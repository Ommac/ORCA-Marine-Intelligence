"""
ORCA Marine Intelligence - Orchestrator Main Entry Point
--------------------------------------------------------
Exposes:
- run_orca(...)
- orchestrate_orca_assessment(...)
- classify_query(...)
- orca_graph
- ORCAState
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any, Dict, Optional

# Ensure workspace root is in sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
_root_dir = os.path.abspath(os.path.join(_current_dir, "..", ".."))
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

from agents.orchestrator.graph import (
    ORCAState,
    classify_query,
    orca_graph,
    orchestrate_orca_assessment,
    run_orca,
)

__all__ = [
    "ORCAState",
    "classify_query",
    "orca_graph",
    "orchestrate_orca_assessment",
    "run_orca",
]


if __name__ == "__main__":
    sample_queries = [
        "Hello, what can you do?",
        "What is fishing?",
        "Where is the nearest potential fishing zone?",
        "What are the current sea conditions?",
        "Are there any restrictions for my boat?",
        "Is there a cyclone or lightning risk near me?",
        "Is it safe to go fishing today?",
        "Can I go fishing today with my 5 meter boat?",
        "Where should I go fishing today?",
        "My boat is in danger",
    ]

    print("=" * 80)
    print("ORCA LANGGRAPH QUERY ROUTING TEST")
    print("=" * 80)

    for q in sample_queries:
        intent, selected, risk_req = classify_query(q)
        print(f"\nQuery: {q}")
        print(f"Intent: {intent} | Selected: {selected} | Risk Required: {risk_req}")

    print("\n" + "=" * 80)
    print("Executing Sample Full Assessment ('Is it safe to go fishing today?'):")
    print("=" * 80)
    res = run_orca(
        latitude=19.72,
        longitude=72.70,
        date="2026-09-05",
        boat_width_m=5.0,
        query="Is it safe to go fishing today?",
    )
    print(json.dumps(res, indent=2, ensure_ascii=False))