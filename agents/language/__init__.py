"""
ORCA Marine Intelligence - Multilingual & Voice Layer
------------------------------------------------------
Exports Bhashini client and high-level language translation / ASR / TTS helpers.
"""

from agents.language.bhashini_client import (
    BhashiniClient,
    BhashiniError,
    bhashini_client,
    detect_user_language,
    synthesize_voice_response,
    translate_response_to_language,
    translate_user_query_to_english,
)
from agents.language.config import (
    BHASHINI_INFERENCE_KEY,
    BHASHINI_UDYAT_KEY,
    BHASHINI_USER_ID,
    SUPPORTED_LANGUAGES,
    is_bhashini_configured,
)
from agents.language.detector import detect_language

__all__ = [
    "BhashiniClient",
    "BhashiniError",
    "bhashini_client",
    "detect_language",
    "detect_user_language",
    "translate_user_query_to_english",
    "translate_response_to_language",
    "synthesize_voice_response",
    "is_bhashini_configured",
    "SUPPORTED_LANGUAGES",
    "BHASHINI_UDYAT_KEY",
    "BHASHINI_INFERENCE_KEY",
    "BHASHINI_USER_ID",
]
