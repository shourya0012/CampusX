from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.firebase_auth import AuthenticatedUser, get_current_user

router = APIRouter(prefix="/api", tags=["weather"])

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

WEATHER_CACHE_TTL_SECONDS = 600  # 10 minutes
GEO_CACHE_TTL_SECONDS = 3600  # 1 hour
MAX_CACHE_ENTRIES = 128
DEFAULT_RETRY_AFTER_SECONDS = 60
MAX_RETRY_AFTER_SECONDS = 300

_cache_lock = asyncio.Lock()
_weather_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_geo_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_inflight_city_tasks: dict[str, asyncio.Task[dict[str, Any]]] = {}
_rate_limited_until: float = 0.0

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


def _map_weather_code(code: int, is_day: bool) -> tuple[str, str, str]:
    condition, description, icon_base = WMO_WEATHER_CODES.get(
        code, ("Cloudy", "Variable Conditions", "cloudy")
    )
    if icon_base in ("clear", "partly-cloudy"):
        icon_key = f"{icon_base}-{'day' if is_day else 'night'}"
    else:
        icon_key = icon_base
    return condition, description, icon_key


def _parse_retry_after(header_value: str | None) -> int:
    if not header_value:
        return DEFAULT_RETRY_AFTER_SECONDS
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
        return DEFAULT_RETRY_AFTER_SECONDS


def _prune_cache(cache: dict[str, tuple[float, dict[str, Any]]]) -> None:
    if len(cache) <= MAX_CACHE_ENTRIES:
        return
    # Evict oldest inserted/updated entry to keep RAM bounded on 512 MB instances
    oldest_key = min(cache.keys(), key=lambda k: cache[k][0])
    cache.pop(oldest_key, None)


def _get_cached_weather(city_key: str, *, allow_stale: bool = False) -> dict[str, Any] | None:
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
            "notice": "Showing recently cached weather while Open-Meteo is temporarily unavailable.",
        }
    return None


async def _fetch_weather_from_open_meteo(clean_city: str, city_key: str) -> dict[str, Any]:
    global _rate_limited_until

    now = time.monotonic()
    if now < _rate_limited_until:
        wait_seconds = max(1, int(_rate_limited_until - now))
        stale = _get_cached_weather(city_key, allow_stale=True)
        if stale is not None:
            return stale
        raise HTTPException(
            status_code=429,
            detail=(
                f"Weather service is temporarily rate-limited by Open-Meteo. "
                f"Please wait {wait_seconds} seconds and try again."
            ),
            headers={"Retry-After": str(wait_seconds)},
        )

    headers = {"User-Agent": "CampusX-Student-Hub/1.0"}
    try:
        async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
            # Reuse cached coordinates if available so repeated/refreshed calls skip geocoding
            geo_entry = _geo_cache.get(city_key)
            location: dict[str, Any] | None = None
            if geo_entry and (time.monotonic() - geo_entry[0]) <= GEO_CACHE_TTL_SECONDS:
                location = geo_entry[1]
            else:
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
                    retry_s = _parse_retry_after(geo_resp.headers.get("Retry-After"))
                    _rate_limited_until = time.monotonic() + retry_s
                    stale = _get_cached_weather(city_key, allow_stale=True)
                    if stale is not None:
                        return stale
                    raise HTTPException(
                        status_code=429,
                        detail=(
                            f"Weather lookup is temporarily rate-limited. "
                            f"Please wait {retry_s} seconds and try again."
                        ),
                        headers={"Retry-After": str(retry_s)},
                    )
                if geo_resp.status_code >= 400:
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

            lat = location["latitude"]
            lon = location["longitude"]

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
        stale = _get_cached_weather(city_key, allow_stale=True)
        if stale is not None:
            return stale
        raise HTTPException(
            status_code=504,
            detail="Weather service timed out. Please try again in a moment.",
        )
    except httpx.RequestError:
        stale = _get_cached_weather(city_key, allow_stale=True)
        if stale is not None:
            return stale
        raise HTTPException(
            status_code=503,
            detail="Weather service is temporarily unavailable. Please check connectivity and try again.",
        )

    if weather_resp.status_code == 429:
        retry_s = _parse_retry_after(weather_resp.headers.get("Retry-After"))
        _rate_limited_until = time.monotonic() + retry_s
        stale = _get_cached_weather(city_key, allow_stale=True)
        if stale is not None:
            return stale
        raise HTTPException(
            status_code=429,
            detail=(
                f"Weather service is temporarily rate-limited. "
                f"Please wait {retry_s} seconds and try again."
            ),
            headers={"Retry-After": str(retry_s)},
        )

    if weather_resp.status_code >= 400:
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
        "latitude": round(float(lat), 4),
        "longitude": round(float(lon), 4),
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
    resolved_key = str(payload["city"]).strip().lower()
    if resolved_key and resolved_key != city_key:
        _weather_cache[resolved_key] = (now_store, payload)
    _prune_cache(_weather_cache)
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

    # Fast cache hit before deduplicating or hitting Open-Meteo
    cached_payload = _get_cached_weather(city_key, allow_stale=False)
    if cached_payload is not None:
        return cached_payload

    # Single-flight deduplication for concurrent searches of the same city
    async with _cache_lock:
        cached_payload = _get_cached_weather(city_key, allow_stale=False)
        if cached_payload is not None:
            return cached_payload

        task = _inflight_city_tasks.get(city_key)
        is_owner = task is None
        if is_owner:
            task = asyncio.create_task(_fetch_weather_from_open_meteo(clean_city, city_key))
            _inflight_city_tasks[city_key] = task

    try:
        return await task
    finally:
        if is_owner:
            async with _cache_lock:
                if _inflight_city_tasks.get(city_key) is task:
                    _inflight_city_tasks.pop(city_key, None)
