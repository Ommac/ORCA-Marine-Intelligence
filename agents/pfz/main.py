"""
PFZ Agent - Specialist Agent
-----------------------------
Part of the ORCA Marine Intelligence multi-agent system.

Responsibility: given a fisherman's latitude/longitude, fetch LIVE
Potential Fishing Zone (PFZ) data from the INCOIS GeoServer WFS
endpoint and return the nearest PFZ as structured, machine-readable
data for the downstream Risk Calculation Agent.

This agent does NOT produce user-facing prose. Its output is a
JSON-serializable dict with a stable schema.

Core entry point (this is what the frontend / Orchestrator calls):

    find_nearest_pfz(latitude: float, longitude: float) -> dict

CLI test mode (for local development only - not the real architecture):

    python3 main.py

Then type e.g.:

    Find the nearest fishing zone to latitude 19.72 and longitude 72.70

or just press Enter at the prompt to run the built-in programmatic
example: find_nearest_pfz(19.72, 72.70)
"""

import re
import sys
import copy
import json
import math
import requests

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

INCOIS_WFS_ENDPOINT = "https://www.incois.gov.in/geoserver/PFZ_Automation/ows"

INCOIS_WFS_PARAMS = {
    "service": "WFS",
    "version": "1.1.0",
    "request": "GetFeature",
    "typeName": "PFZ_Automation:pfzlines",
    "outputFormat": "application/json",
}

REQUEST_TIMEOUT_SECONDS = 20
EARTH_RADIUS_KM = 6371.0

# Property keys as actually observed in live INCOIS WFS responses.
# GeoServer field names are fixed by the published schema, so these
# should be stable, but we look them up defensively (case-insensitive
# fallback) in case a field is renamed upstream.
PROP_CATEGORY = "category"
PROP_YEAR = "Year"
PROP_JULIAN_DAY = "Julian_day"
PROP_UID = "UID"
PROP_SNO = "Sno"


# ---------------------------------------------------------------------------
# Step 1: Input validation
# ---------------------------------------------------------------------------

def validate_coordinates(latitude: float, longitude: float) -> None:
    """Raise ValueError if latitude/longitude are out of valid range."""
    if latitude is None or longitude is None:
        raise ValueError("latitude and longitude are required.")
    if not isinstance(latitude, (int, float)) or not isinstance(longitude, (int, float)):
        raise ValueError("latitude and longitude must be numeric.")
    if not (-90 <= latitude <= 90):
        raise ValueError(f"Latitude {latitude} is out of valid range (-90 to 90).")
    if not (-180 <= longitude <= 180):
        raise ValueError(f"Longitude {longitude} is out of valid range (-180 to 180).")


# ---------------------------------------------------------------------------
# Step 2: Fetch live PFZ data from INCOIS
# ---------------------------------------------------------------------------

def fetch_pfz_geojson(endpoint: str = INCOIS_WFS_ENDPOINT,
                       params: dict = None) -> dict:
    """
    Fetch the latest PFZ GeoJSON FeatureCollection LIVE from the INCOIS
    GeoServer WFS endpoint. No caching, no static files - this hits the
    network every call, as required.

    Returns the parsed JSON as a dict.
    Raises RuntimeError with a clear message on any failure.
    """
    if params is None:
        params = INCOIS_WFS_PARAMS

    try:
        response = requests.get(endpoint, params=params, timeout=REQUEST_TIMEOUT_SECONDS)
    except requests.exceptions.SSLError:
        try:
            response = requests.get(endpoint, params=params, timeout=REQUEST_TIMEOUT_SECONDS, verify=False)
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Request to INCOIS failed after SSL retry: {e}") from e
    except requests.exceptions.ConnectionError as e:
        raise RuntimeError(
            "Could not connect to INCOIS server. Check network connectivity."
        ) from e
    except requests.exceptions.Timeout as e:
        raise RuntimeError(
            f"INCOIS server did not respond within {REQUEST_TIMEOUT_SECONDS}s."
        ) from e
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Request to INCOIS failed: {e}") from e

    if response.status_code != 200:
        raise RuntimeError(
            f"INCOIS server returned HTTP {response.status_code}. "
            "The service may be temporarily unavailable."
        )

    try:
        data = response.json()
    except ValueError as e:
        raise RuntimeError(
            "INCOIS response was not valid JSON. "
            "The endpoint may have changed or returned an error page."
        ) from e

    if not isinstance(data, dict) or data.get("type") != "FeatureCollection" or "features" not in data:
        raise RuntimeError(
            "Response did not look like a GeoJSON FeatureCollection. "
            "The PFZ endpoint structure may have changed."
        )

    return data


