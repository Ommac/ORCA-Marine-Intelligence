"""
Ocean Analysis Agent - Specialist Agent #4
------------------------------------------
Part of the ORCA Marine Intelligence multi-agent system.

Responsibility:
Consolidate broader ocean and environmental signals:
- Ocean Chlorophyll-a
- Tropical Cyclones & official warning tracks
- Lightning & Convective Instability
- Tsunami & Seismic Bulletins

This agent provides FACTUAL ENVIRONMENTAL EVIDENCE only.
It does NOT calculate trip safety scores or determine SAFE/CAUTION/NOT_RECOMMENDED
status (which belongs strictly to Agent #5: Risk Agent).

Public Entry Point:
    analyze_ocean_conditions(
        latitude: float,
        longitude: float,
        requested_date: str
    ) -> dict
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .sources import (
    fetch_chlorophyll_data,
    fetch_cyclone_data,
    fetch_lightning_data,
    fetch_tsunami_data,
    get_current_iso_timestamp,
)


# ---------------------------------------------------------------------------
# Input Validation
# ---------------------------------------------------------------------------

def validate_ocean_analysis_inputs(
    latitude: float,
    longitude: float,
    requested_date: str,
) -> None:
    """Validate coordinate ranges and requested date format."""
    if not isinstance(latitude, (int, float)):
        raise TypeError(f"Latitude must be numeric, got {type(latitude).__name__}.")

    if not isinstance(longitude, (int, float)):
        raise TypeError(f"Longitude must be numeric, got {type(longitude).__name__}.")

    if not (-90.0 <= float(latitude) <= 90.0):
        raise ValueError(f"Latitude {latitude} is out of valid range (-90 to 90).")

    if not (-180.0 <= float(longitude) <= 180.0):
        raise ValueError(f"Longitude {longitude} is out of valid range (-180 to 180).")

    if not isinstance(requested_date, str) or not requested_date.strip():
        raise ValueError("requested_date must be a non-empty string in 'YYYY-MM-DD' format.")

    try:
        datetime.strptime(requested_date.strip(), "%Y-%m-%d")
    except ValueError as exc:
        raise ValueError(
            f"requested_date '{requested_date}' is not a valid 'YYYY-MM-DD' date."
        ) from exc


# ---------------------------------------------------------------------------
# Environmental Warning Extractor (Factual Evidence Only)
# ---------------------------------------------------------------------------

def extract_environmental_warnings(
    cyclone_res: Dict[str, Any],
    lightning_res: Dict[str, Any],
    tsunami_res: Dict[str, Any],
) -> List[Dict[str, str]]:
    """
    Extract factual environmental hazard warnings from available source results.
    Does NOT calculate trip-risk decisions (e.g. SAFE / CAUTION).
    """
    warnings: List[Dict[str, str]] = []

    # 1. Tsunami Warnings
    if tsunami_res.get("available"):
        events = tsunami_res.get("events", [])
        for ev in events:
            evaluation = str(ev.get("evaluation") or "").strip()
            mag = ev.get("magnitude")
            dist = ev.get("distance_km")
            reg = ev.get("region") or "Unknown Region"

            # Check for active threat keywords in INCOIS evaluation
            is_threat = any(
                w in evaluation.lower()
                for w in ["warning", "alert", "threat", "watch", "evacuation"]
            ) and ("no tsunami threat" not in evaluation.lower())

            if is_threat or (mag is not None and mag >= 7.0 and dist is not None and dist <= 1000.0):
                warnings.append({
                    "type": "tsunami_hazard",
                    "severity": "critical" if is_threat else "high",
                    "message": (
                        f"INCOIS Seismic Bulletin #{ev.get('bulletin_number')}: "
                        f"M{mag} event near {reg} ({dist} km away). "
                        f"Evaluation: {evaluation or 'Under Assessment'}"
                    ),
                })

    # 2. Convective / Lightning Warnings
    if lightning_res.get("available"):
        l_data = lightning_res.get("data") or {}
        if l_data.get("thunderstorm_active"):
            warnings.append({
                "type": "active_thunderstorm",
                "severity": "high",
                "message": (
                    f"Active thunderstorm detected at query location "
                    f"({l_data.get('weather_description', 'Thunderstorm')}). "
                    "Convective lightning hazard present."
                ),
            })
        elif l_data.get("thunderstorm_forecast_today"):
            warnings.append({
                "type": "thunderstorm_forecast",
                "severity": "moderate",
                "message": (
                    "Thunderstorm activity forecast in the area during the forecast period."
                ),
            })
        elif l_data.get("elevated_convective_risk"):
            cape_info = l_data.get("convective_available_potential_energy_j_kg") or {}
            max_cape = cape_info.get("max_cape", 0.0)
            warnings.append({
                "type": "convective_instability",
                "severity": "moderate",
                "message": (
                    f"Elevated convective potential energy detected (Max CAPE: {max_cape} J/kg, "
                    f"{cape_info.get('instability_level', 'Unstable')})."
                ),
            })

    # 3. Cyclone Warnings
    if cyclone_res.get("available"):
        c_data = cyclone_res.get("data") or {}
        active_cyclones = c_data.get("active_cyclones", [])
        for cyc in active_cyclones:
            warnings.append({
                "type": "tropical_cyclone",
                "severity": "critical",
                "message": f"Active tropical cyclone bulletin: {cyc.get('name', 'Unnamed system')}.",
            })

    return warnings


# ---------------------------------------------------------------------------
# Public Specialist Entry Point
# ---------------------------------------------------------------------------

def analyze_ocean_conditions(
    latitude: float,
    longitude: float,
    requested_date: str,
) -> Dict[str, Any]:
    """
    Public Specialist Agent entry point for Agent #4: Ocean Analysis Agent.

    Parameters:
        latitude: Vessel/query latitude (-90 to 90)
        longitude: Vessel/query longitude (-180 to 180)
        requested_date: Target observation/forecast date ('YYYY-MM-DD')

    Returns:
        Structured, JSON-serializable dictionary with environmental signals
        for Chlorophyll, Cyclone, Lightning/Convective conditions, and Tsunami.
    """
    # 1. Validate inputs
    validate_ocean_analysis_inputs(latitude, longitude, requested_date)
    lat_val = float(latitude)
    lon_val = float(longitude)
    date_val = requested_date.strip()
    query_ts = get_current_iso_timestamp()

    # 2. Fetch from all 4 modular sources with independent resilience
    chlorophyll_res = fetch_chlorophyll_data(lat_val, lon_val, date_val)
    cyclone_res = fetch_cyclone_data(lat_val, lon_val, date_val)
    lightning_res = fetch_lightning_data(lat_val, lon_val, date_val)
    tsunami_res = fetch_tsunami_data(lat_val, lon_val, radius_km=2000.0)

    # 3. Assess source statuses
    source_status_map = {
        "chlorophyll": "success" if chlorophyll_res.get("available") else "unavailable",
        "cyclone": "success" if cyclone_res.get("available") else "unavailable",
        "lightning": "success" if lightning_res.get("available") else "unavailable",
        "tsunami": "success" if tsunami_res.get("available") else "unavailable",
    }

    successful_sources = sum(1 for status in source_status_map.values() if status == "success")
    total_sources = len(source_status_map)

    if successful_sources == total_sources:
        overall_status = "success"
    elif successful_sources > 0:
        overall_status = "partial"
    else:
        overall_status = "unavailable"

    # 4. Extract factual environmental warnings
    warnings = extract_environmental_warnings(cyclone_res, lightning_res, tsunami_res)

    # 5. Build structured normalized response
    response: Dict[str, Any] = {
        "agent": "ocean_analysis",
        "status": overall_status,
        "location": {
            "latitude": lat_val,
            "longitude": lon_val,
        },
        "requested_date": date_val,
        "chlorophyll": {
            "available": bool(chlorophyll_res.get("available")),
            "source": chlorophyll_res.get("source"),
            "data": chlorophyll_res.get("data"),
            "reason": chlorophyll_res.get("reason"),
        },
        "cyclone": {
            "available": bool(cyclone_res.get("available")),
            "source": cyclone_res.get("source"),
            "data": cyclone_res.get("data"),
            "reason": cyclone_res.get("reason"),
        },
        "lightning": {
            "available": bool(lightning_res.get("available")),
            "source": lightning_res.get("source"),
            "fallback_used": lightning_res.get("fallback_used", False),
            "data": lightning_res.get("data"),
            "reason": lightning_res.get("reason"),
        },
        "tsunami": {
            "available": bool(tsunami_res.get("available")),
            "source": tsunami_res.get("source"),
            "events_in_search_radius": tsunami_res.get("events_in_search_radius", 0),
            "search_radius_km": tsunami_res.get("search_radius_km", 2000.0),
            "total_bulletins": tsunami_res.get("total_bulletins", 0),
            "events": tsunami_res.get("events", []),
            "nearest_event": tsunami_res.get("nearest_event"),
            "reason": tsunami_res.get("reason"),
        },
        "warnings": warnings,
        "source_status": source_status_map,
        "freshness": {
            "query_timestamp": query_ts,
            "requested_date": date_val,
            "chlorophyll_timestamp": chlorophyll_res.get("timestamp"),
            "cyclone_timestamp": cyclone_res.get("timestamp"),
            "lightning_timestamp": lightning_res.get("timestamp"),
            "tsunami_timestamp": tsunami_res.get("timestamp"),
        },
    }

    return response


# ---------------------------------------------------------------------------
# CLI Test Runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Test execution for Kochi Coast (9.93°N, 76.26°E)
    test_lat = 9.9312
    test_lon = 76.2673
    test_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    print(f"Executing Ocean Analysis Agent for ({test_lat}, {test_lon}) on {test_date}...")
    result = analyze_ocean_conditions(test_lat, test_lon, test_date)
    print("\nComplete Ocean Analysis Response:")
    print(json.dumps(result, indent=2, default=str))
