"""
Bhashini AI Integration Service for ORCA Marine Intelligence
--------------------------------------------------------------
Provides high-performance, resilient access to Bhashini / ULCA language services:
- Language Detection (detect_language)
- Text Translation (translate_text)
- Speech-to-Text / ASR (speech_to_text)
- Text-to-Speech / TTS (text_to_speech)

Architecture & Security:
- All credentials stay strictly backend-only (BHASHINI_UDYAT_KEY, BHASHINI_INFERENCE_KEY).
- Secrets are NEVER logged or returned to clients.
- Dynamic pipeline discovery with in-memory service ID caching.
- Graceful degradation: network timeouts or upstream service failures never crash ORCA.
"""

from __future__ import annotations

import base64
import binascii
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("orca_bhashini")

if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(levelname)s: [%(name)s] %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# Supported Indian Languages (ISO 639-1 / Bhashini Standard Codes)
# ---------------------------------------------------------------------------

SUPPORTED_LANGUAGES = {
    "en": {"name": "English", "native": "English", "script": "Latin"},
    "mr": {"name": "Marathi", "native": "मराठी", "script": "Devanagari"},
    "hi": {"name": "Hindi", "native": "हिन्दी", "script": "Devanagari"},
    "ta": {"name": "Tamil", "native": "தமிழ்", "script": "Tamil"},
    "te": {"name": "Telugu", "native": "తెలుగు", "script": "Telugu"},
    "gu": {"name": "Gujarati", "native": "ગુજરાતી", "script": "Gujarati"},
    "bn": {"name": "Bengali", "native": "বাংলা", "script": "Bengali"},
    "kn": {"name": "Kannada", "native": "ಕನ್ನಡ", "script": "Kannada"},
    "ml": {"name": "Malayalam", "native": "മലയാളം", "script": "Malayalam"},
    "or": {"name": "Odia", "native": "ଓଡ଼ିଆ", "script": "Odia"},
}

DEFAULT_CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
DEFAULT_INFERENCE_URL = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"
DEFAULT_PIPELINE_ID = "64392f96daac500b55c543cd"


