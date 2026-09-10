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
from services.bhashini import (
    SUPPORTED_LANGUAGES,
    detect_language,
    translate_text,
    speech_to_text,
    text_to_speech,
)


# ---------------------------------------------------------------------------
# Logging & FastAPI App Configuration
# ---------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("orca_api")

app = FastAPI(
    title="ORCA Marine Intelligence API",
    description=(
        "HTTP API Bridge connecting client applications to the ORCA "
        "Multi-Agent backend with Bhashini Multilingual & Voice support."
    ),
    version="1.1.0",
)


# ---------------------------------------------------------------------------
# CORS Configuration
# Enabled for Expo / React Native / Localhost development
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
    """
    Pydantic validation schema for ORCA assessment requests with
    Bhashini multilingual and voice support.
    """

    query: Optional[str] = Field(
        None,
        description="Natural-language question from the fisherman.",
    )

    latitude: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Vessel latitude (-90 to 90).",
    )

    longitude: float = Field(
        ...,
        ge=-180.0,
        le=180.0,
        description="Vessel longitude (-180 to 180).",
    )

    date: str = Field(
        ...,
        description="Requested target date in YYYY-MM-DD format.",
    )

    boat_width_m: float = Field(
        ...,
        gt=0.0,
        description="Vessel width in meters.",
    )

    request_id: Optional[str] = Field(
        None,
        description="Client request UUID for correlation.",
    )

    session_id: Optional[str] = Field(
        None,
        description="Conversational session ID for multi-turn context.",
    )

    conversation_history: Optional[list[dict[str, Any]]] = Field(
        None,
        description="Recent conversation history turns.",
    )

    # Multilingual & Voice layer fields
    language: Optional[str] = Field(
        None,
        description=(
            "Preferred language code "
            "('mr', 'hi', 'ta', 'te', 'gu', 'bn', 'en', 'auto')."
        ),
    )

    audio_base64: Optional[str] = Field(
        None,
        description=(
            "Base64 encoded audio input from microphone "
            "for ASR speech-to-text."
        ),
    )

    audio_format: Optional[str] = Field(
        "wav",
        description="Audio format (wav, mp3, m4a, webm).",
    )

    enable_tts: Optional[bool] = Field(
        True,
        description=(
            "Whether to synthesize Bhashini TTS voice audio "
            "for the response."
        ),
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "query": "उद्या मासेमारीला जाणं सुरक्षित आहे का?",
                "latitude": 19.72,
                "longitude": 72.70,
                "date": "2026-09-04",
                "boat_width_m": 5.0,
                "request_id": "req-12345",
                "session_id": "sess-user-1",
                "language": "mr",
                "enable_tts": True,
            }
        }
    }


class LanguageDetectRequest(BaseModel):
    text: str = Field(
        ...,
        description="Text to analyze for language detection.",
    )


class LanguageTranslateRequest(BaseModel):
    text: str = Field(
        ...,
        description="Source text to translate.",
    )

    source_language: str = Field(
        ...,
        description="Source ISO language code (e.g. 'mr', 'hi', 'en').",
    )

    target_language: str = Field(
        ...,
        description="Target ISO language code (e.g. 'en', 'mr', 'hi').",
    )


class SpeechToTextRequest(BaseModel):
    audio_base64: str = Field(
        ...,
        description="Base64 encoded audio content.",
    )

    language: Optional[str] = Field(
        None,
        description="Spoken language ISO code.",
    )

    audio_format: Optional[str] = Field(
        "wav",
        description="Audio container format.",
    )


class TextToSpeechRequest(BaseModel):
    text: str = Field(
        ...,
        description="Text to synthesize to speech.",
    )

    language: str = Field(
        ...,
        description="Target ISO language code.",
    )

    gender: Optional[str] = Field(
        "female",
        description="Voice gender ('female' or 'male').",
    )


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@app.get("/health", status_code=status.HTTP_200_OK)
def health_check() -> Dict[str, Any]:
    """Health check endpoint."""

    from services.bhashini.client import bhashini_client

    return {
        "status": "ok",
        "service": "ORCA API",
        "bhashini_configured": bhashini_client.is_configured,
        "supported_languages": list(SUPPORTED_LANGUAGES.keys()),
    }


