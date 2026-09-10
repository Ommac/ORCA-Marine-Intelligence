"""
Bhashini Multilingual & Voice Services for ORCA Marine Intelligence
"""

from services.bhashini.client import (
    BhashiniClient,
    BhashiniError,
    bhashini_client,
    detect_language,
    translate_text,
    speech_to_text,
    text_to_speech,
    SUPPORTED_LANGUAGES,
)

__all__ = [
    "BhashiniClient",
    "BhashiniError",
    "bhashini_client",
    "detect_language",
    "translate_text",
    "speech_to_text",
    "text_to_speech",
    "SUPPORTED_LANGUAGES",
]
