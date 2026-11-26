from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
import time
from typing import Any
import weakref

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.firebase_auth import AuthenticatedUser, get_current_user
from app.config import settings

router = APIRouter(prefix="/api", tags=["weather"])
logger = logging.getLogger("campusx.weather")

WEATHERAPI_CURRENT_URL = "https://api.weatherapi.com/v1/current.json"
WEATHER_CACHE_TTL_SECONDS = 600  # 10 minutes
MAX_CACHE_ENTRIES = 128

_loop_locks: "weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, asyncio.Lock]" = weakref.WeakKeyDictionary()
_weather_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_inflight_city_tasks: dict[str, asyncio.Task[dict[str, Any]]] = {}


def _get_cache_lock() -> asyncio.Lock:
    loop = asyncio.get_running_loop()
    lock = _loop_locks.get(loop)
    if lock is None:
        lock = asyncio.Lock()
        _loop_locks[loop] = lock
    return lock


def _map_weatherapi_code(code: int, is_day: bool, text: str) -> str:
    if code == 1000:
        return "clear-day" if is_day else "clear-night"
    if code == 1003:
        return "partly-cloudy-day" if is_day else "partly-cloudy-night"
    if code in (1006, 1009):
        return "cloudy"
    if code in (1030, 1135, 1147):
        return "fog"
    if code in (1063, 1072, 1150, 1153, 1168, 1171):
        return "drizzle"
    if code in (1087, 1273, 1276, 1279, 1282):
        return "thunderstorm"
    if code in (
        1066,
        1069,
        1114,
        1117,
        1204,
        1207,
        1210,
        1213,
        1216,
        1219,
        1222,
        1225,
        1237,
        1249,
        1252,
        1255,
        1258,
        1261,
        1264,
    ):
        return "snow"
    if code in (1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1240, 1243, 1246):
        return "rain"

    lower_text = (text or "").lower()
    if "thunder" in lower_text:
        return "thunderstorm"
    if "snow" in lower_text or "sleet" in lower_text or "blizzard" in lower_text:
        return "snow"
    if "drizzle" in lower_text:
        return "drizzle"
    if "rain" in lower_text or "shower" in lower_text:
        return "rain"
    if "fog" in lower_text or "mist" in lower_text or "haze" in lower_text:
        return "fog"
    if "cloud" in lower_text or "overcast" in lower_text:
        return "cloudy"
    if "clear" in lower_text or "sunny" in lower_text:
        return "clear-day" if is_day else "clear-night"
    return "partly-cloudy-day" if is_day else "partly-cloudy-night"


def _prune_cache() -> None:
    while len(_weather_cache) > MAX_CACHE_ENTRIES:
        oldest_key = min(_weather_cache.keys(), key=lambda k: _weather_cache[k][0])
        _weather_cache.pop(oldest_key, None)


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
            "notice": "Showing recently cached WeatherAPI data while the weather service is temporarily unavailable.",
        }
    return None


