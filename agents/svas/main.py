"""
SVAS Agent - Small Vessel Advisory Service
--------------------------------------------
Part of the ORCA Marine Intelligence multi-agent system.

Responsibility: given a fisherman's location, a requested fishing
date, and a boat width, fetch the LIVE INCOIS Small Vessel Advisory
Service (SVAS) response and return the exact official advisory that
applies to that location/date/boat-size category.

This agent is deterministic. It does NOT use an LLM, and it does NOT
compute an overall fishing risk score - that belongs to ORCA's later
Risk Model / Orchestrator. This agent's only job is to look up and
normalize one official INCOIS advisory.

Core entry point:

    get_svas_advisory(
        latitude: float,
        longitude: float,
        requested_date: str,   # "YYYY-MM-DD"
        boat_width_m: float,
    ) -> dict

CLI test mode (manual testing only):

    python3 main.py

-------------------------------------------------------------------
IMPORTANT - READ BEFORE TOUCHING find_matching_feature() AGAIN
-------------------------------------------------------------------
The previous version of this file matched a point to a district by
looping over every GeoJSON feature and calling polygon.covers(point)
on each one individually, returning on the first hit. That produced
the reported bug: (19.72, 72.70) matched Palghar; (19.72, 72.80),
~11km away at the same latitude, matched nothing.

I was NOT able to fully diagnose this against Palghar's actual live
geometry - the sandbox this change was written in cannot reach
gemini.incois.gov.in (blocked at the network layer), and the
web-fetch tool available to me truncated the live response before
reaching Maharashtra's features (the FeatureCollection is very large:
every coastal district's polygon, x10 languages, x3 boat categories,
x3 days). I confirmed the general structure against Kerala and West
Bengal districts, but NOT against Palghar specifically.

What I changed here is deliberately limited to fixes that are
justified by the data format itself, not by guessing what Palghar's
polygon looks like:

  1. A district's advisory area is represented as one-or-more GeoJSON
     Polygon/MultiPolygon *features* (properties.district is not
     guaranteed unique in the FeatureCollection). All features
     sharing the same district name are unioned into one geometry
     before testing, so a point landing in a seam between two
     adjoining polygon pieces of the same district is not silently
     dropped.
  2. Government GeoJSON exports very commonly contain topologically
     invalid polygons (self-intersecting/"bowtie" rings). An invalid
     polygon can make shapely's covers() return incorrect results for
     points near complex parts of the boundary. shape.buffer(0) is a
     standard, non-destructive way to repair ring self-intersections
     WITHOUT changing the polygon's actual extent (it is not a
     distance buffer / radius - it's a topology cleanup). We apply it
     whenever a geometry is invalid, before testing coverage.

   Neither of these invents a radius, a nearest-district fallback, a
   hardcoded coordinate, or a fabricated advisory. Both are
   corrections to how we read data that's already there.

RUN diagnose_palghar.py (shipped alongside this file) on a machine
with real internet access. It fetches the live endpoint, isolates
Palghar's actual feature(s), reports validity, and tests both
(19.72,72.70) and (19.72,72.80) against the raw AND repaired
geometry, with the boundary distance for the failing point. If that
diagnostic shows the repaired/unioned geometry still doesn't cover
(19.72,72.80), that means INCOIS's own data genuinely has no coverage
at that exact point - and per the spec, this agent should keep
returning "unavailable" there rather than inventing coverage. Report
the diagnostic output back before changing this function further.
-------------------------------------------------------------------
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from datetime import date, datetime
from typing import Optional

import requests
from shapely.geometry import shape, Point
from shapely.errors import ShapelyError
from shapely.ops import unary_union

logger = logging.getLogger("svas_agent")
logging.basicConfig(level=logging.INFO)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SVAS_URL = "https://gemini.incois.gov.in/api/ws/latestsvasadvisory"
REQUEST_TIMEOUT_SECONDS = 20

# Boat-width category thresholds, in the order they should be checked.
# (lower_inclusive, upper_exclusive, ENG_property_key, category_value)
BOAT_CATEGORIES = [
    (0.0, 4.0, "ENG4", "under_4m"),
    (4.0, 6.0, "ENG6", "under_6m"),
    (6.0, 7.0, "ENG7", "under_7m"),
]

DAY_KEYS = ("Day-1", "Day-2", "Day-3")

SUPPORTED_GEOMETRY_TYPES = ("Polygon", "MultiPolygon")


# ---------------------------------------------------------------------------
# Errors (internal - never leak raw exceptions to the caller)
# ---------------------------------------------------------------------------

class SVASFetchError(Exception):
    """Raised when the live INCOIS SVAS endpoint cannot be fetched or
    parsed. Caught by get_svas_advisory and converted into the
    standard 'unavailable' response shape."""


# ---------------------------------------------------------------------------
# Step 1: Input validation
# ---------------------------------------------------------------------------

def validate_coordinates(latitude: float, longitude: float) -> Optional[str]:
    """Return an error message string if invalid, else None."""
    if not isinstance(latitude, (int, float)) or isinstance(latitude, bool):
        return "Invalid latitude"
    if not isinstance(longitude, (int, float)) or isinstance(longitude, bool):
        return "Invalid longitude"
    if not (-90 <= latitude <= 90):
        return "Invalid latitude"
    if not (-180 <= longitude <= 180):
        return "Invalid longitude"
    return None


def validate_boat_width(boat_width_m: float) -> Optional[str]:
    """Return an error message string if invalid, else None."""
    if not isinstance(boat_width_m, (int, float)) or isinstance(boat_width_m, bool):
        return "Invalid boat_width_m"
    if boat_width_m <= 0:
        return "Invalid boat_width_m"
    return None


def validate_requested_date(requested_date: str) -> tuple:
    """
    Parse requested_date (must be a "YYYY-MM-DD" string) into a date
    object. Returns (date_obj, error_message) - exactly one of the two
    will be None. Natural language ("tomorrow", etc.) is rejected;
    the Orchestrator is responsible for resolving that before calling
    this agent.
    """
    if not isinstance(requested_date, str):
        return None, "Invalid requested_date"
    try:
        parsed = datetime.strptime(requested_date, "%Y-%m-%d").date()
    except ValueError:
        return None, "Invalid requested_date"
    return parsed, None


# ---------------------------------------------------------------------------
# Step 2: Fetch live SVAS data from INCOIS
# ---------------------------------------------------------------------------

def fetch_svas_data(url: str = SVAS_URL) -> dict:
    """
    Fetch the latest SVAS GeoJSON FeatureCollection LIVE from INCOIS.
    Fetched at runtime on every call - no caching, no hardcoded data.

    Raises SVASFetchError (with a technical detail logged internally)
    on any network, HTTP, or JSON-structure failure.
    """
    try:
        response = requests.get(url, timeout=REQUEST_TIMEOUT_SECONDS)
    except requests.exceptions.ConnectionError as e:
        logger.error("SVAS fetch connection error: %s", e)
        raise SVASFetchError("connection error") from e
    except requests.exceptions.Timeout as e:
        logger.error("SVAS fetch timeout: %s", e)
        raise SVASFetchError("timeout") from e
    except requests.exceptions.RequestException as e:
        logger.error("SVAS fetch request error: %s", e)
        raise SVASFetchError("request error") from e

    if response.status_code != 200:
        logger.error("SVAS fetch returned HTTP %s", response.status_code)
        raise SVASFetchError(f"HTTP {response.status_code}")

    try:
        data = response.json()
    except ValueError as e:
        logger.error("SVAS response was not valid JSON: %s", e)
        raise SVASFetchError("invalid JSON") from e

    if not isinstance(data, dict) or data.get("type") != "FeatureCollection" \
            or not isinstance(data.get("features"), list):
        logger.error("SVAS response was not a GeoJSON FeatureCollection")
        raise SVASFetchError("unexpected response structure")

    return data


# ---------------------------------------------------------------------------
# Step 3: Location matching (real GeoJSON geometry, not a lookup table)
# ---------------------------------------------------------------------------

def _repair_if_invalid(geom):
    """
    If a geometry is topologically invalid (self-intersecting rings -
    common in government GeoJSON exports), repair it with buffer(0).
    This is a topology cleanup, NOT a distance buffer: it does not
    grow or shrink the polygon's intended extent, it only resolves
    self-intersections so operations like covers() behave correctly
    near complex parts of the boundary. Returns the geometry unchanged
    if it was already valid.
    """
    if geom.is_valid:
        return geom
    try:
        repaired = geom.buffer(0)
        if repaired.is_valid and not repaired.is_empty:
            logger.warning(
                "Repaired an invalid SVAS polygon via buffer(0) "
                "(area before=%.6f after=%.6f)",
                geom.area, repaired.area,
            )
            return repaired
        logger.warning("buffer(0) repair did not produce a valid geometry; "
                        "leaving geometry as-is")
    except (ShapelyError, ValueError) as e:
        logger.warning("buffer(0) repair raised %s; leaving geometry as-is", e)
    return geom


def build_district_geometries(geojson_data: dict) -> dict:
    """
    Group ALL features by properties.district, union each district's
    geometry (a district's advisory area may be split across more
    than one Feature in the live data - a point landing in a seam
    between two adjoining pieces of the SAME district must not be
    treated as unmatched), and repair invalid geometries.

    Returns: { district_name: { "geometry": <shapely geom>,
                                 "properties": <one feature's properties dict> } }

    We keep the properties dict from the FIRST feature encountered for
    a given district, since district/state/day/severity/message
    content is expected to be identical across a district's split
    pieces - only the geometry differs.
    """
    by_district = defaultdict(list)
    props_by_district = {}

    for feature in geojson_data.get("features", []):
        geometry = feature.get("geometry")
        properties = feature.get("properties") or {}
        district = properties.get("district")

        if not district or not geometry or geometry.get("type") not in SUPPORTED_GEOMETRY_TYPES:
            continue

        try:
            geom = shape(geometry)
        except (ShapelyError, ValueError, TypeError) as e:
            logger.warning("Skipping feature with unparseable geometry for "
                            "district=%r: %s", district, e)
            continue

        by_district[district].append(geom)
        props_by_district.setdefault(district, properties)

    result = {}
    for district, geoms in by_district.items():
        try:
            merged = geoms[0] if len(geoms) == 1 else unary_union(geoms)
        except (ShapelyError, ValueError) as e:
            logger.warning("Failed to union geometries for district=%r: %s",
                            district, e)
            continue
        merged = _repair_if_invalid(merged)
        result[district] = {"geometry": merged, "properties": props_by_district[district]}

    return result


def find_matching_district(geojson_data: dict, latitude: float, longitude: float) -> Optional[dict]:
    """
    Find the district whose (unioned, repaired) geometry covers the
    fisherman's point.

    GeoJSON coordinate order is [longitude, latitude] - shapely's
    Point() takes (x, y) i.e. (longitude, latitude), which is why we
    build Point(longitude, latitude) here.

    Returns {"properties": <dict>} for the matching district, or None
    if no district's geometry covers the point.
    """
    point = Point(longitude, latitude)
    district_geoms = build_district_geometries(geojson_data)

    for district, entry in district_geoms.items():
        geom = entry["geometry"]
        try:
            if geom.covers(point):
                return {"properties": entry["properties"]}
        except (ShapelyError, ValueError) as e:
            logger.warning("Geometry covers() check failed for district=%r: %s",
                            district, e)
            continue

    return None


# ---------------------------------------------------------------------------
# Step 4: Boat-size category selection
# ---------------------------------------------------------------------------

def select_boat_category(boat_width_m: float) -> Optional[tuple]:
    """
    Map boat_width_m to (ENG_property_key, category_value), e.g.
    (4.9, ...) -> ("ENG6", "under_6m").

    Returns None if boat_width_m >= 7 (no INCOIS SVAS category covers
    it - caller must NOT fabricate an advisory in that case).
    """
    for lower, upper, eng_key, category_value in BOAT_CATEGORIES:
        if lower <= boat_width_m < upper:
            return eng_key, category_value
    return None


# ---------------------------------------------------------------------------
# Step 5: Date matching
# ---------------------------------------------------------------------------

def parse_api_date(date_str: str) -> date:
    """Parse an INCOIS API date string 'DD-MM-YYYY' into a date object.
    Raises ValueError if malformed."""
    return datetime.strptime(date_str, "%d-%m-%Y").date()


def find_advisory_for_date(feature_properties: dict, eng_key: str,
                            requested_date_obj: date) -> Optional[tuple]:
    """
    Search Day-1/Day-2/Day-3 under feature_properties[eng_key] for the
    entry whose own 'date' field matches requested_date_obj exactly.

    Never assumes Day-N corresponds to a fixed offset from today - the
    actual date embedded in each day's data is what's compared.

    Returns (day_label, day_data_dict) if a valid, complete match is
    found, else None. A day entry missing 'severity' or 'message' is
    treated as not-a-valid-match (we never turn incomplete data into
    "safe").
    """
    category_data = feature_properties.get(eng_key)
    if not isinstance(category_data, dict):
        return None

    for day_label in DAY_KEYS:
        day_data = category_data.get(day_label)
        if not isinstance(day_data, dict):
            continue

        date_str = day_data.get("date")
        message = day_data.get("message")
        severity = day_data.get("severity")

        if not date_str or not message or not severity:
            # Incomplete entry - skip rather than guess.
            continue

        try:
            api_date = parse_api_date(date_str)
        except ValueError:
            logger.warning("Skipping day entry with malformed date: %r", date_str)
            continue

        if api_date == requested_date_obj:
            return day_label, day_data

    return None


# ---------------------------------------------------------------------------
# Step 6: Response builders
# ---------------------------------------------------------------------------

def build_error_response(error: str) -> dict:
    """Invalid-input error response (status='error')."""
    return {"agent": "svas", "status": "error", "error": error}


def build_unavailable_response(*, error: str = None, reason: str = None) -> dict:
    """Unavailable response (status='unavailable'), for either an
    'error' (e.g. upstream fetch failure) or a 'reason' (e.g. no
    matching location/date/category) - matching the two shapes shown
    in the spec."""
    resp = {"agent": "svas", "status": "unavailable"}
    if error is not None:
        resp["error"] = error
    if reason is not None:
        resp["reason"] = reason
    return resp


def build_success_response(latitude: float, longitude: float, requested_date: str,
                            boat_width_m: float, category_value: str,
                            feature_properties: dict, day_label: str,
                            day_data: dict) -> dict:
    return {
        "agent": "svas",
        "status": "success",
        "location": {"latitude": latitude, "longitude": longitude},
        "requested_date": requested_date,
        "vessel": {
            "boat_width_m": boat_width_m,
            "applicable_category": category_value,
        },
        "area": {
            "district": feature_properties.get("district"),
            "state": feature_properties.get("state"),
        },
        "advisory": {
            "day": day_label,
            "date": requested_date,
            "severity": day_data.get("severity"),
            "message": day_data.get("message"),
        },
        "source": {
            "provider": "INCOIS",
            "service": "Small Vessel Advisory Service",
            "endpoint": SVAS_URL,
        },
    }


# ---------------------------------------------------------------------------
# Step 7: Core public function
# ---------------------------------------------------------------------------

def get_svas_advisory(
    latitude: float,
    longitude: float,
    requested_date: str,
    boat_width_m: float,
) -> dict:
    """
    Core specialist-agent function. Frontend/Orchestrator calls this
    directly.

    Always returns a JSON-serializable dict:
      - {"agent": "svas", "status": "success", ...}
      - {"agent": "svas", "status": "error", "error": "..."}          (bad input)
      - {"agent": "svas", "status": "unavailable", "error"|"reason": "..."}  (no data)

    Never raises to the caller. Never fabricates an advisory: a
    "safe" result is only ever returned when INCOIS's own data for
    that exact location/date/category literally says so.
    """
    # --- Input validation ---
    lat_error = validate_coordinates(latitude, longitude)
    if lat_error:
        return build_error_response(lat_error)

    width_error = validate_boat_width(boat_width_m)
    if width_error:
        return build_error_response(width_error)

    requested_date_obj, date_error = validate_requested_date(requested_date)
    if date_error:
        return build_error_response(date_error)

    # --- Boat category (checked before the network call - cheap, deterministic) ---
    category = select_boat_category(boat_width_m)
    if category is None:
        return build_unavailable_response(
            reason="No applicable INCOIS SVAS vessel category is available for boats 7m or wider"
        )
    eng_key, category_value = category

    # --- Live fetch ---
    try:
        geojson_data = fetch_svas_data()
    except SVASFetchError:
        return build_unavailable_response(error="Unable to fetch SVAS data from INCOIS")

    # --- Location matching ---
    feature = find_matching_district(geojson_data, latitude, longitude)
    if feature is None:
        return build_unavailable_response(
            reason="No SVAS advisory area found for the provided location"
        )

    feature_properties = feature.get("properties") or {}

    # --- Date matching within the selected boat category ---
    match = find_advisory_for_date(feature_properties, eng_key, requested_date_obj)
    if match is None:
        return build_unavailable_response(
            reason="No SVAS advisory available for the requested date"
        )
    day_label, day_data = match

    return build_success_response(
        latitude=latitude,
        longitude=longitude,
        requested_date=requested_date,
        boat_width_m=boat_width_m,
        category_value=category_value,
        feature_properties=feature_properties,
        day_label=day_label,
        day_data=day_data,
    )


# ---------------------------------------------------------------------------
# CLI test mode ONLY - for manual local testing.
# The frontend / Orchestrator calls get_svas_advisory(...) directly.
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("SVAS Agent - Interactive Test")
    print("-" * 29)

    try:
        latitude_str = input("Enter latitude: ").strip()
        latitude = float(latitude_str)
    except ValueError:
        print(f"Invalid latitude: {latitude_str!r} is not a number.")
        raise SystemExit(1)

    try:
        longitude_str = input("Enter longitude: ").strip()
        longitude = float(longitude_str)
    except ValueError:
        print(f"Invalid longitude: {longitude_str!r} is not a number.")
        raise SystemExit(1)

    requested_date = input("Enter date (YYYY-MM-DD): ").strip()

    try:
        boat_width_str = input("Enter boat width (meters): ").strip()
        boat_width_m = float(boat_width_str)
    except ValueError:
        print(f"Invalid boat width: {boat_width_str!r} is not a number.")
        raise SystemExit(1)

    result = get_svas_advisory(
        latitude,
        longitude,
        requested_date,
        boat_width_m,
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))