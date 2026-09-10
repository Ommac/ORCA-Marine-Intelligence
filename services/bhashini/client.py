"""
Bhashini Client Compatibility Module
------------------------------------
Re-exports from agents.language.bhashini_client
"""

from agents.language.bhashini_client import (
    BhashiniClient,
    BhashiniError,
    bhashini_client,
    detect_language,
    detect_user_language,
    is_bhashini_configured,
    synthesize_voice_response,
    translate_response_to_language,
    translate_user_query_to_english,
)

__all__ = [
    "BhashiniClient",
    "BhashiniError",
    "bhashini_client",
    "detect_language",
    "detect_user_language",
    "is_bhashini_configured",
    "synthesize_voice_response",
    "translate_response_to_language",
    "translate_user_query_to_english",
]
