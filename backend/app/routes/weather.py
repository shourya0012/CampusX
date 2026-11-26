from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
import logging
from pathlib import Path
import tempfile
import time
from typing import Any
import weakref

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.firebase_auth import AuthenticatedUser, get_current_user

router = APIRouter(prefix="/api", tags=["weather"])
logger = logging.getLogger("campusx.weather")

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

WEATHER_CACHE_TTL_SECONDS = 600  # 10 minutes
GEO_CACHE_TTL_SECONDS = 86400  # 24 hours
MAX_CACHE_ENTRIES = 128
DEFAULT_RETRY_AFTER_SECONDS = 60
MAX_RETRY_AFTER_SECONDS = 300
_DISK_CACHE_PATH = Path(tempfile.gettempdir()) / "campusx_weather_cache.json"

# Exact coordinates verified from Open-Meteo Geocoding API to avoid extra geocoding calls
_KNOWN_CITY_LOCATIONS: dict[str, dict[str, Any]] = {
    "jaipur": {"name": "Jaipur", "admin1": "Rajasthan", "country_code": "IN", "latitude": 26.91962, "longitude": 75.78781},
    "bengaluru": {"name": "Bengaluru", "admin1": "Karnataka", "country_code": "IN", "latitude": 12.97194, "longitude": 77.59369},
    "bangalore": {"name": "Bengaluru", "admin1": "Karnataka", "country_code": "IN", "latitude": 12.97194, "longitude": 77.59369},
    "mumbai": {"name": "Mumbai", "admin1": "Maharashtra", "country_code": "IN", "latitude": 19.07283, "longitude": 72.88261},
    "delhi": {"name": "Delhi", "admin1": "National Capital Territory of Delhi", "country_code": "IN", "latitude": 28.65195, "longitude": 77.23149},
    "new delhi": {"name": "New Delhi", "admin1": "National Capital Territory of Delhi", "country_code": "IN", "latitude": 28.6139, "longitude": 77.209},
    "london": {"name": "London", "admin1": "England", "country_code": "GB", "latitude": 51.50853, "longitude": -0.12574},
    "tokyo": {"name": "Tokyo", "admin1": "Tokyo", "country_code": "JP", "latitude": 35.6895, "longitude": 139.69171},
}

_loop_locks: "weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, asyncio.Lock]" = weakref.WeakKeyDictionary()
_weather_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_geo_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_inflight_city_tasks: dict[str, asyncio.Task[dict[str, Any]]] = {}
_rate_limited_until: float = 0.0
_disk_loaded: bool = False

WMO_WEATHER_CODES: dict[int, tuple[str, str, str]] = {
    0: ("Clear", "Clear Sky", "clear"),
    1: ("Mainly Clear", "Mainly Clear", "partly-cloudy"),
    2: ("Partly Cloudy", "Partly Cloudy", "partly-cloudy"),
    3: ("Cloudy", "Overcast", "cloudy"),
    45: ("Fog", "Foggy", "fog"),
    48: ("Fog", "Depositing Rime Fog", "fog"),
    51: ("Drizzle", "Light Drizzle", "drizzle"),
    53: ("Drizzle", "Moderate Drizzle", "drizzle"),
    55: ("Drizzle", "Dense Drizzle", "drizzle"),
    56: ("Drizzle", "Light Freezing Drizzle", "drizzle"),
    57: ("Drizzle", "Dense Freezing Drizzle", "drizzle"),
    61: ("Rain", "Slight Rain", "rain"),
    63: ("Rain", "Moderate Rain", "rain"),
    65: ("Rain", "Heavy Rain", "rain"),
    66: ("Rain", "Light Freezing Rain", "rain"),
    67: ("Rain", "Heavy Freezing Rain", "rain"),
    71: ("Snow", "Slight Snow Fall", "snow"),
    73: ("Snow", "Moderate Snow Fall", "snow"),
    75: ("Snow", "Heavy Snow Fall", "snow"),
    77: ("Snow", "Snow Grains", "snow"),
    80: ("Showers", "Slight Rain Showers", "rain"),
    81: ("Showers", "Moderate Rain Showers", "rain"),
    82: ("Showers", "Violent Rain Showers", "rain"),
    85: ("Snow Showers", "Slight Snow Showers", "snow"),
    86: ("Snow Showers", "Heavy Snow Showers", "snow"),
    95: ("Thunderstorm", "Thunderstorm", "thunderstorm"),
    96: ("Thunderstorm", "Thunderstorm with Slight Hail", "thunderstorm"),
    99: ("Thunderstorm", "Thunderstorm with Heavy Hail", "thunderstorm"),
}


