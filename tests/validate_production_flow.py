import json
import os
import sys

# Ensure UTF-8 output on Windows terminals
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agents.orchestrator.main import run_orca, classify_query

scenarios = [
    {
        "name": "Test 1 — General Inquiry",
        "query": "Hello, what can you do?",
        "expected_intent": "general",
        "expected_agents": [],
        "expected_risk": False,
    },
    {
        "name": "Test 2 — General Domain Question",
        "query": "What is fishing?",
        "expected_intent": "general",
        "expected_agents": [],
        "expected_risk": False,
    },
    {
        "name": "Test 3 — PFZ Query",
        "query": "Where is the nearest potential fishing zone?",
        "expected_intent": "pfz_query",
        "expected_agents": ["pfz"],
        "expected_risk": False,
    },
    {
        "name": "Test 4 — Marine Weather Query",
        "query": "What are the current sea conditions?",
        "expected_intent": "marine_weather_query",
        "expected_agents": ["marine_weather"],
        "expected_risk": False,
    },
    {
        "name": "Test 5 — SVAS Query",
        "query": "Are there any restrictions for my boat?",
        "expected_intent": "svas_query",
        "expected_agents": ["svas"],
        "expected_risk": False,
    },
    {
        "name": "Test 6 — Ocean Hazard Query",
        "query": "Is there a cyclone or lightning risk near me?",
        "expected_intent": "ocean_analysis_query",
        "expected_agents": ["ocean_analysis"],
        "expected_risk": False,
    },
    {
        "name": "Test 7 — Safety Assessment",
        "query": "Is it safe to go fishing today?",
        "expected_intent": "safety_assessment",
        "expected_agents": ["pfz", "marine_weather", "svas", "ocean_analysis"],
        "expected_risk": True,
    },
    {
        "name": "Test 8 — Boat-specific Safety Assessment",
        "query": "Can I go fishing today with my 5 meter boat?",
        "expected_intent": "safety_assessment",
        "expected_agents": ["pfz", "marine_weather", "svas", "ocean_analysis"],
        "expected_risk": True,
    },
    {
        "name": "Test 9 — Fishing Recommendation",
        "query": "Where should I go fishing today?",
        "expected_intent": "fishing_advice",
        "expected_agents": ["pfz", "marine_weather"],
        "expected_risk": False,
    },
    {
        "name": "Test 10 — Emergency Inquiry",
        "query": "My boat is in danger",
        "expected_intent": "emergency",
        "expected_agents": [],
        "expected_risk": False,
    },
]

print("=" * 80)
print("ORCA PRODUCTION LANGGRAPH AGENTIC FLOW VALIDATION")
print("=" * 80)

passed = 0
total = len(scenarios)

for idx, sc in enumerate(scenarios, 1):
    print(f"\n[{idx}/{total}] Running: {sc['name']}")
    print(f"Query: \"{sc['query']}\"")
    
    intent, selected, risk_req = classify_query(sc["query"])
    assert intent == sc["expected_intent"], f"Intent mismatch: {intent} != {sc['expected_intent']}"
    assert set(selected) == set(sc["expected_agents"]), f"Agents mismatch: {selected} != {sc['expected_agents']}"
    assert risk_req == sc["expected_risk"], f"Risk required mismatch: {risk_req} != {sc['expected_risk']}"

    res = run_orca(
        latitude=19.72,
        longitude=72.70,
        date="2026-09-05",
        boat_width_m=5.0,
        query=sc["query"],
    )

    assert "recommendation" in res, "Missing recommendation in response"
    assert "explanation" in res, "Missing explanation in response"
    assert res["intent"] == sc["expected_intent"], "Intent mismatch in final response"
    assert set(res["selected_agents"]) == set(sc["expected_agents"]), "Selected agents mismatch in response"

    print(f"-> SUCCESS: Intent={res['intent']}, Selected={res['selected_agents']}, RiskReq={res['risk_required']}")
    print(f"-> Recommendation: {res['recommendation']}")
    summary = res.get("explanation", {}).get("summary", "")
    print(f"-> Summary: {summary[:120]}..." if len(summary) > 120 else f"-> Summary: {summary}")
    passed += 1

print("\n" + "=" * 80)
print(f"ALL SCENARIOS VALIDATED: {passed}/{total} PASSED")
print("=" * 80)