@app.post("/api/orca/assess", status_code=status.HTTP_200_OK)
def assess_marine_conditions(payload: OrcaAssessRequest) -> Dict[str, Any]:
    """
    Perform a full ORCA marine assessment or conversational query using
    the existing Orchestrator, with optional Bhashini multilingual and
    voice processing:

    1. ASR: Speech-to-text if audio is provided.
    2. Language detection and normalization to English for ORCA processing.
    3. Existing LangGraph orchestrator executes the specialist agents and
       authoritative deterministic Risk Engine.
    4. Final recommendation is translated back to the fisherman's language.
    5. Optional Bhashini TTS generates voice audio for the response.
    """

    import uuid

    effective_req_id = payload.request_id or f"req-{uuid.uuid4().hex[:12]}"

    # -----------------------------------------------------------------------
    # 1. Voice Input Processing (ASR)
    # -----------------------------------------------------------------------

    raw_query = payload.query or ""
    asr_metadata = None

    if payload.audio_base64:
        logger.info("[BHASHINI ASR] Processing voice audio input...")

        asr_res = speech_to_text(
            audio_content_base64=payload.audio_base64,
            language=(
                payload.language
                if payload.language and payload.language != "auto"
                else None
            ),
            audio_format=payload.audio_format or "wav",
        )

        if (
            asr_res.get("status") == "success"
            and asr_res.get("transcript")
        ):
            raw_query = asr_res["transcript"]
            asr_metadata = asr_res

            logger.info(
                "[BHASHINI ASR] Transcribed voice query: '%s' (lang: %s)",
                raw_query,
                asr_res.get("language"),
            )
        else:
            logger.warning(
                "[BHASHINI ASR] Voice transcription failed/empty: %s. "
                "Using text query if present.",
                asr_res.get("error"),
            )

    # -----------------------------------------------------------------------
    # 2. Language Detection & Normalization
    # -----------------------------------------------------------------------

    detected_lang = "en"

    if payload.language and payload.language.lower() != "auto":
        detected_lang = payload.language.lower()

    elif raw_query.strip():
        det_res = detect_language(raw_query)
        detected_lang = det_res.get("language", "en")

    # Translate query to English if needed for internal ORCA processing
    orca_query = raw_query
    translation_input_meta = None

    if detected_lang != "en" and raw_query.strip():
        logger.info(
            "[BHASHINI NMT] Translating input query from '%s' to 'en': '%s'",
            detected_lang,
            raw_query,
        )

        trans_in = translate_text(
            raw_query,
            source_lang=detected_lang,
            target_lang="en",
        )

        if (
            trans_in.get("status") == "success"
            and trans_in.get("translated_text")
        ):
            orca_query = trans_in["translated_text"]
            translation_input_meta = trans_in

            logger.info(
                "[BHASHINI NMT] Normalized ORCA query: '%s'",
                orca_query,
            )

    logger.info("=" * 70)
    logger.info("[API INCOMING ASSESS REQUEST]")

    logger.info(
        "  Session ID: %s | Request ID: %s",
        payload.session_id,
        effective_req_id,
    )

    logger.info(
        "  Original Query: '%s' | Language: %s",
        raw_query,
        detected_lang,
    )

    logger.info(
        "  ORCA Query: '%s'",
        orca_query,
    )

    logger.info(
        "  Coordinates: (%.4f, %.4f)",
        payload.latitude,
        payload.longitude,
    )

    logger.info(
        "  Date: %s, Boat Width: %.1f m",
        payload.date,
        payload.boat_width_m,
    )

    logger.info("=" * 70)

    # -----------------------------------------------------------------------
    # 3. Existing LangGraph Orchestrator & Deterministic Risk Engine
    # -----------------------------------------------------------------------

    try:
        assessment = orchestrate_orca_assessment(
            latitude=payload.latitude,
            longitude=payload.longitude,
            date=payload.date,
            boat_width_m=payload.boat_width_m,
            query=orca_query,
            request_id=effective_req_id,
        )

    except Exception as exc:
        logger.error(
            "Orchestrator invocation failed for req=%s: %s",
            effective_req_id,
            exc,
            exc_info=True,
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "An error occurred while formulating the "
                "ORCA assessment."
            ),
        )

    # -----------------------------------------------------------------------
    # 4. Multilingual Response Translation (Output)
    # -----------------------------------------------------------------------

    english_recommendation = assessment.get("recommendation") or ""
    localized_recommendation = english_recommendation
    translation_output_meta = None

    if detected_lang != "en" and english_recommendation.strip():
        logger.info(
            "[BHASHINI NMT] Translating recommendation from 'en' to '%s'...",
            detected_lang,
        )

        trans_out = translate_text(
            english_recommendation,
            source_lang="en",
            target_lang=detected_lang,
        )

        if (
            trans_out.get("status") in ("success", "fallback")
            and trans_out.get("translated_text")
        ):
            localized_recommendation = trans_out["translated_text"]
            translation_output_meta = trans_out

    # Attach language metadata
    assessment["language"] = detected_lang

    assessment["language_name"] = SUPPORTED_LANGUAGES.get(
        detected_lang,
        {},
    ).get("name", "Unknown")

    assessment["original_query"] = raw_query
    assessment["translated_query"] = orca_query
    assessment["original_recommendation"] = english_recommendation
    assessment["recommendation"] = localized_recommendation

    # -----------------------------------------------------------------------
    # 5. Text-to-Speech (TTS) Voice Generation
    # -----------------------------------------------------------------------

    assessment["audio_base64"] = None
    assessment["audio_format"] = "wav"

    if payload.enable_tts and localized_recommendation.strip():

        logger.info(
            "[BHASHINI TTS] Synthesizing voice audio for '%s' (lang: %s)...",
            localized_recommendation[:50],
            detected_lang,
        )

        tts_res = text_to_speech(
            text=localized_recommendation,
            language=detected_lang,
            gender="female",
        )

        if (
            tts_res.get("status") == "success"
            and tts_res.get("audio_base64")
        ):
            assessment["audio_base64"] = tts_res["audio_base64"]
            assessment["audio_format"] = tts_res.get(
                "audio_format",
                "wav",
            )

            logger.info(
                "[BHASHINI TTS] Voice audio generated successfully."
            )
        else:
            logger.warning(
                "[BHASHINI TTS] Voice synthesis omitted or failed: %s",
                tts_res.get("error"),
            )

    return assessment