def _get_cache_lock() -> asyncio.Lock:
    loop = asyncio.get_running_loop()
    lock = _loop_locks.get(loop)
    if lock is None:
        lock = asyncio.Lock()
        _loop_locks[loop] = lock
    return lock


def _load_disk_cache_once() -> None:
    global _disk_loaded
    if _disk_loaded:
        return
    _disk_loaded = True
    try:
        if not _DISK_CACHE_PATH.exists():
            return
        raw = json.loads(_DISK_CACHE_PATH.read_text(encoding="utf-8"))
        now_wall = time.time()
        now_mono = time.monotonic()

        for key, item in (raw.get("weather") or {}).items():
            saved_wall = float(item.get("wall_ts", 0.0))
            payload = item.get("payload")
            if isinstance(payload, dict) and (now_wall - saved_wall) <= 86400:
                age = max(0.0, now_wall - saved_wall)
                _weather_cache[key] = (now_mono - age, payload)

        for key, item in (raw.get("geo") or {}).items():
            saved_wall = float(item.get("wall_ts", 0.0))
            loc = item.get("location")
            if isinstance(loc, dict) and (now_wall - saved_wall) <= GEO_CACHE_TTL_SECONDS:
                age = max(0.0, now_wall - saved_wall)
                _geo_cache[key] = (now_mono - age, loc)
    except Exception:
        pass


def _save_disk_cache() -> None:
    try:
        now_wall = time.time()
        now_mono = time.monotonic()
        weather_dump = {
            k: {"wall_ts": now_wall - max(0.0, now_mono - ts), "payload": payload}
            for k, (ts, payload) in list(_weather_cache.items())[-MAX_CACHE_ENTRIES:]
        }
        geo_dump = {
            k: {"wall_ts": now_wall - max(0.0, now_mono - ts), "location": loc}
            for k, (ts, loc) in list(_geo_cache.items())[-MAX_CACHE_ENTRIES:]
        }
        _DISK_CACHE_PATH.write_text(
            json.dumps({"weather": weather_dump, "geo": geo_dump}),
            encoding="utf-8",
        )
    except Exception:
        pass


def _map_weather_code(code: int, is_day: bool) -> tuple[str, str, str]:
    condition, description, icon_base = WMO_WEATHER_CODES.get(
        code, ("Cloudy", "Variable Conditions", "cloudy")
    )
    if icon_base in ("clear", "partly-cloudy"):
        icon_key = f"{icon_base}-{'day' if is_day else 'night'}"
    else:
        icon_key = icon_base
    return condition, description, icon_key


def _parse_retry_after(header_value: str | None, response_body: str = "") -> int:
    if header_value:
        cleaned = header_value.strip()
        if cleaned.isdigit():
            return max(5, min(MAX_RETRY_AFTER_SECONDS, int(cleaned)))
        try:
            target = parsedate_to_datetime(cleaned)
            if target.tzinfo is None:
                target = target.replace(tzinfo=timezone.utc)
            delta = int((target - datetime.now(timezone.utc)).total_seconds())
            return max(5, min(MAX_RETRY_AFTER_SECONDS, delta))
        except Exception:
            pass

    lower_body = (response_body or "").lower()
    if "hourly" in lower_body:
        return 180
    if "daily" in lower_body:
        return MAX_RETRY_AFTER_SECONDS
    return DEFAULT_RETRY_AFTER_SECONDS


def _prune_cache(cache: dict[str, tuple[float, dict[str, Any]]]) -> None:
    while len(cache) > MAX_CACHE_ENTRIES:
        oldest_key = min(cache.keys(), key=lambda k: cache[k][0])
        cache.pop(oldest_key, None)


def _get_cached_weather(city_key: str, *, allow_stale: bool = False) -> dict[str, Any] | None:
    _load_disk_cache_once()
    entry = _weather_cache.get(city_key)
    if not entry:
        return None
    cached_at, payload = entry
    age = time.monotonic() - cached_at
    if age <= WEATHER_CACHE_TTL_SECONDS:
        return {**payload, "cached": True, "stale": False}
    if allow_stale:
        return {
            **payload,
            "cached": True,
            "stale": True,
            "notice": "Showing previously cached Open-Meteo weather while the weather service is temporarily busy.",
        }
    return None


def _get_cached_location(city_key: str) -> dict[str, Any] | None:
    _load_disk_cache_once()
    if city_key in _KNOWN_CITY_LOCATIONS:
        return _KNOWN_CITY_LOCATIONS[city_key]
    entry = _geo_cache.get(city_key)
    if entry and (time.monotonic() - entry[0]) <= GEO_CACHE_TTL_SECONDS:
        return entry[1]
    return None


