"""
Bhashini Official Multi-Task Client (ULCA / Dhruva Integration)
---------------------------------------------------------------
Implements the verified 2-step official Bhashini API contract:
1. Pipeline Discovery (meity-auth.ulcacontrib.org)
2. Task Inference for Translation, ASR, and TTS (dhruva-api.bhashini.gov.in)

Key Architectural Principles:
- Resilient: Graceful fallback on timeout, 401, 429, or network errors.
- Isolated: Zero safety, risk, or weather logic resides here.
- Secure: Never logs sensitive keys; reads backend environment variables.
"""

from __future__ import annotations

import base64
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import requests

from agents.language.config import (
    BHASHINI_DEFAULT_INFERENCE_URL,
    BHASHINI_DISCOVERY_URL,
    BHASHINI_INFERENCE_KEY,
    BHASHINI_PIPELINE_ID,
    BHASHINI_TIMEOUT_SECONDS,
    BHASHINI_UDYAT_KEY,
    BHASHINI_USER_ID,
    is_bhashini_configured,
)
from agents.language.detector import detect_language

logger = logging.getLogger("bhashini_client")

# In-memory service discovery cache: (task_type, source_lang, target_lang) -> (service_id, callback_url, expiry_timestamp)
_DISCOVERY_CACHE: Dict[str, Tuple[str, str, float]] = {}
CACHE_TTL_SECONDS = 3600.0  # 1 hour cache