# ---------------------------------------------------------------------------
# Step 3: Extract points, one per vertex, each tagged with its parent
#          feature's properties (needed so we can report the metadata
#          of whichever line actually turns out nearest).
# ---------------------------------------------------------------------------

def extract_pfz_points(geojson_data: dict) -> list:
    """
    Walk every feature's geometry (MultiLineString / LineString / Point)
    and return a flat list of dicts:
        {"lat": float, "lon": float, "properties": dict, "feature_index": int}

    GeoJSON stores coordinates as [longitude, latitude]; this function
    performs the swap so downstream code always works in (lat, lon).
    """
    points = []

    for feature_index, feature in enumerate(geojson_data.get("features", [])):
        geometry = feature.get("geometry") or {}
        geom_type = geometry.get("type")
        coords = geometry.get("coordinates", [])
        properties = feature.get("properties") or {}

        if geom_type == "MultiLineString":
            for line in coords:
                for point in line:
                    lon, lat = point[0], point[1]
                    points.append({
                        "lat": lat, "lon": lon,
                        "properties": properties,
                        "feature_index": feature_index,
                    })

        elif geom_type == "LineString":
            for point in coords:
                lon, lat = point[0], point[1]
                points.append({
                    "lat": lat, "lon": lon,
                    "properties": properties,
                    "feature_index": feature_index,
                })

        elif geom_type == "Point":
            if len(coords) >= 2:
                lon, lat = coords[0], coords[1]
                points.append({
                    "lat": lat, "lon": lon,
                    "properties": properties,
                    "feature_index": feature_index,
                })
        # Other geometry types are ignored for this stage.

    return points


# ---------------------------------------------------------------------------
# Step 4: "Latest-data-first" filtering
#
# The WFS response is the source of truth for what's current - we do
# NOT assume "today" locally. If the feature collection contains
# points from more than one (Year, Julian_day) combination, we
# determine the newest one present in the data itself and restrict
# the nearest-PFZ search to that group, so we never mix stale and
# fresh PFZ lines in one answer.
# ---------------------------------------------------------------------------

def _get_property(properties: dict, key: str):
    """Case-tolerant property lookup (exact match first, then case-insensitive)."""
    if key in properties:
        return properties[key]
    lowered_key = key.lower()
    for k, v in properties.items():
        if k.lower() == lowered_key:
            return v
    return None


def select_latest_points(points: list) -> tuple:
    """
    Given the flat point list, determine the newest (Year, Julian_day)
    combination actually present in the data and return
    (filtered_points, latest_year, latest_julian_day).

    If Year/Julian_day metadata isn't present or parseable on any
    feature, returns (points, None, None) unfiltered - we never fail
    the whole request just because freshness metadata is missing, but
    we also never fabricate a date.
    """
    dated_indices = []  # (year, julian_day, point_index)
    for i, p in enumerate(points):
        year_raw = _get_property(p["properties"], PROP_YEAR)
        jday_raw = _get_property(p["properties"], PROP_JULIAN_DAY)
        try:
            year = int(year_raw)
            jday = int(jday_raw)
        except (TypeError, ValueError):
            continue
        dated_indices.append((year, jday, i))

    if not dated_indices:
        return points, None, None

    latest_year, latest_jday, _ = max(dated_indices, key=lambda t: (t[0], t[1]))

    filtered = [
        points[i] for (year, jday, i) in dated_indices
        if year == latest_year and jday == latest_jday
    ]

    # Safety net: if filtering somehow produced nothing usable, fall
    # back to the full unfiltered set rather than erroring out.
    if not filtered:
        return points, None, None

    return filtered, latest_year, latest_jday


