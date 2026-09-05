"""
Automated Test Suite for ORCA Marine Intelligence Production LangGraph Flow
---------------------------------------------------------------------------
Tests intent classification, selective agent routing, parallel execution,
deterministic risk evaluation, and output schema consistency across all test cases.
"""

import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Ensure project root is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agents.orchestrator.graph import (
    classify_query,
    extract_boat_width,
    run_orca,
    orchestrate_orca_assessment,
    orca_graph,
    AGENT_PFZ,
    AGENT_WEATHER,
    AGENT_SVAS,
    AGENT_OCEAN,
    ALL_SPECIALISTS,
)


class TestOrcaRoutingAndFlow(unittest.TestCase):

    def test_01_general_greeting(self):
        query = "Hello, what can you do?"
        intent, selected, risk_req = classify_query(query)
        self.assertEqual(intent, "general")
        self.assertEqual(selected, [])
        self.assertFalse(risk_req)

    def test_02_general_fisherman_knowledge(self):
        query = "What is fishing?"
        intent, selected, risk_req = classify_query(query)
        self.assertEqual(intent, "general")
        self.assertEqual(selected, [])
        self.assertFalse(risk_req)

        query_pfz = "What is a PFZ?"
        intent2, selected2, risk_req2 = classify_query(query_pfz)
        self.assertEqual(intent2, "general")
        self.assertEqual(selected2, [])
        self.assertFalse(risk_req2)

    def test_03_pfz_query(self):
        query = "Where is the nearest potential fishing zone?"
        intent, selected, risk_req = classify_query(query)
        self.assertEqual(intent, "pfz_query")
        self.assertEqual(selected, [AGENT_PFZ])
        self.assertFalse(risk_req)

    def test_04_marine_weather_query(self):
        query = "What are the current sea conditions?"
        intent, selected, risk_req = classify_query(query)
        self.assertEqual(intent, "marine_weather_query")
        self.assertEqual(selected, [AGENT_WEATHER])
        self.assertFalse(risk_req)

    def test_05_svas_query(self):
        query = "Are there any restrictions for my boat?"
        intent, selected, risk_req = classify_query(query)
        self.assertEqual(intent, "svas_query")
        self.assertEqual(selected, [AGENT_SVAS])
        self.assertFalse(risk_req)

    def test_06_ocean_hazard_query(self):
        query = "Is there a cyclone or lightning risk near me?"
        intent, selected, risk_req = classify_query(query)
        self.assertEqual(intent, "ocean_analysis_query")
        self.assertEqual(selected, [AGENT_OCEAN])
        self.assertFalse(risk_req)

    def test_07_safety_assessment(self):
        query = "Is it safe to go fishing today?"
        intent, selected, risk_req = classify_query(query)
        self.assertEqual(intent, "safety_assessment")
        self.assertEqual(set(selected), set(ALL_SPECIALISTS))
        self.assertTrue(risk_req)

    def test_08_boat_specific_safety(self):
        query = "Can I go fishing today with my 5 meter boat?"
        intent, selected, risk_req = classify_query(query)
        boat_width = extract_boat_width(query)
        self.assertEqual(intent, "safety_assessment")
        self.assertEqual(boat_width, 5.0)
        self.assertTrue(risk_req)

    def test_09_fishing_advice(self):
        query = "Where should I go fishing today?"
        intent, selected, risk_req = classify_query(query)
        self.assertEqual(intent, "fishing_advice")
        self.assertEqual(selected, [AGENT_PFZ, AGENT_WEATHER])
        self.assertFalse(risk_req)

    def test_10_emergency(self):
        query = "My boat is in danger"
        intent, selected, risk_req = classify_query(query)
        self.assertEqual(intent, "emergency")
        self.assertEqual(selected, [])
        self.assertFalse(risk_req)

    def test_11_general_execution_no_marine_agents_called(self):
        """Verify that general query does not call any specialist functions."""
        with patch("agents.orchestrator.graph.find_nearest_pfz") as mock_pfz, \
             patch("agents.orchestrator.graph.fetch_marine_weather") as mock_weather, \
             patch("agents.orchestrator.graph.get_svas_advisory") as mock_svas, \
             patch("agents.orchestrator.graph.analyze_ocean_conditions") as mock_ocean, \
             patch("agents.orchestrator.graph.calculate_risk") as mock_risk:

            res = run_orca(
                latitude=19.72,
                longitude=72.70,
                date="2026-09-05",
                boat_width_m=5.0,
                query="Hello, what can you do?",
            )

            mock_pfz.assert_not_called()
            mock_weather.assert_not_called()
            mock_svas.assert_not_called()
            mock_ocean.assert_not_called()
            mock_risk.assert_not_called()

            self.assertEqual(res["intent"], "general")
            self.assertEqual(res["selected_agents"], [])
            self.assertFalse(res["risk_required"])
            self.assertIn("recommendation", res)
            self.assertIn("explanation", res)

    def test_12_single_pfz_execution(self):
        """Verify that PFZ query only calls PFZ agent."""
        mock_pfz_data = {
            "agent": "pfz",
            "status": "success",
            "pfz": {
                "nearest_point": {
                    "latitude": 19.80,
                    "longitude": 72.50,
                    "distance_km": 25.4,
                    "direction": "W",
                    "bearing_degrees": 265.0,
                },
                "category": "A",
            }
        }
        with patch("agents.orchestrator.graph.find_nearest_pfz", return_value=mock_pfz_data) as mock_pfz, \
             patch("agents.orchestrator.graph.fetch_marine_weather") as mock_weather, \
             patch("agents.orchestrator.graph.get_svas_advisory") as mock_svas, \
             patch("agents.orchestrator.graph.analyze_ocean_conditions") as mock_ocean, \
             patch("agents.orchestrator.graph.calculate_risk") as mock_risk:

            res = run_orca(
                latitude=19.72,
                longitude=72.70,
                date="2026-09-05",
                boat_width_m=5.0,
                query="Where is the nearest potential fishing zone?",
            )

            mock_pfz.assert_called_once()
            mock_weather.assert_not_called()
            mock_svas.assert_not_called()
            mock_ocean.assert_not_called()
            mock_risk.assert_not_called()

            self.assertEqual(res["intent"], "pfz_query")
            self.assertEqual(res["selected_agents"], ["pfz"])
            self.assertEqual(res["pfz"]["status"], "success")
            self.assertNotIn("marine_weather", res["specialist_results"])
            self.assertNotIn("marine_weather", res)

    def test_13_safety_assessment_execution(self):
        """Verify safety assessment executes all 4 specialist agents and risk engine."""
        mock_pfz_data = {"status": "success", "pfz": {"nearest_point": {"distance_km": 30.0, "direction": "NW"}}}
        mock_weather_data = {
            "status": "success",
            "marine": {"wave_height_m": 1.2, "ocean_current_velocity_kmh": 0.8},
            "weather": {"wind_speed_knots": 10.0, "wind_gusts_knots": 15.0},
        }
        mock_svas_data = {"status": "success", "advisory": {"severity": "safe", "message": "Normal operations"}}
        mock_ocean_data = {"status": "success", "warnings": []}
        mock_risk_data = {
            "agent": "risk",
            "status": "SAFE",
            "risk_score": 12,
            "reasons": ["Wave height is 1.2 m", "Wind speed is 10.0 kt"],
            "factors": [],
            "data_quality": "good",
            "hard_override": False,
        }

        with patch("agents.orchestrator.graph.find_nearest_pfz", return_value=mock_pfz_data) as mock_pfz, \
             patch("agents.orchestrator.graph.fetch_marine_weather", return_value=mock_weather_data) as mock_weather, \
             patch("agents.orchestrator.graph.get_svas_advisory", return_value=mock_svas_data) as mock_svas, \
             patch("agents.orchestrator.graph.analyze_ocean_conditions", return_value=mock_ocean_data) as mock_ocean, \
             patch("agents.orchestrator.graph.calculate_risk", return_value=mock_risk_data) as mock_risk:

            res = run_orca(
                latitude=19.72,
                longitude=72.70,
                date="2026-09-05",
                boat_width_m=5.0,
                query="Is it safe to go fishing today?",
            )

            mock_pfz.assert_called_once()
            mock_weather.assert_called_once()
            mock_svas.assert_called_once()
            mock_ocean.assert_called_once()
            mock_risk.assert_called_once()

            self.assertEqual(res["intent"], "safety_assessment")
            self.assertTrue(res["risk_required"])
            self.assertEqual(res["risk"]["status"], "SAFE")
            self.assertEqual(res["risk"]["risk_score"], 12)
            self.assertIn("🟢", res["recommendation"])


if __name__ == "__main__":
    unittest.main()
