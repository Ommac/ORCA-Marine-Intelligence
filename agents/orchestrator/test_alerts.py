"""
ORCA Marine Intelligence - Comprehensive Alerts Test Suite
----------------------------------------------------------
Tests deterministic alert generation across all required marine scenarios:
1. Normal safe marine conditions (no false danger alerts).
2. High wave conditions (high severity weather alert).
3. Severe wave conditions (critical severity weather alert).
4. Strong wind conditions (high severity weather alert).
5. Severe storm wind conditions (critical severity weather alert).
6. Dangerous gust conditions (high severity weather alert).
7. Extreme gust hazard (critical severity weather alert).
8. Tropical cyclone hazard (critical ocean alert).
9. Tsunami hazard (critical ocean alert).
10. Active thunderstorm / lightning hazard (high ocean alert).
11. Convective instability advisory (moderate ocean alert).
12. SVAS should not sail / danger (critical vessel alert).
13. SVAS small vessel alert / warning (high vessel alert).
14. SVAS vessel category notice (vessel notice).
15. Restricted zone / geofencing area (geofence alert).
16. Risk Engine high risk (high risk alert).
17. Risk Engine critical risk (critical risk alert).
18. Deduplication verification (duplicate alerts merged).
19. Request ID correlation (every alert has current request_id).
20. Consecutive assessments isolation (no stale alerts leaked).
"""

from __future__ import annotations

import os
import sys
import unittest

# Ensure root workspace is in sys.path
_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _root not in sys.path:
    sys.path.insert(0, _root)

from agents.orchestrator.graph import generate_deterministic_alerts


