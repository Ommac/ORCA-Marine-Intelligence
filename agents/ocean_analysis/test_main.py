"""
Unit & Integration Tests for Agent #4: Ocean Analysis Agent
------------------------------------------------------------
Validates:
1. Public entry point `analyze_ocean_conditions`
2. Input validation (lat/lon bounds, date format)
3. Chlorophyll source resilience
4. Cyclone source resilience
5. Lightning / Convective activity parsing & fallback
6. Tsunami source parsing & seismic distance calculation
7. Partial failure handling & status calculation
8. Freshness timestamps
9. Schema compliance (JSON-serializability, field presence)
10. Absence of fabricated data and absence of risk scores (SAFE/CAUTION/NOT_RECOMMENDED)
"""

import os
import sys
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import json
import unittest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock

import requests

from agents.ocean_analysis.main import (
    analyze_ocean_conditions,
    extract_environmental_warnings,
    validate_ocean_analysis_inputs,
)
from agents.ocean_analysis.sources import (
    haversine_distance_km,
    fetch_chlorophyll_data,
    fetch_cyclone_data,
    fetch_lightning_data,
    fetch_tsunami_data,
    describe_weather_code,
    categorize_cape,
)


class TestOceanAnalysisAgent(unittest.TestCase):

    def setUp(self):
        self.sample_lat = 18.95
        self.sample_lon = 72.80
        self.sample_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # -----------------------------------------------------------------------
    # 1. Input Validation Tests
    # -----------------------------------------------------------------------
    def test_input_validation_valid(self):
        """Valid coordinates and dates should not raise any exception."""
        validate_ocean_analysis_inputs(18.95, 72.80, "2026-09-03")
        validate_ocean_analysis_inputs(-45.0, 120.0, "2026-01-01")
        validate_ocean_analysis_inputs(0.0, 0.0, "2026-12-31")

    def test_input_validation_invalid_latitude(self):
        """Invalid latitudes should raise ValueError."""
        with self.assertRaises(ValueError):
            validate_ocean_analysis_inputs(95.0, 72.80, "2026-09-03")
        with self.assertRaises(ValueError):
            validate_ocean_analysis_inputs(-90.1, 72.80, "2026-09-03")

    def test_input_validation_invalid_longitude(self):
        """Invalid longitudes should raise ValueError."""
        with self.assertRaises(ValueError):
            validate_ocean_analysis_inputs(18.95, 185.0, "2026-09-03")
        with self.assertRaises(ValueError):
            validate_ocean_analysis_inputs(18.95, -181.0, "2026-09-03")

    def test_input_validation_invalid_types(self):
        """Non-numeric coordinates should raise TypeError."""
        with self.assertRaises(TypeError):
            validate_ocean_analysis_inputs("18.95", 72.80, "2026-09-03")  # type: ignore
        with self.assertRaises(TypeError):
            validate_ocean_analysis_inputs(18.95, None, "2026-09-03")  # type: ignore

    def test_input_validation_invalid_date(self):
        """Invalid date strings should raise ValueError."""
        with self.assertRaises(ValueError):
            validate_ocean_analysis_inputs(18.95, 72.80, "invalid-date")
        with self.assertRaises(ValueError):
            validate_ocean_analysis_inputs(18.95, 72.80, "2026/09/03")

    # -----------------------------------------------------------------------
    # 2. Spatial Utility Tests
    # -----------------------------------------------------------------------
    def test_haversine_distance(self):
        """Haversine distance calculation should be mathematically accurate."""
        # Mumbai (18.95, 72.80) to Kochi (9.93, 76.26) is approx 1060 km
        dist = haversine_distance_km(18.95, 72.80, 9.93, 76.26)
        self.assertGreater(dist, 1000.0)
        self.assertLess(dist, 1150.0)

        # Same point should be 0.0 km
        self.assertEqual(haversine_distance_km(18.95, 72.80, 18.95, 72.80), 0.0)

    # -----------------------------------------------------------------------
    # 3. Source Fetcher Mock & Error Handling Tests
    # -----------------------------------------------------------------------
    @patch("agents.ocean_analysis.sources.requests.get")
    def test_chlorophyll_404_handling(self, mock_get):
        """MOSDAC 404 should return available: False without crashing."""
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_resp.reason = "Not Found"
        mock_get.return_value = mock_resp

        res = fetch_chlorophyll_data(18.95, 72.80, "2026-09-03")
        self.assertFalse(res["available"])
        self.assertIsNone(res["data"])
        self.assertIn("404", res["reason"])

    @patch("agents.ocean_analysis.sources.requests.get")
    def test_cyclone_offline_handling(self, mock_get):
        """INCOIS cyclone failure should return available: False with clear reason."""
        mock_resp = MagicMock()
        mock_resp.status_code = 403
        mock_get.return_value = mock_resp

        res = fetch_cyclone_data(18.95, 72.80, "2026-09-03")
        self.assertFalse(res["available"])
        self.assertIsNone(res["data"])
        self.assertIn("403", res["reason"])

    @patch("agents.ocean_analysis.sources.requests.get")
    def test_tsunami_parsing_and_filtering(self, mock_get):
        """Tsunami GeoJSON should parse seismic properties and calculate distances."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {
                        "EVID": "incois2026test",
                        "BTYPE": "I",
                        "BULNO": 1,
                        "MAGNITUDE": 6.8,
                        "OT": "2026-08-20 23:30:00.0",
                        "LONGITUDE": 73.0,
                        "LATITUDE": 19.0,
                        "DEPTH": 10.0,
                        "OCEAN_LAND": "O",
                        "REGIONNAME": "Arabian Sea",
                        "EVALUATION": "No Tsunami Threat",
                        "detail": "https://incois.gov.in/test",
                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [73.0, 19.0],
                    },
                }
            ],
        }
        mock_get.return_value = mock_resp

        res = fetch_tsunami_data(18.95, 72.80, radius_km=500.0)
        self.assertTrue(res["available"])
        self.assertEqual(len(res["events"]), 1)
        event = res["events"][0]
        self.assertEqual(event["event_id"], "incois2026test")
        self.assertEqual(event["magnitude"], 6.8)
        self.assertEqual(event["region"], "Arabian Sea")
        self.assertLess(event["distance_km"], 100.0)

    @patch("agents.ocean_analysis.sources.requests.get")
    def test_tsunami_connection_timeout(self, mock_get):
        """Tsunami API timeout should cleanly return available: False, NOT 'no tsunami'."""
        mock_get.side_effect = requests.exceptions.ConnectTimeout("Connection timed out")

        res = fetch_tsunami_data(18.95, 72.80)
        self.assertFalse(res["available"])
        self.assertEqual(res["events"], [])
        self.assertIn("failed", res["reason"].lower())

    # -----------------------------------------------------------------------
    # 4. Warnings Extraction Tests
    # -----------------------------------------------------------------------
    def test_extract_warnings_factual(self):
        """Verify factual hazard extraction without risk decision calculation."""
        cyclone_res = {"available": False, "data": None}
        lightning_res = {
            "available": True,
            "data": {
                "thunderstorm_active": True,
                "weather_code": 95,
                "weather_description": "Thunderstorm: Slight or moderate",
            },
        }
        tsunami_res = {
            "available": True,
            "events": [
                {
                    "event_id": "test1",
                    "bulletin_number": 2,
                    "magnitude": 7.5,
                    "region": "Sumatra Coast",
                    "distance_km": 800.0,
                    "evaluation": "Tsunami Warning in effect",
                }
            ],
        }

        warnings = extract_environmental_warnings(cyclone_res, lightning_res, tsunami_res)
        self.assertEqual(len(warnings), 2)
        warning_types = [w["type"] for w in warnings]
        self.assertIn("tsunami_hazard", warning_types)
        self.assertIn("active_thunderstorm", warning_types)

    # -----------------------------------------------------------------------
    # 5. Live Agent Execution & Schema Validation
    # -----------------------------------------------------------------------
    def test_live_analyze_ocean_conditions(self):
        """Run the actual live agent against real endpoints and verify normalized schema."""
        result = analyze_ocean_conditions(self.sample_lat, self.sample_lon, self.sample_date)

        # 1. Base agent identification
        self.assertEqual(result["agent"], "ocean_analysis")
        self.assertIn(result["status"], ["success", "partial", "unavailable"])
        self.assertEqual(result["location"]["latitude"], self.sample_lat)
        self.assertEqual(result["location"]["longitude"], self.sample_lon)
        self.assertEqual(result["requested_date"], self.sample_date)

        # 2. Source blocks presence
        for section in ["chlorophyll", "cyclone", "lightning", "tsunami", "warnings", "source_status", "freshness"]:
            self.assertIn(section, result, f"Missing section '{section}' in agent response.")

        # 3. Source status dictionary presence
        for src in ["chlorophyll", "cyclone", "lightning", "tsunami"]:
            self.assertIn(src, result["source_status"])
            self.assertIn(result["source_status"][src], ["success", "unavailable"])

        # 4. Freshness metadata
        self.assertIn("query_timestamp", result["freshness"])
        self.assertIn("requested_date", result["freshness"])

        # 5. Ensure NO risk score or trip-decision keys are present
        forbidden_keys = [
            "risk_score",
            "risk_level",
            "trip_recommendation",
            "SAFE",
            "CAUTION",
            "NOT_RECOMMENDED",
            "risk_weights",
            "final_safety_decision",
        ]
        for k in forbidden_keys:
            self.assertNotIn(k, result, f"Forbidden risk key '{k}' found in Ocean Analysis Agent output!")

        # 6. JSON serialization check
        json_output = json.dumps(result, indent=2, default=str)
        self.assertTrue(len(json_output) > 50)


if __name__ == "__main__":
    print("=" * 70)
    print("RUNNING OCEAN ANALYSIS AGENT TEST SUITE")
    print("=" * 70)

    # Run unit tests
    suite = unittest.TestLoader().loadTestsFromTestCase(TestOceanAnalysisAgent)
    runner = unittest.TextTestRunner(verbosity=2)
    test_res = runner.run(suite)

    # Run live sample and print complete JSON response
    print("\n" + "=" * 70)
    print("LIVE OCEAN ANALYSIS OUTPUT FOR MUMBAI COAST (18.95°N, 72.80°E)")
    print("=" * 70)
    sample_response = analyze_ocean_conditions(18.95, 72.80, datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    print(json.dumps(sample_response, indent=2, default=str))

    if test_res.wasSuccessful():
        print("\n✓ ALL AGENT #4 TESTS PASSED SUCCESSFULLY.")
    else:
        print("\n✗ SOME TESTS FAILED.")
        exit(1)
