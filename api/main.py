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

from agents.language import (
    BhashiniError,
    bhashini_client,
    detect_language,
    detect_user_language,
    is_bhashini_configured,
    synthesize_voice_response,
    translate_explanation_card,
    translate_response_to_language,
    translate_user_query_to_english,
)
from agents.language.config import SUPPORTED_LANGUAGES, get_language_name
from agents.orchestrator.main import orchestrate_orca_assessment

# ---------------------------------------------------------------------------
# Logging & FastAPI App Configuration
# ---------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("orca_api")

app = FastAPI(
    title="ORCA Marine Intelligence API",
    description="HTTP API Bridge connecting client applications to the ORCA Multi-Agent backend with Bhashini Multilingual & Voice layer.",
    version="1.1.0",
)

# ---------------------------------------------------------------------------
# CORS Configuration (Enabled for Expo / React Native / Localhost development)
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:19006",
        "http://127.0.0.1:19006",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request & Response Schemas
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
    language: Optional[str] = Field("en", description="Preferred language code (e.g. 'mr', 'hi', 'ta', 'te', 'en', 'auto').")
    generate_audio: Optional[bool] = Field(False, description="Generate spoken voice audio (base64) using Bhashini TTS.")
    voice_gender: Optional[str] = Field("male", description="TTS voice gender ('male' or 'female').")

    model_config = {
        "json_schema_extra": {
            "example": {
                "query": "उद्या मासेमारीला जाणं सुरक्षित आहे का?",
                "latitude": 19.72,
                "longitude": 72.70,
                "date": "2026-09-08",
                "boat_width_m": 5.0,
                "request_id": "req-12345",
                "session_id": "sess-user-1",
                "language": "mr",
                "generate_audio": True,
            }
        }
    }


class LanguageDetectRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text snippet to analyze.")


class LanguageTranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to translate.")
    source_language: str = Field(..., description="Source language code (e.g. 'mr', 'hi', 'en').")
    target_language: str = Field(..., description="Target language code (e.g. 'en', 'mr', 'hi').")


class SpeechToTextRequest(BaseModel):
    audio_base64: str = Field(..., min_length=10, description="Base64 encoded audio string (WAV/MP3).")
    language: Optional[str] = Field("mr", description="Spoken language code (default: 'mr').")
    audio_format: Optional[str] = Field("wav", description="Audio container format ('wav', 'mp3', 'ogg').")
    sampling_rate: Optional[int] = Field(16000, description="Audio sampling rate in Hz.")


class TextToSpeechRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to convert to speech.")
    language: Optional[str] = Field("mr", description="Target spoken language code.")
    gender: Optional[str] = Field("male", description="Voice gender ('male' or 'female').")


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@app.get("/health", status_code=status.HTTP_200_OK)
def health_check() -> Dict[str, Any]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "ORCA API",
        "bhashini_configured": is_bhashini_configured(),
        "supported_languages": list(SUPPORTED_LANGUAGES.keys()),
    }


# ---------------------------------------------------------------------------
# Dedicated Language Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/language/detect", status_code=status.HTTP_200_OK)
def detect_user_text_language(payload: LanguageDetectRequest) -> Dict[str, Any]:
    """Detects Indian coastal language or English from input text."""
    lang_code, confidence = detect_language(payload.text)
    return {
        "language": lang_code,
        "confidence": confidence,
        "language_name": get_language_name(lang_code),
    }


@app.post("/api/language/translate", status_code=status.HTTP_200_OK)
def translate_marine_text(payload: LanguageTranslateRequest) -> Dict[str, Any]:
    """Translates text between supported Indian languages and English."""
    translated = bhashini_client.translate_text(
        text=payload.text,
        source_lang=payload.source_language,
        target_lang=payload.target_language,
    )
    return {
        "original_text": payload.text,
        "translated_text": translated,
        "source_language": payload.source_language,
        "target_language": payload.target_language,
    }


@app.post("/api/language/speech-to-text", status_code=status.HTTP_200_OK)
def convert_speech_to_text(payload: SpeechToTextRequest) -> Dict[str, Any]:
    """Transcribes fisherman spoken audio into text via Bhashini ASR."""
    try:
        transcript = bhashini_client.speech_to_text(
            audio_base64=payload.audio_base64,
            source_lang=payload.language or "mr",
            audio_format=payload.audio_format or "wav",
            sampling_rate=payload.sampling_rate or 16000,
        )
        detected_lang, conf = detect_language(transcript, default_lang=payload.language or "mr")
        return {
            "transcript": transcript,
            "language": detected_lang,
            "confidence": conf,
            "status": "success",
        }
    except BhashiniError as b_err:
        logger.warning(f"ASR error: {b_err}")
        raise HTTPException(
            status_code=b_err.status_code or status.HTTP_502_BAD_GATEWAY,
            detail=str(b_err),
        )
    except Exception as exc:
        logger.error(f"Unexpected ASR error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Speech-to-text conversion failed: {exc}",
        )


