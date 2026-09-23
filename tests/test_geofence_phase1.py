import os
import sys
import json
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient

from api.main import app

from agents.geofencing.registry import (
    load_all_geofences,
    GEOFENCE_CATEGORIES,
    GEOFENCE_FILES,
    DATA_DIR,
)


class TestGeofencePhase1(unittest.TestCase):
    """Phase 1: Dummy Geofence Data Foundation Verification Suite"""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_all_geojson_files_exist(self):
        """Verify all 4 required dummy GeoJSON files exist on disk."""
        for cat, filename in GEOFENCE_FILES.items():
            path = os.path.join(DATA_DIR, filename)
            self.assertTrue(os.path.exists(path), f"Missing GeoJSON file for {cat}: {filename}")
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.assertEqual(data.get("type"), "FeatureCollection")
                self.assertGreater(len(data.get("features", [])), 0)

    def test_02_load_all_geofences_structure(self):
        """Verify load_all_geofences returns a standard GeoJSON FeatureCollection."""
        fc = load_all_geofences(force_reload=True)
        self.assertEqual(fc.get("type"), "FeatureCollection")
        self.assertIn("features", fc)
        self.assertGreaterEqual(len(fc["features"]), 4)
        self.assertEqual(fc.get("metadata", {}).get("dataset_type"), "DUMMY")

    def test_03_feature_properties_normalization(self):
        """Verify every feature has all required normalized fields and dataset_type=DUMMY."""
        fc = load_all_geofences(force_reload=True)
        required_fields = [
            "id",
            "name",
            "category",
            "category_label",
            "restriction_level",
            "description",
            "dataset_type",
        ]
        for feat in fc["features"]:
            self.assertEqual(feat.get("type"), "Feature")
            props = feat.get("properties", {})
            for field in required_fields:
                self.assertIn(field, props, f"Missing required property {field} in feature {feat}")
                self.assertTrue(props[field] is not None, f"Property {field} is None in {feat}")
            self.assertEqual(props["dataset_type"], "DUMMY")

    def test_04_all_four_categories_represented(self):
        """Verify that eez, restricted_waters, mpa, and ecologically_sensitive are present."""
        fc = load_all_geofences(force_reload=True)
        present_categories = {feat["properties"]["category"] for feat in fc["features"]}
        expected_categories = set(GEOFENCE_CATEGORIES.keys())
        self.assertTrue(expected_categories.issubset(present_categories),
                        f"Expected {expected_categories}, found {present_categories}")

    def test_05_category_filtering(self):
        """Verify filtering by category returns only features of that category."""
        for cat in GEOFENCE_CATEGORIES.keys():
            filtered_fc = load_all_geofences(category=cat)
            self.assertEqual(filtered_fc.get("type"), "FeatureCollection")
            self.assertGreater(len(filtered_fc["features"]), 0)
            for feat in filtered_fc["features"]:
                self.assertEqual(feat["properties"]["category"], cat)

    def test_06_in_memory_caching(self):
        """Verify that multiple load_all_geofences calls reuse the in-memory cache."""
        fc1 = load_all_geofences(force_reload=True)
        fc2 = load_all_geofences(force_reload=False)
        self.assertIs(fc1, fc2, "Cache was not reused when force_reload=False")

    def test_07_api_endpoint_get_all(self):
        """Verify GET /api/orca/geofences returns HTTP 200 and valid FeatureCollection."""
        response = self.client.get("/api/orca/geofences")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("type"), "FeatureCollection")
        self.assertGreaterEqual(len(data.get("features", [])), 4)

    def test_08_api_endpoint_filtered(self):
        """Verify GET /api/orca/geofences?category=restricted_waters returns only filtered items."""
        response = self.client.get("/api/orca/geofences?category=restricted_waters")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get("type"), "FeatureCollection")
        for feat in data.get("features", []):
            self.assertEqual(feat["properties"]["category"], "restricted_waters")

    def test_09_polygon_coordinate_integrity(self):
        """Verify all polygon coordinates are closed rings with valid lon/lat ranges."""
        fc = load_all_geofences(force_reload=True)
        for feat in fc["features"]:
            geom = feat.get("geometry", {})
            geom_type = geom.get("type")
            self.assertIn(geom_type, ["Polygon", "MultiPolygon"])
            if geom_type == "Polygon":
                rings = geom.get("coordinates", [])
                self.assertGreater(len(rings), 0)
                for ring in rings:
                    self.assertGreaterEqual(len(ring), 4, "Polygon ring must have >= 4 coordinates")
                    self.assertEqual(ring[0], ring[-1], "Polygon first and last coordinate must match (closed ring)")
                    for coord in ring:
                        lon, lat = coord[0], coord[1]
                        self.assertTrue(-180.0 <= lon <= 180.0, f"Invalid longitude: {lon}")
                        self.assertTrue(-90.0 <= lat <= 90.0, f"Invalid latitude: {lat}")


if __name__ == "__main__":
    unittest.main()
