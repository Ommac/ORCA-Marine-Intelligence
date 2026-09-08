"""
ORCA Marine Intelligence - Phase 2 Verification Test Suite
-----------------------------------------------------------
Tests the Visual "WHY?" Risk Explanation System:
1. Single deterministic source of truth (agents/risk/main.py).
2. Clear 3-state decisions: 🟢 GO / 🟡 CAUTION / 🔴 DON'T GO.
3. Visual factor breakdowns (Waves, Wind, Gusts, Current, Thunderstorm/Lightning, SVAS).
4. Dominant hazard identification for conflicting conditions.
5. Missing data handling (⚪ Data unavailable, never green/safe).
6. Vessel-specific context (e.g. 5.0m vessel).
7. Independent display relevance control (display.risk_explanation vs display.pfz).
"""

import os
import sys
import unittest

# Ensure workspace root is in sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
_root_dir = os.path.abspath(os.path.join(_current_dir, "..", ".."))
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

from agents.risk.main import calculate_risk
from agents.orchestrator.session_store import clear_session
from agents.orchestrator.graph import run_orca


class TestPhase2RiskExplanation(unittest.TestCase):
    def setUp(self):
        self.lat = 19.72
        self.lon = 72.70
        self.date = "2026-09-08"
        self.session_id = "test-phase2-sess-001"
        clear_session(self.session_id)

    def tearDown(self):
        clear_session(self.session_id)

    def test_01_low_risk_go_decision(self):
        """TEST 1: Low risk conditions produce 🟢 GO decision with safe factor statuses."""
        marine_mock = {
            "status": "success",
            "weather": {
                "wind_speed_knots": 6.5,
                "wind_gusts_knots": 10.0,
                "temperature_c": 28.0,
            },
            "marine": {
                "wave_height_m": 0.8,
                "wave_period_seconds": 6.0,
                "ocean_current_velocity_kmh": 0.5,
                "sea_surface_temperature_c": 29.0,
            },
        }
        svas_mock = {"status": "success", "advisory": {"severity": "normal"}}
        ocean_mock = {"status": "success", "warnings": []}

        risk_res = calculate_risk(
            latitude=self.lat,
            longitude=self.lon,
            date=self.date,
            boat_width_m=5.0,
            marine_weather_result=marine_mock,
            svas_result=svas_mock,
            ocean_analysis_result=ocean_mock,
        )

        self.assertIn("explanation_card", risk_res)
        card = risk_res["explanation_card"]

        self.assertEqual(card["decision"], "GO")
        self.assertIn("GO", card["decision_label"])
        self.assertLess(card["risk_score"], 35)
        self.assertEqual(card["vessel_evaluated"], "5.0m Vessel Evaluated")
        self.assertEqual(card["action_guidance"]["urgency"], "routine")

        # Verify factors breakdown
        factor_names = [f["name"] for f in card["factors"]]
        self.assertIn("Wave Height", factor_names)
        self.assertIn("Wind Speed", factor_names)
        for f in card["factors"]:
            if f["status"] != "unavailable":
                self.assertEqual(f["status"], "safe")

    def test_02_moderate_risk_caution_decision(self):
        """TEST 2: Marginal sea conditions produce 🟡 CAUTION decision with appropriate warnings."""
        marine_mock = {
            "status": "success",
            "weather": {
                "wind_speed_knots": 18.0,
                "wind_gusts_knots": 24.0,
                "temperature_c": 27.0,
            },
            "marine": {
                "wave_height_m": 1.8,
                "wave_period_seconds": 7.0,
                "ocean_current_velocity_kmh": 1.5,
                "sea_surface_temperature_c": 28.5,
            },
        }
        svas_mock = {"status": "success", "advisory": {"severity": "caution", "message": "Moderate coastal chop expected for small craft."}}
        ocean_mock = {"status": "success", "warnings": []}

        risk_res = calculate_risk(
            latitude=self.lat,
            longitude=self.lon,
            date=self.date,
            boat_width_m=5.0,
            marine_weather_result=marine_mock,
            svas_result=svas_mock,
            ocean_analysis_result=ocean_mock,
        )

        card = risk_res["explanation_card"]
        self.assertEqual(card["decision"], "CAUTION")
        self.assertIn("CAUTION", card["decision_label"])
        self.assertGreaterEqual(card["risk_score"], 25)
        self.assertLess(card["risk_score"], 70)
        self.assertEqual(card["action_guidance"]["urgency"], "moderate")

        # Waves or wind should be flagged as caution
        caution_factors = [f for f in card["factors"] if f["status"] == "caution"]
        self.assertGreaterEqual(len(caution_factors), 1)

    def test_03_high_risk_dont_go_decision(self):
        """TEST 3: Hazardous sea conditions produce 🔴 DON'T GO decision with critical directives."""
        marine_mock = {
            "status": "success",
            "weather": {
                "wind_speed_knots": 32.0,
                "wind_gusts_knots": 42.0,
                "temperature_c": 26.0,
            },
            "marine": {
                "wave_height_m": 3.4,
                "wave_period_seconds": 8.0,
                "ocean_current_velocity_kmh": 2.5,
                "sea_surface_temperature_c": 28.0,
            },
        }
        svas_mock = {"status": "success", "advisory": {"severity": "normal"}}
        ocean_mock = {"status": "success", "warnings": []}

        risk_res = calculate_risk(
            latitude=self.lat,
            longitude=self.lon,
            date=self.date,
            boat_width_m=5.0,
            marine_weather_result=marine_mock,
            svas_result=svas_mock,
            ocean_analysis_result=ocean_mock,
        )

        card = risk_res["explanation_card"]
        self.assertEqual(card["decision"], "DONT_GO")
        self.assertIn("DON'T GO", card["decision_label"])
        self.assertGreaterEqual(card["risk_score"], 70)
        self.assertEqual(card["action_guidance"]["urgency"], "critical")
        self.assertIsNotNone(card["dominant_hazard"])

        # Factors should be sorted by severity with danger factors first
        self.assertEqual(card["factors"][0]["status"], "danger")

    def test_04_conflicting_conditions_dominant_hazard(self):
        """TEST 4: Conflicting conditions (calm waves but severe lightning/hazard) highlights dominant danger."""
        marine_mock = {
            "status": "success",
            "weather": {
                "wind_speed_knots": 7.0,
                "wind_gusts_knots": 10.0,
                "temperature_c": 28.0,
            },
            "marine": {
                "wave_height_m": 0.7,
                "wave_period_seconds": 6.0,
                "ocean_current_velocity_kmh": 0.5,
                "sea_surface_temperature_c": 29.0,
            },
        }
        svas_mock = {"status": "success", "advisory": {"severity": "normal"}}
        ocean_mock = {
            "status": "success",
            "warnings": [
                {
                    "type": "Thunderstorm / Lightning",
                    "severity": "HIGH",
                    "message": "Severe squall line and cloud-to-water lightning strikes detected.",
                }
            ],
        }

        risk_res = calculate_risk(
            latitude=self.lat,
            longitude=self.lon,
            date=self.date,
            boat_width_m=5.0,
            marine_weather_result=marine_mock,
            svas_result=svas_mock,
            ocean_analysis_result=ocean_mock,
        )

        card = risk_res["explanation_card"]
        self.assertIn(card["decision"], ["CAUTION", "DONT_GO"])
        self.assertIsNotNone(card["dominant_hazard"])
        self.assertIn("Thunderstorm", card["dominant_hazard"])

        # Severe lightning factor must be prominent
        lightning_factors = [f for f in card["factors"] if "Thunderstorm" in f["name"] or "Lightning" in f["name"]]
        self.assertEqual(len(lightning_factors), 1)
        self.assertEqual(lightning_factors[0]["status"], "danger")

    def test_05_missing_data_labeled_unavailable(self):
        """TEST 5: Missing or failed agent feeds are explicitly labeled 'unavailable' (never safe)."""
        marine_mock = {
            "status": "partial",
            "weather": {
                "wind_speed_knots": 8.0,
                "wind_gusts_knots": 12.0,
            },
            "marine": {
                "wave_height_m": 1.0,
                # ocean_current_velocity_kmh is missing
            },
        }
        svas_mock = {"status": "error"}  # SVAS failed
        ocean_mock = {"status": "success", "warnings": []}

        risk_res = calculate_risk(
            latitude=self.lat,
            longitude=self.lon,
            date=self.date,
            boat_width_m=5.0,
            marine_weather_result=marine_mock,
            svas_result=svas_mock,
            ocean_analysis_result=ocean_mock,
        )

        card = risk_res["explanation_card"]
        unavailable_factors = [f for f in card["factors"] if f["status"] == "unavailable"]
        self.assertGreaterEqual(len(unavailable_factors), 1)
        
        # Verify unavailable factor format
        for uf in unavailable_factors:
            self.assertEqual(uf["value_formatted"], "Data unavailable")
            self.assertIn("unavailable", uf["interpretation"].lower())

    def test_06_hard_safety_override_svas(self):
        """TEST 6: Hard safety override (e.g. SVAS alert for boat under 6m) triggers immediate DON'T GO."""
        marine_mock = {
            "status": "success",
            "weather": {"wind_speed_knots": 10.0, "wind_gusts_knots": 15.0},
            "marine": {"wave_height_m": 1.2},
        }
        svas_mock = {
            "status": "success",
            "advisory": {
                "severity": "alert",
                "boat_category": "under_6m",
                "message": "Small craft advisory active. Boats under 6m should not sail.",
            },
        }
        ocean_mock = {"status": "success", "warnings": []}

        risk_res = calculate_risk(
            latitude=self.lat,
            longitude=self.lon,
            date=self.date,
            boat_width_m=5.0,
            marine_weather_result=marine_mock,
            svas_result=svas_mock,
            ocean_analysis_result=ocean_mock,
        )

        card = risk_res["explanation_card"]
        self.assertEqual(card["decision"], "DONT_GO")
        self.assertEqual(card["risk_score"], 100)
        self.assertIn("INCOIS", card["dominant_hazard"])
        self.assertEqual(card["factors"][0]["status"], "danger")
        self.assertIn("SVAS", card["factors"][0]["name"])

    def test_07_orchestrator_query_relevance(self):
        """TEST 7: Orchestrator enables display.risk_explanation only for safety queries, not PFZ or general."""
        # A. Safety Query -> display.risk_explanation: True, display.pfz: False
        safety_out = run_orca(
            latitude=self.lat,
            longitude=self.lon,
            query="Is it safe for me to go fishing tomorrow?",
            session_id=self.session_id,
        )
        self.assertTrue(safety_out["display"]["risk_explanation"], "Safety inquiry MUST set display.risk_explanation: True")
        self.assertFalse(safety_out["display"]["pfz"], "Safety inquiry MUST set display.pfz: False")
        self.assertIn("risk_explanation", safety_out)
        self.assertIn("decision", safety_out["risk_explanation"])

        # B. PFZ Query -> display.risk_explanation: False, display.pfz: True
        pfz_out = run_orca(
            latitude=self.lat,
            longitude=self.lon,
            query="Where is the nearest fishing zone?",
            session_id=self.session_id,
        )
        self.assertFalse(pfz_out["display"]["risk_explanation"], "PFZ inquiry MUST set display.risk_explanation: False")
        self.assertTrue(pfz_out["display"]["pfz"], "PFZ inquiry MUST set display.pfz: True")

        # C. General Query -> display.risk_explanation: False, display.pfz: False
        general_out = run_orca(
            latitude=self.lat,
            longitude=self.lon,
            query="What is the capital of India?",
            session_id=self.session_id,
        )
        self.assertFalse(general_out["display"]["risk_explanation"], "General inquiry MUST set display.risk_explanation: False")
        self.assertFalse(general_out["display"]["pfz"], "General inquiry MUST set display.pfz: False")

    def test_08_no_duplicate_safety_output_in_text(self):
        """TEST 8: Chat recommendation text must NOT prepend legacy uppercase status headers."""
        safety_out = run_orca(
            latitude=self.lat,
            longitude=self.lon,
            query="Is it safe to go fishing today?",
            session_id=self.session_id,
        )
        rec_text = safety_out.get("recommendation", "")
        # Ensure raw uppercase status prefix strings are not injected into natural conversation text
        self.assertNotIn("CONDITIONS GENERALLY FAVOURABLE", rec_text)
        self.assertNotIn("NOT RECOMMENDED (Risk Score:", rec_text)
        self.assertNotIn("CAUTION REQUIRED (Risk Score:", rec_text)
        self.assertNotIn("EXTREME DANGER (Risk Score:", rec_text)
        
        # Risk explanation card is still populated cleanly for UI rendering
        self.assertIn("risk_explanation", safety_out)
        self.assertIn("decision", safety_out["risk_explanation"])

    def test_09_primary_thing_to_watch_when_go(self):
        """TEST 9: Conditions that are overall GO with a minor caution factor return GO with primary_thing_to_watch."""
        marine_mock = {
            "status": "success",
            "weather": {
                "wind_speed_knots": 8.0,
                "wind_gusts_knots": 11.0,
                "temperature_c": 28.0,
            },
            "marine": {
                "wave_height_m": 0.9,
                "wave_period_seconds": 6.0,
                "ocean_current_velocity_kmh": 1.8,  # Minor caution factor
                "sea_surface_temperature_c": 29.0,
            },
        }
        svas_mock = {"status": "success", "advisory": {"severity": "normal"}}
        ocean_mock = {"status": "success", "warnings": []}

        risk_res = calculate_risk(
            latitude=self.lat,
            longitude=self.lon,
            date=self.date,
            boat_width_m=5.0,
            marine_weather_result=marine_mock,
            svas_result=svas_mock,
            ocean_analysis_result=ocean_mock,
        )

        card = risk_res["explanation_card"]
        self.assertEqual(card["decision"], "GO", "Minor current should not force overall CAUTION override when score is low")
        self.assertEqual(card["primary_thing_to_watch"], "Ocean Current")
        self.assertIsNotNone(card["primary_thing_to_watch_reason"])
        self.assertTrue("1.8 km/h" in card["primary_thing_to_watch_reason"] or "drift" in card["primary_thing_to_watch_reason"].lower())


if __name__ == "__main__":
    unittest.main()
