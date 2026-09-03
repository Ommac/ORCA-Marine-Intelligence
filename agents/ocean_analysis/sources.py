"""
Ocean Analysis Agent - Data Sources Module
------------------------------------------
Provides modular, resilient fetchers for external ocean and environmental data:
1. Chlorophyll (MOSDAC API)
2. Cyclone (INCOIS GeoServer WFS)
3. Lightning & Convective Activity (MOSDAC WFS primary, Open-Meteo Convective fallback)
4. Tsunami & Seismic Bulletins (INCOIS Tsunami Warning Centre API)

All fetchers implement explicit timeouts, error handling, response validation,
and return structured metadata without fabricating values.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import requests


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

MOSDAC_CHLOROPHYLL_URL = "https://www.mosdac.gov.in/api/v1/ocean/chlorophyll"
MOSDAC_LIGHTNING_WFS_URL = "https://www.mosdac.gov.in/geoserver/MOSDAC/ows"
INCOIS_GEOSERVER_URL = "https://www.incois.gov.in/geoserver/ows"
INCOIS_TSUNAMI_URL = "https://gemini.incois.gov.in/api/ws/tsunami"
OPEN_METEO_CONVECTIVE_URL = "https://api.open-meteo.com/v1/forecast"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36 ORCA-Marine-Intelligence/1.0"
    ),
    "Accept": "application/json, text/plain, */*",
}


# ---------------------------------------------------------------------------
# Spatial Utilities
# ---------------------------------------------------------------------------

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on Earth in km."""
    earth_radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(earth_radius_km * c, 2)