def _raise_rate_limit(wait_seconds: int) -> None:
    wait_clamped = max(1, int(wait_seconds))
    raise HTTPException(
        status_code=429,
        detail=(
            f"Weather service is temporarily rate-limited by Open-Meteo. "
            f"Please wait {wait_clamped} seconds and try again."
        ),
        headers={"Retry-After": str(wait_clamped)},
    )


def _record_upstream_429(endpoint: str, resp: httpx.Response) -> int:
    global _rate_limited_until
    retry_header = resp.headers.get("Retry-After")
    body_preview = (resp.text or "")[:500]
    retry_s = _parse_retry_after(retry_header, body_preview)
    _rate_limited_until = max(_rate_limited_until, time.monotonic() + retry_s)
    logger.warning(
        "Open-Meteo HTTP 429 from %s | Retry-After=%r -> cooldown=%ss | body=%s",
        endpoint,
        retry_header,
        retry_s,
        body_preview,
    )
    return retry_s


async def _fetch_weather_from_open_meteo(clean_city: str, city_key: str) -> dict[str, Any]:
    global _rate_limited_until

    now = time.monotonic()
    if now < _rate_limited_until:
        wait_seconds = max(1, int(_rate_limited_until - now))
        stale = _get_cached_weather(city_key, allow_stale=True)
        if stale is not None:
            return stale
        _raise_rate_limit(wait_seconds)

    try:
        async with httpx.AsyncClient(
            timeout=10.0,
            headers={"User-Agent": "CampusX-Student-Hub/1.0"},
        ) as client:
            location = _get_cached_location(city_key)
            if location is None:
                geo_resp = await client.get(
                    GEOCODING_URL,
                    params={
                        "name": clean_city,
                        "count": 1,
                        "language": "en",
                        "format": "json",
                    },
                )
                if geo_resp.status_code == 429:
                    retry_s = _record_upstream_429(GEOCODING_URL, geo_resp)
                    stale = _get_cached_weather(city_key, allow_stale=True)
                    if stale is not None:
                        return stale
                    _raise_rate_limit(retry_s)

                if geo_resp.status_code >= 400:
                    logger.warning(
                        "Open-Meteo HTTP %s from %s | body=%s",
                        geo_resp.status_code,
                        GEOCODING_URL,
                        (geo_resp.text or "")[:300],
                    )
                    stale = _get_cached_weather(city_key, allow_stale=True)
                    if stale is not None:
                        return stale
                    raise HTTPException(
                        status_code=503,
                        detail="Weather geocoding service is temporarily unavailable. Please try again shortly.",
                    )

                geo_data = geo_resp.json()
                results = geo_data.get("results") or []
                if not results:
                    raise HTTPException(
                        status_code=404,
                        detail=f"City '{clean_city}' was not found. Please check the spelling and try again.",
                    )
                location = results[0]
                _geo_cache[city_key] = (time.monotonic(), location)
                _prune_cache(_geo_cache)
                _save_disk_cache()

            lat = float(location["latitude"])
            lon = float(location["longitude"])
            coord_key = f"coord:{round(lat, 2)}:{round(lon, 2)}"

            # Coordinate-level cache check (e.g. Delhi / New Delhi or Bangalore / Bengaluru)
            coord_cached = _get_cached_weather(coord_key, allow_stale=False)
            if coord_cached is not None:
                _weather_cache[city_key] = (time.monotonic(), coord_cached)
                return {**coord_cached, "cached": True, "stale": False}

            weather_resp = await client.get(
                FORECAST_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": (
                        "temperature_2m,relative_humidity_2m,apparent_temperature,"
                        "is_day,weather_code,wind_speed_10m,surface_pressure"
                    ),
                    "wind_speed_unit": "kmh",
                    "timezone": "auto",
                },
            )
    except HTTPException:
        raise
    except httpx.TimeoutException:
        logger.warning("Open-Meteo request timed out for city=%r", clean_city)
        stale = _get_cached_weather(city_key, allow_stale=True)
        if stale is not None:
            return stale
        raise HTTPException(
            status_code=504,
            detail="Weather service timed out. Please try again in a moment.",
        )
    except httpx.RequestError as exc:
        logger.warning("Open-Meteo network error for city=%r: %s", clean_city, exc)
        stale = _get_cached_weather(city_key, allow_stale=True)
        if stale is not None:
            return stale
        raise HTTPException(
            status_code=503,
            detail="Weather service is temporarily unavailable. Please check connectivity and try again.",
        )

    if weather_resp.status_code == 429:
        retry_s = _record_upstream_429(FORECAST_URL, weather_resp)
        stale = _get_cached_weather(city_key, allow_stale=True)
        if stale is not None:
            return stale
        _raise_rate_limit(retry_s)

    if weather_resp.status_code >= 400:
        logger.warning(
            "Open-Meteo HTTP %s from %s | Retry-After=%r | body=%s",
            weather_resp.status_code,
            FORECAST_URL,
            weather_resp.headers.get("Retry-After"),
            (weather_resp.text or "")[:500],
        )
        stale = _get_cached_weather(city_key, allow_stale=True)
        if stale is not None:
            return stale
        raise HTTPException(
            status_code=503,
            detail="Weather service is temporarily unavailable right now. Please try again in a moment.",
        )

    forecast = weather_resp.json()
    current = forecast.get("current")
    if not current:
        stale = _get_cached_weather(city_key, allow_stale=True)
        if stale is not None:
            return stale
        raise HTTPException(
            status_code=502,
            detail="Open-Meteo returned an incomplete forecast payload.",
        )

    temp_c = round(float(current.get("temperature_2m", 0.0)), 1)
    feels_like_c = round(float(current.get("apparent_temperature", temp_c)), 1)
    humidity = int(round(float(current.get("relative_humidity_2m", 0))))
    wind_kmh = round(float(current.get("wind_speed_10m", 0.0)), 1)
    wind_ms = round(wind_kmh / 3.6, 1)
    pressure_hpa = int(round(float(current.get("surface_pressure", 0))))
    weather_code = int(current.get("weather_code", 3))
    is_day = bool(current.get("is_day", 1))

    condition, description, icon_key = _map_weather_code(weather_code, is_day)

    payload: dict[str, Any] = {
        "city": location.get("name", clean_city),
        "region": location.get("admin1", ""),
        "country": location.get("country_code", ""),
        "latitude": round(lat, 4),
        "longitude": round(lon, 4),
        "temperature_c": temp_c,
        "feels_like_c": feels_like_c,
        "humidity": humidity,
        "pressure_hpa": pressure_hpa,
        "wind_speed_kmh": wind_kmh,
        "wind_speed_ms": wind_ms,
        "weather_code": weather_code,
        "condition": condition,
        "description": description,
        "icon": icon_key,
        "is_day": is_day,
        "provider": "Open-Meteo",
        "attribution_url": "https://open-meteo.com/",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "cached": False,
        "stale": False,
    }

    now_store = time.monotonic()
    _weather_cache[city_key] = (now_store, payload)
    _weather_cache[f"coord:{round(lat, 2)}:{round(lon, 2)}"] = (now_store, payload)
    resolved_key = str(payload["city"]).strip().lower()
    if resolved_key and resolved_key != city_key:
        _weather_cache[resolved_key] = (now_store, payload)
    _prune_cache(_weather_cache)
    _save_disk_cache()
    return payload


