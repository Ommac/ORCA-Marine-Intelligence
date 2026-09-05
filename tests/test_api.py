"""
Integration tests for FastAPI endpoints in api/main.py
"""

import sys
import os
import unittest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from api.main import app

client = TestClient(app)


class TestOrcaAPI(unittest.TestCase):

    def test_health_check(self):
        resp = client.get("/health")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), {"status": "ok", "service": "ORCA API"})

    def test_assess_general_query(self):
        payload = {
            "query": "Hello, what can you do?",
            "latitude": 19.72,
            "longitude": 72.70,
            "date": "2026-09-05",
            "boat_width_m": 5.0,
        }
        resp = client.post("/api/orca/assess", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["intent"], "general")
        self.assertEqual(data["selected_agents"], [])
        self.assertFalse(data["risk_required"])
        self.assertIn("recommendation", data)
        self.assertIn("explanation", data)

    def test_assess_safety_query(self):
        payload = {
            "query": "Is it safe to go fishing today?",
            "latitude": 19.72,
            "longitude": 72.70,
            "date": "2026-09-05",
            "boat_width_m": 5.0,
        }
        resp = client.post("/api/orca/assess", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["intent"], "safety_assessment")
        self.assertTrue(data["risk_required"])
        self.assertIn("recommendation", data)
        self.assertIn("risk", data)


if __name__ == "__main__":
    unittest.main()