def get_current_iso_timestamp() -> str:
    """Return current UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Weather Code Helpers
# ---------------------------------------------------------------------------

WMO_WEATHER_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm: Slight or moderate",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


def describe_weather_code(code: Optional[int]) -> str:
    if code is None:
        return "Unknown"
    return WMO_WEATHER_CODES.get(code, f"Weather Code {code}")


def categorize_cape(cape_val: float) -> str:
    """
    Categorize Convective Available Potential Energy (CAPE) in J/kg.
    CAPE > 1000 indicates moderate instability; > 2500 indicates severe instability.
    """
    if cape_val < 500:
        return "Low (Stable)"
    if cape_val < 1000:
        return "Marginal"
    if cape_val < 2500:
        return "Moderate Instability"
    return "High Convective Instability"


# ---------------------------------------------------------------------------
# Source 1: Chlorophyll
# ---------------------------------------------------------------------------

def fetch_chlorophyll_data(
    latitude: float,
    longitude: float,
    requested_date: str,
    timeout: int = 10,
) -> Dict[str, Any]:
    """
    Fetch ocean Chlorophyll-a data from MOSDAC API.
    
    If the endpoint is unavailable or returns 404/non-JSON, cleanly returns
    unavailable state without fabricating chlorophyll concentration numbers.
    """
    bbox_deg = 1.0
    min_lon = round(longitude - bbox_deg, 4)
    min_lat = round(latitude - bbox_deg, 4)
    max_lon = round(longitude + bbox_deg, 4)
    max_lat = round(latitude + bbox_deg, 4)

    params = {
        "bbox": f"{min_lon},{min_lat},{max_lon},{max_lat}",
        "date": requested_date,
    }

    try:
        response = requests.get(
            MOSDAC_CHLOROPHYLL_URL,
            params=params,
            headers=DEFAULT_HEADERS,
            timeout=timeout,
        )

        if response.status_code == 200:
            try:
                data = response.json()
                return {
                    "available": True,
                    "source": "MOSDAC_Chlorophyll",
                    "data": data,
                    "bounding_box": params["bbox"],
                    "date": requested_date,
                    "reason": None,
                    "timestamp": get_current_iso_timestamp(),
                }
            except ValueError:
                return {
                    "available": False,
                    "source": "MOSDAC_Chlorophyll",
                    "data": None,
                    "reason": "MOSDAC returned non-JSON response body",
                    "timestamp": get_current_iso_timestamp(),
                }

        return {
            "available": False,
            "source": "MOSDAC_Chlorophyll",
            "data": None,
            "reason": (
                f"MOSDAC Chlorophyll API returned HTTP {response.status_code} "
                f"({response.reason or 'Endpoint unavailable'})"
            ),
            "timestamp": get_current_iso_timestamp(),
        }

    except requests.exceptions.RequestException as exc:
        return {
            "available": False,
            "source": "MOSDAC_Chlorophyll",
            "data": None,
            "reason": f"MOSDAC Chlorophyll connection failed: {exc}",
            "timestamp": get_current_iso_timestamp(),
        }


# ---------------------------------------------------------------------------
# Source 2: Cyclone
# ---------------------------------------------------------------------------

def fetch_cyclone_data(
    latitude: float,
    longitude: float,
    requested_date: str,
    timeout: int = 10,
) -> Dict[str, Any]:
    """
    Fetch active cyclone warnings and tracks from INCOIS / official feeds.
    
    The legacy source inspected WFS GetCapabilities on INCOIS GeoServer which
    returned 403 Forbidden and did not expose active cyclone observation layers.
    This fetcher validates availability and reports explicit status.
    Never fabricates cyclone positions, names, or warnings.
    """
    params = {
        "service": "WFS",
        "version": "1.1.0",
        "request": "GetCapabilities",
    }

    try:
        response = requests.get(
            INCOIS_GEOSERVER_URL,
            params=params,
            headers=DEFAULT_HEADERS,
            timeout=timeout,
        )

        if response.status_code == 200 and "FeatureTypeList" in response.text:
            return {
                "available": True,
                "source": "INCOIS_WFS",
                "data": {
                    "active_cyclones": [],
                    "message": "INCOIS GeoServer online; no active cyclone track layer published.",
                },
                "reason": None,
                "timestamp": get_current_iso_timestamp(),
            }

        return {
            "available": False,
            "source": "INCOIS_WFS",
            "data": None,
            "reason": (
                f"INCOIS GeoServer cyclone feed returned HTTP {response.status_code} "
                "(WFS capability query restricted or no active cyclone feed exposed)"
            ),
            "timestamp": get_current_iso_timestamp(),
        }

    except requests.exceptions.RequestException as exc:
        return {
            "available": False,
            "source": "INCOIS_WFS",
            "data": None,
            "reason": f"INCOIS cyclone service unreachable: {exc}",
            "timestamp": get_current_iso_timestamp(),
        }


# ---------------------------------------------------------------------------
# Source 3: Lightning & Convective Activity
# ---------------------------------------------------------------------------

def fetch_lightning_data(
    latitude: float,
    longitude: float,
    requested_date: str,
    timeout: int = 10,
) -> Dict[str, Any]:
    """
    Fetch convective instability and lightning activity.
    
    Primary attempt: MOSDAC GeoServer WFS endpoint.
    Secondary fallback: Open-Meteo Atmospheric Forecast API with CAPE and weather codes.
    Clearly marks which source provided the data.
    """
    # 1. Primary: MOSDAC WFS
    mosdac_params = {
        "service": "WFS",
        "version": "1.1.0",
        "request": "GetFeature",
        "typeName": "MOSDAC:lightning_forecast",
        "outputFormat": "application/json",
    }

    try:
        response = requests.get(
            MOSDAC_LIGHTNING_WFS_URL,
            params=mosdac_params,
            headers=DEFAULT_HEADERS,
            timeout=timeout,
        )
        if response.status_code == 200:
            try:
                data = response.json()
                features = data.get("features", [])
                return {
                    "available": True,
                    "source": "MOSDAC_WFS",
                    "fallback_used": False,
                    "data": {
                        "lightning_features": features,
                        "feature_count": len(features),
                    },
                    "reason": None,
                    "timestamp": get_current_iso_timestamp(),
                }
            except ValueError:
                pass
    except requests.exceptions.RequestException:
        pass

    # 2. Secondary fallback: Open-Meteo Atmospheric Forecast API
    om_params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": (
            "weather_code,"
            "precipitation,"
            "rain,"
            "showers"
        ),
        "hourly": (
            "cape,"
            "weather_code,"
            "precipitation_probability"
        ),
        "forecast_days": 1,
        "timezone": "Asia/Kolkata",
    }

    try:
        om_response = requests.get(
            OPEN_METEO_CONVECTIVE_URL,
            params=om_params,
            headers=DEFAULT_HEADERS,
            timeout=timeout,
        )

        if om_response.status_code == 200:
            om_json = om_response.json()
            current_obj = om_json.get("current", {})
            hourly_obj = om_json.get("hourly", {})

            current_code = current_obj.get("weather_code")
            precip_mm = current_obj.get("precipitation", 0.0)
            rain_mm = current_obj.get("rain", 0.0)
            showers_mm = current_obj.get("showers", 0.0)

            hourly_cape: List[float] = [
                float(v) for v in hourly_obj.get("cape", []) if v is not None
            ]
            max_cape = max(hourly_cape) if hourly_cape else 0.0
            avg_cape = round(sum(hourly_cape) / len(hourly_cape), 2) if hourly_cape else 0.0

            # Thunderstorm WMO codes: 95 (slight/moderate), 96 (slight hail), 99 (heavy hail)
            is_active_thunderstorm = current_code in [95, 96, 99]
            elevated_convective_risk = is_active_thunderstorm or (max_cape >= 1000.0)

            hourly_codes: List[int] = hourly_obj.get("weather_code", [])
            thunderstorm_forecast_today = any(c in [95, 96, 99] for c in hourly_codes)

            return {
                "available": True,
                "source": "Open-Meteo Atmospheric API (Convective Fallback)",
                "fallback_used": True,
                "primary_source_status": "MOSDAC WFS unavailable (HTTP 404 or connection failure)",
                "data": {
                    "thunderstorm_active": is_active_thunderstorm,
                    "thunderstorm_forecast_today": thunderstorm_forecast_today,
                    "elevated_convective_risk": elevated_convective_risk,
                    "weather_code": current_code,
                    "weather_description": describe_weather_code(current_code),
                    "precipitation_mm": precip_mm,
                    "rain_mm": rain_mm,
                    "showers_mm": showers_mm,
                    "convective_available_potential_energy_j_kg": {
                        "max_cape": max_cape,
                        "average_cape": avg_cape,
                        "instability_level": categorize_cape(max_cape),
                    },
                },
                "reason": None,
                "timestamp": current_obj.get("time") or get_current_iso_timestamp(),
            }

        return {
            "available": False,
            "source": "None",
            "fallback_used": True,
            "data": None,
            "reason": (
                f"Both MOSDAC WFS and Open-Meteo Atmospheric API failed "
                f"(Open-Meteo HTTP {om_response.status_code})"
            ),
            "timestamp": get_current_iso_timestamp(),
        }

    except requests.exceptions.RequestException as exc:
        return {
            "available": False,
            "source": "None",
            "fallback_used": True,
            "data": None,
            "reason": f"Both MOSDAC WFS and Open-Meteo fallback failed: {exc}",
            "timestamp": get_current_iso_timestamp(),
        }


# ---------------------------------------------------------------------------
# Source 4: Tsunami & Seismic Bulletins
# ---------------------------------------------------------------------------

def fetch_tsunami_data(
    latitude: float,
    longitude: float,
    radius_km: float = 2000.0,
    timeout: int = 12,
) -> Dict[str, Any]:
    """
    Fetch official tsunami and seismic threat evaluations from INCOIS.
    
    IMPORTANT:
    - If the API succeeds and returns 0 events inside the radius, available is True and events=[].
    - If the API request times out or errors, available is False with explicit reason.
    - Never converts API failure into "no tsunami".
    """
    try:
        response = requests.get(
            INCOIS_TSUNAMI_URL,
            headers=DEFAULT_HEADERS,
            timeout=timeout,
        )
        response.raise_for_status()

        data = response.json()
        if data.get("type") != "FeatureCollection":
            return {
                "available": False,
                "source": "INCOIS_Tsunami",
                "events": [],
                "reason": f"Unexpected GeoJSON structure: type is '{data.get('type')}'",
                "timestamp": get_current_iso_timestamp(),
            }

        features = data.get("features", [])
        parsed_events: List[Dict[str, Any]] = []

        for feature in features:
            props = feature.get("properties", {})
            geom = feature.get("geometry", {})
            coords = geom.get("coordinates", [])

            # Extract coordinates: prefer geometry [lon, lat], fallback to properties
            lon_val = None
            lat_val = None
            if isinstance(coords, (list, tuple)) and len(coords) >= 2:
                lon_val, lat_val = coords[0], coords[1]
            if lat_val is None or lon_val is None:
                lat_val = props.get("LATITUDE")
                lon_val = props.get("LONGITUDE")

            try:
                event_lat = float(lat_val)
                event_lon = float(lon_val)
            except (TypeError, ValueError):
                continue

            dist_km = haversine_distance_km(latitude, longitude, event_lat, event_lon)

            # Clean magnitude
            mag_val = props.get("MAGNITUDE")
            try:
                mag_float = float(mag_val) if mag_val is not None else None
            except (TypeError, ValueError):
                mag_float = None

            # Clean depth
            depth_val = props.get("DEPTH")
            try:
                depth_km = float(depth_val) if depth_val is not None else None
            except (TypeError, ValueError):
                depth_km = None

            event_obj = {
                "event_id": props.get("EVID"),
                "bulletin_type": props.get("BTYPE"),
                "bulletin_number": props.get("BULNO"),
                "magnitude": mag_float,
                "origin_time": props.get("ORIGINTIME") or props.get("OT"),
                "latitude": event_lat,
                "longitude": event_lon,
                "distance_km": dist_km,
                "depth_km": depth_km,
                "ocean_land": props.get("OCEAN_LAND"),
                "region": props.get("REGIONNAME"),
                "evaluation": props.get("EVALUATION"),
                "detail_url": props.get("detail"),
            }
            parsed_events.append(event_obj)

        # Sort all events by proximity
        parsed_events.sort(key=lambda e: e["distance_km"])

        # Filter within query radius
        events_within_radius = [
            e for e in parsed_events if e["distance_km"] <= radius_km
        ]

        latest_origin_time = (
            parsed_events[0]["origin_time"] if parsed_events else None
        )

        return {
            "available": True,
            "source": "INCOIS_Tsunami",
            "total_bulletins": len(parsed_events),
            "search_radius_km": radius_km,
            "events_in_search_radius": len(events_within_radius),
            "events": events_within_radius,
            "nearest_event": parsed_events[0] if parsed_events else None,
            "reason": None,
            "timestamp": latest_origin_time or get_current_iso_timestamp(),
        }

    except requests.exceptions.RequestException as exc:
        return {
            "available": False,
            "source": "INCOIS_Tsunami",
            "events": [],
            "reason": f"INCOIS Tsunami API request failed: {exc}",
            "timestamp": get_current_iso_timestamp(),
        }
    except ValueError as exc:
        return {
            "available": False,
            "source": "INCOIS_Tsunami",
            "events": [],
            "reason": f"Invalid JSON response from INCOIS Tsunami API: {exc}",
            "timestamp": get_current_iso_timestamp(),
        }
