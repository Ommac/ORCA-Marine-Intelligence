"""
End-to-End API Test for Conversational Agentic Workflow
"""

import sys
import os

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

_root = os.path.abspath(os.path.join(os.path.dirname(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_multi_turn_conversational_workflow():
    session_id = "e2e-test-session-42"
    
    print("\n--- TURN 1: 'tell me 2nd pfz from my location' ---")
    payload1 = {
        "query": "tell me 2nd pfz from my location",
        "latitude": 19.72,
        "longitude": 72.70,
        "date": "2026-09-08",
        "boat_width_m": 5.0,
        "session_id": session_id,
    }
    res1 = client.post("/api/orca/assess", json=payload1)
    assert res1.status_code == 200, f"Turn 1 failed: {res1.text}"
    data1 = res1.json()
    print("Turn 1 Intent:", data1.get("intent"))
    print("Turn 1 Selected Agents:", data1.get("selected_agents"))
    print("Turn 1 Entity Rank:", data1.get("entity_rank"))
    print("Turn 1 Recommendation:", data1.get("recommendation"))
    
    pfz1 = data1.get("pfz", {})
    assert pfz1.get("status") == "success", "PFZ status must be success"
    p1_point = pfz1.get("pfz", {}).get("nearest_point", {})
    lat2nd = p1_point.get("latitude")
    lon2nd = p1_point.get("longitude")
    print(f"Turn 1 2nd PFZ Coordinates: Lat {lat2nd}, Lon {lon2nd}, Dist: {p1_point.get('distance_km')} km")
    
    print("\n--- TURN 2: 'show in map 2nd nearest' ---")
    payload2 = {
        "query": "show in map 2nd nearest",
        "latitude": 19.72,
        "longitude": 72.70,
        "date": "2026-09-08",
        "boat_width_m": 5.0,
        "session_id": session_id,
    }
    res2 = client.post("/api/orca/assess", json=payload2)
    assert res2.status_code == 200, f"Turn 2 failed: {res2.text}"
    data2 = res2.json()
    print("Turn 2 Intent:", data2.get("intent"))
    print("Turn 2 Action:", data2.get("action"))
    print("Turn 2 Resolved Query:", data2.get("resolved_query"))
    print("Turn 2 UI Action:", data2.get("ui_action"))
    
    ui_act = data2.get("ui_action")
    assert ui_act is not None, "UI action must be present"
    assert ui_act.get("type") == "show_on_map"
    assert ui_act.get("rank") == 2
    assert abs(ui_act["coordinates"]["latitude"] - lat2nd) < 0.001
    assert abs(ui_act["coordinates"]["longitude"] - lon2nd) < 0.001
    print("Turn 2 UI Action Coordinates verified matches Turn 1 2nd PFZ coordinates!")
    
    print("\n--- TURN 3: 'is it safe to travel there?' ---")
    payload3 = {
        "query": "is it safe to travel there?",
        "latitude": 19.72,
        "longitude": 72.70,
        "date": "2026-09-08",
        "boat_width_m": 5.0,
        "session_id": session_id,
    }
    res3 = client.post("/api/orca/assess", json=payload3)
    assert res3.status_code == 200, f"Turn 3 failed: {res3.text}"
    data3 = res3.json()
    print("Turn 3 Intent:", data3.get("intent"))
    print("Turn 3 Risk Required:", data3.get("risk_required"))
    print("Turn 3 Risk Status:", data3.get("risk", {}).get("status"))
    print("Turn 3 Risk Score:", data3.get("risk", {}).get("risk_score"))
    assert data3.get("intent") == "safety_assessment"
    assert data3.get("risk_required") is True
    print("\nALL MULTI-TURN CONVERSATIONAL END-TO-END TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_multi_turn_conversational_workflow()
