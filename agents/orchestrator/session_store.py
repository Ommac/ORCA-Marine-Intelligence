"""
ORCA Marine Intelligence - Conversational Session Memory Store
--------------------------------------------------------------
Provides in-memory, bounded conversational context tracking across multi-turn
interactions in Ask ORCA and the FastAPI HTTP bridge.

Features:
- Session-based conversation memory with bounded recent history window (last N turns).
- Structured entity tracking (last_entity, last_entity_rank, last_pfz_data, last_action).
- Specialist output caching to avoid redundant API hits when query context is preserved.
- Automatic expiration and pruning of stale sessions.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger("orca_session_store")

# Maximum number of chat messages to retain in active window per session
MAX_HISTORY_MESSAGES = 12

# Default session time-to-live: 2 hours (7200 seconds)
DEFAULT_SESSION_TTL_SECONDS = 7200

# Global in-memory storage dictionary: session_id -> session_dict
_SESSIONS: Dict[str, Dict[str, Any]] = {}


def get_session(session_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """Retrieve an existing session if present and not expired."""
    if not session_id:
        return None
    session = _SESSIONS.get(session_id)
    if not session:
        return None

    # Check TTL expiration
    now = time.time()
    if now - session.get("updated_at", now) > DEFAULT_SESSION_TTL_SECONDS:
        logger.info("[SESSION STORE] Expired session pruned: %s", session_id)
        _SESSIONS.pop(session_id, None)
        return None

    return session


def get_or_create_session(session_id: Optional[str]) -> Dict[str, Any]:
    """Retrieve an existing session or initialize a fresh structured context."""
    if not session_id:
        import uuid
        session_id = f"sess-{uuid.uuid4().hex[:12]}"

    session = get_session(session_id)
    if session is None:
        now = time.time()
        session = {
            "session_id": session_id,
            "messages": [],
            "last_intent": None,
            "last_action": None,
            "last_entity": None,
            "last_entity_rank": 1,
            "last_pfz_data": None,
            "last_pfz_candidates": None,
            "last_specialist_results": {},
            "last_location": None,
            "last_date": None,
            "last_boat_width_m": None,
            "last_ui_action": None,
            "created_at": now,
            "updated_at": now,
        }
        _SESSIONS[session_id] = session
        logger.info("[SESSION STORE] Initialized new session: %s", session_id)

    return session


def update_session(session_id: Optional[str], updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Update fields in an existing or new session and refresh its timestamp."""
    if not session_id:
        return None

    session = get_or_create_session(session_id)
    for key, value in updates.items():
        if key == "messages":
            # Append or replace messages with bounding
            if isinstance(value, list):
                session["messages"] = value[-MAX_HISTORY_MESSAGES:]
        else:
            session[key] = value

    session["updated_at"] = time.time()
    return session


def add_session_message(session_id: Optional[str], role: str, content: str) -> None:
    """Append a single message (user or assistant) to session history."""
    if not session_id or not content:
        return

    session = get_or_create_session(session_id)
    messages = session.get("messages", [])
    messages.append({
        "role": role,
        "content": str(content).strip(),
        "timestamp": time.time(),
    })
    session["messages"] = messages[-MAX_HISTORY_MESSAGES:]
    session["updated_at"] = time.time()


def clear_session(session_id: Optional[str]) -> bool:
    """Remove a session from memory."""
    if session_id and session_id in _SESSIONS:
        del _SESSIONS[session_id]
        return True
    return False


def get_cached_pfz_candidates(
    session_id: Optional[str],
    latitude: float,
    longitude: float,
    max_location_delta: float = 0.01,
) -> Optional[List[Dict[str, Any]]]:
    """
    Retrieve cached top PFZ candidates from session memory if:
    1. The session is valid and not expired.
    2. 'last_pfz_candidates' exists and is non-empty.
    3. The query coordinates are proximate to 'last_location' (within max_location_delta degrees ~1km).
    """
    if not session_id:
        return None

    session = get_session(session_id)
    if not session:
        return None

    cached_candidates = session.get("last_pfz_candidates")
    if not cached_candidates or not isinstance(cached_candidates, list):
        return None

    last_loc = session.get("last_location")
    if not last_loc or not isinstance(last_loc, dict):
        return None

    last_lat = last_loc.get("latitude")
    last_lon = last_loc.get("longitude")
    if last_lat is None or last_lon is None:
        return None

    try:
        lat_diff = abs(float(latitude) - float(last_lat))
        lon_diff = abs(float(longitude) - float(last_lon))
        if lat_diff <= max_location_delta and lon_diff <= max_location_delta:
            logger.info(
                "[SESSION STORE] Reusing %d cached PFZ candidates for session %s (coords: %.4f, %.4f)",
                len(cached_candidates),
                session_id,
                latitude,
                longitude,
            )
            return cached_candidates
    except (TypeError, ValueError):
        pass

    return None


def prune_expired_sessions(max_age_seconds: int = DEFAULT_SESSION_TTL_SECONDS) -> int:
    """Remove all expired sessions from memory."""
    now = time.time()
    to_remove = [
        s_id for s_id, s_data in _SESSIONS.items()
        if (now - s_data.get("updated_at", now)) > max_age_seconds
    ]
    for s_id in to_remove:
        _SESSIONS.pop(s_id, None)
    if to_remove:
        logger.info("[SESSION STORE] Pruned %d expired sessions.", len(to_remove))
    return len(to_remove)

