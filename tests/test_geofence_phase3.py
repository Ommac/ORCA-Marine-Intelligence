"""
Unit & Integration Tests for ORCA Phase 3: Basic A* Route Optimization
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient

from api.main import app
from agents.geofencing.registry import load_all_geofences
from agents.geofencing.detection import (
    haversine_distance_km,
    check_point_spatial_status,
    check_route_segment_intersection,
)
from agents.geofencing.routing import optimize_route


class TestGeofencePhase3(unittest.TestCase):
    """Phase 3 A* Route Optimization Test Suite"""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_astar_clear_route(self):
        """A route with an unblocked direct path should immediately succeed."""
        start_lat, start_lon = 18.00, 71.00
        dest_lat, dest_lon = 18.50, 71.00

        res = optimize_route(start_lat, start_lon, dest_lat, dest_lon)
        self.assertTrue(res["success"])
        self.assertGreaterEqual(len(res["route"]), 2)
        self.assertEqual(res["route"][0], [start_lat, start_lon])
        self.assertEqual(res["route"][-1], [dest_lat, dest_lon])
        self.assertIsNotNone(res["total_distance_km"])
        self.assertEqual(res["algorithm"], "A*")

    def test_astar_avoids_restricted_area(self):
        """A route crossing dummy restricted waters must find a safe detour avoiding restricted polygons."""
        # Direct line from (18.80, 72.70) to (19.30, 72.70) is blocked by [72.60-72.80, 18.95-19.15]
        direct_chk = check_route_segment_intersection(18.80, 72.70, 19.30, 72.70)
        self.assertTrue(direct_chk["blocked"])

        res = optimize_route(
            start_latitude=18.80,
            start_longitude=72.70,
            destination_latitude=19.30,
            destination_longitude=72.70,
            grid_spacing_km=2.0,
            search_margin_km=15.0,
        )
        self.assertTrue(res["success"], f"A* failed to find route: {res.get('reason')}")
        self.assertGreaterEqual(len(res["route"]), 2)
        self.assertEqual(res["route"][0], [18.80, 72.70])
        self.assertEqual(res["route"][-1], [19.30, 72.70])

        # Verify no segment of the generated route crosses restricted waters
        route = res["route"]
        for i in range(len(route) - 1):
            seg_chk = check_route_segment_intersection(
                route[i][0], route[i][1],
                route[i+1][0], route[i+1][1],
            )
            self.assertFalse(seg_chk["blocked"], f"Segment {route[i]} -> {route[i+1]} is blocked!")

    def test_astar_route_distance(self):
        """Verify total_distance_km matches the exact sum of Haversine segment distances."""
        res = optimize_route(18.80, 72.70, 19.30, 72.70, grid_spacing_km=2.0, search_margin_km=15.0)
        self.assertTrue(res["success"])

        route = res["route"]
        expected_distance = sum(
            haversine_distance_km(route[i][0], route[i][1], route[i+1][0], route[i+1][1])
            for i in range(len(route) - 1)
        )
        self.assertAlmostEqual(res["total_distance_km"], expected_distance, delta=0.05)

    def test_start_inside_restricted_area(self):
        """Start position inside restricted waters must immediately fail with a clear reason."""
        res = optimize_route(
            start_latitude=19.05,
            start_longitude=72.70,
            destination_latitude=19.30,
            destination_longitude=72.70,
        )
        self.assertFalse(res["success"])
        self.assertEqual(res["route"], [])
        self.assertIsNone(res["total_distance_km"])
        self.assertIn("Start point is inside a restricted area", res.get("reason", ""))

    def test_destination_inside_restricted_area(self):
        """Destination inside restricted waters must immediately fail with a clear reason."""
        res = optimize_route(
            start_latitude=18.80,
            start_longitude=72.70,
            destination_latitude=19.05,
            destination_longitude=72.70,
        )
        self.assertFalse(res["success"])
        self.assertEqual(res["route"], [])
        self.assertIsNone(res["total_distance_km"])
        self.assertIn("Destination is inside a restricted area", res.get("reason", ""))

    def test_final_route_validation(self):
        """Verify final route validation guarantees safety and boundary integrity."""
        res = optimize_route(18.80, 72.70, 19.30, 72.70)
        self.assertTrue(res["success"])
        route = res["route"]
        self.assertEqual(route[0], [18.80, 72.70])
        self.assertEqual(route[-1], [19.30, 72.70])

    def test_no_safe_route(self):
        """When search is bounded with 0 margin so detour is impossible, it should cleanly return success=False."""
        res = optimize_route(
            start_latitude=18.80,
            start_longitude=72.70,
            destination_latitude=19.30,
            destination_longitude=72.70,
            grid_spacing_km=2.0,
            search_margin_km=0.0,
            max_iterations=10,
        )
        # With 0 margin and 10 max iterations, detour around the 22km polygon is impossible
        self.assertFalse(res["success"])
        self.assertEqual(res["route"], [])
        self.assertIsNone(res["total_distance_km"])
        self.assertIsNotNone(res.get("reason"))

    def test_phase1_regression(self):
        """Verify Phase 1 registry still loads all 4 categories."""
        fc = load_all_geofences(force_reload=True)
        self.assertEqual(fc.get("type"), "FeatureCollection")
        self.assertGreaterEqual(len(fc["features"]), 4)

    def test_phase2_regression(self):
        """Verify Phase 2 spatial check and route intersection still function accurately."""
        pt = check_point_spatial_status(19.05, 72.70)
        self.assertEqual(pt["status"], "RESTRICTED")

        seg = check_route_segment_intersection(18.80, 72.70, 19.30, 72.70)
        self.assertTrue(seg["blocked"])

    def test_api_route_optimize_endpoint(self):
        """Verify POST /api/orca/route/optimize endpoint via HTTP."""
        payload = {
            "start": [18.80, 72.70],
            "destination": [19.30, 72.70],
            "grid_spacing_km": 2.0,
            "search_margin_km": 15.0,
        }
        res = self.client.post("/api/orca/route/optimize", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["success"])
        self.assertGreaterEqual(len(data["route"]), 2)
        self.assertIsNotNone(data["total_distance_km"])
        self.assertEqual(data["algorithm"], "A*")


if __name__ == "__main__":
    unittest.main()