@app.post("/api/language/text-to-speech", status_code=status.HTTP_200_OK)
def convert_text_to_speech(payload: TextToSpeechRequest) -> Dict[str, Any]:
    """Converts advisory text to spoken audio base64 via Bhashini TTS."""
    audio_b64 = bhashini_client.text_to_speech(
        text=payload.text,
        target_lang=payload.language or "mr",
        gender=payload.gender or "male",
    )
    if not audio_b64:
        return {
            "audio_base64": None,
            "language": payload.language,
            "status": "unavailable",
            "message": "TTS audio could not be generated. Fallback to text advice.",
        }
    return {
        "audio_base64": audio_b64,
        "language": payload.language,
        "status": "success",
    }


# ---------------------------------------------------------------------------
# Primary Assessment Route (with Transparent Multilingual Envelope)
# ---------------------------------------------------------------------------

@app.post("/api/orca/assess", status_code=status.HTTP_200_OK)
def assess_marine_conditions(payload: OrcaAssessRequest) -> Dict[str, Any]:
    """
    Perform a full ORCA marine assessment or conversational query by invoking the Orchestrator:
    - Bhashini Multilingual Layer: Normalizes native Indian language queries to English
    - Maintains conversational session memory and context across turns
    - Ranks and resolves ordinal entities (e.g. 2nd nearest PFZ)
    - Emits structured map / UI actions (show_on_map)
    - Evaluates deterministic risk via the Risk Agent
    - Generates conversational fisherman guidance via Gemini/deterministic synthesis
    - Bhashini Translation & TTS: Translates final advice back to fisherman's language
    """
    import uuid
    effective_req_id = payload.request_id or f"req-{uuid.uuid4().hex[:12]}"
    
    # Multilingual Layer: Detect Language & Translate Query to English
    raw_query = payload.query or ""
    requested_lang = (payload.language or "en").lower().strip()
    
    english_query = raw_query
    detected_lang = requested_lang

    if raw_query.strip():
        # If language is auto or non-English, detect and translate
        if requested_lang in ("auto", "") or requested_lang != "en":
            detected_code, conf = detect_user_language(raw_query, default_lang=requested_lang if requested_lang != "auto" else "mr")
            detected_lang = detected_code if requested_lang == "auto" else requested_lang
            if detected_lang != "en":
                english_query, _ = translate_user_query_to_english(raw_query, source_lang=detected_lang)
        else:
            # Check if query contains non-Latin scripts even if language was default "en"
            detected_code, conf = detect_user_language(raw_query, default_lang="en")
            if detected_code != "en" and conf >= 0.7:
                detected_lang = detected_code
                english_query, _ = translate_user_query_to_english(raw_query, source_lang=detected_lang)

    logger.info("=" * 70)
    logger.info("[API INCOMING ASSESS REQUEST]")
    logger.info("  Session ID: %s | Request ID: %s", payload.session_id, effective_req_id)
    logger.info("  Language: %s (Raw: '%s' -> English: '%s')", detected_lang, raw_query, english_query)
    logger.info("  Coordinates: (%.4f, %.4f)", payload.latitude, payload.longitude)
    logger.info("  Date: %s, Boat Width: %.1f m", payload.date, payload.boat_width_m)
    logger.info("=" * 70)

    try:
        # Core Orchestration (Invoked with normalized English query to preserve deterministic logic)
        assessment = orchestrate_orca_assessment(
            latitude=payload.latitude,
            longitude=payload.longitude,
            date=payload.date,
            boat_width_m=payload.boat_width_m,
            query=english_query,
            request_id=effective_req_id,
            session_id=payload.session_id,
            conversation_history=payload.conversation_history,
        )

        # Multilingual Envelope: Translate Response back to fisherman's language
        if detected_lang != "en":
            english_rec = assessment.get("recommendation", "")
            if english_rec:
                translated_rec = translate_response_to_language(english_rec, target_lang=detected_lang)
                assessment["original_recommendation"] = english_rec
                assessment["recommendation"] = translated_rec

            # Translate Risk Explanation card text if present
            re_cards = []
            if "risk_explanation" in assessment and isinstance(assessment["risk_explanation"], dict):
                re_cards.append(assessment["risk_explanation"])
            if isinstance(assessment.get("risk"), dict) and isinstance(assessment["risk"].get("explanation_card"), dict):
                re_cards.append(assessment["risk"]["explanation_card"])

            for re_card in re_cards:
                translate_explanation_card(re_card, target_lang=detected_lang)

        # Voice Synthesis (TTS) if requested
        if payload.generate_audio:
            rec_for_speech = assessment.get("recommendation", "")
            if rec_for_speech:
                audio_b64 = synthesize_voice_response(rec_for_speech, target_lang=detected_lang)
                assessment["audio_base64"] = audio_b64

        assessment["language"] = detected_lang
        assessment["raw_query"] = raw_query
        assessment["english_query"] = english_query

        return assessment
    except Exception as exc:
        logger.error(f"Orchestrator invocation failed for req={effective_req_id}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while formulating the ORCA assessment: {exc}",
        )
