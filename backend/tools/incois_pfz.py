import math
from typing import Any, Dict, List, Optional, Tuple

import requests

from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


# ============================================================
# INCOIS PFZ WFS CONFIGURATION
# ============================================================

INCOIS_PFZ_URL = (
    "https://www.incois.gov.in/"
    "geoserver/PFZ_Automation/ows"
)

PFZ_LAYER = "PFZ_Automation:pfzlines"


# ============================================================
# GEOGRAPHIC CALCULATIONS
# ============================================================

def haversine_distance_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float
) -> float:
    """
    Calculate great-circle distance between two coordinates.

    Returns:
        Distance in kilometers.
    """

    earth_radius_km = 6371.0088

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)

    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad)
        * math.cos(lat2_rad)
        * math.sin(delta_lon / 2) ** 2
    )

    a = min(1.0, max(0.0, a))

    return (
        2
        * earth_radius_km
        * math.asin(math.sqrt(a))
    )


def calculate_bearing(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float
) -> float:
    """
    Calculate initial bearing from point 1 to point 2.

    Returns:
        Bearing in degrees:
        0 = North
        90 = East
        180 = South
        270 = West
    """

    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)

    delta_lon = math.radians(lon2 - lon1)

    x = (
        math.sin(delta_lon)
        * math.cos(lat2_rad)
    )

    y = (
        math.cos(lat1_rad)
        * math.sin(lat2_rad)
        - math.sin(lat1_rad)
        * math.cos(lat2_rad)
        * math.cos(delta_lon)
    )

    bearing = math.degrees(
        math.atan2(x, y)
    )

    return (bearing + 360) % 360


def bearing_to_direction(
    bearing: float
) -> str:
    """
    Convert bearing to a 16-point compass direction.
    """

    directions = [
        "North",
        "North-Northeast",
        "Northeast",
        "East-Northeast",
        "East",
        "East-Southeast",
        "Southeast",
        "South-Southeast",
        "South",
        "South-Southwest",
        "Southwest",
        "West-Southwest",
        "West",
        "West-Northwest",
        "Northwest",
        "North-Northwest",
    ]

    index = int(
        (bearing + 11.25) / 22.5
    ) % 16

    return directions[index]


# ============================================================
# GEOMETRY HELPERS
# ============================================================

def extract_coordinates(
    geometry: Optional[Dict[str, Any]]
) -> List[Tuple[float, float]]:
    """
    Extract all coordinates from a GeoJSON geometry.

    Supports:
        LineString
        MultiLineString

    Returns:
        List of (latitude, longitude)
    """

    if not geometry:
        return []

    geometry_type = geometry.get("type")

    coordinates = geometry.get(
        "coordinates",
        []
    )

    points = []

    if geometry_type == "LineString":

        for coordinate in coordinates:

            if len(coordinate) >= 2:

                lon, lat = coordinate[:2]

                points.append(
                    (lat, lon)
                )

    elif geometry_type == "MultiLineString":

        for line in coordinates:

            for coordinate in line:

                if len(coordinate) >= 2:

                    lon, lat = coordinate[:2]

                    points.append(
                        (lat, lon)
                    )

    return points


def calculate_centroid(
    points: List[Tuple[float, float]]
) -> Optional[Dict[str, float]]:
    """
    Calculate a simple coordinate centroid.

    Returns:
        {
            "latitude": ...,
            "longitude": ...
        }
    """

    if not points:
        return None

    avg_lat = sum(
        point[0] for point in points
    ) / len(points)

    avg_lon = sum(
        point[1] for point in points
    ) / len(points)

    return {
        "latitude": round(avg_lat, 6),
        "longitude": round(avg_lon, 6)
    }


def calculate_bounding_box(
    points: List[Tuple[float, float]]
) -> Optional[Dict[str, float]]:
    """
    Calculate PFZ bounding box.
    """

    if not points:
        return None

    latitudes = [
        point[0]
        for point in points
    ]

    longitudes = [
        point[1]
        for point in points
    ]

    return {
        "min_latitude": round(
            min(latitudes),
            6
        ),
        "min_longitude": round(
            min(longitudes),
            6
        ),
        "max_latitude": round(
            max(latitudes),
            6
        ),
        "max_longitude": round(
            max(longitudes),
            6
        )
    }


