"""
ORCA Marine Intelligence - Phase 1 Verification Test Suite
-----------------------------------------------------------
Tests the Top 3 PFZ Candidate System, Clear Recommendations, Explicit
Display Relevance Control, Multi-turn Conversational Context Caching,
and Structured Map UI Actions according to exact user criteria.
"""

import os
import sys
import unittest

# Ensure workspace root is in sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
_root_dir = os.path.abspath(os.path.join(_current_dir, "..", ".."))
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

from agents.pfz.main import find_nearest_pfz, rank_pfz_candidates, evaluate_pfz_recommendations
from agents.orchestrator.session_store import (
    get_or_create_session,
    get_session,
    update_session,
    get_cached_pfz_candidates,
    clear_session,
)
from agents.orchestrator.graph import run_orca, resolve_context_and_intent


class TestPhase1PFZSystem(unittest.TestCase):
    def setUp(self):
        self.lat = 19.72
        self.lon = 72.70
        self.session_id = "test-phase1-sess-001"
        clear_session(self.session_id)

    def tearDown(self):
        clear_session(self.session_id)

    def test_01_waves_query_no_pfz_display(self):
        """TEST 1: 'Are the waves safe for a 5m boat?' must NOT display PFZ cards."""
        out = run_orca(
            latitude=self.lat,
            longitude=self.lon,
            query="Are the waves safe for a 5m boat?",
            session_id=self.session_id,
        )
        self.assertIn("display", out)
        self.assertFalse(out["display"]["pfz"], "PFZ cards must NOT be displayed for wave safety queries")
        self.assertTrue(out["display"]["marine"] or out["display"]["risk_assessment"])

    def test_02_tomorrow_safety_no_pfz_display(self):
        """TEST 2: 'Can I go fishing tomorrow?' must NOT display Top 3 PFZ cards by default."""
        out = run_orca(
            latitude=self.lat,
            longitude=self.lon,
            query="Can I go fishing tomorrow?",
            session_id=self.session_id,
        )
        self.assertIn("display", out)
        self.assertFalse(out["display"]["pfz"], "PFZ cards must NOT be displayed for general safety questions")
        self.assertTrue(out["display"]["risk_assessment"])

    def test_03_sea_conditions_no_pfz_display(self):
        """TEST 3: 'What are the tide, weather, and sea conditions near my fishing location?' must NOT display PFZ cards."""
        out = run_orca(
            latitude=self.lat,
            longitude=self.lon,
            query="What are the tide, weather, and sea conditions near my fishing location?",
            session_id=self.session_id,
        )
        self.assertIn("display", out)
        self.assertFalse(out["display"]["pfz"], "PFZ cards must NOT be displayed for sea conditions queries")

    def test_04_nearest_fishing_zone_shows_pfz(self):
        """TEST 4: 'Where is the nearest fishing zone?' must display Top PFZ cards."""
        out = run_orca(
            latitude=self.lat,
            longitude=self.lon,
            query="Where is the nearest fishing zone?",
            session_id=self.session_id,
        )
        self.assertIn("display", out)
        self.assertTrue(out["display"]["pfz"], "PFZ cards MUST be displayed for nearest fishing zone inquiry")
        self.assertIn("top_pfz", out)
        self.assertGreaterEqual(len(out["top_pfz"]), 1)
        self.assertTrue(out["top_pfz"][0]["recommended"])
        self.assertIn("shortest travel distance", out["top_pfz"][0]["recommendation_reason"])

    def test_05_nearby_fishing_zones_shows_pfz(self):
        """TEST 5: 'Show me nearby fishing zones' must return up to Top 3 PFZ cards sorted by distance."""
        out = run_orca(
            latitude=self.lat,
            longitude=self.lon,
            query="Show me nearby fishing zones",
            session_id=self.session_id,
        )
        self.assertIn("display", out)
        self.assertTrue(out["display"]["pfz"])
        top_cands = out["top_pfz"]
        self.assertGreaterEqual(len(top_cands), 1)
        self.assertLessEqual(len(top_cands), 3)
        distances = [c["distance_km"] for c in top_cands]
        self.assertEqual(distances, sorted(distances), "Candidates must be ordered by distance ascending")

    def test_06_single_pfz_ordinal_query(self):
        """TEST 6: 'Tell me 2nd PFZ from my location' must return single_pfz mode with ONLY candidate rank 2."""
        out = run_orca(
            latitude=self.lat,
            longitude=self.lon,
            query="Tell me 2nd PFZ from my location",
            session_id=self.session_id,
        )
        self.assertIn("display", out)
        self.assertTrue(out["display"]["pfz"], "Must display PFZ card")
        self.assertEqual(out["display"]["pfz_mode"], "single_pfz", "Display mode must be single_pfz")
        self.assertIn("top_pfz", out)
        self.assertEqual(len(out["top_pfz"]), 1, "Only the 2nd candidate must be returned in top_pfz")
        self.assertEqual(out["top_pfz"][0]["rank"], 2, "Candidate rank must be 2")

    def test_07_critical_state_isolation_multi_turn(self):
        """
        TEST 7: Critical Bug Test:
        Turn 1: 'Tell me 2nd PFZ from my location' (returns 2nd PFZ)
        Turn 2: 'What is the capital of India?' (MUST NOT return PFZ cards or 2nd PFZ text)
        Turn 3: 'Show the second one on the map' (MUST resolve candidate 2 from cache)
        """
        conv_session = "sess-critical-isolation-test"
        clear_session(conv_session)

        # Turn 1: 2nd PFZ
        out1 = run_orca(
            latitude=self.lat,
            longitude=self.lon,
            query="Tell me 2nd PFZ from my location",
            session_id=conv_session,
        )
        self.assertTrue(out1["display"]["pfz"])
        self.assertEqual(out1["display"]["pfz_mode"], "single_pfz")
        self.assertEqual(len(out1["top_pfz"]), 1)
        self.assertEqual(out1["top_pfz"][0]["rank"], 2)
        second_cand_coords = out1["top_pfz"][0]["coordinates"]

        # Turn 2: What is the capital of India?
        out2 = run_orca(
            latitude=self.lat,
            longitude=self.lon,
            query="What is the capital of India?",
            session_id=conv_session,
        )
        self.assertEqual(out2.get("intent"), "general", "Intent must be general")
        self.assertFalse(out2["display"]["pfz"], "PFZ cards must NOT be displayed for general knowledge")
        self.assertEqual(out2["display"]["pfz_mode"], "none", "pfz_mode must be none")
        self.assertIsNone(out2.get("top_pfz"), "top_pfz must be None for general queries")
        rec2 = out2.get("recommendation", "").lower()
        self.assertNotIn("2nd nearest potential fishing zone", rec2, "Must not contain leaked PFZ text")

        # Turn 3: Show the second one on the map
        out3 = run_orca(
            latitude=self.lat,
            longitude=self.lon,
            query="Show the second one on the map",
            session_id=conv_session,
        )
        self.assertEqual(out3.get("action"), "show_on_map")
        self.assertEqual(out3.get("entity_rank"), 2)
        ui_act = out3.get("ui_action")
        self.assertIsNotNone(ui_act, "Turn 3 must generate structured ui_action")
        self.assertEqual(ui_act.get("type"), "show_on_map")
        self.assertEqual(ui_act.get("rank"), 2)
        self.assertAlmostEqual(ui_act["coordinates"]["latitude"], second_cand_coords["latitude"], places=4)
        self.assertAlmostEqual(ui_act["coordinates"]["longitude"], second_cand_coords["longitude"], places=4)

        clear_session(conv_session)

    def test_08_hazard_avoidance_no_pfz_display(self):
        """TEST 8: 'Which fishing zones should be avoided due to hazards or geofencing?' must NOT display PFZ cards."""
        out = run_orca(
            latitude=self.lat,
            longitude=self.lon,
            query="Which fishing zones should be avoided due to hazards or geofencing?",
            session_id=self.session_id,
        )
        self.assertEqual(out.get("intent"), "safety_assessment")
        self.assertFalse(out["display"]["pfz"], "PFZ cards must NOT be displayed for hazard avoidance queries")
        self.assertEqual(out["display"]["pfz_mode"], "none")
        self.assertTrue(out["display"]["risk_assessment"])

    def test_09_fastapi_and_data_consistency(self):
        """TEST 9: FastAPI assess endpoint returns structured display flags and consistent availability."""
        from fastapi.testclient import TestClient
        from api.main import app

        client = TestClient(app)
        
        # Test safety query via API
        resp_safety = client.post(
            "/api/orca/assess",
            json={
                "query": "Can I go fishing tomorrow?",
                "latitude": self.lat,
                "longitude": self.lon,
                "date": "2026-09-08",
                "boat_width_m": 5.0,
                "session_id": "test-fastapi-sess",
            },
        )
        self.assertEqual(resp_safety.status_code, 200)
        data_safety = resp_safety.json()
        self.assertIn("display", data_safety)
        self.assertFalse(data_safety["display"]["pfz"])
        self.assertEqual(data_safety["display"]["pfz_mode"], "none")

        # Test list PFZ query via API
        resp_pfz = client.post(
            "/api/orca/assess",
            json={
                "query": "Where is the nearest fishing zone?",
                "latitude": self.lat,
                "longitude": self.lon,
                "date": "2026-09-08",
                "boat_width_m": 5.0,
                "session_id": "test-fastapi-sess",
            },
        )
        self.assertEqual(resp_pfz.status_code, 200)
        data_pfz = resp_pfz.json()
        self.assertIn("display", data_pfz)
        self.assertTrue(data_pfz["display"]["pfz"])
        self.assertIn(data_pfz["display"]["pfz_mode"], ["pfz_list", "single_pfz"])
        self.assertIn("top_pfz", data_pfz)


if __name__ == "__main__":
    unittest.main(verbosity=2)
