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
from datetime import datetime, timedelta, timezone
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
from agents.orchestrator.session_store import (
    get_or_create_session,
    get_session,
    update_session,
    add_session_message,
    get_cached_pfz_candidates,
)

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
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
fallback_models_env = os.getenv(
    "GEMINI_FALLBACK_MODELS",
    "gemini-3.5-flash-lite,gemini-3.5-flash,gemini-3.7-flash,gemini-3.6-flash",
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
    # User input & Context
    request_id: Optional[str]
    session_id: Optional[str]
    query: str
    conversation_history: List[Dict[str, str]]
    conversation_context: Dict[str, Any]
    latitude: float
    longitude: float
    date: Optional[str]
    boat_width_m: Optional[float]

    # Intent & Context Resolution
    intent: str
    action: Optional[str]               # e.g. "show_on_map", "query", "assess"
    target_entity: Optional[str]        # e.g. "pfz", "marine_weather", "svas", "ocean_analysis"
    entity_rank: Optional[int]          # e.g. 1, 2, 3
    resolved_query: str                 # Natural language query with references resolved
    selected_agents: List[str]
    risk_required: bool

    # Map & UI Actions
    map_target: Optional[Dict[str, Any]]
    ui_action: Optional[Dict[str, Any]]

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


def resolve_effective_date(query: str, reference_date: str) -> str:
    """
    Resolve relative date terms in the query against the API request date.

    The request date is authoritative (not server clock). Examples when
    reference_date = 2026-09-06:
      today -> 2026-09-06
      tomorrow -> 2026-09-07
      day after tomorrow -> 2026-09-08
      yesterday -> 2026-09-05
    """
    q = (query or "").strip().lower()
    ref = datetime.strptime(reference_date, "%Y-%m-%d").date()

    if "day after tomorrow" in q:
        return (ref + timedelta(days=2)).strftime("%Y-%m-%d")
    if "tomorrow" in q:
        return (ref + timedelta(days=1)).strftime("%Y-%m-%d")
    if "yesterday" in q:
        return (ref - timedelta(days=1)).strftime("%Y-%m-%d")
    if "today" in q:
        return ref.strftime("%Y-%m-%d")

    return reference_date


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


def extract_entity_rank(text: str, default: Optional[int] = None) -> Optional[int]:
    """
    Extract ordinal or cardinal rank from text (e.g. '2nd', 'second', '3rd', 'third', 'nearest', '1st').
    Returns None if no rank or ordinal is specified.
    """
    t = text.lower()
    if re.search(r"\b(2nd|second)\b", t) or "2 nd" in t:
        return 2
    if re.search(r"\b(3rd|third)\b", t) or "3 rd" in t:
        return 3
    if re.search(r"\b(4th|fourth)\b", t) or "4 th" in t:
        return 4
    if re.search(r"\b(5th|fifth)\b", t) or "5 th" in t:
        return 5
    if re.search(r"\b(1st|first)\b", t) or "1 st" in t:
        return 1
    m = re.search(r"(?:rank|number|#|zone)\s*(\d+)", t)
    if m:
        try:
            val = int(m.group(1))
            if 1 <= val <= 20:
                return val
        except ValueError:
            pass
    if re.search(r"\bnearest\b", t):
        return 1
    return default


def classify_query(query: str) -> Tuple[str, List[str], bool]:
    """
    Deterministically classify a query and select every specialist required.

    Important rules:
    1. Emergency keywords trigger immediate emergency protocol.
    2. Any query asking about safety, hazards to avoid, danger, or navigation risk
       runs a full safety assessment using all specialists.
    3. Specific specialist queries route directly to the requested domains.
    4. General / knowledge queries bypass specialist APIs.
    """
    q = (query or "").strip().lower()

    if not q:
        return "general", [], False

    emergency_keywords = [
        "boat is in danger", "stranded at sea", "emergency", "mayday", "sos",
        "boat sinking", "capsizing", "man overboard", "life threatening",
        "engine failed at sea", "distress", "save us",
    ]
    if contains_any(q, emergency_keywords):
        return "emergency", [], False

    general_knowledge_exact = [
        "hello", "hi", "hey", "good morning", "good afternoon", "good evening",
        "who are you", "what are you", "what is orca", "what can you do",
        "how can you help", "help", "what is fishing", "what is a pfz",
        "what is pfz", "what is a potential fishing zone",
        "what is potential fishing zone", "what is svas", "what is swell",
        "explain pfz", "explain svas",
    ]
    if q in general_knowledge_exact:
        return "general", [], False

    # Detect safety and hazard avoidance intent before ordinary specialist routing.
    # Catches questions about safety, hazards to avoid, geofencing restrictions, danger, etc.
    safety_and_hazard_keywords = [
        "is it safe", "is safe", "safe to", "safe for", "whether it is safe",
        "whether safe", "tell me whether", "tell me if it is safe",
        "can i go", "can we go", "can i sail", "can we sail",
        "can i go out", "can we go out", "should i go", "should we go",
        "should i sail", "should we sail", "should i take my boat",
        "safe route", "route safety", "navigation safety", "trip safe",
        "trip safety", "safe today", "safe tomorrow", "risk score",
        "risk level", "weather risk", "safe for my boat",
        "safe to take my boat out", "safe to travel", "safe to travel there",
        "safe to reach", "safe to reach there", "safe journey",
        "dangerous", "danger at sea", "marine danger",
        "avoid", "avoided", "should be avoided", "zones to avoid",
        "zone to avoid", "dangerous zone", "dangerous zones",
        "hazardous zone", "hazardous zones", "hazard zone",
        "hazard zones", "hazardous marine", "marine hazards", "ocean hazards",
        "restricted zone", "restricted zones", "geofence", "geofencing",
        "no-go zone", "no go zone", "no-fishing zone",
    ]
    if contains_any(q, safety_and_hazard_keywords):
        return "safety_assessment", ALL_SPECIALISTS.copy(), True

    # Broad live-data signals.
    pfz_keywords = [
        "pfz", "potential fishing zone", "potential fishing zones",
        "fishing zone", "fishing zones", "fish zone", "best fishing area",
        "nearest fishing zone", "nearest pfz", "nearby fishing zone",
        "find a fishing zone", "find nearest pfz", "nearest potential fishing zone",
    ]
    weather_keywords = [
        "marine weather", "weather", "wave", "waves", "wave height",
        "wave direction", "wave period", "swell", "wind", "wind speed",
        "wind gust", "gusts", "sea temperature", "sea surface temperature",
        "sst", "weather at sea", "sea condition", "sea conditions",
        "current wave", "current wind",
    ]
    svas_keywords = [
        "svas", "advisory", "advisories", "restriction", "restrictions",
        "vessel advisory", "boat advisory", "sailing restriction",
        "sailing restrictions", "fishing restriction", "fishing restrictions",
        "is my boat allowed", "boat allowed to sail", "small vessel advisory",
        "restrictions for my boat", "marine warning", "marine warnings",
        "warning", "warnings", "official warning", "official warnings",
        "restricted",
    ]
    ocean_keywords = [
        "cyclone", "tsunami", "lightning", "thunderstorm", "chlorophyll",
        "ocean analysis", "ocean condition", "ocean conditions",
        "ocean current", "ocean currents", "current velocity",
        "marine hazard", "marine hazards", "ocean hazard", "ocean hazards",
        "hazardous", "hazard", "hazards",
    ]

    selected: List[str] = []
    if contains_any(q, pfz_keywords):
        selected.append(AGENT_PFZ)
    if contains_any(q, weather_keywords):
        selected.append(AGENT_WEATHER)
    if contains_any(q, svas_keywords):
        selected.append(AGENT_SVAS)
    if contains_any(q, ocean_keywords):
        selected.append(AGENT_OCEAN)

    # Where-to-fish questions need PFZ + weather even if the exact keyword
    # list above did not match.
    fishing_advice_keywords = [
        "where should i go fishing", "where should we go fishing",
        "where to go fishing", "where should i fish", "where should we fish",
        "which fishing area is better", "which fishing area",
        "recommend fishing spot", "recommend fishing area",
        "where to go fishing today", "where should i go to fish",
        "best place to fish today", "suggest fishing area",
        "which zone is better", "fishing route", "best route to fish",
    ]
    if contains_any(q, fishing_advice_keywords):
        return "fishing_advice", [AGENT_PFZ, AGENT_WEATHER], False

    if len(selected) == 1:
        agent = selected[0]
        if agent == AGENT_PFZ:
            return "pfz_query", [AGENT_PFZ], False
        if agent == AGENT_WEATHER:
            return "marine_weather_query", [AGENT_WEATHER], False
        if agent == AGENT_SVAS:
            return "svas_query", [AGENT_SVAS], False
        if agent == AGENT_OCEAN:
            return "ocean_analysis_query", [AGENT_OCEAN], False

    if len(selected) > 1:
        return "multi_specialist_query", selected, False

    if q.startswith("what is "):
        return "general", [], False

    return "general", [], False


def resolve_context_and_intent(
    query: str,
    conversation_history: Optional[List[Dict[str, str]]] = None,
    conversation_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Hybrid intent and conversational context resolution.
    Strict Separation Rules:
    1. Evaluates raw query deterministically first without any prior context influence.
    2. Contextual memory (last_entity, last_pfz_candidates, last_entity_rank) is accessed
       ONLY if the current query contains an explicit contextual reference / anaphora
       (e.g., 'show the second one on map', 'how far is it?', 'what about the 3rd one?').
    3. Unrelated queries (e.g. 'What is the capital of India?') or non-contextual domain queries
       (e.g. 'Are waves safe for 5m boat?') NEVER inherit previous PFZ rank, entity, or intent.
    """
    q_raw = (query or "").strip()
    q_lower = q_raw.lower()
    conv_history = conversation_history or []
    conv_ctx = conversation_context or {}

    # Extract rank strictly from current query text (default is None, never inherited by default)
    extracted_rank = extract_entity_rank(q_lower, default=None)

    # Base deterministic classification of the raw query
    raw_intent, raw_selected, raw_risk_req = classify_query(q_raw)

    # Detect Map Action
    is_map_action = bool(
        re.search(r"\b(show|plot|view|display|open|see|locate|take me to)\b.*\bmap\b", q_lower)
        or re.search(r"\b(on|in|to)\s+(?:the\s+)?map\b", q_lower)
        or contains_any(q_lower, [
            "show in map", "show on map", "plot on map", "view on map", "show map",
            "open map", "take me to map", "display on map", "locate on map",
            "show me on map", "plot it on map", "see on map", "on map", "in map",
            "on the map", "in the map", "to the map",
        ])
    )
    action = "show_on_map" if is_map_action else "query"

    # Explicit direct PFZ signals in current query
    direct_pfz_keywords = [
        "pfz", "potential fishing zone", "potential fishing zones",
        "fishing zone", "fishing zones", "fish zone", "fish zones",
        "best fishing area", "nearest fishing zone", "nearest pfz",
        "nearby fishing zone", "nearby fishing zones", "find a fishing zone",
        "find nearest pfz", "find pfz", "where to fish", "where should i fish",
        "where should i go fishing", "where to go fishing", "fishing spot",
        "fishing spots", "recommend fishing spot", "recommend fishing area",
        "best place to fish",
    ]
    has_direct_pfz_keyword = contains_any(q_lower, direct_pfz_keywords)

    # Anaphoric references / pronouns
    anaphora_patterns = [
        r"\b(that|this|the)\s+(one|zone|spot|area|candidate)\b",
        r"\b(it|there|that)\b",
        r"\b(the\s+)?(1st|first|2nd|second|3rd|third|4th|fourth|5th|fifth|nearest)\s+(one|zone|spot|area|on\s+map)\b",
        r"\bhow\s+far\s+(is\s+)?(it|that|there|the\s+\w+)\b",
        r"\b(show|plot|view|display|locate|open)\s+(it|that|the\s+\w+)?\s*(on|in|to)\s+(the\s+)?map\b",
        r"\bshow\s+(the\s+)?(1st|first|2nd|second|3rd|third|4th|fourth|5th|fifth|nearest)\b",
    ]
    has_anaphora = any(bool(re.search(pat, q_lower)) for pat in anaphora_patterns)
    has_cached_pfz = bool(conv_ctx.get("last_pfz_candidates") or conv_ctx.get("last_pfz_data"))
    last_entity = conv_ctx.get("last_entity")

    # Is this a valid contextual reference to previous PFZ?
    # ONLY True if:
    # 1. We have cached PFZ from a previous turn
    # 2. Previous turn entity was PFZ
    # 3. Current query has anaphora or map action or ordinal referencing the previous PFZ
    # AND 4. Current query is NOT an emergency or standalone general query without reference
    is_pfz_context_followup = (
        has_cached_pfz
        and last_entity == "pfz"
        and (has_anaphora or is_map_action or (extracted_rank is not None and not has_direct_pfz_keyword))
        and raw_intent not in ["emergency"]
        and not (raw_intent == "general" and not has_anaphora and not is_map_action)
    )

    # Determine rank and target entity
    if extracted_rank is not None:
        rank = extracted_rank
    elif is_pfz_context_followup:
        rank = conv_ctx.get("last_entity_rank") or 1
    else:
        rank = None

    if has_direct_pfz_keyword or is_pfz_context_followup:
        target_entity = "pfz"
    elif raw_intent in ["safety_assessment"]:
        target_entity = "safety"
    elif raw_intent in ["marine_weather_query"]:
        target_entity = "marine_weather"
    elif raw_intent in ["svas_query"]:
        target_entity = "svas"
    elif raw_intent in ["ocean_analysis_query"]:
        target_entity = "ocean_analysis"
    else:
        target_entity = "general"

    # Resolve Query Text
    resolved_query = q_raw
    if is_pfz_context_followup:
        effective_rank = rank or 1
        ord_word = {1: "1st nearest", 2: "2nd nearest", 3: "3rd nearest", 4: "4th nearest", 5: "5th nearest"}.get(effective_rank, f"rank {effective_rank}")
        if is_map_action:
            resolved_query = f"Show the {ord_word} Potential Fishing Zone on the map."
        elif "how far" in q_lower or "distance" in q_lower:
            resolved_query = f"How far is the {ord_word} Potential Fishing Zone?"
        elif has_anaphora:
            resolved_query = f"{q_raw} (referring to Potential Fishing Zone {ord_word})"

    # Base intent & agents determination
    if is_pfz_context_followup:
        det_intent = "pfz_query"
        det_selected = [AGENT_PFZ]
        det_risk_req = False
    elif has_direct_pfz_keyword and raw_intent in ["general", "general_knowledge"]:
        det_intent = "pfz_query"
        det_selected = [AGENT_PFZ]
        det_risk_req = False
    else:
        det_intent = raw_intent
        det_selected = raw_selected
        det_risk_req = raw_risk_req

    # 2. LLM Resolution (ONLY when there is genuine conversational ambiguity or explicit anaphora)
    should_invoke_llm = (
        gemini_client is not None
        and is_pfz_context_followup
        and contains_any(q_lower, ["it", "there", "that", "which one"])
    )

    if should_invoke_llm:
        try:
            recent_msgs_formatted = "\n".join([
                f"- {m.get('role', 'user').capitalize()}: {m.get('content', '')}"
                for m in conv_history[-4:]
            ])
            llm_prompt = f"""
You are the Conversational Supervisor and Intent Resolver for ORCA Marine Intelligence.
Analyze the user's latest query in the context of recent conversation history and extract structured intent.

CONVERSATION HISTORY:
{recent_msgs_formatted if recent_msgs_formatted else "None"}

PREVIOUS CONTEXT:
- Last active entity: {conv_ctx.get('last_entity', 'None')}
- Last selected PFZ rank: {conv_ctx.get('last_entity_rank', 1)}
- Last action: {conv_ctx.get('last_action', 'None')}

CURRENT USER QUERY:
"{q_raw}"

STRICT SCHEMA RULES:
1. "intent": One of ["pfz_query", "safety_assessment", "marine_weather_query", "svas_query", "ocean_analysis_query", "fishing_advice", "general", "emergency"]
2. If the current user query is a general knowledge question (e.g. "What is the capital of India?"), greeting, or completely new topic, you MUST return:
   "intent": "general", "action": "query", "target_entity": "general", "entity_rank": null, "selected_agents": [], "risk_required": false, "resolved_query": "{q_raw}"
3. "action": "show_on_map" if the user wants to view/plot/navigate to coordinates/map, otherwise "query" or "assess"
4. "target_entity": "pfz" | "marine_weather" | "svas" | "ocean_analysis" | "safety" | "general"
5. "entity_rank": Integer rank (1 for nearest, 2 for 2nd nearest, 3 for 3rd, etc.) or null
6. "risk_required": Boolean (true ONLY for safety assessments / hazard checks)
7. "selected_agents": Array of agents needed from ["pfz", "marine_weather", "svas", "ocean_analysis"]
8. "resolved_query": Complete unambiguous natural language query with pronouns resolved.

Return valid JSON only matching the schema.
"""
            llm_result = execute_gemini_json_with_fallback(llm_prompt)
            if isinstance(llm_result, dict) and "intent" in llm_result:
                llm_intent = str(llm_result.get("intent", det_intent))
                llm_action = str(llm_result.get("action", action))
                llm_entity = str(llm_result.get("target_entity", target_entity))
                llm_rank = llm_result.get("entity_rank")
                llm_agents = llm_result.get("selected_agents")
                llm_resolved = str(llm_result.get("resolved_query", resolved_query))

                if isinstance(llm_rank, int) and llm_rank >= 1:
                    rank = llm_rank
                if isinstance(llm_agents, list) and all(a in ALL_SPECIALISTS for a in llm_agents):
                    det_selected = llm_agents
                if llm_action in ["show_on_map", "query", "assess"]:
                    action = llm_action
                if llm_entity in ["pfz", "marine_weather", "svas", "ocean_analysis", "safety", "general"]:
                    target_entity = llm_entity
                if llm_intent in ["pfz_query", "safety_assessment", "marine_weather_query", "svas_query", "ocean_analysis_query", "fishing_advice", "general", "emergency"]:
                    det_intent = llm_intent
                if llm_resolved:
                    resolved_query = llm_resolved
        except Exception as exc:
            logger.info("[INTENT RESOLVER] LLM resolution skipped/failed (%s), using deterministic routing.", exc)

    # 3. Deterministic Safety Override (Cannot be bypassed by LLM)
    safety_keywords = [
        "is it safe", "is safe", "safe to", "safe for", "whether safe", "tell me if it is safe",
        "can i go", "can we go", "can i sail", "can we sail", "should i go", "should we go",
        "risk score", "risk level", "weather risk", "dangerous", "danger at sea",
        "avoid", "zones to avoid", "zone to avoid", "hazardous zone", "hazard zone",
        "restricted zone", "geofence", "no-go zone",
    ]
    if contains_any(q_lower, safety_keywords) or contains_any(resolved_query.lower(), safety_keywords):
        det_intent = "safety_assessment"
        det_selected = ALL_SPECIALISTS.copy()
        det_risk_req = True
        target_entity = "safety"

    # Emergency Override
    emergency_keywords = [
        "boat is in danger", "stranded at sea", "emergency", "mayday", "sos",
        "boat sinking", "capsizing", "man overboard", "life threatening",
        "engine failed at sea", "distress", "save us",
    ]
    if contains_any(q_lower, emergency_keywords):
        det_intent = "emergency"
        det_selected = []
        det_risk_req = False
        target_entity = "general"

    # If action is show_on_map for PFZ, ensure PFZ agent is selected
    if action == "show_on_map" and (target_entity == "pfz" or "pfz" in det_intent):
        if AGENT_PFZ not in det_selected:
            det_selected.append(AGENT_PFZ)

    return {
        "intent": det_intent,
        "action": action,
        "target_entity": target_entity,
        "entity_rank": rank,
        "selected_agents": det_selected,
        "risk_required": det_risk_req,
        "resolved_query": resolved_query,
    }


# ===========================================================================
# SUPERVISOR NODE
# ===========================================================================

def supervisor_node(state: ORCAState) -> Dict[str, Any]:
    """
    Supervisor classifies query and selects required specialist agents.
    Resolves conversational context, references, and intent.
    Does NOT calculate risk and does NOT fabricate marine data.
    """
    query = state.get("query", "")
    session_id = state.get("session_id")
    conv_history = state.get("conversation_history") or []

    session_data = get_session(session_id) if session_id else {}
    conv_context = {
        "last_intent": session_data.get("last_intent") if session_data else None,
        "last_action": session_data.get("last_action") if session_data else None,
        "last_entity": session_data.get("last_entity") if session_data else None,
        "last_entity_rank": session_data.get("last_entity_rank", 1) if session_data else 1,
        "last_pfz_data": session_data.get("last_pfz_data") if session_data else None,
        "last_location": session_data.get("last_location") if session_data else None,
    }

    if not conv_history and session_data and session_data.get("messages"):
        conv_history = [
            {"role": m.get("role", "user"), "content": m.get("content", "")}
            for m in session_data.get("messages", [])
        ]

    resolved_info = resolve_context_and_intent(
        query=query,
        conversation_history=conv_history,
        conversation_context=conv_context,
    )

    intent = resolved_info["intent"]
    selected_agents = resolved_info["selected_agents"]
    risk_required = resolved_info["risk_required"]
    action = resolved_info.get("action")
    target_entity = resolved_info.get("target_entity")
    entity_rank = resolved_info.get("entity_rank")
    resolved_query = resolved_info.get("resolved_query", query)

    boat_width = state.get("boat_width_m")
    if boat_width is None:
        boat_width = extract_boat_width(resolved_query, default=5.0)

    reference_date = state.get("date") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    effective_date = resolve_effective_date(resolved_query, reference_date)

    logger.info("\n[SUPERVISOR]")
    logger.info("Session ID: %s | Request ID: %s", session_id, state.get("request_id"))
    logger.info("Raw Query: %s", query)
    logger.info("Resolved Query: %s", resolved_query)
    logger.info("Intent: %s | Action: %s | Target Entity: %s | Rank: %s", intent, action, target_entity, entity_rank)
    logger.info("Selected agents: %s | Risk required: %s", selected_agents, risk_required)
    logger.info("Reference date: %s -> Effective date: %s", reference_date, effective_date)

    return {
        "session_id": session_id,
        "conversation_history": conv_history,
        "conversation_context": conv_context,
        "intent": intent,
        "action": action,
        "target_entity": target_entity,
        "entity_rank": entity_rank,
        "resolved_query": resolved_query,
        "selected_agents": selected_agents,
        "risk_required": risk_required,
        "boat_width_m": boat_width,
        "date": effective_date,
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
    """Execute PFZ Agent with ordinal rank support and session caching."""
    lat = state.get("latitude")
    lon = state.get("longitude")
    entity_rank = state.get("entity_rank", 1) or 1
    session_id = state.get("session_id")
    logger.info("[PFZ AGENT] Starting... (Rank: %s, Session: %s)", entity_rank, session_id)

    # 1. Check for valid cached PFZ candidates from previous turns in this session
    try:
        if session_id and lat is not None and lon is not None:
            cached_candidates = get_cached_pfz_candidates(session_id, float(lat), float(lon))
            if cached_candidates:
                req_rank = int(entity_rank) if entity_rank is not None and int(entity_rank) >= 1 else 1
                target_rank = min(req_rank, len(cached_candidates))
                selected_cand = cached_candidates[target_rank - 1]
                logger.info(
                    "[PFZ AGENT] Using CACHED PFZ candidate rank %d/%d for session %s",
                    target_rank,
                    len(cached_candidates),
                    session_id,
                )
                result = {
                    "agent": "pfz",
                    "status": "success",
                    "cached": True,
                    "fisherman_location": {"latitude": float(lat), "longitude": float(lon)},
                    "pfz": selected_cand,
                    "top_candidates": cached_candidates,
                    "selected_rank": target_rank,
                    "total_candidates": len(cached_candidates),
                }
                logger.info("[PFZ AGENT] Finished (cached).")
                return {"pfz_result": result}
    except Exception as exc:
        logger.warning("[PFZ AGENT] Cache lookup failed (%s), falling back to live fetch.", exc)

    # 2. Live INCOIS GeoJSON WFS Fetch
    try:
        result = find_nearest_pfz(latitude=float(lat), longitude=float(lon), rank=int(entity_rank))
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
    q_raw = (state.get("query") or "").strip()
    q_lower = q_raw.lower()

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

        # Check if query asks specifically about avoiding zones / hazardous conditions / geofencing
        is_avoidance_query = any(k in q_lower for k in ["avoid", "restricted", "geofenc", "hazard", "danger zone"])
        
        if is_avoidance_query:
            if status == "NOT_RECOMMENDED" or official_warnings:
                summary = "Based on current ocean conditions and advisories, avoid offshore fishing zones under active alert: " + ("; ".join(official_warnings) if official_warnings else "Offshore sectors with rough seas.")
                final_advice = "Small craft should remain in port or stay within sheltered inshore waters. Note: Respect international maritime boundary lines (IMBL) and local port geofencing restrictions."
            else:
                summary = f"No active INCOIS SVAS restrictions or extreme ocean hazards flagged in the search sector. Conditions are {status} (Risk Score: {score if score is not None else 'N/A'}/100)."
                final_advice = "Avoid venturing beyond authorized fishing zones or crossing international maritime boundaries (IMBL). Always maintain VHF radio watch."
        elif status == "NOT_RECOMMENDED":
            summary = "Official restrictions or adverse marine conditions apply."
            final_advice = "Remain in port. Do not venture into sea until safety advisories improve."
        elif status in ["SAFE", "RECOMMENDED"]:
            summary = "Marine conditions are generally within normal limits based on the available assessment."
            final_advice = "Proceed with normal caution and continue monitoring official maritime advisories."
        else:
            summary = "Moderate marine hazards or vessel precautions are in effect."
            final_advice = "Exercise caution. Small craft should avoid offshore waters if gusts or swell increase."

    elif intent == "multi_specialist_query":
        summary_parts = []
        if key_conditions:
            summary_parts.append("Current conditions: " + ", ".join(key_conditions) + ".")
        if official_warnings:
            summary_parts.append("Active advisories: " + "; ".join(official_warnings) + ".")
        if not summary_parts:
            summary = f"ORCA evaluated multiple marine parameters for: {q_raw}"
        else:
            summary = " ".join(summary_parts)

        if any(k in q_lower for k in ["avoid", "geofenc", "restricted"]):
            final_advice = "Adhere strictly to official INCOIS advisories and maritime boundary limits (IMBL)."
        else:
            final_advice = "Target designated PFZ areas only if local weather and sea conditions remain calm."

    elif intent == "pfz_query" or state.get("action") == "show_on_map":
        if isinstance(pfz, dict) and pfz.get("status") == "success":
            p = pfz.get("pfz", {}).get("nearest_point", {})
            sel_rank = pfz.get("selected_rank", state.get("entity_rank", 1) or 1)
            ord_word = {1: "Nearest", 2: "2nd Nearest", 3: "3rd Nearest", 4: "4th Nearest", 5: "5th Nearest"}.get(sel_rank, f"Rank {sel_rank}")
            summary = f"🎣 {ord_word} Potential Fishing Zone is located at Lat {p.get('latitude')}, Lon {p.get('longitude')}, approximately {p.get('distance_km', 'N/A')} km to the {p.get('direction', 'N/A')}."
            if state.get("action") == "show_on_map":
                summary += " This zone is selected and plotted on your interactive Map."
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
        greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "help", "who are you", "what is orca", "what can you do", "namaste"]

        if not q_lower or q_lower in greetings:
            summary = "Namaste! I am ORCA, your Marine Intelligence Assistant. I provide live PFZ locations, marine weather forecasts, SVAS vessel advisories, and safety risk assessments for Indian fishermen."
            final_advice = "Ask about fishing zones, waves, wind, vessel restrictions, or trip safety."
        elif ("productivity" in q_lower and ("decline" in q_lower or "drop" in q_lower or "decreas" in q_lower or "low" in q_lower or "why" in q_lower)) or "why has fish productivity" in q_lower:
            summary = "Coastal fish productivity can decline due to a combination of sea surface temperature fluctuations, coastal pollution, overfishing, habitat degradation, and shifting ocean current patterns affecting chlorophyll and plankton distribution."
            final_advice = "Monitor INCOIS Potential Fishing Zones (PFZ) and SST charts for active fish aggregation zones."
        elif "geofenc" in q_lower or "restricted zone" in q_lower or "zones should be avoided" in q_lower or "border" in q_lower:
            summary = "Fishing vessels must avoid designated maritime restricted zones, marine protected areas, sensitive naval defense corridors, and international maritime boundary lines (IMBL)."
            final_advice = "Always maintain GPS navigation awareness, heed Coast Guard border warnings, and check live INCOIS SVAS hazard alerts."
        elif "capital of" in q_lower:
            if "usa" in q_lower or "america" in q_lower or "united states" in q_lower:
                summary = "Washington, D.C. is the capital of the United States of America."
            elif "india" in q_lower:
                summary = "New Delhi is the capital of India."
            else:
                summary = f"General geography response: {q_raw}"
            final_advice = "Ask about marine weather or fishing safety when planning your next trip."
        elif "what is a pfz" in q_lower or "what is pfz" in q_lower or "potential fishing zone" in q_lower:
            summary = "A Potential Fishing Zone (PFZ) is an ocean region identified by satellite oceanography (SST & Chlorophyll) where fish are likely to aggregate."
            final_advice = "Ask 'Where is the nearest PFZ?' to locate active fishing zones."
        elif "what is svas" in q_lower or "what is svas advisory" in q_lower:
            summary = "Small Vessel Advisory Service (SVAS) provides boat-category specific safety warnings issued by INCOIS for motorized vessels under 6m-7m width."
            final_advice = "Ask 'Are there any restrictions for my boat?' to check active advisories."
        else:
            summary = f"Regarding '{q_raw}': ORCA Marine Intelligence provides guidance on marine weather, fishing zones, vessel restrictions, and sailing safety."
            final_advice = "Ask about waves, wind, PFZ, or safety before sailing."

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
    """Handles general conversation and emergency queries without specialist APIs."""
    query = state.get("query", "")
    intent = state.get("intent", "general")

    logger.info("\n[GENERAL RESPONSE] Intent: %s. No specialist APIs invoked.", intent)

    if intent == "emergency":
        explanation = {
            "summary": (
                "🚨 EMERGENCY: If you or your vessel are in immediate danger at sea, "
                "contact maritime rescue authorities now."
            ),
            "why": [
                "The query indicates a possible emergency or distress situation at sea."
            ],
            "key_conditions": [],
            "official_warnings": [
                "Indian Coast Guard Emergency Toll-Free Helpline: 1554",
                "Coastal Police Helpline: 1093",
                "National Emergency Number: 112",
                "VHF Distress Frequency: Channel 16 (156.8 MHz)",
            ],
            "data_limitations": [],
            "final_advice": (
                "Do not rely solely on automated chat during a life-threatening situation. "
                "Call 1554 or broadcast MAYDAY on VHF Channel 16 immediately."
            ),
        }

        recommendation = "\n\n".join(
            [
                "🚨 MARITIME EMERGENCY — CONTACT COAST GUARD (1554)",
                explanation["summary"],
                explanation["final_advice"],
            ]
        )

        return {
            "gemini_explanation": explanation,
            "recommendation": recommendation,
        }

    prompt = f"""
You are ORCA Marine Intelligence, an authoritative AI assistant for Indian fishermen and mariners.

The user asked:
"{query}"

Answer the user's actual question directly and concisely in simple,
fisherman-friendly language.

IMPORTANT:
- Do NOT invent live weather information.
- Do NOT invent PFZ coordinates or distances.
- Do NOT claim real-time marine conditions unless specialist evidence was provided.
- If the question is general knowledge, answer it honestly.
- Return valid JSON only.

Return exactly this structure:
{{
  "summary": "Concise direct answer to the user's question.",
  "why": [],
  "key_conditions": [],
  "official_warnings": [],
  "data_limitations": [],
  "final_advice": "Brief practical guidance."
}}
"""

    try:
        explanation = execute_gemini_json_with_fallback(prompt)
    except Exception as exc:
        logger.info("Using fallback for general response: %s", exc)
        explanation = build_deterministic_fallback(state)

    summary = str(explanation.get("summary") or "").strip()
    final_advice = str(explanation.get("final_advice") or "").strip()

    parts: List[str] = []
    if summary:
        parts.append(summary)
    if final_advice and final_advice != summary:
        parts.append(final_advice)

    recommendation = "\n\n".join(parts)
    if not recommendation:
        recommendation = (
            "I am ORCA, your Marine Intelligence Assistant. "
            "Ask me about fishing zones, waves, wind, marine weather, "
            "boat safety, or sailing conditions."
        )

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
# ===========================================================================
# DETERMINISTIC ALERTS
# ===========================================================================

import hashlib

def generate_deterministic_alerts(
    state: ORCAState,
    specialist_results: Dict[str, Any],
    risk_result: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Deterministically generate safety alerts strictly based on actual conditions
    reported by specialist agents and the Risk Engine.
    
    Alert severity is 100% deterministic and rule-based.
    No LLM creates or alters alert severity.
    Normal safe conditions produce NO active danger alerts.
    """
    alerts: List[Dict[str, Any]] = []
    request_id = state.get("request_id") or "req-unknown"
    timestamp = datetime.now(timezone.utc).isoformat()
    q_lower = (state.get("query") or "").lower()
    boat_width = state.get("boat_width_m") or 5.0
    
    # -----------------------------------------------------------------------
    # 1. MARINE WEATHER ALERTS
    # -----------------------------------------------------------------------
    mw_result = specialist_results.get("marine_weather", {})
    if isinstance(mw_result, dict) and mw_result.get("status") == "success":
        marine = mw_result.get("marine") or {}
        weather = mw_result.get("weather") or {}
        wave_height = marine.get("wave_height_m")
        wind_speed = weather.get("wind_speed_knots")
        wind_gusts = weather.get("wind_gusts_knots")
        
        # Wave Height Warnings
        if wave_height is not None and isinstance(wave_height, (int, float)):
            if 2.0 <= wave_height < 3.0:
                alerts.append({
                    "type": "weather",
                    "severity": "high",
                    "title": "High Wave Warning",
                    "message": f"Elevated wave height of {wave_height:.1f} m detected near your location.",
                    "source": "marine_weather",
                    "action": "Exercise extreme caution. Small fishing craft should avoid open sea.",
                })
            elif wave_height >= 3.0:
                alerts.append({
                    "type": "weather",
                    "severity": "critical",
                    "title": "Severe Wave Hazard",
                    "message": f"Dangerous wave height of {wave_height:.1f} m detected. High risk of capsizing.",
                    "source": "marine_weather",
                    "action": "Do not sail. Severe wave hazard in effect.",
                })
                
        # Wind Speed Warnings
        if wind_speed is not None and isinstance(wind_speed, (int, float)):
            if 20.0 <= wind_speed < 30.0:
                alerts.append({
                    "type": "weather",
                    "severity": "high",
                    "title": "Strong Wind Warning",
                    "message": f"Sustained wind speeds reaching {wind_speed:.1f} knots in the coastal sector.",
                    "source": "marine_weather",
                    "action": "Small craft should exercise caution and stay within sheltered waters.",
                })
            elif wind_speed >= 30.0:
                alerts.append({
                    "type": "weather",
                    "severity": "critical",
                    "title": "Severe Gale / Storm Winds",
                    "message": f"Severe wind speeds reaching {wind_speed:.1f} knots. Gale conditions active.",
                    "source": "marine_weather",
                    "action": "Do not sail. Remain in port until conditions improve.",
                })

        # Wind Gust Warnings
        if wind_gusts is not None and isinstance(wind_gusts, (int, float)):
            if 25.0 <= wind_gusts < 35.0:
                alerts.append({
                    "type": "weather",
                    "severity": "high",
                    "title": "Dangerous Gust Warning",
                    "message": f"Dangerous wind gusts reaching {wind_gusts:.1f} knots detected.",
                    "source": "marine_weather",
                    "action": "Secure vessel gear and monitor sudden changes in wind direction.",
                })
            elif wind_gusts >= 35.0:
                alerts.append({
                    "type": "weather",
                    "severity": "critical",
                    "title": "Extreme Gust Hazard",
                    "message": f"Extreme squall gusts reaching {wind_gusts:.1f} knots detected.",
                    "source": "marine_weather",
                    "action": "Do not sail. Seek immediate sheltered harbor.",
                })

    # -----------------------------------------------------------------------
    # 2. OCEAN ANALYSIS HAZARDS
    # -----------------------------------------------------------------------
    oa_result = specialist_results.get("ocean_analysis", {})
    if isinstance(oa_result, dict):
        warnings = oa_result.get("warnings", [])
        for w in warnings:
            w_type = str(w.get("type", "")).lower()
            w_sev = str(w.get("severity", "")).lower()
            w_msg = w.get("message", "Environmental hazard active.")
            
            if "cyclone" in w_type:
                alerts.append({
                    "type": "ocean",
                    "severity": "critical",
                    "title": "Tropical Cyclone Warning",
                    "message": w_msg,
                    "source": "ocean_analysis",
                    "action": "Seek shelter immediately and follow Coast Guard emergency directives.",
                })
            elif "tsunami" in w_type and w_sev in ["critical", "high"]:
                alerts.append({
                    "type": "ocean",
                    "severity": "critical",
                    "title": "Tsunami Warning",
                    "message": w_msg,
                    "source": "ocean_analysis",
                    "action": "Evacuate coastal waters and heed official disaster management notices.",
                })
            elif "thunderstorm" in w_type or "lightning" in w_type:
                alerts.append({
                    "type": "ocean",
                    "severity": "high",
                    "title": "Active Thunderstorm Warning",
                    "message": w_msg,
                    "source": "ocean_analysis",
                    "action": "Avoid open waters; seek safe harbor immediately to avoid lightning strikes.",
                })
            elif "convective" in w_type:
                alerts.append({
                    "type": "ocean",
                    "severity": "moderate",
                    "title": "Convective Instability Advisory",
                    "message": w_msg,
                    "source": "ocean_analysis",
                    "action": "Monitor live weather radar updates before venturing offshore.",
                })
            elif w_sev in ["critical", "high"]:
                alerts.append({
                    "type": "ocean",
                    "severity": w_sev,
                    "title": "Ocean Hazard Warning",
                    "message": w_msg,
                    "source": "ocean_analysis",
                    "action": "Exercise high caution and monitor official INCOIS ocean bulletins.",
                })

    # -----------------------------------------------------------------------
    # 3. SVAS / VESSEL SAFETY ALERTS
    # -----------------------------------------------------------------------
    svas_result = specialist_results.get("svas", {})
    if isinstance(svas_result, dict) and svas_result.get("status") == "success":
        advisory = svas_result.get("advisory") or {}
        adv_msg = str(advisory.get("message") or "").strip()
        adv_msg_lower = adv_msg.lower()
        adv_sev = str(advisory.get("severity") or "").lower()
        
        if "should not sail" in adv_msg_lower or "do not sail" in adv_msg_lower or adv_sev == "danger":
            alerts.append({
                "type": "vessel",
                "severity": "critical",
                "title": "Vessel Sailing Restriction",
                "message": adv_msg or "INCOIS SVAS advisory restricts sailing for this boat category.",
                "source": "svas",
                "action": "Do not sail. Small craft should remain safely in port.",
            })
        elif adv_sev in ["alert", "warning"]:
            alerts.append({
                "type": "vessel",
                "severity": "high",
                "title": "Small Vessel Advisory Active",
                "message": adv_msg or "Official INCOIS Small Vessel Advisory is active for this boat size.",
                "source": "svas",
                "action": "Exercise extreme caution; small craft should avoid offshore waters.",
            })
        elif adv_sev in ["advisory", "caution"]:
            alerts.append({
                "type": "vessel",
                "severity": "moderate",
                "title": "Vessel Caution Advisory",
                "message": adv_msg or "Precautionary advisory in effect for small motorized craft.",
                "source": "svas",
                "action": "Verify safety equipment and monitor changing sea conditions.",
            })
    elif isinstance(svas_result, dict) and svas_result.get("reason"):
        reason = str(svas_result.get("reason"))
        if "7m or wider" in reason:
            alerts.append({
                "type": "vessel",
                "severity": "info",
                "title": "Vessel Category Notice",
                "message": "INCOIS SVAS service covers motorized craft under 7m width. Standard maritime navigation rules apply.",
                "source": "svas",
                "action": "Adhere to standard maritime safety and port clearance regulations.",
            })

    # -----------------------------------------------------------------------
    # 4. GEOFENCING / RESTRICTED ZONES ALERTS
    # -----------------------------------------------------------------------
    geofence_keywords = [
        "restricted", "geofenc", "no-go zone", "no go zone",
        "no-fishing zone", "border", "imbl", "hazard zone", "dangerous zone",
        "avoid", "zones should be avoided", "zones to avoid"
    ]
    if any(k in q_lower for k in geofence_keywords):
        alerts.append({
            "type": "geofence",
            "severity": "high",
            "title": "Restricted Maritime Zone Notice",
            "message": "Do not cross International Maritime Boundary Lines (IMBL) or enter designated naval/marine protected areas.",
            "source": "risk_engine",
            "action": "Maintain GPS navigation watch and avoid restricted boundary corridors.",
        })

    # -----------------------------------------------------------------------
    # 5. RISK ENGINE SAFETY ALERTS
    # -----------------------------------------------------------------------
    if isinstance(risk_result, dict):
        risk_score = risk_result.get("risk_score")
        risk_status = str(risk_result.get("status") or "").upper()
        hard_override = risk_result.get("hard_override", False)
        
        if hard_override or (risk_score is not None and risk_score >= 80) or risk_status == "NOT_RECOMMENDED":
            alerts.append({
                "type": "risk",
                "severity": "critical",
                "title": "Critical Risk - Do Not Sail",
                "message": f"ORCA Safety Assessment evaluates overall risk as CRITICAL (Risk Score: {risk_score if risk_score is not None else 100}/100).",
                "source": "risk_engine",
                "action": "Do not venture into the sea. High probability of dangerous marine conditions.",
            })
        elif (risk_score is not None and 60 <= risk_score < 80) or risk_status == "HIGH_RISK":
            alerts.append({
                "type": "risk",
                "severity": "high",
                "title": "High Risk Marine Assessment",
                "message": f"ORCA Safety Assessment evaluates conditions as HIGH RISK (Risk Score: {risk_score}/100).",
                "source": "risk_engine",
                "action": "Reconsider trip. Small vessels should avoid venturing beyond sheltered waters.",
            })

    # -----------------------------------------------------------------------
    # 6. DEDUPLICATION & UNIQUE ID GENERATION
    # -----------------------------------------------------------------------
    final_alerts: List[Dict[str, Any]] = []
    seen = set()
    
    for a in alerts:
        # Deduplicate based on type, severity, title, message, source
        dedup_key = (
            a["type"].strip().lower(),
            a["severity"].strip().lower(),
            a["title"].strip().lower(),
            a["message"].strip().lower(),
            a["source"].strip().lower(),
        )
        if dedup_key not in seen:
            seen.add(dedup_key)
            
            # Generate deterministic stable unique alert ID
            hash_input = f"{request_id}-{a['type']}-{a['severity']}-{a['title']}-{a['source']}"
            hash_suffix = hashlib.md5(hash_input.encode("utf-8")).hexdigest()[:8]
            alert_id = f"alert-{a['source']}-{hash_suffix}"
            
            final_alerts.append({
                "id": alert_id,
                "request_id": request_id,
                "type": a["type"],
                "severity": a["severity"],
                "title": a["title"],
                "message": a["message"],
                "source": a["source"],
                "timestamp": timestamp,
                "action": a.get("action", "Proceed with caution."),
            })

    return final_alerts


# ===========================================================================
# FINAL RESPONSE NODE
# ===========================================================================

def final_response_node(state: ORCAState) -> Dict[str, Any]:
    """Construct the final API response and a readable chat recommendation."""
    logger.info("\n[FINAL RESPONSE] Formatting complete ORCA assessment response...")

    risk_result = state.get("risk_result", {}) or {}
    explanation = state.get("gemini_explanation", {}) or {}
    intent = state.get("intent", "general")
    selected_agents = state.get("selected_agents", [])
    risk_required = state.get("risk_required", False)
    specialist_results = state.get("specialist_results", {}) or {}
    action = state.get("action")
    target_entity = state.get("target_entity")
    entity_rank = state.get("entity_rank", 1) or 1
    session_id = state.get("session_id")

    status = risk_result.get("status")
    score = risk_result.get("risk_score")

    summary = str(explanation.get("summary") or "").strip()
    final_advice = str(explanation.get("final_advice") or "").strip()

    parts: List[str] = []

    if summary:
        parts.append(summary)

    if final_advice and final_advice != summary:
        parts.append(final_advice)

    if not parts:
        existing_recommendation = str(state.get("recommendation") or "").strip()
        if existing_recommendation:
            parts.append(existing_recommendation)
        else:
            parts.append(
                "ORCA completed the request, but a detailed explanation is currently unavailable."
            )

    recommendation = "\n\n".join(parts)

    # -----------------------------------------------------------------------
    # STRUCTURED MAP / UI ACTION RESOLUTION
    # -----------------------------------------------------------------------
    # STRUCTURED MAP / UI ACTION & CANDIDATE RESOLUTION
    # -----------------------------------------------------------------------
    ui_action = None
    pfz_res = specialist_results.get("pfz", {})
    query_lower = (state.get("query") or "").lower()
    resolved_query_lower = (state.get("resolved_query") or "").lower()

    # Retrieve all available candidates from specialist output or session cache
    all_candidates: List[Dict[str, Any]] = []
    if isinstance(pfz_res, dict) and pfz_res.get("status") == "success":
        all_candidates = pfz_res.get("top_candidates") or pfz_res.get("pfz", {}).get("top_candidates") or []
    if not all_candidates and session_id:
        cached_cands = get_cached_pfz_candidates(session_id, float(state.get("latitude") or 0), float(state.get("longitude") or 0))
        if cached_cands:
            all_candidates = cached_cands

    # -----------------------------------------------------------------------
    # STRUCTURED DISPLAY RELEVANCE & PFZ MODE CONTROL
    # Three distinct PFZ presentation modes:
    # 1. "pfz_list": List queries ("Show nearby fishing zones", "Where to fish?") -> Top 3 cards
    # 2. "single_pfz": Specific ordinal / single zone ("Tell me 2nd PFZ", "Show second on map") -> 1 card
    # 3. "none": Non-PFZ queries ("Are waves safe?", "Capital of India", "Zones to avoid") -> 0 cards
    # -----------------------------------------------------------------------
    pfz_avoid_or_hazard = contains_any(query_lower, [
        "avoid", "avoided", "should be avoided", "hazard", "hazards",
        "geofenc", "restricted", "no-go", "no go", "danger", "dangerous",
    ])

    pfz_list_keywords = [
        "nearby fishing zone", "nearby fishing zones", "nearby pfz",
        "find fishing zones", "find nearest pfz", "find pfz",
        "show nearby", "show fishing zones", "where should i go fishing",
        "where to go fishing", "where should i fish", "where to fish",
        "fishing spots", "best fishing area", "recommend fishing",
        "top 3", "top 3 pfz", "3 pfz", "nearest 3", "all pfz",
    ]

    is_list_query = (
        contains_any(query_lower, pfz_list_keywords)
        or (intent == "fishing_advice" and not pfz_avoid_or_hazard)
        or (intent == "pfz_query" and entity_rank is None and not pfz_avoid_or_hazard)
    )

    is_single_pfz_query = (
        (intent == "pfz_query" and entity_rank is not None and not pfz_avoid_or_hazard)
        or (action == "show_on_map" and target_entity == "pfz")
        or (contains_any(resolved_query_lower, ["1st", "first", "2nd", "second", "3rd", "third", "4th", "fourth", "5th", "fifth"]) and target_entity == "pfz" and not pfz_avoid_or_hazard)
    )

    # Determine Display Mode
    if pfz_avoid_or_hazard or intent in ["general", "emergency"] or intent == "safety_assessment":
        pfz_mode = "none"
    elif is_single_pfz_query:
        pfz_mode = "single_pfz"
    elif is_list_query or intent in ["pfz_query", "fishing_advice"]:
        pfz_mode = "pfz_list"
    else:
        pfz_mode = "none"

    display_pfz = (pfz_mode != "none") and bool(all_candidates)

    # Filter top_candidates based on pfz_mode
    top_candidates: List[Dict[str, Any]] = []
    if pfz_mode == "single_pfz" and all_candidates:
        req_r = entity_rank if (entity_rank is not None and entity_rank >= 1) else 1
        target_idx = min(req_r, len(all_candidates)) - 1
        top_candidates = [all_candidates[target_idx]]
    elif pfz_mode == "pfz_list" and all_candidates:
        top_candidates = all_candidates[:3]
    else:
        top_candidates = []

    # Map Action generation
    if action == "show_on_map" or contains_any(query_lower, ["show in map", "show on map", "plot on map", "view on map", "on map", "in map"]):
        if all_candidates:
            sel_rank = entity_rank if (entity_rank is not None and entity_rank >= 1) else 1
            target_idx = min(sel_rank, len(all_candidates)) - 1
            target_cand = all_candidates[target_idx]
            p_block = target_cand.get("nearest_point") or target_cand.get("coordinates") or {}

            ord_str = {1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th"}.get(sel_rank, f"{sel_rank}th")
            dist_val = target_cand.get("distance_km", "N/A")
            dir_val = target_cand.get("direction", "")
            lat_val = target_cand.get("coordinates", {}).get("latitude")
            lon_val = target_cand.get("coordinates", {}).get("longitude")

            if lat_val is not None and lon_val is not None:
                ui_action = {
                    "type": "show_on_map",
                    "target": "pfz",
                    "rank": sel_rank,
                    "coordinates": {
                        "latitude": lat_val,
                        "longitude": lon_val,
                    },
                    "label": f"{ord_str} Nearest PFZ ({dist_val} km {dir_val})",
                    "geometry": target_cand.get("geometry"),
                    "zoom": 10,
                    "top_candidates": [target_cand],
                }
                logger.info("[FINAL RESPONSE] Generated structured UI Action: %s", ui_action)

    # Independent Risk Explanation Display Relevance
    display_risk_explanation = False
    if intent in ["safety_assessment"]:
        display_risk_explanation = True
    elif intent in ["fishing_advice"] and risk_required and isinstance(risk_result, dict) and risk_result.get("risk_score") is not None:
        display_risk_explanation = True

    display_flags = {
        "pfz": bool(display_pfz and top_candidates),
        "pfz_mode": pfz_mode,
        "risk_explanation": bool(display_risk_explanation and isinstance(risk_result, dict) and risk_result.get("explanation_card")),
        "marine": bool(intent in ["marine_weather_query", "safety_assessment", "fishing_advice", "ocean_analysis_query"] or "marine_weather" in selected_agents),
        "risk_assessment": bool(risk_required),
        "svas": bool(intent in ["svas_query", "safety_assessment"] or "svas" in selected_agents),
        "ocean_hazards": bool(intent in ["ocean_analysis_query", "safety_assessment"] or "ocean_analysis" in selected_agents),
        "map_action": bool(ui_action is not None),
    }

    final_dict = {
        "request_id": state.get("request_id"),
        "session_id": session_id,
        "query": state.get("query", ""),
        "resolved_query": state.get("resolved_query", state.get("query", "")),
        "location": {
            "latitude": state.get("latitude"),
            "longitude": state.get("longitude"),
        },
        "date": state.get("date"),
        "boat_width_m": state.get("boat_width_m"),
        "intent": intent,
        "action": action,
        "target_entity": target_entity,
        "entity_rank": entity_rank,
        "selected_agents": selected_agents,
        "risk_required": risk_required,
        "recommendation": recommendation,
        "ui_action": ui_action,
        "display": display_flags,
        "risk_explanation": risk_result.get("explanation_card") if display_flags["risk_explanation"] else None,
        "top_pfz": top_candidates if display_flags["pfz"] else None,
        "risk": (
            risk_result
            if risk_required
            else {"status": "not_required", "risk_score": None}
        ),
        "explanation": explanation,
        "specialist_results": specialist_results,
    }

    final_dict.update(specialist_results)

    # Attach top_candidates to pfz block only if relevant
    if "pfz" in final_dict and isinstance(final_dict["pfz"], dict) and all_candidates:
        final_dict["pfz"]["top_candidates"] = top_candidates if display_flags["pfz"] else all_candidates

    alerts = generate_deterministic_alerts(state, specialist_results, risk_result)
    final_dict["alerts"] = alerts

    # -----------------------------------------------------------------------
    # PERSIST SESSION MEMORY
    # -----------------------------------------------------------------------
    if session_id:
        add_session_message(session_id, "user", state.get("query", ""))
        add_session_message(session_id, "assistant", recommendation)
        update_session(session_id, {
            "last_intent": intent,
            "last_action": action,
            "last_entity": target_entity if target_entity != "general" else None,
            "last_entity_rank": entity_rank if target_entity == "pfz" else None,
            "last_pfz_data": pfz_res if isinstance(pfz_res, dict) and pfz_res.get("status") == "success" else None,
            "last_pfz_candidates": all_candidates if all_candidates else None,
            "last_specialist_results": specialist_results,
            "last_location": {"latitude": state.get("latitude"), "longitude": state.get("longitude")},
            "last_date": state.get("date"),
            "last_boat_width_m": state.get("boat_width_m"),
            "last_ui_action": ui_action,
        })
    
    # Comprehensive Debug Logging
    logger.info("=" * 70)
    logger.info("[ORCA BACKEND ASSESSMENT COMPLETE]")
    logger.info("  Session ID: %s | Request ID: %s", session_id, state.get("request_id"))
    logger.info("  Query: %s", state.get("query"))
    logger.info("  Resolved Query: %s", state.get("resolved_query"))
    logger.info("  Intent: %s | Action: %s | Rank: %s", intent, action, entity_rank)
    logger.info("  UI Action: %s", ui_action.get("type") if ui_action else "None")
    logger.info("  Latitude: %s, Longitude: %s", state.get("latitude"), state.get("longitude"))
    logger.info("  Date: %s, Boat Size: %s m", state.get("date"), state.get("boat_width_m"))
    logger.info("  Generated Alerts Count: %d", len(alerts))
    logger.info("=" * 70)

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
    request_id: Optional[str] = None,
    session_id: Optional[str] = None,
    conversation_history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """
    Main public ORCA entry point with conversational session support.
    """
    import uuid
    if not request_id:
        request_id = str(uuid.uuid4())
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    initial_state: ORCAState = {
        "request_id": request_id,
        "session_id": session_id,
        "query": query or "",
        "conversation_history": conversation_history or [],
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
    request_id: Optional[str] = None,
    session_id: Optional[str] = None,
    conversation_history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """Compatibility alias for FastAPI and external bridges."""
    return run_orca(
        latitude=latitude,
        longitude=longitude,
        date=date,
        boat_width_m=boat_width_m,
        query=query,
        request_id=request_id,
        session_id=session_id,
        conversation_history=conversation_history,
    )