def find_nearest_point(
    user_lat: float,
    user_lon: float,
    points: List[Tuple[float, float]]
) -> Optional[Dict[str, Any]]:
    """
    Find the PFZ coordinate nearest to the user.
    """

    if not points:
        return None

    nearest = min(
        points,
        key=lambda point: haversine_distance_km(
            user_lat,
            user_lon,
            point[0],
            point[1]
        )
    )

    nearest_lat, nearest_lon = nearest

    distance = haversine_distance_km(
        user_lat,
        user_lon,
        nearest_lat,
        nearest_lon
    )

    bearing = calculate_bearing(
        user_lat,
        user_lon,
        nearest_lat,
        nearest_lon
    )

    return {
        "latitude": round(
            nearest_lat,
            6
        ),
        "longitude": round(
            nearest_lon,
            6
        ),
        "distance_km": round(
            distance,
            2
        ),
        "bearing_degrees": round(
            bearing,
            2
        ),
        "direction": bearing_to_direction(
            bearing
        )
    }


def calculate_orientation(
    points: List[Tuple[float, float]]
) -> Optional[Dict[str, Any]]:
    """
    Calculate the overall orientation of the PFZ.

    Uses the first and last points of the PFZ line.
    """

    if len(points) < 2:
        return None

    start_lat, start_lon = points[0]
    end_lat, end_lon = points[-1]

    bearing = calculate_bearing(
        start_lat,
        start_lon,
        end_lat,
        end_lon
    )

    direction = bearing_to_direction(
        bearing
    )

    return {
        "start_point": {
            "latitude": round(
                start_lat,
                6
            ),
            "longitude": round(
                start_lon,
                6
            )
        },

        "end_point": {
            "latitude": round(
                end_lat,
                6
            ),
            "longitude": round(
                end_lon,
                6
            )
        },

        "bearing_degrees": round(
            bearing,
            2
        ),

        "direction": direction
    }


def calculate_geometry_length_km(
    points: List[Tuple[float, float]]
) -> float:
    """
    Calculate approximate PFZ length from
    the coordinate sequence.

    Returns:
        Length in kilometers.
    """

    if len(points) < 2:
        return 0.0

    total_distance = 0.0

    for i in range(
        len(points) - 1
    ):

        lat1, lon1 = points[i]
        lat2, lon2 = points[i + 1]

        total_distance += (
            haversine_distance_km(
                lat1,
                lon1,
                lat2,
                lon2
            )
        )

    return total_distance


# ============================================================
# PFZ FEATURE PROCESSING
# ============================================================

