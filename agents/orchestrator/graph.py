"""
ORCA Marine Intelligence - Production LangGraph Agentic Flow
------------------------------------------------------------
Implements query-based LangGraph multi-agent architecture:
- User query determines which specialist agents are called.
- General and general-knowledge queries bypass specialist APIs.
- Single-agent queries execute only the requested specialist.
- Safety assessment queries execute all four specialists in parallel.
- Deterministic Risk Engine remains authoritative for safety decisions.
- Gemini provides fisherman-friendly explanations with retry/fallback.
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple, TypedDict

# Ensure workspace root is in sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
_root_dir = os.path.abspath(os.path.join(_current_dir, "..", ".."))
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

from dotenv import load_dotenv
from google import genai
from google.genai import types
from langgraph.graph import END, START, StateGraph

from agents.pfz.main import find_nearest_pfz
from agents.marine_weather.main import fetch_marine_weather
from agents.svas.main import get_svas_advisory
from agents.ocean_analysis.main import analyze_ocean_conditions
from agents.risk.main import calculate_risk

# ===========================================================================
# CONFIGURATION & LOGGING
# ===========================================================================

load_dotenv(override=True)

try:
    import certifi
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
except ImportError:
    pass

import httpx
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger("orca_orchestrator")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter("%(levelname)s:%(name)s:%(message)s")
    )
    logger.addHandler(handler)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Supported Gemini Model Cascade
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
fallback_models_env = os.getenv(
    "GEMINI_FALLBACK_MODELS",
    "gemini-3.5-flash-lite,gemini-3.7-flash,gemini-3.6-flash",
)
GEMINI_FALLBACK_MODELS = [
    m.strip() for m in fallback_models_env.split(",") if m.strip()
]
GEMINI_MODELS: List[str] = list(
    dict.fromkeys([GEMINI_MODEL] + GEMINI_FALLBACK_MODELS)
)

GEMINI_RETRIES = int(os.getenv("GEMINI_RETRIES", "2"))
GEMINI_RETRY_DELAY = float(os.getenv("GEMINI_RETRY_DELAY", "2.0"))

gemini_client: Optional[genai.Client] = None
if GEMINI_API_KEY:
    try:
        gemini_client = genai.Client(
            api_key=GEMINI_API_KEY,
            http_options=types.HttpOptions(
                httpx_client=httpx.Client(verify=False)
            ),
        )
        logger.info("Gemini client initialized. Models: %s", GEMINI_MODELS)
    except Exception as exc:
        logger.warning("Gemini client init failed: %s", exc)
else:
    logger.warning("GEMINI_API_KEY not found. Fallback explanations enabled.")


# ===========================================================================
# AGENT NAMES
# ===========================================================================

AGENT_PFZ = "pfz"
AGENT_WEATHER = "marine_weather"
AGENT_SVAS = "svas"
AGENT_OCEAN = "ocean_analysis"

ALL_SPECIALISTS = [
    AGENT_PFZ,
    AGENT_WEATHER,
    AGENT_SVAS,
    AGENT_OCEAN,
]


# ===========================================================================
# LANGGRAPH STATE SCHEMA
# ===========================================================================

class ORCAState(TypedDict, total=False):
    # User input
    query: str
    latitude: float
    longitude: float
    date: Optional[str]
    boat_width_m: Optional[float]

    # Supervisor
    intent: str
    selected_agents: List[str]
    risk_required: bool

    # Specialist isolated outputs (prevents concurrency conflicts)
    pfz_result: Dict[str, Any]
    marine_weather_result: Dict[str, Any]
    svas_result: Dict[str, Any]
    ocean_analysis_result: Dict[str, Any]

    # Aggregated information
    specialist_results: Dict[str, Any]

    # Risk result
    risk_result: Dict[str, Any]

    # Explanation
    gemini_explanation: Dict[str, Any]

    # Final response
    recommendation: str
    final_response: Dict[str, Any]


# ===========================================================================
# INTENT CLASSIFICATION & ROUTING
# ===========================================================================

def contains_any(text: str, keywords: List[str]) -> bool:
    """Return True if any keyword/phrase is present in lowercased text."""
    return any(keyword in text for keyword in keywords)


def extract_boat_width(query: str, default: float = 5.0) -> float:
    """Extract boat width in meters from natural language if specified."""
    match = re.search(r"(\d+(?:\.\d+)?)\s*(?:m|meter|meters|metre|metres)\s*(?:boat|vessel|craft|dinghy)?", query, re.IGNORECASE)
    if match:
        try:
            val = float(match.group(1))
            if 0 < val <= 50:
                return val
        except ValueError:
            pass
    return default


def classify_query(query: str) -> Tuple[str, List[str], bool]:
    """
    Classify user query deterministically into one of the ORCA intents:
    - general
    - emergency
    - safety_assessment
    - fishing_advice
    - pfz_query
    - marine_weather_query
    - svas_query
    - ocean_analysis_query

    Returns: (intent, selected_agents, risk_required)
    """
    q = (query or "").strip().lower()

    if not q:
        return "general", [], False

    # 1. EMERGENCY
    emergency_keywords = [
        "boat is in danger",
        "stranded at sea",
        "emergency",
        "mayday",
        "sos",
        "boat sinking",
        "capsizing",
        "man overboard",
        "life threatening",
        "engine failed at sea",
        "distress",
        "save us",
    ]
    if contains_any(q, emergency_keywords):
        return "emergency", [], False

    # 2. GENERAL GREETING / BOT IDENTITY / DOMAIN KNOWLEDGE (No live data needed)
    general_knowledge_exact = [
        "hello",
        "hi",
        "hey",
        "good morning",
        "good afternoon",
        "good evening",
        "who are you",
        "what are you",
        "what is orca",
        "what can you do",
        "how can you help",
        "help",
        "what is fishing",
        "what is a pfz",
        "what is pfz",
        "what is a potential fishing zone",
        "what is potential fishing zone",
        "what is svas",
        "what is swell",
        "explain pfz",
        "explain svas",
    ]
    if q in general_knowledge_exact or (
        q.startswith("what is ") and not contains_any(q, ["today", "now", "current", "near me", "nearest", "weather", "wave", "wind", "temp", "restriction", "restrictions"])
    ):
        return "general", [], False

    # 3. FISHING ADVICE (Where to fish / recommendation; PFZ + Marine Weather; no risk calculation)
    fishing_advice_keywords = [
        "where should i go fishing",
        "where should we go fishing",
        "where to go fishing",
        "where should i fish",
        "where should we fish",
        "which fishing area is better",
        "which fishing area",
        "recommend fishing spot",
        "recommend fishing area",
        "where to go fishing today",
        "where should i go to fish",
        "best place to fish today",
        "suggest fishing area",
        "which zone is better",
    ]
    is_explicit_safety = contains_any(q, [
        "is it safe", "safe to", "safe for", "dangerous", "danger", "risk", "can my boat go out"
    ])
    if contains_any(q, fishing_advice_keywords) and not is_explicit_safety:
        return "fishing_advice", [AGENT_PFZ, AGENT_WEATHER], False

    # 4. SAFETY ASSESSMENT (All 4 specialist agents + Risk Engine)
    safety_keywords = [
        "is it safe",
        "safe to go",
        "safe for fishing",
        "safe for sailing",
        "safe to sail",
        "safe fishing",
        "should i go",
        "should we go",
        "can i go fishing",
        "can we go fishing",
        "can i sail",
        "can we sail",
        "can my boat go out",
        "can i go with my",
        "should i take my boat",
        "is it dangerous",
        "danger today",
        "safety today",
        "safety assessment",
        "trip safe",
        "trip safety",
        "safe today",
        "can i go out to sea",
        "risk score",
        "risk level",
        "weather risk",
        "safe for my boat",
    ]
    if contains_any(q, safety_keywords):
        return "safety_assessment", ALL_SPECIALISTS.copy(), True

    # 5. SPECIFIC SPECIALIST QUERIES
    pfz_keywords = [
        "pfz",
        "potential fishing zone",
        "potential fishing zones",
        "fishing zone",
        "fishing zones",
        "fish zone",
        "best fishing area",
        "nearest fishing zone",
        "nearest pfz",
        "nearby fishing zone",
        "find a fishing zone",
        "find nearest pfz",
    ]

    weather_keywords = [
        "marine weather",
        "wave",
        "waves",
        "wave height",
        "wave direction",
        "wave period",
        "swell",
        "wind",
        "wind speed",
        "wind gust",
        "gusts",
        "sea temperature",
        "sea surface temperature",
        "sst",
        "weather at sea",
        "sea condition",
        "sea conditions",
        "current wave",
        "current wind",
    ]

    svas_keywords = [
        "svas",
        "advisory",
        "advisories",
        "restriction",
        "restrictions",
        "vessel advisory",
        "boat advisory",
        "sailing restriction",
        "sailing restrictions",
        "fishing restriction",
        "fishing restrictions",
        "is my boat allowed",
        "boat allowed to sail",
        "small vessel advisory",
        "restrictions for my boat",
    ]

    ocean_keywords = [
        "cyclone",
        "tsunami",
        "lightning",
        "thunderstorm",
        "chlorophyll",
        "ocean analysis",
        "ocean condition",
        "ocean conditions",
        "ocean current",
        "ocean currents",
        "current velocity",
        "marine hazard",
        "ocean hazard",
    ]

    is_pfz = contains_any(q, pfz_keywords)
    is_weather = contains_any(q, weather_keywords)
    is_svas = contains_any(q, svas_keywords)
    is_ocean = contains_any(q, ocean_keywords)

    selected: List[str] = []
    if is_pfz:
        selected.append(AGENT_PFZ)
    if is_weather:
        selected.append(AGENT_WEATHER)
    if is_svas:
        selected.append(AGENT_SVAS)
    if is_ocean:
        selected.append(AGENT_OCEAN)

    if len(selected) == 1:
        agent = selected[0]
        if agent == AGENT_PFZ:
            return "pfz_query", [AGENT_PFZ], False
        elif agent == AGENT_WEATHER:
            return "marine_weather_query", [AGENT_WEATHER], False
        elif agent == AGENT_SVAS:
            return "svas_query", [AGENT_SVAS], False
        elif agent == AGENT_OCEAN:
            return "ocean_analysis_query", [AGENT_OCEAN], False

    if len(selected) > 1:
        # Multi-specialist informative query
        return "multi_specialist_query", selected, False

    # 6. Fallback
    # If coordinates / general question without marine keywords
    return "general", [], False


# ===========================================================================
# SUPERVISOR NODE
# ===========================================================================

def supervisor_node(state: ORCAState) -> Dict[str, Any]:
    """
    Supervisor classifies query and selects required specialist agents.
    Does NOT calculate risk and does NOT fabricate marine data.
    """
    query = state.get("query", "")
    intent, selected_agents, risk_required = classify_query(query)

    boat_width = state.get("boat_width_m")
    if boat_width is None:
        boat_width = extract_boat_width(query, default=5.0)

    logger.info("\n[SUPERVISOR]")
    logger.info("Query: %s", query)
    logger.info("Intent: %s", intent)
    logger.info("Selected agents: %s", selected_agents)
    logger.info("Risk required: %s", risk_required)

    return {
        "intent": intent,
        "selected_agents": selected_agents,
        "risk_required": risk_required,
        "boat_width_m": boat_width,
    }


def route_from_supervisor(state: ORCAState) -> List[str]:
    """
    Dynamic LangGraph conditional router.
    Fans out to selected specialist nodes or general response.
    """
    selected = state.get("selected_agents", [])
    intent = state.get("intent", "general")

    if not selected or intent in ["general", "emergency"]:
        return ["general_response"]

    return selected


# ===========================================================================
# SPECIALIST NODES (Isolate return keys to prevent concurrency conflicts)
# ===========================================================================

def pfz_node(state: ORCAState) -> Dict[str, Any]:
    """Execute PFZ Agent."""
    lat = state.get("latitude")
    lon = state.get("longitude")
    logger.info("[PFZ AGENT] Starting...")
    try:
        result = find_nearest_pfz(latitude=float(lat), longitude=float(lon))
        if not isinstance(result, dict):
            result = {"status": "success", "data": result}
    except Exception as exc:
        logger.exception("PFZ execution failed: %s", exc)
        result = {"agent": "pfz", "status": "error", "error": str(exc)}

    logger.info("[PFZ AGENT] Finished.")
    return {"pfz_result": result}


def marine_weather_node(state: ORCAState) -> Dict[str, Any]:
    """Execute Marine Weather Agent."""
    lat = state.get("latitude")
    lon = state.get("longitude")
    logger.info("[MARINE WEATHER AGENT] Starting...")
    try:
        result = fetch_marine_weather(latitude=float(lat), longitude=float(lon))
        if not isinstance(result, dict):
            result = {"status": "success", "data": result}
    except Exception as exc:
        logger.exception("Marine Weather execution failed: %s", exc)
        result = {"agent": "marine_weather", "status": "error", "error": str(exc)}

    logger.info("[MARINE WEATHER AGENT] Finished.")
    return {"marine_weather_result": result}


def svas_node(state: ORCAState) -> Dict[str, Any]:
    """Execute SVAS Agent."""
    lat = state.get("latitude")
    lon = state.get("longitude")
    date_val = state.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    boat_width = state.get("boat_width_m") or 5.0

    logger.info("[SVAS AGENT] Starting...")
    try:
        result = get_svas_advisory(
            latitude=float(lat),
            longitude=float(lon),
            requested_date=str(date_val),
            boat_width_m=float(boat_width),
        )
        if not isinstance(result, dict):
            result = {"status": "success", "data": result}
    except Exception as exc:
        logger.exception("SVAS execution failed: %s", exc)
        result = {"agent": "svas", "status": "error", "error": str(exc)}

    logger.info("[SVAS AGENT] Finished.")
    return {"svas_result": result}


def ocean_analysis_node(state: ORCAState) -> Dict[str, Any]:
    """Execute Ocean Analysis Agent."""
    lat = state.get("latitude")
    lon = state.get("longitude")
    date_val = state.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    logger.info("[OCEAN ANALYSIS AGENT] Starting...")
    try:
        result = analyze_ocean_conditions(
            latitude=float(lat),
            longitude=float(lon),
            requested_date=str(date_val),
        )
        if not isinstance(result, dict):
            result = {"status": "success", "data": result}
    except Exception as exc:
        logger.exception("Ocean Analysis execution failed: %s", exc)
        result = {"agent": "ocean_analysis", "status": "error", "error": str(exc)}

    logger.info("[OCEAN ANALYSIS AGENT] Finished.")
    return {"ocean_analysis_result": result}


# ===========================================================================
# AGGREGATOR NODE
# ===========================================================================

def aggregator_node(state: ORCAState) -> Dict[str, Any]:
    """
    Aggregate only specialist outputs that were selected and executed.

    Keeping unselected agents out of this object is important: the response
    represents the evidence used for this particular query, rather than a
    synthetic report containing placeholder agent results.
    """
    logger.info("\n[AGGREGATOR] Combining specialist results...")
    selected = state.get("selected_agents", [])

    specialist_results: Dict[str, Any] = {}

    result_keys = {
        AGENT_PFZ: "pfz_result",
        AGENT_WEATHER: "marine_weather_result",
        AGENT_SVAS: "svas_result",
        AGENT_OCEAN: "ocean_analysis_result",
    }
    for agent in selected:
        result_key = result_keys.get(agent)
        if result_key:
            specialist_results[agent] = state.get(
                result_key,
                {"agent": agent, "status": "unavailable"},
            )

    logger.info("[AGGREGATOR] Specialist results combined.")
    return {"specialist_results": specialist_results}


def route_from_aggregator(state: ORCAState) -> str:
    """Decide whether to execute deterministic Risk Engine."""
    if state.get("risk_required", False):
        return "risk"
    return "explanation"


# ===========================================================================
# RISK ENGINE NODE (Authoritative & Deterministic)
# ===========================================================================

def risk_node(state: ORCAState) -> Dict[str, Any]:
    """
    Runs deterministic risk calculation.
    Gemini is NOT involved.
    """
    logger.info("\n[RISK ENGINE] Running deterministic risk calculation...")
    specialist_results = state.get("specialist_results", {})

    lat = state.get("latitude")
    lon = state.get("longitude")
    date_val = state.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    boat_width = state.get("boat_width_m") or 5.0

    try:
        result = calculate_risk(
            latitude=float(lat),
            longitude=float(lon),
            date=str(date_val),
            boat_width_m=float(boat_width),
            pfz_result=specialist_results.get("pfz"),
            marine_weather_result=specialist_results.get("marine_weather"),
            svas_result=specialist_results.get("svas"),
            ocean_analysis_result=specialist_results.get("ocean_analysis"),
        )
    except Exception as exc:
        logger.exception("Risk calculation failed: %s", exc)
        result = {
            "agent": "risk",
            "status": "error",
            "risk_score": None,
            "error": str(exc),
        }

    # Enrich risk result metadata
    if isinstance(result, dict):
        score = result.get("risk_score")
        status = result.get("status", "UNKNOWN")
        if score is not None:
            if score >= 75:
                risk_level = "CRITICAL"
            elif score >= 50:
                risk_level = "HIGH"
            elif score >= 25:
                risk_level = "MODERATE"
            else:
                risk_level = "LOW"
        else:
            risk_level = "UNKNOWN"

        result.setdefault("risk_level", risk_level)
        result.setdefault("score_type", "rule_based_severity")
        result.setdefault("confidence", "high" if result.get("data_quality") == "good" else ("medium" if result.get("data_quality") == "partial" else "low"))

    logger.info("[RISK ENGINE] Deterministic risk calculation complete. Status: %s, Score: %s", result.get("status"), result.get("risk_score"))
    return {"risk_result": result}


# ===========================================================================
# GEMINI EXPLANATION LAYER & RETRY / FALLBACK
# ===========================================================================

def _is_retryable_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    retryable = [
        "429", "500", "502", "503", "504", "resource exhausted",
        "service unavailable", "timeout", "timed out", "high demand", "deadline exceeded"
    ]
    return any(c in msg for c in retryable)


def _gemini_call(prompt: str, model: str) -> Dict[str, Any]:
    if gemini_client is None:
        raise RuntimeError("Gemini client is not initialized.")

    response = gemini_client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.2,
            response_mime_type="application/json",
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        ),
    )
    text = getattr(response, "text", None)
    if not text:
        raise RuntimeError("Empty response from Gemini.")

    text = text.strip()
    if text.startswith("```json"):
        text = text[len("```json"):].strip()
    elif text.startswith("```"):
        text = text[len("```"):].strip()
    if text.endswith("```"):
        text = text[:-len("```")].strip()

    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise RuntimeError("Parsed JSON is not a dictionary.")
    return parsed


def execute_gemini_json_with_fallback(prompt: str) -> Dict[str, Any]:
    if gemini_client is None:
        raise RuntimeError("Gemini client unavailable.")

    last_error: Optional[Exception] = None
    for model in GEMINI_MODELS:
        for attempt in range(1, GEMINI_RETRIES + 1):
            try:
                return _gemini_call(prompt, model)
            except Exception as exc:
                last_error = exc
                if not _is_retryable_error(exc):
                    break
                if attempt < GEMINI_RETRIES:
                    time.sleep(GEMINI_RETRY_DELAY * (2 ** (attempt - 1)))
    raise RuntimeError(f"All Gemini models failed. Last error: {last_error}")


# ===========================================================================
# DETERMINISTIC FALLBACK BUILDERS
# ===========================================================================

def build_deterministic_fallback(state: ORCAState) -> Dict[str, Any]:
    """Generates grounded fallback explanation when Gemini is unavailable."""
    intent = state.get("intent", "general")
    specialist_results = state.get("specialist_results", {})
    risk_result = state.get("risk_result", {})

    why: List[str] = []
    key_conditions: List[str] = []
    official_warnings: List[str] = []
    data_limitations: List[str] = []

    # 1. SVAS
    svas = specialist_results.get("svas", {})
    if isinstance(svas, dict) and svas.get("status") == "success":
        advisory = svas.get("advisory", {})
        if advisory.get("message"):
            official_warnings.append(f"INCOIS SVAS: {advisory.get('message')}")

    # 2. Ocean Analysis
    ocean = specialist_results.get("ocean_analysis", {})
    if isinstance(ocean, dict):
        warnings = ocean.get("warnings", [])
        for w in warnings:
            official_warnings.append(f"{w.get('type')}: {w.get('message')}")
        if ocean.get("status") == "partial":
            data_limitations.append("Some supporting ocean data feeds were partially unavailable.")

    # 3. Weather
    weather = specialist_results.get("marine_weather", {})
    if isinstance(weather, dict) and weather.get("status") == "success":
        m = weather.get("marine", {})
        w = weather.get("weather", {})
        if m.get("wave_height_m") is not None:
            key_conditions.append(f"Waves: {m.get('wave_height_m')} m")
        if w.get("wind_speed_knots") is not None:
            key_conditions.append(f"Wind: {w.get('wind_speed_knots')} knots (Gusts: {w.get('wind_gusts_knots', 'N/A')} knots)")
        if m.get("sea_surface_temperature_c") is not None:
            key_conditions.append(f"Sea Temp: {m.get('sea_surface_temperature_c')}°C")

    # 4. PFZ
    pfz = specialist_results.get("pfz", {})
    if isinstance(pfz, dict) and pfz.get("status") == "success":
        p_data = pfz.get("pfz", {}).get("nearest_point", {})
        if p_data.get("distance_km") is not None:
            key_conditions.append(f"Nearest PFZ: {p_data.get('distance_km')} km to the {p_data.get('direction', 'N/A')}")

    # Intent-specific summaries
    if intent == "safety_assessment":
        status = risk_result.get("status", "UNKNOWN")
        score = risk_result.get("risk_score")
        why.extend(risk_result.get("reasons", []))

        if status == "NOT_RECOMMENDED":
            summary = f"🔴 NOT RECOMMENDED. Risk score: {score}/100. Official restrictions or adverse marine conditions apply."
            final_advice = "Remain in port. Do not venture into sea until safety advisories improve."
        elif status in ["SAFE", "RECOMMENDED"]:
            summary = f"🟢 CONDITIONS GENERALLY FAVOURABLE. Risk score: {score}/100. Marine conditions are within normal limits."
            final_advice = "Proceed with normal caution and continue monitoring official maritime advisories."
        else:
            summary = f"🟡 CAUTION. Risk score: {score}/100. Moderate marine hazards or vessel precautions in effect."
            final_advice = "Exercise caution. Small craft should avoid offshore waters if gusts or swell increase."

    elif intent == "pfz_query":
        if isinstance(pfz, dict) and pfz.get("status") == "success":
            p = pfz.get("pfz", {}).get("nearest_point", {})
            summary = f"🎣 Nearest Potential Fishing Zone is approximately {p.get('distance_km', 'N/A')} km to the {p.get('direction', 'N/A')}."
            final_advice = "PFZ indicates potential fish aggregation. Always check weather and safety conditions before departing."
        else:
            summary = "PFZ data is currently unavailable from INCOIS."
            final_advice = "Please retry shortly or consult local port authorities."

    elif intent == "marine_weather_query":
        summary = "🌊 Marine weather report updated. " + ", ".join(key_conditions)
        final_advice = "This is a marine condition update, not a complete safety clearance."

    elif intent == "svas_query":
        if official_warnings:
            summary = "📋 Official SVAS vessel advisory active: " + "; ".join(official_warnings)
        else:
            summary = "📋 SVAS advisory: No active vessel restrictions recorded for the specified date and size."
        final_advice = "Verify current port clearance before casting off."

    elif intent == "ocean_analysis_query":
        summary = "🛰️ Ocean Analysis: Environmental hazards checked."
        if official_warnings:
            summary += " Active notices: " + "; ".join(official_warnings)
        else:
            summary += " No active cyclone or tsunami threats detected in search area."
        final_advice = "Stay tuned to official INCOIS ocean state forecasts."

    elif intent == "fishing_advice":
        summary = "🎣 Fishing trip advice based on live PFZ and weather conditions."
        final_advice = "Target the nearest fishing zone if marine conditions remain calm."

    elif intent == "emergency":
        summary = "🚨 EMERGENCY DIRECTIVE: Contact the Indian Coast Guard immediately."
        official_warnings.append("Emergency distress call: Dial 1554 (Coast Guard) or 1093 (Coastal Police) or 112.")
        final_advice = "Transmit MAYDAY on VHF Channel 16 if equipped, or call 1554 immediately."

    else:
        summary = "ORCA Marine Intelligence Assistant is ready to provide live PFZ, marine weather, SVAS vessel advisories, and safety risk assessments."
        final_advice = "Ask about fishing zones, waves, wind, vessel restrictions, or trip safety."

    return {
        "summary": summary,
        "why": why,
        "key_conditions": key_conditions,
        "official_warnings": official_warnings,
        "data_limitations": data_limitations,
        "final_advice": final_advice,
    }


# ===========================================================================
# GENERAL RESPONSE NODE (Direct general & emergency queries)
# ===========================================================================

def general_response_node(state: ORCAState) -> Dict[str, Any]:
    """Handles general conversation and emergency queries without calling marine specialist APIs."""
    query = state.get("query", "")
    intent = state.get("intent", "general")

    logger.info("\n[GENERAL RESPONSE] Intent: %s. No specialist APIs invoked.", intent)

    if intent == "emergency":
        explanation = {
            "summary": "🚨 EMERGENCY DIRECTIVE: If you or your vessel are in distress at sea, immediately contact maritime rescue authorities.",
            "why": ["User reported an active emergency or distress situation at sea."],
            "key_conditions": [],
            "official_warnings": [
                "Indian Coast Guard Emergency Toll-Free Helpline: 1554",
                "Coastal Police Helpline: 1093",
                "National Emergency Number: 112",
                "VHF Distress Frequency: Channel 16 (156.8 MHz)",
            ],
            "data_limitations": [],
            "final_advice": "Do not rely solely on automated chat during life-threatening situations. Call 1554 or broadcast MAYDAY on VHF Channel 16 immediately.",
        }
        recommendation = "🚨 MARITIME EMERGENCY — CONTACT COAST GUARD (1554)"
        return {
            "gemini_explanation": explanation,
            "recommendation": recommendation,
        }

    # General knowledge / capability
    prompt = f"""