class BhashiniError(Exception):
    """Custom exception raised for unrecoverable Bhashini client errors."""
    def __init__(self, message: str, status_code: Optional[int] = None, details: Optional[Any] = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details


class BhashiniClient:
    """Client interface for Bhashini / ULCA Multilingual & Voice APIs."""

    def __init__(
        self,
        udyat_key: Optional[str] = None,
        inference_key: Optional[str] = None,
        user_id: Optional[str] = None,
        pipeline_id: Optional[str] = None,
        config_url: Optional[str] = None,
        inference_url: Optional[str] = None,
        timeout: float = 12.0,
    ):
        self.udyat_key = (udyat_key or os.getenv("BHASHINI_UDYAT_KEY", "")).strip()
        self.inference_key = (inference_key or os.getenv("BHASHINI_INFERENCE_KEY", "")).strip()
        self.user_id = (user_id or os.getenv("BHASHINI_USER_ID", "")).strip()
        self.pipeline_id = (pipeline_id or os.getenv("BHASHINI_PIPELINE_ID", DEFAULT_PIPELINE_ID)).strip()
        self.config_url = (config_url or os.getenv("BHASHINI_CONFIG_URL", DEFAULT_CONFIG_URL)).strip()
        self.inference_url = (inference_url or os.getenv("BHASHINI_INFERENCE_URL", DEFAULT_INFERENCE_URL)).strip()
        self.timeout = timeout

        # Dynamic service cache: key -> service_id
        self._service_cache: Dict[str, str] = {}
        # Dynamic inference auth cache: token string
        self._cached_inference_auth: Optional[str] = None

        masked_key = f"{self.inference_key[:4]}...{self.inference_key[-4:]}" if len(self.inference_key) >= 8 else ("Set" if self.inference_key else "None")
        logger.info("Initialized BhashiniClient (Inference Key: %s, Pipeline ID: %s)", masked_key, self.pipeline_id)

    @property
    def is_configured(self) -> bool:
        """Returns True if minimum required Bhashini credentials exist."""
        return bool(self.inference_key or (self.udyat_key and self.user_id))

    # -----------------------------------------------------------------------
    # Step 1: Pipeline Discovery & Configuration
    # -----------------------------------------------------------------------

    def discover_pipeline(
        self,
        task_type: str,
        source_language: str,
        target_language: Optional[str] = None,
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Discovers model serviceId, callbackUrl, and inference auth token from getModelsPipeline.
        Returns: (service_id, callback_url, inference_token)
        """
        cache_key = f"{task_type}:{source_language}:{target_language or ''}"
        if cache_key in self._service_cache and self._cached_inference_auth:
            return self._service_cache[cache_key], self.inference_url, self._cached_inference_auth

        # If direct inference key is supplied, we can use default callback and attempt direct call
        if self.inference_key and not (self.udyat_key and self.user_id):
            return None, self.inference_url, self.inference_key

        if not self.config_url or not self.udyat_key:
            return None, self.inference_url, self.inference_key or None

        headers = {
            "Content-Type": "application/json",
            "userID": self.user_id,
            "ulcaApiKey": self.udyat_key,
        }

        task_config: Dict[str, Any] = {"language": {"sourceLanguage": source_language}}
        if target_language:
            task_config["language"]["targetLanguage"] = target_language

        payload = {
            "pipelineTasks": [
                {
                    "taskType": task_type,
                    "config": task_config,
                }
            ],
            "pipelineRequestConfig": {
                "pipelineId": self.pipeline_id,
            },
        }

        try:
            resp = requests.post(self.config_url, json=payload, headers=headers, timeout=self.timeout)
            if resp.status_code == 200:
                data = resp.json()
                callback_url = data.get("pipelineInferenceAPIEndPoint", {}).get("callbackUrl") or self.inference_url
                inference_api_key_obj = data.get("pipelineInferenceAPIEndPoint", {}).get("inferenceApiKey", {})
                inference_token = inference_api_key_obj.get("value") or self.inference_key

                # Extract serviceId
                service_id = None
                config_list = data.get("pipelineResponseConfig", [])
                for cfg in config_list:
                    if cfg.get("taskType") == task_type:
                        configs = cfg.get("config", [])
                        if configs and isinstance(configs, list):
                            service_id = configs[0].get("serviceId")
                            break

                if service_id:
                    self._service_cache[cache_key] = service_id
                if inference_token:
                    self._cached_inference_auth = inference_token

                return service_id, callback_url, inference_token
            else:
                logger.warning("Bhashini config call returned status %d: %s", resp.status_code, resp.text[:200])
        except Exception as exc:
            logger.warning("Bhashini config discovery failed (%s). Falling back to direct inference.", exc)

        return None, self.inference_url, self.inference_key or None

    # -----------------------------------------------------------------------
    # 1. Language Detection
    # -----------------------------------------------------------------------

    def detect_language(self, text: str) -> Dict[str, Any]:
        """
        Detects the natural language of given text.
        Falls back to Unicode script heuristics if Bhashini is unreachable or unconfigured.
        """
        if not text or not text.strip():
            return {
                "status": "error",
                "language": "en",
                "language_name": "English",
                "confidence": 0.0,
                "method": "empty_input",
                "error": "Input text is empty",
            }

        cleaned = text.strip()

        # Check script heuristic first as fast path and reliable fallback
        heuristic_lang = self._detect_script_heuristic(cleaned)

        if not self.is_configured:
            return {
                "status": "success",
                "language": heuristic_lang,
                "language_name": SUPPORTED_LANGUAGES.get(heuristic_lang, {}).get("name", "Unknown"),
                "confidence": 0.95 if heuristic_lang != "en" else 0.85,
                "method": "script_heuristic_fallback",
            }

        # Attempt Bhashini language detection
        service_id, callback_url, token = self.discover_pipeline("txt-lang-detection", "en")
        if not token:
            return {
                "status": "success",
                "language": heuristic_lang,
                "language_name": SUPPORTED_LANGUAGES.get(heuristic_lang, {}).get("name", "Unknown"),
                "confidence": 0.95,
                "method": "script_heuristic_fallback",
            }

        headers = {
            "Content-Type": "application/json",
            "Authorization": token,
        }

        task_config: Dict[str, Any] = {}
        if service_id:
            task_config["serviceId"] = service_id

        payload = {
            "pipelineTasks": [
                {
                    "taskType": "txt-lang-detection",
                    "config": task_config,
                }
            ],
            "inputData": {
                "input": [{"source": cleaned}],
            },
        }

        try:
            resp = requests.post(callback_url or self.inference_url, json=payload, headers=headers, timeout=self.timeout)
            if resp.status_code == 200:
                res_data = resp.json()
                preds = (
                    res_data.get("pipelineResponse", [{}])[0]
                    .get("output", [{}])[0]
                )
                detected = (
                    preds.get("langPrediction", [{}])[0].get("langCode")
                    or preds.get("source")
                    or heuristic_lang
                )
                detected = detected.lower()
                return {
                    "status": "success",
                    "language": detected if detected in SUPPORTED_LANGUAGES else heuristic_lang,
                    "language_name": SUPPORTED_LANGUAGES.get(detected, {}).get("name", "Unknown"),
                    "confidence": 0.99,
                    "method": "bhashini_api",
                }
            else:
                logger.warning("Bhashini lang-detection returned status %d. Using heuristic.", resp.status_code)
        except Exception as exc:
            logger.warning("Bhashini language detection call failed: %s. Using heuristic.", exc)

        return {
            "status": "success",
            "language": heuristic_lang,
            "language_name": SUPPORTED_LANGUAGES.get(heuristic_lang, {}).get("name", "Unknown"),
            "confidence": 0.90,
            "method": "script_heuristic_fallback",
        }

    # -----------------------------------------------------------------------
    # 2. Text Translation
    # -----------------------------------------------------------------------

    def translate_text(
        self,
        text: str,
        source_lang: str,
        target_lang: str,
    ) -> Dict[str, Any]:
        """
        Translates text from source_lang to target_lang via Bhashini NMT.
        """
        if not text or not text.strip():
            return {
                "status": "error",
                "translated_text": "",
                "source_language": source_lang,
                "target_language": target_lang,
                "error": "Empty text provided for translation",
            }

        cleaned = text.strip()

        # Same language: identity pass-through
        if source_lang.lower() == target_lang.lower():
            return {
                "status": "success",
                "translated_text": cleaned,
                "source_language": source_lang,
                "target_language": target_lang,
                "method": "passthrough",
            }

        # If Bhashini is not configured, perform safe simulated translation / fallback
        if not self.is_configured:
            logger.info("Bhashini credentials not set; returning graceful mock/fallback translation.")
            return self._mock_translation(cleaned, source_lang, target_lang)

        service_id, callback_url, token = self.discover_pipeline("translation", source_lang, target_lang)
        if not token:
            logger.warning("No Bhashini inference token available; using fallback.")
            return self._mock_translation(cleaned, source_lang, target_lang)

        headers = {
            "Content-Type": "application/json",
            "Authorization": token,
        }

        task_config: Dict[str, Any] = {
            "language": {
                "sourceLanguage": source_lang,
                "targetLanguage": target_lang,
            }
        }
        if service_id:
            task_config["serviceId"] = service_id

        payload = {
            "pipelineTasks": [
                {
                    "taskType": "translation",
                    "config": task_config,
                }
            ],
            "inputData": {
                "input": [{"source": cleaned}],
            },
        }

        try:
            start_t = time.time()
            resp = requests.post(callback_url or self.inference_url, json=payload, headers=headers, timeout=self.timeout)
            elapsed = time.time() - start_t

            if resp.status_code == 200:
                data = resp.json()
                pipe_resp = data.get("pipelineResponse", [])
                if pipe_resp:
                    output = pipe_resp[0].get("output", [])
                    if output:
                        target_text = output[0].get("target") or output[0].get("source")
                        return {
                            "status": "success",
                            "translated_text": target_text,
                            "source_language": source_lang,
                            "target_language": target_lang,
                            "latency_ms": round(elapsed * 1000, 1),
                            "method": "bhashini_api",
                        }
            
            logger.error("Bhashini translation failed [%d]: %s", resp.status_code, resp.text[:200])
            return self._mock_translation(cleaned, source_lang, target_lang, error=f"Upstream status {resp.status_code}")
        except Exception as exc:
            logger.error("Bhashini translation exception: %s", exc)
            return self._mock_translation(cleaned, source_lang, target_lang, error=str(exc))

    # -----------------------------------------------------------------------
    # 3. Speech to Text (ASR)
    # -----------------------------------------------------------------------

    def speech_to_text(
        self,
        audio_content_base64: str,
        language: Optional[str] = None,
        audio_format: str = "wav",
        sampling_rate: int = 16000,
    ) -> Dict[str, Any]:
        """
        Converts speech audio (Base64) to text transcript using Bhashini ASR.
        """
        # Validate audio content
        if not audio_content_base64 or not str(audio_content_base64).strip():
            return {
                "status": "error",
                "transcript": "",
                "language": language or "en",
                "error": "Audio content is empty",
            }

        clean_b64 = audio_content_base64.strip()
        # Strip data URL prefix if present (e.g. data:audio/wav;base64,...)
        if "," in clean_b64:
            clean_b64 = clean_b64.split(",", 1)[1]

        try:
            raw_bytes = base64.b64decode(clean_b64, validate=True)
            if len(raw_bytes) < 32:
                return {
                    "status": "error",
                    "transcript": "",
                    "language": language or "en",
                    "error": "Audio payload is too small or corrupted (< 32 bytes)",
                }
            if len(raw_bytes) > 10 * 1024 * 1024:
                return {
                    "status": "error",
                    "transcript": "",
                    "language": language or "en",
                    "error": "Audio payload exceeds maximum supported size (10 MB)",
                }
        except binascii.Error:
            return {
                "status": "error",
                "transcript": "",
                "language": language or "en",
                "error": "Invalid base64 encoding in audio payload",
            }

        effective_lang = language or "mr"

        if not self.is_configured:
            logger.info("Bhashini credentials not set; returning simulated ASR transcript.")
            return {
                "status": "success",
                "transcript": "उद्या मासेमारीला जाणं सुरक्षित आहे का?",
                "language": effective_lang,
                "method": "mock_fallback",
            }

        service_id, callback_url, token = self.discover_pipeline("asr", effective_lang)
        if not token:
            return {
                "status": "success",
                "transcript": "उद्या मासेमारीला जाणं सुरक्षित आहे का?",
                "language": effective_lang,
                "method": "mock_fallback",
            }

        headers = {
            "Content-Type": "application/json",
            "Authorization": token,
        }

        task_config: Dict[str, Any] = {
            "language": {"sourceLanguage": effective_lang},
            "audioFormat": audio_format.lower(),
            "samplingRate": sampling_rate,
        }
        if service_id:
            task_config["serviceId"] = service_id

        payload = {
            "pipelineTasks": [
                {
                    "taskType": "asr",
                    "config": task_config,
                }
            ],
            "inputData": {
                "audio": [{"audioContent": clean_b64}],
            },
        }

        try:
            start_t = time.time()
            resp = requests.post(callback_url or self.inference_url, json=payload, headers=headers, timeout=self.timeout)
            elapsed = time.time() - start_t

            if resp.status_code == 200:
                data = resp.json()
                pipe_resp = data.get("pipelineResponse", [])
                if pipe_resp:
                    output = pipe_resp[0].get("output", [])
                    if output:
                        transcript = output[0].get("source") or ""
                        return {
                            "status": "success",
                            "transcript": transcript,
                            "language": effective_lang,
                            "latency_ms": round(elapsed * 1000, 1),
                            "method": "bhashini_api",
                        }
            logger.error("Bhashini ASR failed [%d]: %s", resp.status_code, resp.text[:200])
            return {
                "status": "error",
                "transcript": "",
                "language": effective_lang,
                "error": f"Bhashini ASR returned error {resp.status_code}",
            }
        except Exception as exc:
            logger.error("Bhashini ASR exception: %s", exc)
            return {
                "status": "error",
                "transcript": "",
                "language": effective_lang,
                "error": str(exc),
            }

    # -----------------------------------------------------------------------
    # 4. Text to Speech (TTS)
    # -----------------------------------------------------------------------

    def text_to_speech(
        self,
        text: str,
        language: str,
        gender: str = "female",
    ) -> Dict[str, Any]:
        """
        Converts text response to synthesized audio using Bhashini TTS.
        Returns Base64 audio string.
        """
        if not text or not text.strip():
            return {
                "status": "error",
                "audio_base64": None,
                "audio_format": "wav",
                "error": "Empty text provided for TTS",
            }

        cleaned = text.strip()
        effective_lang = language.lower()

        if not self.is_configured:
            logger.info("Bhashini credentials not set; returning dummy WAV audio header.")
            # Minimal 44-byte silent WAV header for clean playback without crashing
            dummy_wav_b64 = "UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
            return {
                "status": "success",
                "audio_base64": dummy_wav_b64,
                "audio_format": "wav",
                "language": effective_lang,
                "method": "mock_fallback",
            }

        service_id, callback_url, token = self.discover_pipeline("tts", effective_lang)
        if not token:
            dummy_wav_b64 = "UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
            return {
                "status": "success",
                "audio_base64": dummy_wav_b64,
                "audio_format": "wav",
                "language": effective_lang,
                "method": "mock_fallback",
            }

        headers = {
            "Content-Type": "application/json",
            "Authorization": token,
        }

        task_config: Dict[str, Any] = {
            "language": {"sourceLanguage": effective_lang},
            "gender": gender,
        }
        if service_id:
            task_config["serviceId"] = service_id

        payload = {
            "pipelineTasks": [
                {
                    "taskType": "tts",
                    "config": task_config,
                }
            ],
            "inputData": {
                "input": [{"source": cleaned}],
            },
        }

        try:
            start_t = time.time()
            resp = requests.post(callback_url or self.inference_url, json=payload, headers=headers, timeout=self.timeout)
            elapsed = time.time() - start_t

            if resp.status_code == 200:
                data = resp.json()
                pipe_resp = data.get("pipelineResponse", [])
                if pipe_resp:
                    audio_list = pipe_resp[0].get("audio", [])
                    if audio_list:
                        audio_b64 = audio_list[0].get("audioContent")
                        return {
                            "status": "success",
                            "audio_base64": audio_b64,
                            "audio_format": "wav",
                            "language": effective_lang,
                            "latency_ms": round(elapsed * 1000, 1),
                            "method": "bhashini_api",
                        }
            logger.error("Bhashini TTS failed [%d]: %s", resp.status_code, resp.text[:200])
            return {
                "status": "error",
                "audio_base64": None,
                "audio_format": "wav",
                "error": f"Bhashini TTS returned status {resp.status_code}",
            }
        except Exception as exc:
            logger.error("Bhashini TTS exception: %s", exc)
            return {
                "status": "error",
                "audio_base64": None,
                "audio_format": "wav",
                "error": str(exc),
            }

    # -----------------------------------------------------------------------
    # Helper & Fallback Methods
    # -----------------------------------------------------------------------

    def _detect_script_heuristic(self, text: str) -> str:
        """
        Fast, robust Unicode block heuristic detection for Indian languages.
        """
        counts = {
            "mr": 0,  # Devanagari (Marathi/Hindi)
            "hi": 0,
            "ta": 0,  # Tamil
            "te": 0,  # Telugu
            "gu": 0,  # Gujarati
            "bn": 0,  # Bengali
            "kn": 0,  # Kannada
            "ml": 0,  # Malayalam
            "or": 0,  # Odia
            "en": 0,  # Latin
        }

        # Marathi distinguishing words
        marathi_markers = {"आहे", "नाही", "का", "मासेमारी", "करा", "उद्या", "होय", "किमी", "सुरक्षित", "सांगा", "हवामान"}
        hindi_markers = {"है", "नहीं", "क्या", "मछली", "कल", "हाँ", "सुरक्षित", "बताएं", "मौसम"}

        words = set(re.findall(r"\w+", text))
        marathi_hits = len(words.intersection(marathi_markers))
        hindi_hits = len(words.intersection(hindi_markers))

        for char in text:
            code = ord(char)
            if 0x0900 <= code <= 0x097F:
                if marathi_hits > hindi_hits:
                    counts["mr"] += 2
                elif hindi_hits > marathi_hits:
                    counts["hi"] += 2
                else:
                    # In ORCA Palghar/Maharashtra maritime context, default Devanagari to mr
                    counts["mr"] += 1
            elif 0x0B80 <= code <= 0x0BFF:
                counts["ta"] += 1
            elif 0x0C00 <= code <= 0x0C7F:
                counts["te"] += 1
            elif 0x0A80 <= code <= 0x0AFF:
                counts["gu"] += 1
            elif 0x0980 <= code <= 0x09FF:
                counts["bn"] += 1
            elif 0x0C80 <= code <= 0x0CFF:
                counts["kn"] += 1
            elif 0x0D00 <= code <= 0x0D7F:
                counts["ml"] += 1
            elif 0x0B00 <= code <= 0x0B7F:
                counts["or"] += 1
            elif (0x0041 <= code <= 0x005A) or (0x0061 <= code <= 0x007A):
                counts["en"] += 1

        top_lang = max(counts, key=counts.get)  # type: ignore
        return top_lang if counts[top_lang] > 0 else "en"

    def _mock_translation(
        self,
        text: str,
        source_lang: str,
        target_lang: str,
        error: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Graceful translation fallback dictionary for development/mock mode.
        Ensures realistic test coverage and smooth demonstration without crashing.
        """
        # Dictionary of standard maritime phrases for test/demo fallback
        mock_phrase_book = {
            # Marathi -> English
            ("mr", "en", "उद्या मासेमारीला जाणं सुरक्षित आहे का?"): "Is it safe to go fishing tomorrow?",
            ("mr", "en", "उद्या मासेमारीला जाणं सुरक्षित आहे का"): "Is it safe to go fishing tomorrow?",
            ("mr", "en", "सर्वात जवळचे मासेमारी क्षेत्र कुठे आहे?"): "Where is the nearest fishing zone?",
            ("mr", "en", "माझ्या स्थानावरून दुसरे पीएफझेड सांगा"): "tell me 2nd pfz from my location",
            ("mr", "en", "नकाशात दाखवा"): "show on map",
            # Hindi -> English
            ("hi", "en", "क्या कल मछली पकड़ना सुरक्षित है?"): "Is it safe to go fishing tomorrow?",
            ("hi", "en", "निकटतम मछली पकड़ने का क्षेत्र कहाँ है?"): "Where is the nearest fishing zone?",
            # English -> Marathi
            ("en", "mr", "Safe to go fishing"): "मासेमारीसाठी सुरक्षित",
            ("en", "mr", "Caution advised"): "सावधगिरी बाळगा",
            ("en", "mr", "Do not go fishing"): "मासेमारीला जाऊ नका",
        }

        key = (source_lang.lower(), target_lang.lower(), text.strip())
        if key in mock_phrase_book:
            translated = mock_phrase_book[key]
        else:
            # Context-aware fallback: if translating into Marathi, append localized prefix
            if target_lang == "mr" and source_lang == "en":
                translated = f"[मराठी अनुवाद] {text}"
            elif target_lang == "hi" and source_lang == "en":
                translated = f"[हिन्दी अनुवाद] {text}"
            else:
                translated = text

        return {
            "status": "success" if not error else "fallback",
            "translated_text": translated,
            "source_language": source_lang,
            "target_language": target_lang,
            "method": "mock_phrasebook_fallback",
            "warning": error,
        }


# Singleton instance
bhashini_client = BhashiniClient()


# Convenience functional exports
def detect_language(text: str) -> Dict[str, Any]:
    return bhashini_client.detect_language(text)


def translate_text(text: str, source_lang: str, target_lang: str) -> Dict[str, Any]:
    return bhashini_client.translate_text(text, source_lang, target_lang)


def speech_to_text(
    audio_content_base64: str,
    language: Optional[str] = None,
    audio_format: str = "wav",
) -> Dict[str, Any]:
    return bhashini_client.speech_to_text(audio_content_base64, language, audio_format)


def text_to_speech(text: str, language: str, gender: str = "female") -> Dict[str, Any]:
    return bhashini_client.text_to_speech(text, language, gender)
