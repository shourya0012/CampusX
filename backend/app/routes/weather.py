from datetime import datetime, timezone
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from app.auth.firebase_auth import AuthenticatedUser, get_current_user

router = APIRouter(prefix="/api", tags=["weather"])

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

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


@router.get("/weather")
async def get_weather(
    city: str = Query(..., min_length=1, description="City name to look up"),
    _current_user: AuthenticatedUser = Depends(get_current_user),
):
    clean_city = city.strip()
    if not clean_city:
        raise HTTPException(status_code=400, detail="Please enter a valid city name.")

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            geo_resp = await client.get(
                GEOCODING_URL,
                params={
                    "name": clean_city,
                    "count": 1,
                    "language": "en",
                    "format": "json",
                },
            )
            if geo_resp.status_code >= 400:
                raise HTTPException(
                    status_code=502,
                    detail=f"Open-Meteo geocoding returned an upstream error (HTTP {geo_resp.status_code}).",
                )

            geo_data = geo_resp.json()
            results = geo_data.get("results") or []
            if not results:
                raise HTTPException(
                    status_code=404,
                    detail=f"City '{clean_city}' was not found. Please check the spelling and try again.",
                )

            location = results[0]
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
        raise HTTPException(
            status_code=504,
            detail="Open-Meteo weather service timed out. Please try again in a moment.",
        )
    except httpx.RequestError:
        raise HTTPException(
            status_code=502,
            detail="Could not reach Open-Meteo API. Check server internet connectivity.",
        )

    if weather_resp.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Open-Meteo forecast returned an upstream error (HTTP {weather_resp.status_code}).",
        )

    forecast = weather_resp.json()
    current = forecast.get("current")
    if not current:
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

    return {
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
    }
