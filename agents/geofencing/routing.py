"""
ORCA Marine Intelligence - A* Route Optimization Engine (Phase 3)
Provides geographic A* pathfinding between vessel location and destination while avoiding hard-restricted geofences.
"""

import math
import heapq
import logging
from typing import Dict, Any, List, Optional, Tuple, Set

from shapely.geometry import shape

from agents.geofencing.registry import load_all_geofences
from agents.geofencing.detection import (
    haversine_distance_km,
    check_point_spatial_status,
    check_route_segment_intersection,
    _is_hard_restricted,
)

logger = logging.getLogger("orca.geofencing.routing")


def _get_restricted_polygons_bounds() -> List[Tuple[float, float, float, float]]:
    """Get bounding boxes (min_lon, min_lat, max_lon, max_lat) of all hard-restricted geofences."""
    fc = load_all_geofences()
    boxes = []
    for feat in fc.get("features", []):
        props = feat.get("properties", {})
        if _is_hard_restricted(props):
            geom = feat.get("geometry", {})
            if geom:
                try:
                    s = shape(geom)
                    boxes.append(s.bounds)  # (min_lon, min_lat, max_lon, max_lat)
                except Exception as exc:
                    logger.error(f"Error reading shape bounds: {exc}")
    return boxes


def optimize_route(
    start_latitude: float,
    start_longitude: float,
    destination_latitude: float,
    destination_longitude: float,
    grid_spacing_km: float = 2.0,
    search_margin_km: float = 15.0,
    max_iterations: int = 5000,
) -> Dict[str, Any]:
    """
    Find the shortest safe geographic route between START and DESTINATION avoiding hard-restricted geofences.

    Returns:
    {
        "success": bool,
        "route": [[lat, lon], [lat, lon], ...],
        "total_distance_km": float | None,
        "nodes_explored": int,
        "algorithm": "A*",
        "reason": str (optional on failure)
    }
    """
    # 1. Validation: Check Start Point
    start_status = check_point_spatial_status(start_latitude, start_longitude)
    if start_status.get("status") == "RESTRICTED":
        return {
            "success": False,
            "route": [],
            "total_distance_km": None,
            "nodes_explored": 0,
            "algorithm": "A*",
            "reason": "Start point is inside a restricted area",
        }

    # 2. Validation: Check Destination Point
    dest_status = check_point_spatial_status(destination_latitude, destination_longitude)
    if dest_status.get("status") == "RESTRICTED":
        return {
            "success": False,
            "route": [],
            "total_distance_km": None,
            "nodes_explored": 0,
            "algorithm": "A*",
            "reason": "Destination is inside a restricted area",
        }

    # Handle identity
    if math.isclose(start_latitude, destination_latitude, abs_tol=1e-6) and math.isclose(start_longitude, destination_longitude, abs_tol=1e-6):
        return {
            "success": True,
            "route": [[start_latitude, start_longitude], [destination_latitude, destination_longitude]],
            "total_distance_km": 0.0,
            "nodes_explored": 0,
            "algorithm": "A*",
        }

    # 3. Direct Route Shortcut Check
    direct_check = check_route_segment_intersection(
        start_latitude, start_longitude, destination_latitude, destination_longitude
    )
    if not direct_check.get("blocked", False):
        direct_dist = haversine_distance_km(
            start_latitude, start_longitude, destination_latitude, destination_longitude
        )
        return {
            "success": True,
            "route": [
                [start_latitude, start_longitude],
                [destination_latitude, destination_longitude],
            ],
            "total_distance_km": round(direct_dist, 2),
            "nodes_explored": 1,
            "algorithm": "A*",
        }

    # 4. Search Area Bounding Box Calculation
    min_lat = min(start_latitude, destination_latitude)
    max_lat = max(start_latitude, destination_latitude)
    min_lon = min(start_longitude, destination_longitude)
    max_lon = max(start_longitude, destination_longitude)

    # Include restricted polygons that lie along or near the path
    restricted_boxes = _get_restricted_polygons_bounds()
    for min_x, min_y, max_x, max_y in restricted_boxes:
        # if restricted box overlaps corridor
        if not (max_y < min_lat or min_y > max_lat or max_x < min_lon or min_x > max_lon):
            min_lat = min(min_lat, min_y)
            max_lat = max(max_lat, max_y)
            min_lon = min(min_lon, min_x)
            max_lon = max(max_lon, max_x)

    avg_lat = (min_lat + max_lat) / 2.0
    lat_margin_deg = search_margin_km / 111.0
    cos_lat = max(0.01, math.cos(math.radians(avg_lat)))
    lon_margin_deg = search_margin_km / (111.0 * cos_lat)

    bbox_min_lat = min_lat - lat_margin_deg
    bbox_max_lat = max_lat + lat_margin_deg
    bbox_min_lon = min_lon - lon_margin_deg
    bbox_max_lon = max_lon + lon_margin_deg

    lat_step = grid_spacing_km / 111.0
    lon_step = grid_spacing_km / (111.0 * cos_lat)

    start_node = (round(start_latitude, 5), round(start_longitude, 5))
    dest_node = (round(destination_latitude, 5), round(destination_longitude, 5))

    # 5. A* Search
    # 8-neighbor directions: (d_lat, d_lon)
    directions = [
        (-1, -1), (-1, 0), (-1, 1),
        (0, -1),           (0, 1),
        (1, -1),  (1, 0),  (1, 1),
    ]

    open_set: List[Tuple[float, int, Tuple[float, float]]] = []
    initial_h = haversine_distance_km(start_node[0], start_node[1], dest_node[0], dest_node[1])
    counter = 0
    heapq.heappush(open_set, (initial_h, counter, start_node))

    g_score: Dict[Tuple[float, float], float] = {start_node: 0.0}
    came_from: Dict[Tuple[float, float], Tuple[float, float]] = {}
    closed_set: Set[Tuple[float, float]] = set()

    found_path = False

    while open_set and len(closed_set) < max_iterations:
        _, _, current = heapq.heappop(open_set)

        if current in closed_set:
            continue
        closed_set.add(current)

        if current == dest_node:
            found_path = True
            break

        # Check line-of-sight to destination
        direct_to_dest = check_route_segment_intersection(
            current[0], current[1], dest_node[0], dest_node[1]
        )
        if not direct_to_dest.get("blocked", False):
            edge_dist = haversine_distance_km(current[0], current[1], dest_node[0], dest_node[1])
            tentative_g = g_score[current] + edge_dist
            if dest_node not in g_score or tentative_g < g_score[dest_node]:
                came_from[dest_node] = current
                g_score[dest_node] = tentative_g
                counter += 1
                heapq.heappush(open_set, (tentative_g, counter, dest_node))

        # Explore 8 neighbors
        for d_lat, d_lon in directions:
            nbr_lat = round(current[0] + d_lat * lat_step, 5)
            nbr_lon = round(current[1] + d_lon * lon_step, 5)
            neighbor = (nbr_lat, nbr_lon)

            # Check bounds
            if not (bbox_min_lat <= nbr_lat <= bbox_max_lat and bbox_min_lon <= nbr_lon <= bbox_max_lon):
                continue

            if neighbor in closed_set:
                continue

            # Check edge safety
            edge_check = check_route_segment_intersection(
                current[0], current[1], nbr_lat, nbr_lon
            )
            if edge_check.get("blocked", False):
                continue

            edge_dist = haversine_distance_km(current[0], current[1], nbr_lat, nbr_lon)
            tentative_g = g_score[current] + edge_dist

            if neighbor not in g_score or tentative_g < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g
                h_score = haversine_distance_km(nbr_lat, nbr_lon, dest_node[0], dest_node[1])
                f_score = tentative_g + h_score
                counter += 1
                heapq.heappush(open_set, (f_score, counter, neighbor))

    if dest_node not in came_from and start_node != dest_node:
        return {
            "success": False,
            "route": [],
            "total_distance_km": None,
            "nodes_explored": len(closed_set),
            "algorithm": "A*",
            "reason": "No safe route found",
        }

    # 6. Reconstruct Route
    raw_nodes = [dest_node]
    curr = dest_node
    while curr in came_from:
        curr = came_from[curr]
        raw_nodes.append(curr)
    raw_nodes.reverse()

    # Build final coordinates list: [ [start_lat, start_lon], ..., [dest_lat, dest_lon] ]
    route: List[List[float]] = []
    for idx, node in enumerate(raw_nodes):
        if idx == 0:
            route.append([start_latitude, start_longitude])
        elif idx == len(raw_nodes) - 1:
            route.append([destination_latitude, destination_longitude])
        else:
            route.append([node[0], node[1]])

    # Path post-smoothing / shortcutting (line of sight)
    smoothed_route: List[List[float]] = [route[0]]
    curr_idx = 0
    while curr_idx < len(route) - 1:
        # Find farthest reachable node without obstruction
        farthest_idx = len(route) - 1
        for test_idx in range(len(route) - 1, curr_idx, -1):
            chk = check_route_segment_intersection(
                route[curr_idx][0], route[curr_idx][1],
                route[test_idx][0], route[test_idx][1],
            )
            if not chk.get("blocked", False):
                farthest_idx = test_idx
                break
        smoothed_route.append(route[farthest_idx])
        curr_idx = farthest_idx

    final_route = smoothed_route if len(smoothed_route) >= 2 else route

    # 7. Final Route Validation: Verify EVERY consecutive segment
    total_distance_km = 0.0
    for i in range(len(final_route) - 1):
        p1 = final_route[i]
        p2 = final_route[i + 1]
        seg_check = check_route_segment_intersection(p1[0], p1[1], p2[0], p2[1])
        if seg_check.get("blocked", False):
            logger.error(f"Final route validation failed on segment {p1} -> {p2}")
            return {
                "success": False,
                "route": [],
                "total_distance_km": None,
                "nodes_explored": len(closed_set),
                "algorithm": "A*",
                "reason": "Final route validation failed: segment intersects restricted area",
            }
        total_distance_km += haversine_distance_km(p1[0], p1[1], p2[0], p2[1])

    return {
        "success": True,
        "route": final_route,
        "total_distance_km": round(total_distance_km, 2),
        "nodes_explored": len(closed_set),
        "algorithm": "A*",
    }
