"""
ORCA Marine Intelligence - Geofencing Module
"""

from agents.geofencing.registry import load_all_geofences, GEOFENCE_CATEGORIES
from agents.geofencing.detection import (
    haversine_distance_km,
    check_point_spatial_status,
    check_route_segment_intersection,
)
from agents.geofencing.routing import optimize_route

__all__ = [
    "load_all_geofences",
    "GEOFENCE_CATEGORIES",
    "haversine_distance_km",
    "check_point_spatial_status",
    "check_route_segment_intersection",
    "optimize_route",
]
