
import requests
from typing import Optional, Dict, Any


WEATHER_API = "https://api.open-meteo.com/v1/forecast"
MARINE_API = "https://marine-api.open-meteo.com/v1/marine"


def fetch_weather(
    lat: float,
    lon: float,
    forecast_days: int = 7
) -> Optional[Dict[str, Any]]:
    """
    Fetch current + hourly atmospheric weather.

    Includes:
    - Temperature
    - Humidity
    - Pressure
    - Rain
    - Precipitation probability
    - Weather code
    - Wind speed
    - Wind direction
    - Wind gusts
    - Cloud cover
    """

    params = {
        "latitude": lat,
        "longitude": lon,

        "current": (
            "temperature_2m,"
            "relative_humidity_2m,"
            "apparent_temperature,"
            "precipitation,"
            "rain,"
            "showers,"
            "weather_code,"
            "cloud_cover,"
            "pressure_msl,"
            "wind_speed_10m,"
            "wind_direction_10m,"
            "wind_gusts_10m"
        ),

        "hourly": (
            "temperature_2m,"
            "relative_humidity_2m,"
            "precipitation_probability,"
            "precipitation,"
            "rain,"
            "showers,"
            "weather_code,"
            "cloud_cover,"
            "pressure_msl,"
            "wind_speed_10m,"
            "wind_direction_10m,"
            "wind_gusts_10m"
        ),

        "forecast_days": forecast_days,
        "timezone": "Asia/Kolkata",
        "wind_speed_unit": "kmh",
        "temperature_unit": "celsius",
        "precipitation_unit": "mm"
    }

    try:
        response = requests.get(
            WEATHER_API,
            params=params,
            timeout=20
        )

        response.raise_for_status()

        return response.json()

    except requests.RequestException as e:
        print(f"Weather API error: {e}")
        return None


def fetch_marine(
    lat: float,
    lon: float,
    forecast_days: int = 7
) -> Optional[Dict[str, Any]]:
    """
    Fetch marine/ocean conditions.

    Includes:
    - Wave height
    - Wave direction
    - Wave period
    - Wind-wave height
    - Swell height
    - Swell direction
    - Swell period
    - Sea surface temperature
    - Ocean current velocity
    - Ocean current direction
    - Sea level height
    """

    params = {
        "latitude": lat,
        "longitude": lon,

        "current": (
            "wave_height,"
            "wave_direction,"
            "wave_period,"
            "swell_wave_height,"
            "swell_wave_direction,"
            "swell_wave_period,"
            "sea_surface_temperature,"
            "ocean_current_velocity,"
            "ocean_current_direction,"
            "sea_level_height_msl"
        ),

        "hourly": (
            "wave_height,"
            "wave_direction,"
            "wave_period,"
            "wind_wave_height,"
            "wind_wave_direction,"
            "swell_wave_height,"
            "swell_wave_direction,"
            "swell_wave_period,"
            "sea_surface_temperature,"
            "ocean_current_velocity,"
            "ocean_current_direction,"
            "sea_level_height_msl"
        ),

        "forecast_days": forecast_days,
        "timezone": "Asia/Kolkata",
        "length_unit": "metric",
        "cell_selection": "sea"
    }

    try:
        response = requests.get(
            MARINE_API,
            params=params,
            timeout=20
        )

        response.raise_for_status()

        return response.json()

    except requests.RequestException as e:
        print(f"Marine API error: {e}")
        return None


def fetch_marine_weather(
    lat: float,
    lon: float,
    forecast_days: int = 7
) -> Dict[str, Any]:
    """
    Main ORCA function.

    Combines atmospheric weather + marine conditions.
    """

    weather = fetch_weather(
        lat,
        lon,
        forecast_days
    )

    marine = fetch_marine(
        lat,
        lon,
        forecast_days
    )

    return {
        "location": {
            "latitude": lat,
            "longitude": lon
        },

        "weather": weather,

        "marine": marine
    }


if __name__ == "__main__":

    # Example:
    # Nearest point of your PFZ #1
    lat = 9.667579
    lon = 75.347628

    print("=" * 60)
    print("ORCA MARINE WEATHER TEST")
    print("=" * 60)

    result = fetch_marine_weather(
        lat,
        lon,
        forecast_days=7
    )

    if result["weather"]:
        print("\n✓ Weather data received")

        print(
            "Current:",
            result["weather"].get("current")
        )

    else:
        print("\n✗ Weather data unavailable")

    if result["marine"]:
        print("\n✓ Marine data received")

        print(
            "Current:",
            result["marine"].get("current")
        )

    else:
        print("\n✗ Marine data unavailable")