# ---------------------------------------------------------------------------
# Step 5: Distance / bearing geometry
# ---------------------------------------------------------------------------

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points, in kilometers."""
    lat1_rad, lon1_rad = math.radians(lat1), math.radians(lon1)
    lat2_rad, lon2_rad = math.radians(lat2), math.radians(lon2)

    delta_lat = lat2_rad - lat1_rad
    delta_lon = lon2_rad - lon1_rad

    a = (math.sin(delta_lat / 2) ** 2
         + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return EARTH_RADIUS_KM * c


def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Initial compass bearing (0-360 degrees) from point 1 to point 2."""
    lat1_rad, lat2_rad = math.radians(lat1), math.radians(lat2)
    delta_lon_rad = math.radians(lon2 - lon1)

    x = math.sin(delta_lon_rad) * math.cos(lat2_rad)
    y = (math.cos(lat1_rad) * math.sin(lat2_rad)
         - math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(delta_lon_rad))

    bearing_deg = math.degrees(math.atan2(x, y))
    return (bearing_deg + 360) % 360


def bearing_to_compass_direction(bearing: float) -> str:
    """Convert a numeric bearing (0-360) into a 16-point compass label."""
    directions = [
        "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
        "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
    ]
    index = round(bearing / 22.5) % 16
    return directions[index]


# ---------------------------------------------------------------------------
# Step 6: Find nearest point
# ---------------------------------------------------------------------------

def find_nearest_point(points: list, latitude: float, longitude: float) -> dict:
    """
    Brute-force scan of all candidate points, returning the nearest one
    plus distance/bearing/direction. Simple by design - fine for this
    stage's data volumes; can be swapped for a spatial index later if
    needed without changing the public interface.
    """
    if not points:
        raise RuntimeError("No PFZ coordinates available to search.")

    nearest = None
    nearest_distance_km = None

    for p in points:
        d = haversine_distance(latitude, longitude, p["lat"], p["lon"])
        if nearest_distance_km is None or d < nearest_distance_km:
            nearest_distance_km = d
            nearest = p

    bearing = calculate_bearing(latitude, longitude, nearest["lat"], nearest["lon"])
    direction = bearing_to_compass_direction(bearing)

    return {
        "point": nearest,
        "distance_km": round(nearest_distance_km, 2),
        "bearing_degrees": round(bearing, 1),
        "direction": direction,
    }


# ---------------------------------------------------------------------------
# Step 7: Core public function
# ---------------------------------------------------------------------------

