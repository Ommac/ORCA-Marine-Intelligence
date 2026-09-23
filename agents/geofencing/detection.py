"""
ORCA Marine Intelligence - Geofence Detection Engine (Phase 2)
Provides point spatial status detection, geodesic distance calculation, and route segment intersection checks.
"""

import math
import logging
from typing import Dict, Any, List, Optional
from shapely.geometry import shape, Point, LineString, Polygon, MultiPolygon
from shapely.ops import nearest_points

from agents.geofencing.registry import load_all_geofences

logger = logging.getLogger("orca.geofencing.detection")


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two geographic coordinates in kilometers.
    """
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


def _is_hard_restricted(properties: Dict[str, Any]) -> bool:
    """Determine if a geofence is classified as hard-restricted."""
    cat = (properties.get("category") or "").lower()
    lvl = (properties.get("restriction_level") or "").upper()
    return cat == "restricted_waters" or lvl == "RESTRICTED"


def check_point_spatial_status(
    latitude: float,
    longitude: float,
    warning_distance_km: float = 5.0,
) -> Dict[str, Any]:
    """
    Evaluate the spatial status of a vessel position against all loaded geofences.

    Returns:
    {
        "status": "SAFE" | "WARNING" | "RESTRICTED",
        "latitude": float,
        "longitude": float,
        "nearest_boundary_distance_km": float,
        "nearest_category": str,
        "details": [
            {
                "id": str,
                "name": str,
                "category": str,
                "category_label": str,
                "restriction_level": str,
                "is_inside": bool,
                "is_restricted": bool,
                "distance_to_boundary_km": float,
            }, ...
        ]
    }
    """
    # Shapely point takes (x, y) = (longitude, latitude)
    point = Point(longitude, latitude)
    geofences_fc = load_all_geofences()
    features = geofences_fc.get("features", [])

    is_in_restricted = False
    min_restricted_dist_km = float("inf")
    nearest_restricted_cat = None

    min_overall_dist_km = float("inf")
    nearest_overall_cat = None

    details: List[Dict[str, Any]] = []

    for feat in features:
        props = feat.get("properties", {})
        feat_geom = feat.get("geometry", {})
        if not feat_geom:
            continue

        try:
            geom = shape(feat_geom)
        except Exception as exc:
            logger.error(f"Error parsing geometry for feature {feat.get('id')}: {exc}")
            continue

        is_inside = bool(geom.contains(point) or geom.covers(point))
        is_restricted = _is_hard_restricted(props)

        # Calculate distance to geometry boundary
        boundary = geom.boundary
        if not boundary.is_empty:
            p_nearest = nearest_points(point, boundary)[1]
            # p_nearest.x is lon, p_nearest.y is lat
            dist_km = haversine_distance_km(latitude, longitude, p_nearest.y, p_nearest.x)
        else:
            dist_km = 0.0

        if is_inside and is_restricted:
            is_in_restricted = True

        if is_restricted:
            if dist_km < min_restricted_dist_km:
                min_restricted_dist_km = dist_km
                nearest_restricted_cat = props.get("category")

        if dist_km < min_overall_dist_km:
            min_overall_dist_km = dist_km
            nearest_overall_cat = props.get("category")

        details.append({
            "id": props.get("id") or feat.get("id"),
            "name": props.get("name"),
            "category": props.get("category"),
            "category_label": props.get("category_label"),
            "restriction_level": props.get("restriction_level"),
            "is_inside": is_inside,
            "is_restricted": is_restricted,
            "distance_to_boundary_km": dist_km,
        })

    # Status Determination Rules
    if is_in_restricted:
        status = "RESTRICTED"
    elif min_restricted_dist_km <= warning_distance_km:
        status = "WARNING"
    else:
        status = "SAFE"

    # Nearest boundary reporting (prefer restricted boundary if available, else overall)
    final_nearest_dist = min_restricted_dist_km if min_restricted_dist_km != float("inf") else (
        min_overall_dist_km if min_overall_dist_km != float("inf") else 0.0
    )
    final_nearest_cat = nearest_restricted_cat or nearest_overall_cat or "none"

    return {
        "status": status,
        "latitude": latitude,
        "longitude": longitude,
        "warning_distance_km": warning_distance_km,
        "nearest_boundary_distance_km": round(final_nearest_dist, 2),
        "nearest_category": final_nearest_cat,
        "details": details,
    }


def check_route_segment_intersection(
    start_latitude: float,
    start_longitude: float,
    end_latitude: float,
    end_longitude: float,
) -> Dict[str, Any]:
    """
    Check if a route segment between start and end coordinates intersects any geofences.

    Returns:
    {
        "intersects": bool,
        "blocked": bool,
        "start": {"latitude": float, "longitude": float},
        "end": {"latitude": float, "longitude": float},
        "intersections": [
            {
                "id": str,
                "category": str,
                "name": str,
                "restriction_level": str,
                "restricted": bool,
            }, ...
        ]
    }
    """
    # Shapely LineString: [(start_lon, start_lat), (end_lon, end_lat)]
    line = LineString([
        (start_longitude, start_latitude),
        (end_longitude, end_latitude),
    ])

    geofences_fc = load_all_geofences()
    features = geofences_fc.get("features", [])

    intersections: List[Dict[str, Any]] = []
    blocked = False

    for feat in features:
        props = feat.get("properties", {})
        feat_geom = feat.get("geometry", {})
        if not feat_geom:
            continue

        try:
            geom = shape(feat_geom)
        except Exception as exc:
            logger.error(f"Error parsing geometry for feature {feat.get('id')}: {exc}")
            continue

        if geom.intersects(line) or geom.crosses(line):
            is_restricted = _is_hard_restricted(props)
            if is_restricted:
                blocked = True

            intersections.append({
                "id": props.get("id") or feat.get("id"),
                "category": props.get("category"),
                "name": props.get("name"),
                "restriction_level": props.get("restriction_level"),
                "restricted": is_restricted,
            })

    return {
        "intersects": len(intersections) > 0,
        "blocked": blocked,
        "start": {
            "latitude": start_latitude,
            "longitude": start_longitude,
        },
        "end": {
            "latitude": end_latitude,
            "longitude": end_longitude,
        },
        "intersections": intersections,
    }