class TestOrcaAlerts(unittest.TestCase):

    def test_01_safe_conditions_no_false_danger_alerts(self):
        """Scenario 1: Normal safe marine conditions must produce NO active danger alerts."""
        state = {"request_id": "req-safe-01", "query": "Is it safe to fish?"}
        specialist_results = {
            "marine_weather": {
                "status": "success",
                "marine": {"wave_height_m": 1.0},
                "weather": {"wind_speed_knots": 8.0, "wind_gusts_knots": 12.0},
            },
            "ocean_analysis": {"status": "success", "warnings": []},
            "svas": {
                "status": "success",
                "advisory": {"severity": "safe", "message": "Favourable conditions for fishing."},
            },
        }
        risk_result = {"status": "SAFE", "risk_score": 15, "hard_override": False}
        alerts = generate_deterministic_alerts(state, specialist_results, risk_result)
        self.assertEqual(len(alerts), 0, "Safe conditions must not generate active danger alerts.")

    def test_02_high_wave_alert(self):
        """Scenario 2: Wave height between 2.0m and 3.0m produces high severity weather alert."""
        state = {"request_id": "req-wave-02", "query": "Check sea conditions"}
        specialist_results = {
            "marine_weather": {
                "status": "success",
                "marine": {"wave_height_m": 2.4},
            }
        }
        alerts = generate_deterministic_alerts(state, specialist_results, {})
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["type"], "weather")
        self.assertEqual(alerts[0]["severity"], "high")
        self.assertIn("High Wave", alerts[0]["title"])
        self.assertIn("2.4", alerts[0]["message"])
        self.assertEqual(alerts[0]["source"], "marine_weather")
        self.assertEqual(alerts[0]["request_id"], "req-wave-02")

    def test_03_severe_wave_alert(self):
        """Scenario 3: Wave height >= 3.0m produces critical severity weather alert."""
        state = {"request_id": "req-wave-03"}
        specialist_results = {
            "marine_weather": {
                "status": "success",
                "marine": {"wave_height_m": 3.6},
            }
        }
        alerts = generate_deterministic_alerts(state, specialist_results, {})
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["type"], "weather")
        self.assertEqual(alerts[0]["severity"], "critical")
        self.assertIn("Severe Wave", alerts[0]["title"])

    def test_04_strong_wind_alert(self):
        """Scenario 4: Wind speed between 20kt and 30kt produces high severity weather alert."""
        state = {"request_id": "req-wind-04"}
        specialist_results = {
            "marine_weather": {
                "status": "success",
                "weather": {"wind_speed_knots": 24.0},
            }
        }
        alerts = generate_deterministic_alerts(state, specialist_results, {})
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["severity"], "high")
        self.assertIn("Strong Wind", alerts[0]["title"])

    def test_05_severe_wind_alert(self):
        """Scenario 5: Wind speed >= 30kt produces critical severity gale/storm alert."""
        state = {"request_id": "req-wind-05"}
        specialist_results = {
            "marine_weather": {
                "status": "success",
                "weather": {"wind_speed_knots": 34.0},
            }
        }
        alerts = generate_deterministic_alerts(state, specialist_results, {})
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["severity"], "critical")
        self.assertIn("Gale", alerts[0]["title"])

    def test_06_dangerous_gust_alert(self):
        """Scenario 6: Wind gusts between 25kt and 35kt produce high severity gust alert."""
        state = {"request_id": "req-gust-06"}
        specialist_results = {
            "marine_weather": {
                "status": "success",
                "weather": {"wind_gusts_knots": 28.0},
            }
        }
        alerts = generate_deterministic_alerts(state, specialist_results, {})
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["severity"], "high")
        self.assertIn("Dangerous Gust", alerts[0]["title"])

    def test_07_extreme_gust_alert(self):
        """Scenario 7: Wind gusts >= 35kt produce critical severity gust alert."""
        state = {"request_id": "req-gust-07"}
        specialist_results = {
            "marine_weather": {
                "status": "success",
                "weather": {"wind_gusts_knots": 42.0},
            }
        }
        alerts = generate_deterministic_alerts(state, specialist_results, {})
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["severity"], "critical")
        self.assertIn("Extreme Gust", alerts[0]["title"])

    def test_08_cyclone_hazard_alert(self):
        """Scenario 8: Tropical cyclone notice produces critical ocean hazard alert."""
        state = {"request_id": "req-cyc-08"}
        specialist_results = {
            "ocean_analysis": {
                "status": "success",
                "warnings": [
                    {"type": "tropical_cyclone", "severity": "critical", "message": "Cyclonic storm ASNA tracking NW."}
                ],
            }
        }
        alerts = generate_deterministic_alerts(state, specialist_results, {})
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["type"], "ocean")
        self.assertEqual(alerts[0]["severity"], "critical")
        self.assertIn("Cyclone", alerts[0]["title"])
        self.assertIn("ASNA", alerts[0]["message"])

    def test_09_tsunami_hazard_alert(self):
        """Scenario 9: Tsunami warning produces critical ocean hazard alert."""
        state = {"request_id": "req-tsu-09"}
        specialist_results = {
            "ocean_analysis": {
                "status": "success",
                "warnings": [
                    {"type": "tsunami_hazard", "severity": "critical", "message": "INCOIS Tsunami Warning active."}
                ],
            }
        }
        alerts = generate_deterministic_alerts(state, specialist_results, {})
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["type"], "ocean")
        self.assertEqual(alerts[0]["severity"], "critical")
        self.assertIn("Tsunami", alerts[0]["title"])

    def test_10_thunderstorm_hazard_alert(self):
        """Scenario 10: Active thunderstorm produces high ocean hazard alert."""
        state = {"request_id": "req-ts-10"}
        specialist_results = {
            "ocean_analysis": {
                "status": "success",
                "warnings": [
                    {"type": "active_thunderstorm", "severity": "high", "message": "Active thunderstorm and lightning."}
                ],
            }
        }
        alerts = generate_deterministic_alerts(state, specialist_results, {})
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["type"], "ocean")
        self.assertEqual(alerts[0]["severity"], "high")
        self.assertIn("Thunderstorm", alerts[0]["title"])

    def test_11_convective_instability_advisory(self):
        """Scenario 11: Convective instability produces moderate ocean alert."""
        state = {"request_id": "req-cape-11"}
        specialist_results = {
            "ocean_analysis": {
                "status": "success",
                "warnings": [
                    {"type": "convective_instability", "severity": "moderate", "message": "High CAPE energy detected."}
                ],
            }
        }
        alerts = generate_deterministic_alerts(state, specialist_results, {})
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["type"], "ocean")
        self.assertEqual(alerts[0]["severity"], "moderate")
        self.assertIn("Convective", alerts[0]["title"])

    def test_12_svas_should_not_sail_restriction(self):
        """Scenario 12: SVAS 'should not sail' directive produces critical vessel safety alert."""
        state = {"request_id": "req-svas-12", "boat_width_m": 4.5}
        specialist_results = {
            "svas": {
                "status": "success",
                "advisory": {"severity": "warning", "message": "Fishermen in small craft should not sail today due to rough sea."},
            }
        }
        alerts = generate_deterministic_alerts(state, specialist_results, {})
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["type"], "vessel")
        self.assertEqual(alerts[0]["severity"], "critical")
        self.assertIn("Restriction", alerts[0]["title"])

    def test_13_svas_alert_active(self):
        """Scenario 13: SVAS 'alert' severity produces high vessel advisory alert."""
        state = {"request_id": "req-svas-13", "boat_width_m": 3.5}
        specialist_results = {
            "svas": {
                "status": "success",
                "advisory": {"severity": "alert", "message": "Rough sea warning for boats under 4m."},
            }
        }
        alerts = generate_deterministic_alerts(state, specialist_results, {})
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["type"], "vessel")
        self.assertEqual(alerts[0]["severity"], "high")

    def test_14_geofencing_restriction_alert(self):
        """Scenario 14: Query about restricted or geofenced zone produces geofence alert."""
        state = {"request_id": "req-geo-14", "query": "Are there any restricted zones or border areas to avoid?"}
        alerts = generate_deterministic_alerts(state, {}, {})
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["type"], "geofence")
        self.assertEqual(alerts[0]["severity"], "high")
        self.assertIn("Restricted Maritime Zone", alerts[0]["title"])

    def test_15_high_risk_engine_alert(self):
        """Scenario 15: Risk engine score between 60 and 79 produces high risk alert."""
        state = {"request_id": "req-risk-15"}
        risk_result = {"status": "HIGH_RISK", "risk_score": 68}
        alerts = generate_deterministic_alerts(state, {}, risk_result)
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["type"], "risk")
        self.assertEqual(alerts[0]["severity"], "high")
        self.assertIn("High Risk", alerts[0]["title"])

    def test_16_critical_risk_engine_alert(self):
        """Scenario 16: Risk engine score >= 80 or NOT_RECOMMENDED produces critical risk alert."""
        state = {"request_id": "req-risk-16"}
        risk_result = {"status": "NOT_RECOMMENDED", "risk_score": 88}
        alerts = generate_deterministic_alerts(state, {}, risk_result)
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["type"], "risk")
        self.assertEqual(alerts[0]["severity"], "critical")
        self.assertIn("Critical Risk", alerts[0]["title"])

    def test_17_deduplication_exact_duplicates_removed(self):
        """Scenario 17: Duplicate warnings reported multiple times are cleanly deduplicated."""
        state = {"request_id": "req-dedup-17"}
        specialist_results = {
            "ocean_analysis": {
                "status": "success",
                "warnings": [
                    {"type": "tropical_cyclone", "severity": "critical", "message": "Cyclone warning active in sector."},
                    {"type": "tropical_cyclone", "severity": "critical", "message": "Cyclone warning active in sector."},
                ],
            }
        }
        alerts = generate_deterministic_alerts(state, specialist_results, {})
        self.assertEqual(len(alerts), 1, "Duplicate cyclone warning must be deduplicated to 1 alert.")

    def test_18_request_id_correlation_and_isolation(self):
        """Scenario 18: Consecutive assessments have isolated request_ids with no state bleeding."""
        # Assessment 1: Danger conditions
        state_1 = {"request_id": "req-111", "query": "Is it safe?"}
        spec_1 = {
            "marine_weather": {"status": "success", "marine": {"wave_height_m": 3.2}}
        }
        alerts_1 = generate_deterministic_alerts(state_1, spec_1, {})
        self.assertEqual(len(alerts_1), 1)
        self.assertEqual(alerts_1[0]["request_id"], "req-111")

        # Assessment 2: Safe conditions
        state_2 = {"request_id": "req-222", "query": "Is it safe today?"}
        spec_2 = {
            "marine_weather": {"status": "success", "marine": {"wave_height_m": 0.8}, "weather": {"wind_speed_knots": 6.0}}
        }
        alerts_2 = generate_deterministic_alerts(state_2, spec_2, {"status": "SAFE", "risk_score": 10})
        self.assertEqual(len(alerts_2), 0, "Second assessment must not retain alerts from first assessment.")

    def test_19_full_schema_conformance(self):
        """Scenario 19: All generated alerts strictly conform to the expected dictionary schema."""
        state = {"request_id": "req-schema-19"}
        specialist_results = {
            "marine_weather": {
                "status": "success",
                "marine": {"wave_height_m": 2.5},
                "weather": {"wind_speed_knots": 32.0},
            },
            "svas": {
                "status": "success",
                "advisory": {"severity": "alert", "message": "High swell near coast."},
            },
        }
        alerts = generate_deterministic_alerts(state, specialist_results, {})
        self.assertEqual(len(alerts), 3)

        required_keys = {"id", "request_id", "type", "severity", "title", "message", "source", "timestamp", "action"}
        for a in alerts:
            self.assertTrue(required_keys.issubset(set(a.keys())), f"Missing required keys in alert: {a}")
            self.assertEqual(a["request_id"], "req-schema-19")
            self.assertTrue(a["severity"] in ["critical", "high", "moderate", "low", "info"])
            self.assertTrue(a["type"] in ["weather", "ocean", "vessel", "geofence", "risk"])
            self.assertTrue(len(a["action"]) > 0)


if __name__ == "__main__":
    unittest.main()