@router.get("/weather")
async def get_weather(
    city: str = Query(..., min_length=1, description="City name to look up"),
    _current_user: AuthenticatedUser = Depends(get_current_user),
):
    clean_city = " ".join(city.split())
    if not clean_city:
        raise HTTPException(status_code=400, detail="Please enter a valid city name.")

    city_key = clean_city.lower()

    # 1. Fast shared 10-minute backend cache hit across all users/cities
    cached_payload = _get_cached_weather(city_key, allow_stale=False)
    if cached_payload is not None:
        return cached_payload

    # 2. Check global rate-limit cooldown BEFORE opening upstream tasks
    now = time.monotonic()
    if now < _rate_limited_until:
        wait_seconds = max(1, int(_rate_limited_until - now))
        stale = _get_cached_weather(city_key, allow_stale=True)
        if stale is not None:
            return stale
        _raise_rate_limit(wait_seconds)

    # 3. Single-flight deduplication for concurrent searches of the same city
    cache_lock = _get_cache_lock()
    async with cache_lock:
        cached_payload = _get_cached_weather(city_key, allow_stale=False)
        if cached_payload is not None:
            return cached_payload

        task = _inflight_city_tasks.get(city_key)
        if task is not None and task.get_loop() is not asyncio.get_running_loop():
            task = None
        is_owner = task is None
        if is_owner:
            task = asyncio.create_task(_fetch_weather_from_open_meteo(clean_city, city_key))
            _inflight_city_tasks[city_key] = task

    try:
        return await task
    finally:
        if is_owner:
            async with cache_lock:
                if _inflight_city_tasks.get(city_key) is task:
                    _inflight_city_tasks.pop(city_key, None)
