"""
Unit & Integration Tests for Agent #5: Risk Agent
-------------------------------------------------
Validates:
1. Completely safe conditions -> SAFE
2. Moderate environmental conditions -> CAUTION
3. High environmental conditions -> HIGH_RISK
4. Very high environmental conditions -> NOT_RECOMMENDED
5. SVAS "should not sail" -> risk 100 / NOT_RECOMMENDED
6. Active cyclone hard stop -> risk 100 / NOT_RECOMMENDED
7. Active tsunami hard stop -> risk 100 / NOT_RECOMMENDED
8. Missing current data -> proportional weight renormalization without assuming 0 risk
9. Missing ocean analysis / weather data -> appropriate data quality tracking
10. PFZ distance independence -> PFZ location never affects safety score
11. Numerical formula precision -> exact verification against known example (Score: 47)
12. Malformed / empty / None agent inputs handled safely without raising exceptions
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

from agents.risk.main import (
    calculate_risk,
    calculate_wave_risk,
    calculate_wind_risk,
    calculate_gust_risk,
    calculate_current_risk,
    calculate_lightning_risk,
    calculate_other_ocean_risk,
    classify_status,
)


class TestRiskAgent(unittest.TestCase):

    def setUp(self):
        self.lat = 18.95
        self.lon = 72.80
        self.date = "2026-09-04"
        self.boat_width = 2.5

    # -----------------------------------------------------------------------
    # 1. Known Numerical Example Verification
    # -----------------------------------------------------------------------
    def test_known_numerical_example(self):
        """
        Verify exact formula against prompt's known example:
        WaveRisk = 70 (2.1 m)
        WindRisk = 30 (18 kt)
        GustRisk = 70 (27 kt)
        CurrentRisk = 30 (1.5 km/h)
        LightningRisk = 50 (elevated convective)
        OtherOceanRisk = 0 (none)

        0.30*70 + 0.20*30 + 0.15*70 + 0.15*30 + 0.10*50 + 0.10*0
        = 21.0 + 6.0 + 10.5 + 4.5 + 5.0 + 0.0 = 47.0
        risk_score = 47, status = CAUTION
        """
        marine_weather = {
            "status": "success",
            "marine": {
                "wave_height_m": 2.1,
                "ocean_current_velocity_kmh": 1.5,
            },
            "weather": {
                "wind_speed_knots": 18.0,
                "wind_gusts_knots": 27.0,
            },
        }
        ocean_analysis = {
            "status": "partial",
            "lightning": {
                "available": True,
                "data": {
                    "elevated_convective_risk": True,
                    "thunderstorm_active": False,
                },
            },
            "warnings": [],
        }
        svas = {
            "status": "success",
            "advisory": {
                "severity": "safe",
                "message": "Safe for fishing operations.",
            },
        }

        res = calculate_risk(
            latitude=self.lat,
            longitude=self.lon,
            date=self.date,
            boat_width_m=self.boat_width,
            marine_weather_result=marine_weather,
            ocean_analysis_result=ocean_analysis,
            svas_result=svas,
        )

        self.assertEqual(res["risk_score"], 47)
        self.assertEqual(res["status"], "CAUTION")
        self.assertFalse(res["hard_override"])
        self.assertEqual(res["data_quality"], "good")

    # -----------------------------------------------------------------------
    # 2. Environmental Conditions Status Bands
    # -----------------------------------------------------------------------
    def test_completely_safe_conditions(self):
        """Calm sea and breeze should yield SAFE (0-29)."""
        marine_weather = {
            "status": "success",
            "marine": {"wave_height_m": 0.5, "ocean_current_velocity_kmh": 0.4},
            "weather": {"wind_speed_knots": 6.0, "wind_gusts_knots": 10.0},
        }
        ocean_analysis = {
            "status": "success",
            "lightning": {"available": True, "data": {"elevated_convective_risk": False, "thunderstorm_active": False}},
            "warnings": [],
        }
        svas = {
            "status": "success",
            "advisory": {"severity": "safe", "message": "Normal sea conditions."},
        }

        res = calculate_risk(
            self.lat, self.lon, self.date, self.boat_width,
            marine_weather_result=marine_weather,
            ocean_analysis_result=ocean_analysis,
            svas_result=svas,
        )
        self.assertEqual(res["risk_score"], 0)
        self.assertEqual(res["status"], "SAFE")

    def test_high_environmental_conditions(self):
        """Rough sea conditions should yield HIGH_RISK (60-79)."""
        marine_weather = {
            "status": "success",
            "marine": {"wave_height_m": 2.5, "ocean_current_velocity_kmh": 2.2},
            "weather": {"wind_speed_knots": 24.0, "wind_gusts_knots": 28.0},
        }
        ocean_analysis = {
            "status": "partial",
            "lightning": {"available": True, "data": {"elevated_convective_risk": True, "thunderstorm_active": False}},
            "warnings": [],
        }
        svas = {
            "status": "success",
            "advisory": {"severity": "caution", "message": "Caution advised."},
        }

        res = calculate_risk(
            self.lat, self.lon, self.date, self.boat_width,
            marine_weather_result=marine_weather,
            ocean_analysis_result=ocean_analysis,
            svas_result=svas,
        )
        # 0.30*70 + 0.20*70 + 0.15*70 + 0.15*70 + 0.10*50 + 0.10*0 = 21 + 14 + 10.5 + 10.5 + 5 = 61
        self.assertEqual(res["risk_score"], 61)
        self.assertEqual(res["status"], "HIGH_RISK")

    def test_very_high_environmental_conditions(self):
        """Severe gale/waves without hard stop should yield NOT_RECOMMENDED (80-100)."""
        marine_weather = {
            "status": "success",
            "marine": {"wave_height_m": 3.8, "ocean_current_velocity_kmh": 3.4},
            "weather": {"wind_speed_knots": 34.0, "wind_gusts_knots": 42.0},
        }
        ocean_analysis = {
            "status": "success",
            "lightning": {"available": True, "data": {"elevated_convective_risk": True, "thunderstorm_active": True}},
            "warnings": [{"type": "severe_sea", "severity": "high", "message": "Very rough seas."}],
        }
        svas = {
            "status": "success",
            "advisory": {"severity": "caution", "message": "High waves."},
        }

        res = calculate_risk(
            self.lat, self.lon, self.date, self.boat_width,
            marine_weather_result=marine_weather,
            ocean_analysis_result=ocean_analysis,
            svas_result=svas,
        )
        self.assertEqual(res["risk_score"], 100)
        self.assertEqual(res["status"], "NOT_RECOMMENDED")

    # -----------------------------------------------------------------------
    # 3. Hard Safety Overrides
    # -----------------------------------------------------------------------
    def test_svas_should_not_sail_override(self):
        """SVAS 'should not sail' must immediately trigger risk=100 and NOT_RECOMMENDED."""
        # Even with completely calm weather (wave=0.2m, wind=2kt)
        marine_weather = {
            "status": "success",
            "marine": {"wave_height_m": 0.2, "ocean_current_velocity_kmh": 0.2},
            "weather": {"wind_speed_knots": 2.0, "wind_gusts_knots": 4.0},
        }
        svas = {
            "status": "success",
            "advisory": {
                "severity": "danger",
                "message": "Boats with width < 3m should not sail due to swell surge.",
            },
        }

        res = calculate_risk(
            self.lat, self.lon, self.date, self.boat_width,
            marine_weather_result=marine_weather,
            svas_result=svas,
        )
        self.assertEqual(res["risk_score"], 100)
        self.assertEqual(res["status"], "NOT_RECOMMENDED")
        self.assertTrue(res["hard_override"])
        self.assertEqual(res["override_reason"], "SVAS_SHOULD_NOT_SAIL")

    def test_cyclone_hard_stop(self):
        """Active cyclone warning in ocean analysis must immediately trigger risk=100."""
        ocean_analysis = {
            "status": "success",
            "cyclone": {
                "available": True,
                "data": {"active_cyclones": [{"name": "Cyclone Vayu", "intensity": "Severe"}]},
            },
            "warnings": [{"type": "tropical_cyclone", "severity": "critical", "message": "Cyclone approaching"}],
        }

        res = calculate_risk(
            self.lat, self.lon, self.date, self.boat_width,
            ocean_analysis_result=ocean_analysis,
        )
        self.assertEqual(res["risk_score"], 100)
        self.assertEqual(res["status"], "NOT_RECOMMENDED")
        self.assertTrue(res["hard_override"])
        self.assertEqual(res["override_reason"], "ACTIVE_CYCLONE_WARNING")

    def test_tsunami_hard_stop(self):
        """Active tsunami warning must immediately trigger risk=100."""
        ocean_analysis = {
            "status": "success",
            "tsunami": {
                "available": True,
                "events": [
                    {
                        "event_id": "tsunami_001",
                        "bulletin_number": 3,
                        "magnitude": 7.8,
                        "region": "Nicobar Islands",
                        "evaluation": "Tsunami Warning in effect",
                    }
                ],
            },
            "warnings": [{"type": "tsunami_hazard", "severity": "critical", "message": "Tsunami Warning"}],
        }

        res = calculate_risk(
            self.lat, self.lon, self.date, self.boat_width,
            ocean_analysis_result=ocean_analysis,
        )
        self.assertEqual(res["risk_score"], 100)
        self.assertEqual(res["status"], "NOT_RECOMMENDED")
        self.assertTrue(res["hard_override"])
        self.assertEqual(res["override_reason"], "ACTIVE_TSUNAMI_WARNING")

    # -----------------------------------------------------------------------
    # 4. Weight Renormalization & Missing Data Handling
    # -----------------------------------------------------------------------
    def test_missing_current_weight_renormalization(self):
        """
        Missing ocean current must NOT be assumed 0.
        Its 0.15 weight must be removed and remaining weights normalized to sum to 1.0.
        """
        marine_weather = {
            "status": "success",
            "marine": {
                "wave_height_m": 2.1,  # risk 70 (base weight 0.30)
                "ocean_current_velocity_kmh": None,  # MISSING
            },
            "weather": {
                "wind_speed_knots": 18.0,  # risk 30 (base weight 0.20)
                "wind_gusts_knots": 27.0,  # risk 70 (base weight 0.15)
            },
        }
        ocean_analysis = {
            "status": "partial",
            "lightning": {"available": True, "data": {"elevated_convective_risk": True}},  # risk 50 (base weight 0.10)
            "warnings": [],  # risk 0 (base weight 0.10)
        }

        res = calculate_risk(
            self.lat, self.lon, self.date, self.boat_width,
            marine_weather_result=marine_weather,
            ocean_analysis_result=ocean_analysis,
        )

        self.assertIn("ocean_current", res["missing_factors"])

        # Remaining available base weights sum = 0.30 + 0.20 + 0.15 + 0.10 + 0.10 = 0.85
        # Effective weights:
        # wave: 0.30 / 0.85 = 0.3529 -> contribution = 0.3529 * 70 = 24.70
        # wind: 0.20 / 0.85 = 0.2353 -> contribution = 0.2353 * 30 = 7.06
        # gust: 0.15 / 0.85 = 0.1765 -> contribution = 0.1765 * 70 = 12.35
        # lightning: 0.10 / 0.85 = 0.1176 -> contribution = 0.1176 * 50 = 5.88
        # other: 0.10 / 0.85 = 0.1176 -> contribution = 0.1176 * 0 = 0.0
        # Sum = 24.70 + 7.06 + 12.35 + 5.88 = 50.0 -> risk_score = 50
        self.assertEqual(res["risk_score"], 50)
        self.assertEqual(res["status"], "CAUTION")

        # Verify sum of effective weights is 1.0
        effective_weights_sum = sum(f["weight"] for f in res["factors"])
        self.assertAlmostEqual(effective_weights_sum, 1.0, places=3)

    # -----------------------------------------------------------------------
    # 5. PFZ Independence (PFZ is not a safety factor)
    # -----------------------------------------------------------------------
    def test_pfz_independence(self):
        """PFZ presence, distance, or absence must NEVER alter the safety risk score."""
        mw = {
            "status": "success",
            "marine": {"wave_height_m": 1.5, "ocean_current_velocity_kmh": 1.2},
            "weather": {"wind_speed_knots": 12.0, "wind_gusts_knots": 18.0},
        }

        # Run with close PFZ
        pfz_close = {
            "status": "success",
            "nearest_pfz": {"distance_km": 2.5, "category": "PFZ"},
        }
        res_close = calculate_risk(self.lat, self.lon, self.date, self.boat_width,
                                  marine_weather_result=mw, pfz_result=pfz_close)

        # Run with far PFZ
        pfz_far = {
            "status": "success",
            "nearest_pfz": {"distance_km": 350.0, "category": "PFZ"},
        }
        res_far = calculate_risk(self.lat, self.lon, self.date, self.boat_width,
                                marine_weather_result=mw, pfz_result=pfz_far)

        # Run with no PFZ
        res_none = calculate_risk(self.lat, self.lon, self.date, self.boat_width,
                                 marine_weather_result=mw, pfz_result=None)

        self.assertEqual(res_close["risk_score"], res_far["risk_score"])
        self.assertEqual(res_close["risk_score"], res_none["risk_score"])
        self.assertEqual(res_close["status"], res_far["status"])

    # -----------------------------------------------------------------------
    # 6. Malformed & Safe Empty Input Handling
    # -----------------------------------------------------------------------
    def test_empty_and_malformed_inputs_handled_safely(self):
        """Completely empty/None upstream responses must not crash the agent."""
        res_all_none = calculate_risk(
            self.lat, self.lon, self.date, self.boat_width,
            pfz_result=None,
            marine_weather_result=None,
            svas_result=None,
            ocean_analysis_result=None,
        )
        self.assertEqual(res_all_none["agent"], "risk")
        self.assertEqual(res_all_none["status"], "NOT_RECOMMENDED")
        self.assertEqual(res_all_none["data_quality"], "insufficient")
        self.assertTrue(len(res_all_none["missing_factors"]) > 0)

        # Partial malformed types
        malformed_mw = {"status": "error", "marine": "invalid", "weather": None}
        res_malformed = calculate_risk(
            self.lat, self.lon, self.date, self.boat_width,
            marine_weather_result=malformed_mw,
        )
        self.assertEqual(res_malformed["agent"], "risk")


if __name__ == "__main__":
    print("=" * 70)
    print("RUNNING RISK AGENT TEST SUITE")
    print("=" * 70)
    unittest.main(verbosity=2)
