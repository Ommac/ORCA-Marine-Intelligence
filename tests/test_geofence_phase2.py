"""
Unit & Integration Tests for ORCA Phase 2: Geofence Detection
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient

from api.main import app
from agents.geofencing.registry import load_all_geofences, GEOFENCE_CATEGORIES
from agents.geofencing.detection import (
    haversine_distance_km,
    check_point_spatial_status,
    check_route_segment_intersection,
)


class TestGeofencePhase2(unittest.TestCase):
    """Phase 2 Geofence Detection Test Suite"""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_safe_point(self):
        """A point well outside all restricted areas should return status SAFE."""
        # Location in open Arabian Sea far from restricted waters
        result = check_point_spatial_status(latitude=15.5, longitude=70.0, warning_distance_km=5.0)
        self.assertEqual(result["status"], "SAFE")
        self.assertGreater(result["nearest_boundary_distance_km"], 5.0)
        self.assertEqual(result["latitude"], 15.5)
        self.assertEqual(result["longitude"], 70.0)

    def test_restricted_point(self):
        """A point inside dummy restricted waters [72.60-72.80, 18.95-19.15] must return RESTRICTED."""
        result = check_point_spatial_status(latitude=19.05, longitude=72.70, warning_distance_km=5.0)
        self.assertEqual(result["status"], "RESTRICTED")
        
        # Verify details list contains restricted_waters as inside
        rw_detail = next((d for d in result["details"] if d["category"] == "restricted_waters"), None)
        self.assertIsNotNone(rw_detail)
        self.assertTrue(rw_detail["is_inside"])
        self.assertTrue(rw_detail["is_restricted"])

    def test_warning_point(self):
        """A point within warning_distance_km (e.g. ~2 km from boundary) must return WARNING."""
        # Restricted boundary is at lat 19.15 for lon 72.70.
        # Lat 19.17 is ~2.2 km north of the boundary (outside polygon, within 5km).
        result = check_point_spatial_status(latitude=19.17, longitude=72.70, warning_distance_km=5.0)
        self.assertEqual(result["status"], "WARNING")
        self.assertLessEqual(result["nearest_boundary_distance_km"], 5.0)

    def test_distance_calculation(self):
        """Verify Haversine distance accuracy and boundary distance computation."""
        # Test basic Haversine accuracy
        self.assertEqual(haversine_distance_km(18.95, 72.80, 18.95, 72.80), 0.0)
        dist_1deg = haversine_distance_km(19.0, 72.0, 19.0, 73.0)
        self.assertAlmostEqual(dist_1deg, 105.15, delta=1.0)

        # Boundary distance for point outside
        result = check_point_spatial_status(latitude=19.25, longitude=72.70, warning_distance_km=5.0)
        # 19.25 is 0.10 degrees (~11 km) north of 19.15 boundary
        self.assertAlmostEqual(result["nearest_boundary_distance_km"], 11.1, delta=1.0)

    def test_route_crosses_restricted_area(self):
        """A route passing through the restricted polygon must return intersects=True and blocked=True."""
        # Line from (18.80, 72.70) to (19.30, 72.70) cuts through [18.95, 19.15]
        result = check_route_segment_intersection(
            start_latitude=18.80,
            start_longitude=72.70,
            end_latitude=19.30,
            end_longitude=72.70,
        )
        self.assertTrue(result["intersects"])
        self.assertTrue(result["blocked"])
        
        cats = [i["category"] for i in result["intersections"]]
        self.assertIn("restricted_waters", cats)

    def test_route_does_not_cross_restricted_area(self):
        """A route completely clear of restricted areas must return blocked=False."""
        result = check_route_segment_intersection(
            start_latitude=18.00,
            start_longitude=71.00,
            end_latitude=18.50,
            end_longitude=71.00,
        )
        self.assertFalse(result["blocked"])

    def test_route_detects_geofence_category(self):
        """A route crossing an MPA polygon must detect the MPA category."""
        # MPA polygon is [Lon 72.30-72.50, Lat 19.40-19.60]
        result = check_route_segment_intersection(
            start_latitude=19.30,
            start_longitude=72.40,
            end_latitude=19.70,
            end_longitude=72.40,
        )
        self.assertTrue(result["intersects"])
        mpa_intersection = next((i for i in result["intersections"] if i["category"] == "mpa"), None)
        self.assertIsNotNone(mpa_intersection)
        self.assertEqual(mpa_intersection["name"], "Dummy Marine Protected Test Area")

    def test_phase1_registry_still_works(self):
        """Ensure Phase 1 load_all_geofences registry and category filtering continue working."""
        fc = load_all_geofences(force_reload=True)
        self.assertEqual(fc.get("type"), "FeatureCollection")
        self.assertGreaterEqual(len(fc["features"]), 4)

        mpa_fc = load_all_geofences(category="mpa")
        for feat in mpa_fc["features"]:
            self.assertEqual(feat["properties"]["category"], "mpa")

    def test_api_point_check_endpoint(self):
        """Verify GET /api/orca/geofences/check returns correct status over HTTP."""
        # Test restricted point
        res_restr = self.client.get("/api/orca/geofences/check?latitude=19.05&longitude=72.70")
        self.assertEqual(res_restr.status_code, 200)
        data_restr = res_restr.json()
        self.assertEqual(data_restr["status"], "RESTRICTED")

        # Test safe point
        res_safe = self.client.get("/api/orca/geofences/check?latitude=15.5&longitude=70.0")
        self.assertEqual(res_safe.status_code, 200)
        data_safe = res_safe.json()
        self.assertEqual(data_safe["status"], "SAFE")

    def test_api_route_check_endpoint(self):
        """Verify POST /api/orca/geofences/route-check returns correct intersection over HTTP."""
        payload = {
            "start": [18.80, 72.70],
            "end": [19.30, 72.70],
        }
        response = self.client.post("/api/orca/geofences/route-check", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["intersects"])
        self.assertTrue(data["blocked"])
        self.assertGreater(len(data["intersections"]), 0)


if __name__ == "__main__":
    unittest.main()
