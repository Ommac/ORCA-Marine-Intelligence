"""
Unit and Integration Tests for Natural Language PFZ Query Routing
------------------------------------------------------------------
Validates:
1. Multilingual intent classification for English, Marathi, and Hindi PFZ queries.
2. Routing to the PFZ Agent.
3. End-to-end ORCA execution returning valid PFZ structured output.
"""

import os
import sys
import unittest

# Ensure workspace root in path
_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _root not in sys.path:
    sys.path.insert(0, _root)

from agents.orchestrator.graph import (
    classify_query,
    resolve_context_and_intent,
    run_orca,
)


class TestPFZQueryRouting(unittest.TestCase):
    def setUp(self):
        self.lat = 19.72
        self.lon = 72.70
        self.date = "2026-09-26"
        self.boat_width_m = 5.0

    def test_01_english_pfz_queries_classification(self):
        queries = [
            "Show the nearest PFZ",
            "Show nearby fishing areas",
            "Show the nearest fishing zone",
            "What is the nearest PFZ?",
            "Find fishing zones near me",
            "Show fishing zones near my location",
            "Which PFZ is closest to me?",
        ]
        for q in queries:
            with self.subTest(query=q):
                intent, selected, risk_req = classify_query(q)
                self.assertEqual(intent, "pfz_query", f"Query '{q}' should have intent 'pfz_query' but got '{intent}'")
                self.assertEqual(selected, ["pfz"], f"Query '{q}' should select ['pfz'] but got {selected}")
                self.assertFalse(risk_req, f"Query '{q}' should not require risk assessment")

                resolved = resolve_context_and_intent(q)
                self.assertEqual(resolved["intent"], "pfz_query")
                self.assertEqual(resolved["target_entity"], "pfz")
                self.assertIn("pfz", resolved["selected_agents"])

    def test_02_marathi_pfz_queries_classification(self):
        queries = [
            "जवळचा मासेमारी क्षेत्र दाखवा",
            "माझ्या जवळचे मासेमारी क्षेत्र दाखवा",
            "जवळचा PFZ दाखवा",
            "माझ्या जवळचा PFZ कोणता आहे?",
            "जवळचे मासेमारीचे क्षेत्र दाखवा",
            "माझ्या ठिकाणापासून जवळचे मासेमारी क्षेत्र कोणते?",
            "जवळपासचे मासेमारी क्षेत्र दाखवा",
            "माझ्या जवळचे मासेमारीचे ठिकाण दाखवा",
        ]
        for q in queries:
            with self.subTest(query=q):
                intent, selected, risk_req = classify_query(q)
                self.assertEqual(intent, "pfz_query", f"Query '{q}' should have intent 'pfz_query' but got '{intent}'")
                self.assertEqual(selected, ["pfz"], f"Query '{q}' should select ['pfz'] but got {selected}")
                self.assertFalse(risk_req, f"Query '{q}' should not require risk assessment")

                resolved = resolve_context_and_intent(q)
                self.assertEqual(resolved["intent"], "pfz_query")
                self.assertEqual(resolved["target_entity"], "pfz")
                self.assertIn("pfz", resolved["selected_agents"])

    def test_03_hindi_pfz_queries_classification(self):
        queries = [
            "मेरे पास का PFZ दिखाओ",
            "मेरे पास का मछली पकड़ने का क्षेत्र दिखाओ",
            "सबसे नजदीकी मछली पकड़ने का क्षेत्र कौन सा है?",
            "मेरे नजदीक के मछली पकड़ने के क्षेत्र दिखाओ",
        ]
        for q in queries:
            with self.subTest(query=q):
                intent, selected, risk_req = classify_query(q)
                self.assertEqual(intent, "pfz_query", f"Query '{q}' should have intent 'pfz_query' but got '{intent}'")
                self.assertEqual(selected, ["pfz"], f"Query '{q}' should select ['pfz'] but got {selected}")
                self.assertFalse(risk_req, f"Query '{q}' should not require risk assessment")

                resolved = resolve_context_and_intent(q)
                self.assertEqual(resolved["intent"], "pfz_query")
                self.assertEqual(resolved["target_entity"], "pfz")
                self.assertIn("pfz", resolved["selected_agents"])

    def test_04_end_to_end_marathi_pfz_run(self):
        """Verify that 'जवळचा मासेमारी क्षेत्र दाखवा' runs the full ORCA graph and invokes PFZ."""
        result = run_orca(
            latitude=self.lat,
            longitude=self.lon,
            date=self.date,
            boat_width_m=self.boat_width_m,
            query="जवळचा मासेमारी क्षेत्र दाखवा",
        )
        self.assertEqual(result.get("intent"), "pfz_query")
        self.assertIn("pfz", result.get("selected_agents", []))
        self.assertTrue(result.get("display", {}).get("pfz"), "PFZ display flag must be True")
        
        # Verify specialist PFZ result is present
        pfz_res = result.get("specialist_results", {}).get("pfz", {})
        self.assertEqual(pfz_res.get("status"), "success")
        self.assertIsNotNone(pfz_res.get("pfz"))

    def test_05_end_to_end_english_pfz_run(self):
        """Verify that 'Show the nearest PFZ' runs the full ORCA graph and invokes PFZ."""
        result = run_orca(
            latitude=self.lat,
            longitude=self.lon,
            date=self.date,
            boat_width_m=self.boat_width_m,
            query="Show the nearest PFZ",
        )
        self.assertEqual(result.get("intent"), "pfz_query")
        self.assertIn("pfz", result.get("selected_agents", []))
        self.assertTrue(result.get("display", {}).get("pfz"), "PFZ display flag must be True")

    def test_06_non_pfz_queries_not_routed_to_pfz(self):
        """Verify weather, safety, svas, and general queries preserve their intended routing."""
        self.assertEqual(classify_query("How high are the waves?")[0], "marine_weather_query")
        self.assertEqual(classify_query("Is it safe to go out today?")[0], "safety_assessment")
        self.assertEqual(classify_query("Are there SVAS restrictions?")[0], "svas_query")
        self.assertEqual(classify_query("What is the capital of India?")[0], "general")


if __name__ == "__main__":
    unittest.main()