# ---------------------------------------------------------------------------
# Modular Bhashini Language Endpoints
# ---------------------------------------------------------------------------

@app.post(
    "/api/language/detect",
    status_code=status.HTTP_200_OK,
)
def api_detect_language(
    payload: LanguageDetectRequest,
) -> Dict[str, Any]:
    """Detect natural language of given text."""

    return detect_language(payload.text)


@app.post(
    "/api/language/translate",
    status_code=status.HTTP_200_OK,
)
def api_translate_text(
    payload: LanguageTranslateRequest,
) -> Dict[str, Any]:
    """Translate text between supported Indian languages / English."""

    return translate_text(
        text=payload.text,
        source_lang=payload.source_language,
        target_lang=payload.target_language,
    )


@app.post(
    "/api/language/speech-to-text",
    status_code=status.HTTP_200_OK,
)
def api_speech_to_text(
    payload: SpeechToTextRequest,
) -> Dict[str, Any]:
    """Convert base64 audio speech to text transcript."""

    return speech_to_text(
        audio_content_base64=payload.audio_base64,
        language=payload.language,
        audio_format=payload.audio_format or "wav",
    )


@app.post(
    "/api/language/text-to-speech",
    status_code=status.HTTP_200_OK,
)
def api_text_to_speech(
    payload: TextToSpeechRequest,
) -> Dict[str, Any]:
    """Synthesize text into speech audio (base64)."""

    return text_to_speech(
        text=payload.text,
        language=payload.language,
        gender=payload.gender or "female",
    )