async def _fetch_weather_from_weatherapi(clean_city: str, city_key: str) -> dict[str, Any]:
    api_key = settings.WEATHERAPI_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="WEATHERAPI_API_KEY is not configured on the backend server. Add it in Render or backend/.env.",
        )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                WEATHERAPI_CURRENT_URL,
                params={
                    "key": api_key,
                    "q": clean_city,
                    "aqi": "no",
                },
            )
    except httpx.TimeoutException:
        logger.warning("WeatherAPI request timed out for city=%r", clean_city)
        stale = _get_cached_weather(city_key, allow_stale=True)
        if stale is not None:
            return stale
        raise HTTPException(
            status_code=504,
            detail="WeatherAPI request timed out. Please try again in a moment.",
        )
    except httpx.RequestError as exc:
        logger.warning("WeatherAPI network error for city=%r: %s", clean_city, exc)
        stale = _get_cached_weather(city_key, allow_stale=True)
        if stale is not None:
            return stale
        raise HTTPException(
            status_code=503,
            detail="Unable to reach WeatherAPI right now. Please check network connectivity and try again.",
        )

    if resp.status_code >= 400:
        err_code = None
        err_msg = ""
        try:
            err_payload = resp.json().get("error") or {}
            err_code = err_payload.get("code")
            err_msg = str(err_payload.get("message") or "")
        except Exception:
            err_payload = {}

        logger.warning(
            "WeatherAPI returned HTTP %s (code=%s) for city=%r: %s",
            resp.status_code,
            err_code,
            clean_city,
            err_msg or resp.reason_phrase,
        )

        # 1006 = No matching location found
        if err_code == 1006:
            raise HTTPException(
                status_code=404,
                detail=f"City '{clean_city}' was not found. Please check the spelling and try again.",
            )

        # 1003 / 1005 = Missing or invalid query parameter
        if err_code in (1003, 1005):
            raise HTTPException(
                status_code=400,
                detail="Please enter a valid city name.",
            )

        # 2007 = API key has exceeded monthly quota, or HTTP 429
        if err_code == 2007 or resp.status_code == 429:
            stale = _get_cached_weather(city_key, allow_stale=True)
            if stale is not None:
                return stale
            raise HTTPException(
                status_code=429,
                detail="WeatherAPI request quota exceeded. Please try again later.",
            )

        # 1002 / 2006 / 2008 / 2009 = Missing/invalid/disabled key or access denied
        if err_code in (1002, 2006, 2008, 2009) or resp.status_code in (401, 403):
            raise HTTPException(
                status_code=502,
                detail="WeatherAPI rejected the backend API key or plan permissions. Please check WEATHERAPI_API_KEY.",
            )

        stale = _get_cached_weather(city_key, allow_stale=True)
        if stale is not None:
            return stale
        raise HTTPException(
            status_code=503,
            detail="WeatherAPI service is temporarily unavailable. Please try again in a moment.",
        )

    data = resp.json()
    location = data.get("location") or {}
    current = data.get("current") or {}
    condition_obj = current.get("condition") or {}
    if not location or not current:
        raise HTTPException(
            status_code=502,
            detail="WeatherAPI returned an incomplete weather payload.",
        )

    temp_c = round(float(current.get("temp_c", 0.0)), 1)
    feels_like_c = round(float(current.get("feelslike_c", temp_c)), 1)
    humidity = int(round(float(current.get("humidity", 0))))
    wind_kmh = round(float(current.get("wind_kph", 0.0)), 1)
    wind_ms = round(wind_kmh / 3.6, 1)
    pressure_hpa = int(round(float(current.get("pressure_mb", 0))))
    weather_code = int(condition_obj.get("code", 1003))
    condition_text = str(condition_obj.get("text") or "Partly Cloudy").strip()
    is_day = bool(current.get("is_day", 1))
    raw_icon_url = str(condition_obj.get("icon") or "").strip()
    icon_url = f"https:{raw_icon_url}" if raw_icon_url.startswith("//") else raw_icon_url

    icon_key = _map_weatherapi_code(weather_code, is_day, condition_text)

    payload: dict[str, Any] = {
        "city": str(location.get("name") or clean_city),
        "region": str(location.get("region") or ""),
        "country": str(location.get("country") or ""),
        "latitude": round(float(location.get("lat", 0.0)), 4),
        "longitude": round(float(location.get("lon", 0.0)), 4),
        "temperature_c": temp_c,
        "feels_like_c": feels_like_c,
        "humidity": humidity,
        "pressure_hpa": pressure_hpa,
        "wind_speed_kmh": wind_kmh,
        "wind_speed_ms": wind_ms,
        "weather_code": weather_code,
        "condition": condition_text,
        "description": condition_text,
        "icon": icon_key,
        "icon_url": icon_url,
        "is_day": is_day,
        "provider": "WeatherAPI",
        "attribution_url": "https://www.weatherapi.com/",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "cached": False,
        "stale": False,
    }

    now_store = time.monotonic()
    _weather_cache[city_key] = (now_store, payload)
    resolved_key = payload["city"].strip().lower()
    if resolved_key and resolved_key != city_key:
        _weather_cache[resolved_key] = (now_store, payload)
    _prune_cache()
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

    cached_payload = _get_cached_weather(city_key, allow_stale=False)
    if cached_payload is not None:
        return cached_payload

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
            task = asyncio.create_task(_fetch_weather_from_weatherapi(clean_city, city_key))
            _inflight_city_tasks[city_key] = task

    try:
        return await task
    finally:
        if is_owner:
            async with cache_lock:
                if _inflight_city_tasks.get(city_key) is task:
                    _inflight_city_tasks.pop(city_key, None)