def find_nearest_pfz(latitude: float, longitude: float) -> dict:
    """
    Core specialist-agent function. Frontend/Orchestrator calls this
    directly with numeric latitude/longitude.

    Always returns a JSON-serializable dict with a stable schema:
      - on success: {"agent": "pfz", "status": "success", ...}
      - on failure: {"agent": "pfz", "status": "error", "error": "..."}

    Never raises to the caller, and never fabricates data - metadata
    fields are None when the source data doesn't provide them.
    """
    try:
        validate_coordinates(latitude, longitude)

        geojson_data = fetch_pfz_geojson()
        all_points = extract_pfz_points(geojson_data)

        if not all_points:
            return {
                "agent": "pfz",
                "status": "error",
                "error": "INCOIS returned no usable PFZ coordinates.",
            }

        latest_points, latest_year, latest_jday = select_latest_points(all_points)

        result = find_nearest_point(latest_points, latitude, longitude)
        nearest_point = result["point"]
        props = nearest_point["properties"]

        # The matched vertex remembers which source feature it came from
        # (see extract_pfz_points). Look that feature back up in the raw
        # GeoJSON so we can hand back its *complete* original geometry -
        # not just the single nearest coordinate - for the frontend map.
        # deepcopy so nothing downstream can mutate the raw geojson_data.
        feature_index = nearest_point["feature_index"]
        matched_feature = geojson_data["features"][feature_index]
        matched_geometry = copy.deepcopy(matched_feature.get("geometry"))

        pfz_block = {
            "nearest_point": {
                "latitude": round(nearest_point["lat"], 5),
                "longitude": round(nearest_point["lon"], 5),
                "distance_km": result["distance_km"],
                "bearing_degrees": result["bearing_degrees"],
                "direction": result["direction"],
            },
            # Full original PFZ geometry as returned by INCOIS (e.g.
            # MultiLineString), coordinates untouched and in their
            # original [longitude, latitude] order. Used by the
            # frontend Map to draw the actual PFZ feature.
            "geometry": matched_geometry,
            "category": _get_property(props, PROP_CATEGORY),
            "uid": _get_property(props, PROP_UID),
            "sno": _get_property(props, PROP_SNO),
            "data_year": _get_property(props, PROP_YEAR),
            "julian_day": _get_property(props, PROP_JULIAN_DAY),
            # INCOIS's WFS response does not include an explicit validity
            # window for the PFZ advisory - we do not fabricate one.
            "valid_until": None,
        }

        return {
            "agent": "pfz",
            "status": "success",
            "fisherman_location": {
                "latitude": latitude,
                "longitude": longitude,
            },
            "pfz": pfz_block,
            "data_freshness": {
                "latest_year_in_response": latest_year,
                "latest_julian_day_in_response": latest_jday,
                "filtered_to_latest": latest_year is not None,
            },
            "source": {
                "provider": "INCOIS",
                "service": "GeoServer WFS",
                "endpoint": INCOIS_WFS_ENDPOINT,
            },
        }

    except ValueError as e:
        return {"agent": "pfz", "status": "error", "error": str(e)}
    except RuntimeError as e:
        return {"agent": "pfz", "status": "error", "error": str(e)}
    except Exception as e:
        # Catch-all so a specialist agent NEVER crashes the Orchestrator.
        return {"agent": "pfz", "status": "error", "error": f"Unexpected error: {e}"}


# ---------------------------------------------------------------------------
# CLI test mode ONLY - not the real architecture. The frontend and the
# future Orchestrator call find_nearest_pfz(latitude, longitude) directly.
# ---------------------------------------------------------------------------

def parse_query_cli(query: str) -> tuple:
    """Very simple NL parser, for local demo/testing only."""
    lat_match = re.search(r"lat(?:itude)?\s*[:=]?\s*(-?\d+\.?\d*)", query, re.IGNORECASE)
    lon_match = re.search(r"lon(?:gitude)?\s*[:=]?\s*(-?\d+\.?\d*)", query, re.IGNORECASE)

    if not lat_match or not lon_match:
        raise ValueError(
            "Could not find both latitude and longitude in your query. "
            "Try: 'Find the nearest fishing zone to latitude 19.72 and longitude 72.70'"
        )
    return float(lat_match.group(1)), float(lon_match.group(1))


def main():
    print("=" * 60)
    print(" PFZ Agent - CLI Test Mode (calls find_nearest_pfz directly)")
    print("=" * 60)
    print("Example query:")
    print("  Find the nearest fishing zone to latitude 19.72 and longitude 72.70")
    print("Press Enter with no input to run the built-in programmatic example:")
    print("  find_nearest_pfz(19.72, 72.70)")
    print("Type 'exit' or 'quit' to stop.\n")

    while True:
        try:
            query = input("Enter your query: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nExiting.")
            sys.exit(0)

        if query.lower() in ("exit", "quit"):
            print("Exiting.")
            break

        if not query:
            # Built-in programmatic example, as requested.
            print("\n[Running programmatic example: find_nearest_pfz(19.72, 72.70)]")
            result = find_nearest_pfz(19.72, 72.70)
            print(json.dumps(result, indent=2))
            print()
            continue

        try:
            lat, lon = parse_query_cli(query)
        except ValueError as e:
            print(f"\n[Input Error] {e}\n")
            continue

        result = find_nearest_pfz(lat, lon)
        print(json.dumps(result, indent=2))
        print()


if __name__ == "__main__":
    main()