import requests
from typing import Any


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
) -> dict[str, Any]:
    """
    Fetch current weather + marine conditions
    for a given latitude and longitude.

    Returns:
        dict containing:
        - location
        - weather conditions
        - marine conditions
        - data sources
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
    # WEATHER API
    # ========================================================

    weather_params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": (
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

    try:
        weather_response = requests.get(
            WEATHER_API,
            params=weather_params,
            timeout=15,
        )
        weather_response.raise_for_status()
        weather_data = weather_response.json()
    except requests.exceptions.SSLError:
        try:
            weather_response = requests.get(
                WEATHER_API,
                params=weather_params,
                timeout=15,
                verify=False,
            )
            weather_response.raise_for_status()
            weather_data = weather_response.json()
        except requests.RequestException as exc:
            raise RuntimeError(f"Weather API request failed: {exc}") from exc
    except requests.RequestException as exc:
        raise RuntimeError(
            f"Weather API request failed: {exc}"
        ) from exc

    # ========================================================
    # MARINE API
    # ========================================================

    marine_params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": (
            "wave_height,"
            "wave_direction,"
            "wave_period,"
            "sea_surface_temperature,"
            "ocean_current_velocity,"
            "ocean_current_direction"
        ),
        "timezone": "auto",
    }

    try:
        marine_response = requests.get(
            MARINE_API,
            params=marine_params,
            timeout=15,
        )
        marine_response.raise_for_status()
        marine_data = marine_response.json()
    except requests.exceptions.SSLError:
        try:
            marine_response = requests.get(
                MARINE_API,
                params=marine_params,
                timeout=15,
                verify=False,
            )
            marine_response.raise_for_status()
            marine_data = marine_response.json()
        except requests.RequestException as exc:
            raise RuntimeError(f"Marine API request failed: {exc}") from exc
    except requests.RequestException as exc:
        raise RuntimeError(
            f"Marine API request failed: {exc}"
        ) from exc

    # ========================================================
    # EXTRACT CURRENT DATA
    # ========================================================

    weather_current = weather_data.get("current", {})
    marine_current = marine_data.get("current", {})

    # ========================================================
    # RETURN NORMALIZED ORCA RESPONSE
    # ========================================================

    return {
        "agent": "marine_weather",

        "status": "success",

        "location": {
            "latitude": latitude,
            "longitude": longitude,
        },

        "weather": {
            "time": weather_current.get("time"),

            "temperature_c": weather_current.get(
                "temperature_2m"
            ),

            "relative_humidity_percent": weather_current.get(
                "relative_humidity_2m"
            ),

            "precipitation_mm": weather_current.get(
                "precipitation"
            ),

            "rain_mm": weather_current.get(
                "rain"
            ),

            "weather_code": weather_current.get(
                "weather_code"
            ),

            "wind_speed_knots": weather_current.get(
                "wind_speed_10m"
            ),

            "wind_direction_degrees": weather_current.get(
                "wind_direction_10m"
            ),

            "wind_gusts_knots": weather_current.get(
                "wind_gusts_10m"
            ),
        },

        "marine": {
            "time": marine_current.get("time"),

            "wave_height_m": marine_current.get(
                "wave_height"
            ),

            "wave_direction_degrees": marine_current.get(
                "wave_direction"
            ),

            "wave_period_seconds": marine_current.get(
                "wave_period"
            ),

            "sea_surface_temperature_c": marine_current.get(
                "sea_surface_temperature"
            ),

            "ocean_current_velocity_kmh": marine_current.get(
                "ocean_current_velocity"
            ),

            "ocean_current_direction_degrees": marine_current.get(
                "ocean_current_direction"
            ),
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
    print("ORCA MARINE WEATHER TOOL")
    print("=" * 70)

    try:
        result = fetch_marine_weather(
            latitude=latitude,
            longitude=longitude,
        )

        print("\nRESULT:")
        print(result)

    except Exception as exc:
        print(f"\nERROR: {exc}")