def process_pfz_feature(
    feature: Dict[str, Any],
    user_lat: float,
    user_lon: float,
    pfz_rank: int
) -> Optional[Dict[str, Any]]:
    """
    Convert a raw INCOIS GeoJSON feature into
    an ORCA-friendly PFZ object.
    """

    geometry = feature.get(
        "geometry"
    )

    properties = (
        feature.get("properties")
        or {}
    )

    points = extract_coordinates(
        geometry
    )

    if not points:
        return None

    # --------------------------------------------------------
    # Nearest PFZ point
    # --------------------------------------------------------

    nearest = find_nearest_point(
        user_lat,
        user_lon,
        points
    )

    if not nearest:
        return None

    # --------------------------------------------------------
    # Orientation
    # --------------------------------------------------------

    orientation = calculate_orientation(
        points
    )

    # --------------------------------------------------------
    # Centroid
    # --------------------------------------------------------

    centroid = calculate_centroid(
        points
    )

    # --------------------------------------------------------
    # Bounding box
    # --------------------------------------------------------

    bounding_box = calculate_bounding_box(
        points
    )

    # --------------------------------------------------------
    # Geometry length
    # --------------------------------------------------------

    calculated_length = (
        calculate_geometry_length_km(
            points
        )
    )

    # INCOIS supplied length
    incois_length = properties.get(
        "Length"
    )

    # --------------------------------------------------------
    # Return structured PFZ
    # --------------------------------------------------------

    return {
        "pfz_rank": pfz_rank,

        "pfz_id": properties.get(
            "UID"
        ),

        "uid": properties.get(
            "UID"
        ),

        "category": properties.get(
            "Category"
        ),

        "sector": {
            "sector_boundary": properties.get(
                "SECTORBOUN"
            ),
            "sector_boundary_1": properties.get(
                "SECTORBO_1"
            ),
            "sector_name": properties.get(
                "SECTORNAME"
            )
        },

        "advisory": {
            "year": properties.get(
                "Year"
            ),
            "julian_day": properties.get(
                "Julian_day"
            )
        },

        "distance": {
            "distance_km": nearest[
                "distance_km"
            ],

            "bearing_degrees": nearest[
                "bearing_degrees"
            ],

            "direction": nearest[
                "direction"
            ]
        },

        "nearest_point": {
            "latitude": nearest[
                "latitude"
            ],

            "longitude": nearest[
                "longitude"
            ]
        },

        "start_point": (
            orientation["start_point"]
            if orientation
            else None
        ),

        "end_point": (
            orientation["end_point"]
            if orientation
            else None
        ),

        "orientation": (
            {
                "bearing_degrees": orientation[
                    "bearing_degrees"
                ],
                "direction": orientation[
                    "direction"
                ]
            }
            if orientation
            else None
        ),

        "centroid": centroid,

        "bounding_box": bounding_box,

        "geometry": {
            "type": geometry.get(
                "type"
            ),

            "coordinate_count": len(
                points
            ),

            "coordinates": [
                {
                    "latitude": round(
                        lat,
                        6
                    ),
                    "longitude": round(
                        lon,
                        6
                    )
                }
                for lat, lon in points
            ]
        },

        "length": {
            "incois_length_km": (
                round(
                    float(incois_length),
                    2
                )
                if incois_length is not None
                else None
            ),

            "calculated_length_km": round(
                calculated_length,
                2
            )
        }
    }


# ============================================================
# LIVE INCOIS PFZ FETCH
# ============================================================