class BhashiniError(Exception):
    """Base exception for Bhashini API integration failures."""

    def __init__(self, message: str, status_code: Optional[int] = None, details: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details


class BhashiniClient:
    """Official client for Bhashini ULCA / Dhruva Multilingual Services."""

    def __init__(
        self,
        user_id: Optional[str] = None,
        udyat_key: Optional[str] = None,
        inference_key: Optional[str] = None,
        timeout: float = BHASHINI_TIMEOUT_SECONDS,
    ):
        self.user_id = user_id or BHASHINI_USER_ID
        self.udyat_key = udyat_key or BHASHINI_UDYAT_KEY
        self.inference_key = inference_key or BHASHINI_INFERENCE_KEY
        self.timeout = timeout

    # -------------------------------------------------------------------------
    # Pipeline Discovery
    # -------------------------------------------------------------------------
    def discover_pipeline(
        self,
        task_type: str,
        source_lang: str,
        target_lang: Optional[str] = None,
    ) -> Tuple[Optional[str], str]:
        """
        Queries the Bhashini Discovery API to obtain the active serviceId
        and inference callback URL for the specified task and language pair.
        Returns (service_id, callback_url).
        """
        cache_key = f"{task_type}:{source_lang}:{target_lang or ''}"
        now = time.time()

        if cache_key in _DISCOVERY_CACHE:
            cached_service, cached_url, expiry = _DISCOVERY_CACHE[cache_key]
            if now < expiry:
                return cached_service, cached_url

        # If discovery credentials are not provided, return default inference URL
        if not self.udyat_key or not self.user_id:
            logger.debug("[BHASHINI] No discovery credentials present. Using default inference endpoint.")
            return None, BHASHINI_DEFAULT_INFERENCE_URL

        task_config: Dict[str, Any] = {"taskType": task_type, "config": {}}
        if task_type == "translation":
            task_config["config"]["language"] = {
                "sourceLanguage": source_lang,
                "targetLanguage": target_lang or "en",
            }
        else:
            task_config["config"]["language"] = {"sourceLanguage": source_lang}

        payload = {
            "pipelineTasks": [task_config],
            "pipelineRequestConfig": {"pipelineId": BHASHINI_PIPELINE_ID},
        }

        headers = {
            "userID": self.user_id,
            "ulcaApiKey": self.udyat_key,
            "Content-Type": "application/json",
        }

        try:
            resp = requests.post(
                BHASHINI_DISCOVERY_URL,
                json=payload,
                headers=headers,
                timeout=self.timeout,
            )

            if resp.status_code == 200:
                data = resp.json()
                callback_url = BHASHINI_DEFAULT_INFERENCE_URL
                if "pipelineInferenceAPIEndPoint" in data:
                    callback_url = (
                        data["pipelineInferenceAPIEndPoint"].get("callbackUrl")
                        or BHASHINI_DEFAULT_INFERENCE_URL
                    )

                service_id = None
                config_list = data.get("pipelineResponseConfig", [])
                for item in config_list:
                    if item.get("taskType") == task_type:
                        config_items = item.get("config", [])
                        if isinstance(config_items, list) and config_items:
                            service_id = config_items[0].get("serviceId")
                        elif isinstance(config_items, dict):
                            service_id = config_items.get("serviceId")
                        break

                _DISCOVERY_CACHE[cache_key] = (service_id, callback_url, now + CACHE_TTL_SECONDS)
                logger.info(
                    "[BHASHINI] Pipeline discovered for %s (%s->%s): serviceId=%s, url=%s",
                    task_type,
                    source_lang,
                    target_lang,
                    service_id,
                    callback_url,
                )
                return service_id, callback_url

            logger.warning(
                "[BHASHINI] Discovery returned status %d: %s. Reverting to default inference URL.",
                resp.status_code,
                resp.text[:200],
            )
        except Exception as exc:
            logger.warning("[BHASHINI] Pipeline discovery failed (%s). Falling back to default URL.", exc)

        return None, BHASHINI_DEFAULT_INFERENCE_URL

    # -------------------------------------------------------------------------
    # Language Detection
    # -------------------------------------------------------------------------
    def detect_language(self, text: Optional[str], default_lang: str = "en") -> Tuple[str, float]:
        """
        Identifies the source language of fisherman query using script & lexical analysis.
        Returns (language_code, confidence).
        """
        return detect_language(text, default_lang=default_lang)

    # -------------------------------------------------------------------------
    # Text Translation
    # -------------------------------------------------------------------------
    def translate_texts(
        self,
        texts: List[str],
        source_lang: str,
        target_lang: str = "en",
    ) -> List[str]:
        """
        Translates a list of texts between Indian languages and English in a single batch.
        Falls back to original texts if translation fails or service is unavailable.
        """
        if not texts:
            return []

        s_lang = (source_lang or "en").lower().strip()
        t_lang = (target_lang or "en").lower().strip()

        if s_lang == t_lang or not self.inference_key:
            return list(texts)

        indexed_items = [(idx, t) for idx, t in enumerate(texts) if t and isinstance(t, str) and t.strip()]
        if not indexed_items:
            return list(texts)

        service_id, callback_url = self.discover_pipeline("translation", s_lang, t_lang)

        payload_task: Dict[str, Any] = {
            "taskType": "translation",
            "config": {
                "language": {
                    "sourceLanguage": s_lang,
                    "targetLanguage": t_lang,
                }
            },
        }
        if service_id:
            payload_task["config"]["serviceId"] = service_id

        payload = {
            "pipelineTasks": [payload_task],
            "inputData": {"input": [{"source": t} for _, t in indexed_items]},
        }

        headers = {
            "Authorization": self.inference_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        results = list(texts)
        try:
            resp = requests.post(callback_url, json=payload, headers=headers, timeout=self.timeout)

            if resp.status_code == 200:
                data = resp.json()
                pipeline_res = data.get("pipelineResponse", [])
                if pipeline_res and "output" in pipeline_res[0]:
                    out_list = pipeline_res[0]["output"]
                    for (orig_idx, orig_text), out_item in zip(indexed_items, out_list):
                        tgt = out_item.get("target", "").strip()
                        if tgt:
                            results[orig_idx] = tgt
                    logger.info(
                        "[BHASHINI BATCH] Translated %d/%d strings (%s->%s)",
                        len(out_list),
                        len(indexed_items),
                        s_lang,
                        t_lang,
                    )
                    return results

            logger.warning(
                "[BHASHINI BATCH FAILED] Status %d: %s. Using original texts fallback.",
                resp.status_code,
                resp.text[:200],
            )
        except requests.Timeout:
            logger.error("[BHASHINI BATCH TIMEOUT] Request timed out after %.1fs.", self.timeout)
        except Exception as exc:
            logger.error("[BHASHINI BATCH ERROR] Failed: %s", exc)

        return results

    def translate_text(
        self,
        text: str,
        source_lang: str,
        target_lang: str = "en",
    ) -> str:
        """
        Translates text between Indian languages and English using Bhashini Translation API.
        Falls back to original text if translation fails or service is unavailable.
        """
        if not text or not text.strip():
            return ""
        translated_list = self.translate_texts([text], source_lang=source_lang, target_lang=target_lang)
        return translated_list[0] if translated_list else text

    # -------------------------------------------------------------------------
    # Speech-to-Text (ASR)
    # -------------------------------------------------------------------------
    def speech_to_text(
        self,
        audio_base64: str,
        source_lang: str = "mr",
        audio_format: str = "wav",
        sampling_rate: int = 16000,
    ) -> str:
        """
        Converts fisherman spoken voice into text using Bhashini ASR.
        Validates audio content and safely handles network failures.
        """
        if not audio_base64 or not audio_base64.strip():
            raise BhashiniError("Empty or missing audio data provided for ASR.", status_code=400)

        # Sanitize data URL prefix if present (e.g. data:audio/wav;base64,...)
        clean_base64 = audio_base64.strip()
        if "," in clean_base64 and clean_base64.startswith("data:"):
            clean_base64 = clean_base64.split(",", 1)[1]

        try:
            # Validate base64 decodability
            decoded_sample = base64.b64decode(clean_base64[:100] + "==")
            if len(decoded_sample) == 0:
                raise ValueError("Decoded audio is 0 bytes")
        except Exception as err:
            raise BhashiniError(f"Malformed or invalid base64 audio string: {err}", status_code=400)

        if not self.inference_key:
            raise BhashiniError("Bhashini ASR requires BHASHINI_INFERENCE_KEY in backend environment.", status_code=503)

        s_lang = (source_lang or "mr").lower().strip()
        service_id, callback_url = self.discover_pipeline("asr", s_lang)

        payload_task: Dict[str, Any] = {
            "taskType": "asr",
            "config": {
                "language": {"sourceLanguage": s_lang},
                "audioFormat": audio_format,
                "samplingRate": sampling_rate,
            },
        }
        if service_id:
            payload_task["config"]["serviceId"] = service_id

        payload = {
            "pipelineTasks": [payload_task],
            "inputData": {"audio": [{"audioContent": clean_base64}]},
        }

        headers = {
            "Authorization": self.inference_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        try:
            resp = requests.post(callback_url, json=payload, headers=headers, timeout=self.timeout)

            if resp.status_code == 200:
                data = resp.json()
                pipeline_res = data.get("pipelineResponse", [])
                if pipeline_res and "output" in pipeline_res[0]:
                    out_list = pipeline_res[0]["output"]
                    if out_list and "source" in out_list[0]:
                        transcript = out_list[0]["source"].strip()
                        logger.info("[BHASHINI ASR] Spoken audio transcribed (%s): '%s'", s_lang, transcript)
                        return transcript

            raise BhashiniError(
                f"Bhashini ASR endpoint returned status {resp.status_code}: {resp.text[:200]}",
                status_code=resp.status_code,
            )
        except requests.Timeout:
            raise BhashiniError(f"Bhashini ASR request timed out after {self.timeout}s.", status_code=504)
        except BhashiniError:
            raise
        except Exception as exc:
            raise BhashiniError(f"Bhashini ASR unexpected failure: {exc}", status_code=500)

    # -------------------------------------------------------------------------
    # Text-to-Speech (TTS)
    # -------------------------------------------------------------------------
    def text_to_speech(
        self,
        text: str,
        target_lang: str = "mr",
        gender: str = "male",
    ) -> Optional[str]:
        """
        Converts ORCA response guidance into spoken voice audio (base64 string).
        Returns None if TTS is unavailable or fails, preserving text delivery.
        """
        if not text or not text.strip():
            return None

        if not self.inference_key:
            logger.debug("[BHASHINI] No BHASHINI_INFERENCE_KEY. Skipping TTS generation.")
            return None

        t_lang = (target_lang or "mr").lower().strip()
        service_id, callback_url = self.discover_pipeline("tts", t_lang)

        payload_task: Dict[str, Any] = {
            "taskType": "tts",
            "config": {
                "language": {"sourceLanguage": t_lang},
                "gender": gender,
            },
        }
        if service_id:
            payload_task["config"]["serviceId"] = service_id

        # Limit text length to first 300 characters for snappy fisherman speech synthesis
        clean_text = text.strip()[:400]

        payload = {
            "pipelineTasks": [payload_task],
            "inputData": {"input": [{"source": clean_text}]},
        }

        headers = {
            "Authorization": self.inference_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        try:
            resp = requests.post(callback_url, json=payload, headers=headers, timeout=self.timeout)

            if resp.status_code == 200:
                data = resp.json()
                pipeline_res = data.get("pipelineResponse", [])
                for task_res in pipeline_res:
                    if task_res.get("taskType") == "tts" and "audio" in task_res:
                        audio_list = task_res["audio"]
                        if audio_list and "audioContent" in audio_list[0]:
                            audio_content = audio_list[0]["audioContent"]
                            if audio_content:
                                logger.info("[BHASHINI TTS] Audio generated successfully for (%s).", t_lang)
                                return audio_content

            logger.warning(
                "[BHASHINI TTS FAILED] Status %d: %s. Omitting voice playback.",
                resp.status_code,
                resp.text[:200],
            )
        except Exception as exc:
            logger.warning("[BHASHINI TTS ERROR] Failed to synthesize voice: %s", exc)

        return None


# Global singleton client instance
bhashini_client = BhashiniClient()


# Convenience Functional API
def detect_user_language(text: Optional[str], default_lang: str = "en") -> Tuple[str, float]:
    return bhashini_client.detect_language(text, default_lang=default_lang)


def translate_user_query_to_english(query: Optional[str], source_lang: Optional[str] = None) -> Tuple[str, str]:
    """
    Detects language if not provided, and translates non-English queries to English.
    Returns (normalized_english_query, detected_or_provided_language).
    """
    if not query or not query.strip():
        return "", source_lang or "en"

    effective_lang = source_lang
    if not effective_lang or effective_lang == "auto":
        effective_lang, _ = detect_user_language(query)

    if effective_lang == "en":
        return query, "en"

    english_query = bhashini_client.translate_text(query, source_lang=effective_lang, target_lang="en")
    return english_query, effective_lang


def translate_response_to_language(text: str, target_lang: str) -> str:
    """Translates final ORCA English recommendation into fisherman's native language."""
    if not text or not target_lang or target_lang == "en":
        return text
    return bhashini_client.translate_text(text, source_lang="en", target_lang=target_lang)


def synthesize_voice_response(text: str, target_lang: str) -> Optional[str]:
    """Generates base64 voice audio in fisherman's language."""
    return bhashini_client.text_to_speech(text, target_lang=target_lang)


def translate_explanation_card(card: Dict[str, Any], target_lang: str) -> Dict[str, Any]:
    """
    Translates all dynamic human-readable fields of the risk explanation card to the target language
    using a single Bhashini batch call. Preserves numbers, scores, units, and enums untouched.
    """
    if not card or not isinstance(card, dict) or not target_lang or target_lang.lower().strip() == "en":
        return card

    t_lang = target_lang.lower().strip()

    items_to_translate: List[Tuple[str, str]] = []

    # 1. Decision label and subtitle
    if card.get("decision_label") and isinstance(card["decision_label"], str):
        items_to_translate.append(("decision_label", card["decision_label"]))
    if card.get("decision_subtitle") and isinstance(card["decision_subtitle"], str):
        items_to_translate.append(("decision_subtitle", card["decision_subtitle"]))

    # 2. Hazards and watch items
    if card.get("dominant_hazard") and isinstance(card["dominant_hazard"], str):
        items_to_translate.append(("dominant_hazard", card["dominant_hazard"]))
    if card.get("primary_thing_to_watch") and isinstance(card["primary_thing_to_watch"], str):
        items_to_translate.append(("primary_thing_to_watch", card["primary_thing_to_watch"]))
    if card.get("primary_thing_to_watch_reason") and isinstance(card["primary_thing_to_watch_reason"], str):
        items_to_translate.append(("primary_thing_to_watch_reason", card["primary_thing_to_watch_reason"]))

    # 3. Vessel evaluated string
    if card.get("vessel_evaluated") and isinstance(card["vessel_evaluated"], str):
        items_to_translate.append(("vessel_evaluated", card["vessel_evaluated"]))

    # 4. Action guidance
    action_g = card.get("action_guidance")
    if isinstance(action_g, dict):
        if action_g.get("headline") and isinstance(action_g["headline"], str):
            items_to_translate.append(("action_guidance.headline", action_g["headline"]))
        if action_g.get("action_text") and isinstance(action_g["action_text"], str):
            items_to_translate.append(("action_guidance.action_text", action_g["action_text"]))

    # 5. Factors
    factors = card.get("factors")
    if isinstance(factors, list):
        for idx, factor in enumerate(factors):
            if isinstance(factor, dict):
                if factor.get("name") and isinstance(factor["name"], str):
                    items_to_translate.append((f"factor.{idx}.name", factor["name"]))
                if factor.get("interpretation") and isinstance(factor["interpretation"], str):
                    items_to_translate.append((f"factor.{idx}.interpretation", factor["interpretation"]))
                if factor.get("reason") and isinstance(factor["reason"], str):
                    items_to_translate.append((f"factor.{idx}.reason", factor["reason"]))
                if factor.get("threshold_context") and isinstance(factor["threshold_context"], str):
                    items_to_translate.append((f"factor.{idx}.threshold_context", factor["threshold_context"]))
                if factor.get("status_label") and isinstance(factor["status_label"], str):
                    items_to_translate.append((f"factor.{idx}.status_label", factor["status_label"]))

    if not items_to_translate:
        return card

    raw_texts = [text for _, text in items_to_translate]
    try:
        translated_texts = bhashini_client.translate_texts(raw_texts, source_lang="en", target_lang=t_lang)

        for (key_path, _), trans_val in zip(items_to_translate, translated_texts):
            if not trans_val:
                continue
            if key_path == "decision_label":
                card["decision_label"] = trans_val
            elif key_path == "decision_subtitle":
                card["decision_subtitle"] = trans_val
            elif key_path == "dominant_hazard":
                card["dominant_hazard"] = trans_val
            elif key_path == "primary_thing_to_watch":
                card["primary_thing_to_watch"] = trans_val
            elif key_path == "primary_thing_to_watch_reason":
                card["primary_thing_to_watch_reason"] = trans_val
            elif key_path == "vessel_evaluated":
                card["vessel_evaluated"] = trans_val
            elif key_path == "action_guidance.headline":
                card["action_guidance"]["headline"] = trans_val
            elif key_path == "action_guidance.action_text":
                card["action_guidance"]["action_text"] = trans_val
            elif key_path.startswith("factor."):
                parts = key_path.split(".")
                f_idx = int(parts[1])
                f_key = parts[2]
                if f_idx < len(card.get("factors", [])):
                    card["factors"][f_idx][f_key] = trans_val
    except Exception as exc:
        logger.error("[BHASHINI] Failed to translate explanation card (%s): %s", t_lang, exc)

    card["language"] = t_lang
    return card

