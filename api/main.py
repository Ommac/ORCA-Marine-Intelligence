"""
ORCA Marine Intelligence - HTTP API Bridge
-------------------------------------------
Exposes the existing ORCA Orchestrator to the React Native / Expo frontend
and other client applications over HTTP.

Architecture:
  React Native Frontend
          |
          | POST /api/orca/assess
          v
        API (FastAPI)
          |
          v
  Existing ORCA Orchestrator (orchestrate_orca_assessment)
          |
     +----+----+----+----+
     |    |    |    |    |
    PFZ Weather SVAS Ocean
          |
          v
        Risk Agent (Authoritative)
          |
          v
   Final ORCA Assessment
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agents.orchestrator.main import orchestrate_orca_assessment

# ---------------------------------------------------------------------------
# Logging & FastAPI App Configuration
# ---------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("orca_api")

app = FastAPI(
    title="ORCA Marine Intelligence API",
    description="HTTP API Bridge connecting client applications to the ORCA Multi-Agent backend.",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS Configuration (Enabled for Expo / React Native / Localhost development)
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configurable for production environments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request Schemas
# ---------------------------------------------------------------------------

class OrcaAssessRequest(BaseModel):
    """Pydantic validation schema for ORCA assessment requests."""
    query: str = Field(..., description="Natural-language question from the fisherman.")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Vessel latitude (-90 to 90).")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Vessel longitude (-180 to 180).")
    date: str = Field(..., description="Requested target date in YYYY-MM-DD format.")
    boat_width_m: float = Field(..., gt=0.0, description="Vessel width in meters.")
    request_id: Optional[str] = Field(None, description="Client request UUID for correlation.")
    session_id: Optional[str] = Field(None, description="Conversational session ID for multi-turn context.")
    conversation_history: Optional[list[dict[str, Any]]] = Field(None, description="Recent conversation history turns.")

    model_config = {
        "json_schema_extra": {
            "example": {
                "query": "Is it safe for me to go fishing today?",
                "latitude": 19.72,
                "longitude": 72.70,
                "date": "2026-09-04",
                "boat_width_m": 5.0,
                "request_id": "req-12345",
                "session_id": "sess-user-1",
            }
        }
    }


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@app.get("/health", status_code=status.HTTP_200_OK)
def health_check() -> Dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "ORCA API",
    }


@app.post("/api/orca/assess", status_code=status.HTTP_200_OK)
def assess_marine_conditions(payload: OrcaAssessRequest) -> Dict[str, Any]:
    """
    Perform a full ORCA marine assessment or conversational query by invoking the Orchestrator:
    - Maintains conversational session memory and context across turns
    - Ranks and resolves ordinal entities (e.g. 2nd nearest PFZ)
    - Emits structured map / UI actions (show_on_map)
    - Evaluates deterministic risk via the Risk Agent
    - Generates conversational fisherman guidance via Gemini/deterministic synthesis
    """
    import uuid
    effective_req_id = payload.request_id or f"req-{uuid.uuid4().hex[:12]}"
    
    logger.info("=" * 70)
    logger.info("[API INCOMING ASSESS REQUEST]")
    logger.info("  Session ID: %s | Request ID: %s", payload.session_id, effective_req_id)
    logger.info("  Query: %s", payload.query)
    logger.info("  Coordinates: (%.4f, %.4f)", payload.latitude, payload.longitude)
    logger.info("  Date: %s, Boat Width: %.1f m", payload.date, payload.boat_width_m)
    logger.info("=" * 70)

    try:
        assessment = orchestrate_orca_assessment(
            latitude=payload.latitude,
            longitude=payload.longitude,
            date=payload.date,
            boat_width_m=payload.boat_width_m,
            query=payload.query,
            request_id=effective_req_id,
            session_id=payload.session_id,
            conversation_history=payload.conversation_history,
        )
        return assessment
    except Exception as exc:
        logger.error(f"Orchestrator invocation failed for req={effective_req_id}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while formulating the ORCA assessment: {exc}",
        )
