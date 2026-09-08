"""
ORCA Conversational Context & Agentic Orchestration Tests
---------------------------------------------------------
Verifies:
1. Multi-candidate PFZ ranking (Rank 1 vs Rank 2 vs Rank 3).
2. Intent and context resolution across multi-turn sessions.
3. Canonical test:
   Turn 1: "tell me 2nd pfz from my location" -> returns 2nd nearest PFZ.
   Turn 2: "show in map 2nd nearest" -> resolves context -> returns show_on_map UI action for 2nd PFZ.
4. Deterministic safety override enforcement.
5. Structured UI Action contract.
"""

import os
import sys
import unittest

# Ensure workspace root in path
_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if _root not in sys.path:
    sys.path.insert(0, _root)

from agents.pfz.main import find_nearest_pfz
from agents.orchestrator.session_store import (
    clear_session,
    get_or_create_session,
    get_session,
    update_session,
)
from agents.orchestrator.graph import (
    classify_query,
    extract_entity_rank,
    resolve_context_and_intent,
    run_orca,
)


class TestConversationalOrchestration(unittest.TestCase):
    def setUp(self):
        self.test_session_id = "test-sess-conv-123"
        clear_session(self.test_session_id)

    def tearDown(self):
        clear_session(self.test_session_id)

    def test_01_extract_entity_rank(self):
        self.assertEqual(extract_entity_rank("tell me 2nd pfz from my location"), 2)
        self.assertEqual(extract_entity_rank("show second nearest zone"), 2)
        self.assertEqual(extract_entity_rank("what is the 3rd fishing spot"), 3)
        self.assertEqual(extract_entity_rank("show nearest pfz"), 1)
        self.assertEqual(extract_entity_rank("show in map 1st nearest"), 1)

    def test_02_pfz_multi_candidate_ranking(self):
        """Verify that find_nearest_pfz supports ranking distinct PFZ candidates."""
        lat, lon = 19.72, 72.70
        res1 = find_nearest_pfz(lat, lon, rank=1)
        self.assertEqual(res1["status"], "success")
        self.assertEqual(res1["selected_rank"], 1)

        p1 = res1["pfz"]["nearest_point"]
        dist1 = p1["distance_km"]

        # If multiple candidates exist, rank 2 distance should be >= rank 1
        if res1.get("total_candidates", 0) >= 2:
            res2 = find_nearest_pfz(lat, lon, rank=2)
            self.assertEqual(res2["status"], "success")
            self.assertEqual(res2["selected_rank"], 2)
            p2 = res2["pfz"]["nearest_point"]
            dist2 = p2["distance_km"]
            self.assertGreaterEqual(dist2, dist1)

    def test_03_context_resolution_followup(self):
        """Verify resolve_context_and_intent resolves 'show in map 2nd nearest'."""
        context = {
            "last_entity": "pfz",
            "last_entity_rank": 2,
            "last_action": "query",
        }
        resolved = resolve_context_and_intent(
            query="show in map 2nd nearest",
            conversation_history=[
                {"role": "user", "content": "tell me 2nd pfz from my location"},
                {"role": "assistant", "content": "The 2nd nearest PFZ is at 45km."},
            ],
            conversation_context=context,
        )

        self.assertEqual(resolved["action"], "show_on_map")
        self.assertEqual(resolved["target_entity"], "pfz")
        self.assertEqual(resolved["entity_rank"], 2)
        self.assertIn("pfz", resolved["selected_agents"])

    def test_04_canonical_two_turn_conversation_end_to_end(self):
        """
        CANONICAL SPECIFICATION TEST:
        Turn 1: User says 'tell me 2nd pfz from my location'
                -> ORCA returns the 2nd nearest PFZ.
        Turn 2: User says 'show in map 2nd nearest'
                -> Context resolves to second nearest PFZ
                -> Structured show_on_map UI action is returned with 2nd nearest PFZ coordinates!
        """
        lat, lon = 19.72, 72.70
        sess_id = self.test_session_id

        # Turn 1
        res1 = run_orca(
            latitude=lat,
            longitude=lon,
            date="2026-09-08",
            boat_width_m=5.0,
            query="tell me 2nd pfz from my location",
            session_id=sess_id,
        )

        self.assertIn("pfz", res1)
        self.assertEqual(res1["pfz"]["status"], "success")
        self.assertEqual(res1.get("entity_rank"), 2)

        p1_coord = res1["pfz"]["pfz"]["nearest_point"]
        self.assertIsNotNone(p1_coord["latitude"])
        self.assertIsNotNone(p1_coord["longitude"])

        # Turn 2 (Follow-up)
        res2 = run_orca(
            latitude=lat,
            longitude=lon,
            date="2026-09-08",
            boat_width_m=5.0,
            query="show in map 2nd nearest",
            session_id=sess_id,
        )

        # Must return structured ui_action
        ui_action = res2.get("ui_action")
        self.assertIsNotNone(ui_action, "ui_action must be present in response")
        self.assertEqual(ui_action["type"], "show_on_map")
        self.assertEqual(ui_action["target"], "pfz")
        self.assertEqual(ui_action["rank"], 2)
        self.assertAlmostEqual(ui_action["coordinates"]["latitude"], p1_coord["latitude"], places=4)
        self.assertAlmostEqual(ui_action["coordinates"]["longitude"], p1_coord["longitude"], places=4)

    def test_05_safety_override_guarantee(self):
        """Verify that any safety query deterministically forces safety_assessment."""
        resolved = resolve_context_and_intent(
            query="is it safe to travel to the 2nd nearest pfz?",
            conversation_history=[],
            conversation_context={"last_entity": "pfz", "last_entity_rank": 2},
        )
        self.assertEqual(resolved["intent"], "safety_assessment")
        self.assertTrue(resolved["risk_required"])
        self.assertEqual(len(resolved["selected_agents"]), 4)

    def test_06_session_isolation(self):
        """Verify that two separate session IDs do not pollute each other's context."""
        sess_a = "sess-a-99"
        sess_b = "sess-b-99"
        clear_session(sess_a)
        clear_session(sess_b)

        run_orca(
            latitude=19.72,
            longitude=72.70,
            query="tell me 3rd pfz from my location",
            session_id=sess_a,
        )

        session_a = get_session(sess_a)
        self.assertEqual(session_a["last_entity_rank"], 3)

        session_b = get_session(sess_b)
        self.assertIsNone(session_b)

        clear_session(sess_a)
        clear_session(sess_b)


if __name__ == "__main__":
    unittest.main()
