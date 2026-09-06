import requests
from datetime import datetime, timezone
from typing import Any, Optional


# ============================================================
# API ENDPOINTS
# ============================================================

MARINE_API = "https://marine-api.open-meteo.com/v1/marine"
WEATHER_API = "https://api.open-meteo.com/v1/forecast"


# ============================================================
# MAIN FUNCTION
# ============================================================

def fetch_marine_weather(
    latitude: float,
    longitude: float,
    requested_date: Optional[str] = None,
) -> dict[str, Any]:
    """
    Fetch marine weather conditions for a given latitude, longitude, and requested date.
    
    Strict Date Integrity Rules:
    - If requested_date is today or not specified: fetches current/forecast conditions.
    - If requested_date is a future date within provider forecast horizon (0 to 7 days):
      fetches forecast specifically covering that target date.
    - If requested_date is outside the forecast horizon:
      returns structured unavailable result without falling back to today's weather.
    """

    # ========================================================
    # VALIDATE COORDINATES
    # ========================================================

    if not isinstance(latitude, (int, float)):
        raise TypeError("Latitude must be a number.")

    if not isinstance(longitude, (int, float)):
        raise TypeError("Longitude must be a number.")

    if not (-90 <= latitude <= 90):
        raise ValueError("Latitude must be between -90 and 90.")

    if not (-180 <= longitude <= 180):
        raise ValueError("Longitude must be between -180 and 180.")

    # ========================================================
    # TARGET DATE & HORIZON VALIDATION
    # ========================================================

    today_utc = datetime.now(timezone.utc).date()
    today_str = today_utc.strftime("%Y-%m-%d")

    if not requested_date or not str(requested_date).strip():
        target_date_str = today_str
    else:
        target_date_str = str(requested_date).strip()

    try:
        req_date_obj = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    except ValueError:
        return {
            "agent": "marine_weather",
            "status": "unavailable",
            "requested_date": requested_date,
            "data_date": None,
            "valid_from": None,
            "valid_to": None,
            "date_match": False,
            "reason": f"Invalid requested_date format '{requested_date}', expected 'YYYY-MM-DD'.",
        }

    days_diff = (req_date_obj - today_utc).days

    # Open-Meteo Marine standard forecast horizon is 7 days ahead
    if days_diff < 0 or days_diff > 7:
        return {
            "agent": "marine_weather",
            "status": "unavailable",
            "requested_date": target_date_str,
            "data_date": None,
            "valid_from": None,
            "valid_to": None,
            "date_match": False,
            "reason": f"Requested date '{target_date_str}' is outside the available forecast horizon (0 to 7 days).",
        }

    is_today = (days_diff == 0)

    # ========================================================
    # WEATHER & MARINE API PARAMS FOR TARGET DATE
    # ========================================================

    weather_params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": target_date_str,
        "end_date": target_date_str,
        "hourly": (
            "temperature_2m,"
            "relative_humidity_2m,"
            "precipitation,"
            "rain,"
            "weather_code,"
            "wind_speed_10m,"
            "wind_direction_10m,"
            "wind_gusts_10m"
        ),
        "wind_speed_unit": "kn",
        "timezone": "auto",
    }
    if is_today:
        weather_params["current"] = (
            "temperature_2m,"
            "relative_humidity_2m,"
            "precipitation,"
            "rain,"
            "weather_code,"
            "wind_speed_10m,"
            "wind_direction_10m,"
            "wind_gusts_10m"
        )

    marine_params = {
        "latitude": latitude,
        "longitude": longitude,
        "start_date": target_date_str,
        "end_date": target_date_str,
        "hourly": (
            "wave_height,"
            "wave_direction,"
            "wave_period,"
            "sea_surface_temperature,"
            "ocean_current_velocity,"
            "ocean_current_direction"
        ),
        "timezone": "auto",
    }
    if is_today:
        marine_params["current"] = (
            "wave_height,"
            "wave_direction,"
            "wave_period,"
            "sea_surface_temperature,"
            "ocean_current_velocity,"
            "ocean_current_direction"
        )

    # ========================================================
    # EXECUTE API CALLS
    # ========================================================

    try:
        weather_response = requests.get(WEATHER_API, params=weather_params, timeout=15)
        if weather_response.status_code == 400:
            return {
                "agent": "marine_weather",
                "status": "unavailable",
                "requested_date": target_date_str,
                "data_date": None,
                "valid_from": None,
                "valid_to": None,
                "date_match": False,
                "reason": "Requested date is outside the available forecast horizon",
            }
        weather_response.raise_for_status()
        weather_data = weather_response.json()
    except requests.RequestException as exc:
        return {
            "agent": "marine_weather",
            "status": "unavailable",
            "requested_date": target_date_str,
            "data_date": None,
            "valid_from": None,
            "valid_to": None,
            "date_match": False,
            "reason": f"Weather API request failed: {exc}",
        }

    try:
        marine_response = requests.get(MARINE_API, params=marine_params, timeout=15)
        if marine_response.status_code == 400:
            return {
                "agent": "marine_weather",
                "status": "unavailable",
                "requested_date": target_date_str,
                "data_date": None,
                "valid_from": None,
                "valid_to": None,
                "date_match": False,
                "reason": "Requested date is outside the available forecast horizon",
            }
        marine_response.raise_for_status()
        marine_data = marine_response.json()
    except requests.RequestException as exc:
        return {
            "agent": "marine_weather",
            "status": "unavailable",
            "requested_date": target_date_str,
            "data_date": None,
            "valid_from": None,
            "valid_to": None,
            "date_match": False,
            "reason": f"Marine API request failed: {exc}",
        }

    # ========================================================
    # EXTRACT WEATHER & MARINE DATA FOR TARGET DATE
    # ========================================================

    weather_hourly = weather_data.get("hourly", {})
    marine_hourly = marine_data.get("hourly", {})

    weather_current = weather_data.get("current", {}) if is_today else {}
    marine_current = marine_data.get("current", {}) if is_today else {}

    # Calculate representative forecast values for the requested target date
    temp_list = [v for v in weather_hourly.get("temperature_2m", []) if v is not None]
    wind_list = [v for v in weather_hourly.get("wind_speed_10m", []) if v is not None]
    gust_list = [v for v in weather_hourly.get("wind_gusts_10m", []) if v is not None]
    wcode_list = [v for v in weather_hourly.get("weather_code", []) if v is not None]

    wave_list = [v for v in marine_hourly.get("wave_height", []) if v is not None]
    period_list = [v for v in marine_hourly.get("wave_period", []) if v is not None]
    sst_list = [v for v in marine_hourly.get("sea_surface_temperature", []) if v is not None]
    current_list = [v for v in marine_hourly.get("ocean_current_velocity", []) if v is not None]
    current_dir_list = [v for v in marine_hourly.get("ocean_current_direction", []) if v is not None]

    # Peak values for safety hazards, average for continuous conditions
    wind_speed = weather_current.get("wind_speed_10m") if is_today and weather_current.get("wind_speed_10m") is not None else (max(wind_list) if wind_list else None)
    wind_gusts = weather_current.get("wind_gusts_10m") if is_today and weather_current.get("wind_gusts_10m") is not None else (max(gust_list) if gust_list else None)
    temp_c = weather_current.get("temperature_2m") if is_today and weather_current.get("temperature_2m") is not None else (round(sum(temp_list)/len(temp_list), 1) if temp_list else None)
    weather_code = weather_current.get("weather_code") if is_today and weather_current.get("weather_code") is not None else (max(wcode_list) if wcode_list else 0)

    wave_height = marine_current.get("wave_height") if is_today and marine_current.get("wave_height") is not None else (max(wave_list) if wave_list else None)
    wave_period = marine_current.get("wave_period") if is_today and marine_current.get("wave_period") is not None else (round(sum(period_list)/len(period_list), 1) if period_list else None)
    sst = marine_current.get("sea_surface_temperature") if is_today and marine_current.get("sea_surface_temperature") is not None else (round(sum(sst_list)/len(sst_list), 1) if sst_list else None)
    ocean_current_vel = marine_current.get("ocean_current_velocity") if is_today and marine_current.get("ocean_current_velocity") is not None else (max(current_list) if current_list else None)

    valid_from = f"{target_date_str}T00:00:00Z"
    valid_to = f"{target_date_str}T23:59:59Z"

    return {
        "agent": "marine_weather",
        "status": "success",
        "requested_date": target_date_str,
        "data_date": target_date_str,
        "valid_from": valid_from,
        "valid_to": valid_to,
        "date_match": True,

        "location": {
            "latitude": latitude,
            "longitude": longitude,
        },

        "weather": {
            "time": weather_current.get("time") or f"{target_date_str}T12:00",
            "temperature_c": temp_c,
            "relative_humidity_percent": weather_current.get("relative_humidity_2m"),
            "precipitation_mm": weather_current.get("precipitation"),
            "rain_mm": weather_current.get("rain"),
            "weather_code": weather_code,
            "wind_speed_knots": wind_speed,
            "wind_direction_degrees": weather_current.get("wind_direction_10m"),
            "wind_gusts_knots": wind_gusts,
        },

        "marine": {
            "time": marine_current.get("time") or f"{target_date_str}T12:00",
            "wave_height_m": wave_height,
            "wave_direction_degrees": marine_current.get("wave_direction"),
            "wave_period_seconds": wave_period,
            "sea_surface_temperature_c": sst,
            "ocean_current_velocity_kmh": ocean_current_vel,
            "ocean_current_direction_degrees": marine_current.get("ocean_current_direction") or (current_dir_list[0] if current_dir_list else None),
        },

        "source": {
            "weather_provider": "Open-Meteo",
            "marine_provider": "Open-Meteo Marine",
            "weather_endpoint": WEATHER_API,
            "marine_endpoint": MARINE_API,
        },
    }


# ============================================================
# LOCAL TEST
# ============================================================

if __name__ == "__main__":
    latitude = 19.72
    longitude = 72.70

    print("=" * 70)
    print("ORCA MARINE WEATHER TOOL TEST")
    print("=" * 70)

    try:
        result = fetch_marine_weather(
            latitude=latitude,
            longitude=longitude,
            requested_date="2026-09-07",
        )
        print("\nTEST FUTURE DATE RESULT:")
        print(result)

    except Exception as exc:
        print(f"\nERROR: {exc}")