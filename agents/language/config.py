"""
Bhashini Service Configuration & Language Registry
--------------------------------------------------
Manages credentials, endpoints, supported languages, and timeouts
for the Bhashini Multilingual & Voice layer in ORCA.
"""

from __future__ import annotations

import os
from typing import Dict, Optional
from dotenv import load_dotenv

# Locate and load .env from project root
_root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(_root_dir, ".env"))
load_dotenv()


# Bhashini / ULCA Credentials
BHASHINI_USER_ID: str = os.getenv("BHASHINI_USER_ID", "").strip()
BHASHINI_UDYAT_KEY: str = os.getenv("BHASHINI_UDYAT_KEY", "").strip() or os.getenv("BHASHINI_ULCA_API_KEY", "").strip()
BHASHINI_INFERENCE_KEY: str = os.getenv("BHASHINI_INFERENCE_KEY", "").strip()
BHASHINI_PIPELINE_ID: str = os.getenv("BHASHINI_PIPELINE_ID", "64392f96daac500b55c543cd").strip()


# Bhashini Gateway Endpoints
BHASHINI_DISCOVERY_URL: str = (
    os.getenv("BHASHINI_CONFIG_URL", "").strip()
    or os.getenv("BHASHINI_DISCOVERY_URL", "").strip()
    or "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
)

BHASHINI_DEFAULT_INFERENCE_URL: str = os.getenv(
    "BHASHINI_INFERENCE_URL",
    "https://dhruva-api.bhashini.gov.in/services/inference/pipeline",
).strip()

# Network Timers (seconds)
BHASHINI_TIMEOUT_SECONDS: float = float(os.getenv("BHASHINI_TIMEOUT_SECONDS", "15.0"))
BHASHINI_MAX_RETRIES: int = int(os.getenv("BHASHINI_MAX_RETRIES", "2"))

# Supported Language Metadata
SUPPORTED_LANGUAGES: Dict[str, Dict[str, str]] = {
    "en": {"name": "English", "native": "English", "script": "Latin"},
    "mr": {"name": "Marathi", "native": "मराठी", "script": "Devanagari"},
    "hi": {"name": "Hindi", "native": "हिन्दी", "script": "Devanagari"},
    "ta": {"name": "Tamil", "native": "தமிழ்", "script": "Tamil"},
    "te": {"name": "Telugu", "native": "తెలుగు", "script": "Telugu"},
    "gu": {"name": "Gujarati", "native": "ગુજરાતી", "script": "Gujarati"},
    "kn": {"name": "Kannada", "native": "ಕನ್ನಡ", "script": "Kannada"},
    "ml": {"name": "Malayalam", "native": "മലയാളം", "script": "Malayalam"},
    "bn": {"name": "Bengali", "native": "বাংলা", "script": "Bengali"},
    "or": {"name": "Odia", "native": "ଓଡ଼ିଆ", "script": "Odia"},
}


def is_bhashini_configured() -> bool:
    """Returns True if the required Bhashini API keys are present in environment."""
    return bool(BHASHINI_INFERENCE_KEY or (BHASHINI_UDYAT_KEY and BHASHINI_USER_ID))


def get_language_name(code: str) -> str:
    """Resolve human-readable name for ISO/Bhashini language code."""
    code_clean = (code or "").lower().strip()
    return SUPPORTED_LANGUAGES.get(code_clean, {}).get("name", code_clean.upper())