You are ORCA Marine Intelligence, an authoritative AI assistant for Indian fishermen and mariners.
The user asked a general question: "{query}".

Explain concisely in simple, fisherman-friendly terms.
Do NOT invent live weather or fake coordinates.
Return JSON with this structure:
{{
  "summary": "Concise answer to the user's question.",
  "why": [],
  "key_conditions": [],
  "official_warnings": [],
  "data_limitations": [],
  "final_advice": "Brief helpful guidance on how ORCA can assist."
}}
"""
    try:
        explanation = execute_gemini_json_with_fallback(prompt)
    except Exception as exc:
        logger.info("Using fallback for general response: %s", exc)
        explanation = build_deterministic_fallback(state)

    recommendation = "ℹ️ GENERAL INQUIRY"
    return {
        "gemini_explanation": explanation,
        "recommendation": recommendation,
    }


# ===========================================================================
# EXPLANATION NODE
# ===========================================================================

def explanation_node(state: ORCAState) -> Dict[str, Any]:
    """Generates fisherman-friendly grounded explanation from specialist evidence and risk result."""
    logger.info("\n[GEMINI EXPLANATION] Synthesizing fisherman-friendly guidance...")

    intent = state.get("intent", "general")
    specialist_results = state.get("specialist_results", {})
    risk_result = state.get("risk_result", {})
    query = state.get("query", "")

    prompt = f"""