def fetch_live_pfz_near_location(
    lat: float,
    lon: float,
    max_distance_km: float = 300.0,
    limit: int = 10
):
    """
    Fetch live PFZ data from INCOIS.

    The complete PFZ dataset is downloaded and then
    spatially filtered locally.

    Parameters
    ----------
    lat:
        User/vessel latitude.

    lon:
        User/vessel longitude.

    max_distance_km:
        Maximum distance for PFZ selection.

    limit:
        Maximum number of PFZs returned.

    Returns
    -------
    dict:
        ORCA-friendly structured PFZ response.
    """

    # --------------------------------------------------------
    # Validate input
    # --------------------------------------------------------
    session = requests.Session()

    retry_strategy = Retry(
        total=4,
        connect=4,
        read=4,
        status=4,
        backoff_factor=2,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"],
        raise_on_status=False
    )

    adapter = HTTPAdapter(
        max_retries=retry_strategy
    )

    session.mount(
        "https://",
        adapter
    )

    session.mount(
        "http://",
        adapter
    )

    if not -90 <= lat <= 90:
        raise ValueError(
            "Latitude must be between -90 and 90."
        )

    if not -180 <= lon <= 180:
        raise ValueError(
            "Longitude must be between -180 and 180."
        )

    if max_distance_km <= 0:
        raise ValueError(
            "max_distance_km must be greater than 0."
        )

    if limit <= 0:
        raise ValueError(
            "limit must be greater than 0."
        )

    # --------------------------------------------------------
    # WFS parameters
    # --------------------------------------------------------

    params = {
        "service": "WFS",
        "version": "1.1.0",
        "request": "GetFeature",
        "typeName": PFZ_LAYER,
        "outputFormat": "application/json",
        "srsName": "EPSG:4326"
    }

    # --------------------------------------------------------
    # Browser-like headers
    # --------------------------------------------------------

    headers = {
        "User-Agent": (
            "Mozilla/5.0 "
            "(Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 "
            "(KHTML, like Gecko) "
            "Chrome/151.0 Safari/537.36"
        ),

        "Accept": (
            "application/json,"
            "text/plain,"
            "*/*"
        ),

        "Referer": (
            "https://www.incois.gov.in/"
        ),

        "Origin": (
            "https://www.incois.gov.in"
        )
    }

    try:

        # ----------------------------------------------------
        # Request live INCOIS data
        # ----------------------------------------------------

        response = session.get(
            INCOIS_PFZ_URL,
            params=params,
            headers=headers,
            timeout=45
        )

        response.raise_for_status()

        # ----------------------------------------------------
        # Parse JSON
        # ----------------------------------------------------

        geojson_data = response.json()

        features = geojson_data.get(
            "features",
            []
        )

        print(
            f"Received {len(features)} "
            "live PFZ feature(s) from INCOIS."
        )

        # ----------------------------------------------------
        # Process each PFZ
        # ----------------------------------------------------

        processed_features = []

        for feature in features:

            processed = process_pfz_feature(
                feature,
                lat,
                lon,
                pfz_rank=0
            )

            if processed is None:
                continue

            distance = processed[
                "distance"
            ][
                "distance_km"
            ]

            if distance <= max_distance_km:

                processed_features.append(
                    processed
                )

        # ----------------------------------------------------
        # Sort by distance
        # ----------------------------------------------------

        processed_features.sort(
            key=lambda pfz:
            pfz["distance"]["distance_km"]
        )

        # ----------------------------------------------------
        # Assign final rank
        # ----------------------------------------------------

        processed_features = (
            processed_features[:limit]
        )

        for rank, pfz in enumerate(
            processed_features,
            start=1
        ):

            pfz["pfz_rank"] = rank

        print(
            f"Found "
            f"{len(processed_features)} "
            f"PFZ feature(s) within "
            f"{max_distance_km} km."
        )

        # ----------------------------------------------------
        # Return ORCA response
        # ----------------------------------------------------

        return {
            "status": "success",

            "source": "INCOIS",

            "layer": PFZ_LAYER,

            "query_location": {
                "latitude": lat,
                "longitude": lon
            },

            "search_radius_km": max_distance_km,

            "total_live_features": len(
                features
            ),

            "matching_features": len(
                processed_features
            ),

            "features": processed_features
        }

    except requests.RequestException as e:

        print(
            f"INCOIS request failed: {e}"
        )

        return {
            "status": "error",
            "source": "INCOIS",
            "error": str(e),
            "features": []
        }

    except ValueError as e:

        print(
            f"Invalid INCOIS response: {e}"
        )

        return {
            "status": "error",
            "source": "INCOIS",
            "error": str(e),
            "features": []
        }


# ============================================================
# SIMPLE SUMMARY FOR LLM / ORCA
# ============================================================

def create_pfz_agent_summary(
    pfz_data: Optional[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Create a compact representation suitable
    for passing to an LLM/ORCA reasoning agent.

    This deliberately excludes the thousands of
    geometry coordinates.
    """

    if not pfz_data:
        return []

    summaries = []

    for pfz in pfz_data.get(
        "features",
        []
    ):

        distance = pfz.get(
            "distance",
            {}
        )

        nearest = pfz.get(
            "nearest_point",
            {}
        )

        orientation = pfz.get(
            "orientation"
        ) or {}

        advisory = pfz.get(
            "advisory",
            {}
        )

        length = pfz.get(
            "length",
            {}
        )

        summaries.append({

            "pfz_rank": pfz.get(
                "pfz_rank"
            ),

            "uid": pfz.get(
                "uid"
            ),

            "category": pfz.get(
                "category"
            ),

            "distance_km": distance.get(
                "distance_km"
            ),

            "bearing_degrees": distance.get(
                "bearing_degrees"
            ),

            "direction": distance.get(
                "direction"
            ),

            "nearest_point": nearest,

            "orientation": orientation,

            "year": advisory.get(
                "year"
            ),

            "julian_day": advisory.get(
                "julian_day"
            ),

            "length_km": length.get(
                "incois_length_km"
            )
        })

    return summaries