You are the explanation layer of ORCA Marine Intelligence.
Explain the results to a fisherman in clear, simple, practical language.

STRICT RULES:
1. NEVER calculate, invent, or override the deterministic risk score or status.
2. If Risk Status is NOT_RECOMMENDED, you MUST advise against going to sea.
3. Treat INCOIS SVAS official safety restrictions as authoritative.
4. Do NOT dump raw polygon coordinates into the conversational text.
5. Do NOT list unnecessary scientific parameters unless directly relevant to the user query.
6. Return valid JSON only.

USER QUERY: {query}
INTENT: {intent}
LOCATION: Lat {state.get('latitude')}, Lon {state.get('longitude')}
DATE: {state.get('date')}
BOAT WIDTH: {state.get('boat_width_m')} meters

DETERMINISTIC RISK RESULT:
{json.dumps(risk_result, ensure_ascii=False, indent=2)}

SPECIALIST EVIDENCE:
{json.dumps(specialist_results, ensure_ascii=False, indent=2)}

Return JSON exactly matching this structure:
{{
  "summary": "Concise summary answering what this means for the fisherman.",
  "why": [
    "Key reason 1",
    "Key reason 2"
  ],
  "key_conditions": [
    "Waves: ~X.X m",
    "Wind: ~X knots",
    "Nearest PFZ: ~X km (Direction)"
  ],
  "official_warnings": [
    "SVAS warning or hazard advisory if applicable"
  ],
  "data_limitations": [
    "Any unavailable or partial data source"
  ],
  "final_advice": "Practical fisherman-friendly recommendation."
}}
"""
    try:
        explanation = execute_gemini_json_with_fallback(prompt)
    except Exception as exc:
        logger.warning("Gemini explanation failed (%s), using deterministic fallback.", exc)
        explanation = build_deterministic_fallback(state)

    return {"gemini_explanation": explanation}


# ===========================================================================
# FINAL RESPONSE NODE
# ===========================================================================

def final_response_node(state: ORCAState) -> Dict[str, Any]:
    """Constructs final structured response compliant with frontend and API contracts."""
    logger.info("\n[FINAL RESPONSE] Formatting complete ORCA assessment response...")

    risk_result = state.get("risk_result", {})
    explanation = state.get("gemini_explanation", {})
    intent = state.get("intent", "general")
    selected_agents = state.get("selected_agents", [])
    risk_required = state.get("risk_required", False)

    status = risk_result.get("status")
    score = risk_result.get("risk_score")

    if state.get("recommendation"):
        recommendation = state["recommendation"]
    elif status == "NOT_RECOMMENDED":
        recommendation = f"🔴 NOT RECOMMENDED (Risk Score: {score}/100)"
    elif status in ["SAFE", "RECOMMENDED"]:
        recommendation = f"🟢 CONDITIONS GENERALLY FAVOURABLE (Risk Score: {score}/100)"
    elif status in ["CAUTION", "HIGH_RISK"]:
        recommendation = f"🟡 CAUTION (Risk Score: {score}/100)"
    elif intent == "emergency":
        recommendation = "🚨 MARITIME EMERGENCY — CONTACT COAST GUARD (1554)"
    else:
        recommendation = "ℹ️ INFORMATION QUERY"

    specialist_results = state.get("specialist_results", {})
    final_dict = {
        "query": state.get("query", ""),
        "location": {
            "latitude": state.get("latitude"),
            "longitude": state.get("longitude"),
        },
        "date": state.get("date"),
        "boat_width_m": state.get("boat_width_m"),
        "intent": intent,
        "selected_agents": selected_agents,
        "risk_required": risk_required,
        "recommendation": recommendation,
        "risk": risk_result if risk_required else {"status": "not_required", "risk_score": None},
        "explanation": explanation,
        "specialist_results": specialist_results,
    }

    # Keep the top-level fields used by existing clients, but expose only
    # evidence that was genuinely collected for this query.
    final_dict.update(specialist_results)

    return {
        "recommendation": recommendation,
        "final_response": final_dict,
    }


# ===========================================================================
# BUILD LANGGRAPH
# ===========================================================================

def build_orca_graph():
    """Build and compile the production ORCA LangGraph StateGraph."""
    graph = StateGraph(ORCAState)

    # Add Nodes
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("general_response", general_response_node)
    graph.add_node("pfz", pfz_node)
    graph.add_node("marine_weather", marine_weather_node)
    graph.add_node("svas", svas_node)
    graph.add_node("ocean_analysis", ocean_analysis_node)
    graph.add_node("aggregator", aggregator_node)
    graph.add_node("risk", risk_node)
    graph.add_node("explanation", explanation_node)
    graph.add_node("final_response", final_response_node)

    # START -> Supervisor
    graph.add_edge(START, "supervisor")

    # Supervisor -> Dynamic conditional fan-out
    graph.add_conditional_edges(
        "supervisor",
        route_from_supervisor,
        ["general_response", "pfz", "marine_weather", "svas", "ocean_analysis"],
    )

    # Specialist fan-in to Aggregator
    graph.add_edge("pfz", "aggregator")
    graph.add_edge("marine_weather", "aggregator")
    graph.add_edge("svas", "aggregator")
    graph.add_edge("ocean_analysis", "aggregator")

    # Aggregator -> Risk or Explanation
    graph.add_conditional_edges(
        "aggregator",
        route_from_aggregator,
        {
            "risk": "risk",
            "explanation": "explanation",
        },
    )

    # Risk -> Explanation
    graph.add_edge("risk", "explanation")

    # Explanation & General Response -> Final Response
    graph.add_edge("explanation", "final_response")
    graph.add_edge("general_response", "final_response")

    # Final Response -> END
    graph.add_edge("final_response", END)

    return graph.compile()


orca_graph = build_orca_graph()


# ===========================================================================
# PUBLIC API
# ===========================================================================

def run_orca(
    latitude: float,
    longitude: float,
    date: Optional[str] = None,
    boat_width_m: Optional[float] = 5.0,
    query: str = "",
) -> Dict[str, Any]:
    """
    Main public ORCA entry point.
    """
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    initial_state: ORCAState = {
        "query": query or "",
        "latitude": float(latitude) if latitude is not None else 19.72,
        "longitude": float(longitude) if longitude is not None else 72.70,
        "date": date,
        "boat_width_m": float(boat_width_m) if boat_width_m is not None else 5.0,
    }

    result = orca_graph.invoke(initial_state)
    return result.get("final_response", {})


def orchestrate_orca_assessment(
    latitude: float,
    longitude: float,
    date: Optional[str] = None,
    boat_width_m: Optional[float] = 5.0,
    query: str = "",
) -> Dict[str, Any]:
    """Compatibility alias for FastAPI and external bridges."""
    return run_orca(
        latitude=latitude,
        longitude=longitude,
        date=date,
        boat_width_m=boat_width_m,
        query=query,
    )
