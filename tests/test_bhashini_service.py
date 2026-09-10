"""
Unit and Integration Tests for Bhashini Multilingual & Voice Integration
------------------------------------------------------------------------
Validates:
1. English query pass-through
2. Marathi -> English translation
3. Hindi -> English translation
4. English -> Marathi translation
5. Language detection (API & Unicode heuristic fallbacks)
6. Speech -> text (valid audio, empty audio, malformed audio)
7. Text -> speech (TTS generation, format validation)
8. Invalid/unsupported language handling
9. Empty text handling
10. Invalid audio handling
11. Bhashini timeout resilience
12. Upstream 500 / error fallback
13. Invalid/missing credentials graceful handling
14. Existing ORCA assessment in regional language
15. Multi-turn conversation in regional language
16. Modular language endpoints (/api/language/*)
"""

import base64
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _root not in sys.path:
    sys.path.insert(0, _root)

from fastapi.testclient import TestClient
from api.main import app
from services.bhashini.client import (
    BhashiniClient,
    SUPPORTED_LANGUAGES,
    detect_language,
    translate_text,
    speech_to_text,
    text_to_speech,
)


class TestBhashiniCoreService(unittest.TestCase):
    """Unit tests for the Bhashini service module."""

    def setUp(self):
        self.client = BhashiniClient(udyat_key="", inference_key="")

    # 1. English query pass-through
    def test_english_passthrough(self):
        res = self.client.translate_text("Is it safe today?", "en", "en")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["translated_text"], "Is it safe today?")
        self.assertEqual(res["method"], "passthrough")

    # 2. Marathi -> English translation
    def test_marathi_to_english(self):
        text = "उद्या मासेमारीला जाणं सुरक्षित आहे का?"
        res = self.client.translate_text(text, "mr", "en")
        self.assertIn(res["status"], ("success", "fallback"))
        self.assertIn("safe", res["translated_text"].lower())

    # 3. Hindi -> English translation
    def test_hindi_to_english(self):
        text = "क्या कल मछली पकड़ना सुरक्षित है?"
        res = self.client.translate_text(text, "hi", "en")
        self.assertIn(res["status"], ("success", "fallback"))
        self.assertIn("safe", res["translated_text"].lower())

    # 4. English -> Marathi translation
    def test_english_to_marathi(self):
        text = "Safe to go fishing"
        res = self.client.translate_text(text, "en", "mr")
        self.assertIn(res["status"], ("success", "fallback"))
        self.assertTrue(len(res["translated_text"]) > 0)

    # 5. Language detection (heuristic & script analysis)
    def test_language_detection(self):
        # Marathi
        mr_res = self.client.detect_language("उद्या मासेमारीला जाणं सुरक्षित आहे का?")
        self.assertEqual(mr_res["status"], "success")
        self.assertEqual(mr_res["language"], "mr")

        # Hindi
        hi_res = self.client.detect_language("क्या कल मछली पकड़ना सुरक्षित है?")
        self.assertEqual(hi_res["status"], "success")
        self.assertEqual(hi_res["language"], "hi")

        # Tamil
        ta_res = self.client.detect_language("மீன்பிடிக்க செல்வது பாதுகாப்பானதா?")
        self.assertEqual(ta_res["status"], "success")
        self.assertEqual(ta_res["language"], "ta")

        # Gujarati
        gu_res = self.client.detect_language("કાલે માછીમારી કરવી સલામત છે?")
        self.assertEqual(gu_res["status"], "success")
        self.assertEqual(gu_res["language"], "gu")

        # English
        en_res = self.client.detect_language("Is it safe for fishing tomorrow?")
        self.assertEqual(en_res["status"], "success")
        self.assertEqual(en_res["language"], "en")

    # 6. Speech -> text validation
    def test_speech_to_text_valid_dummy(self):
        # Create a valid 44-byte WAV header in base64
        dummy_wav = b"RIFF,\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x40\x1f\x00\x00\x40\x1f\x00\x00\x01\x00\x08\x00data\x00\x00\x00\x00"
        b64_audio = base64.b64encode(dummy_wav).decode("ascii")
        res = self.client.speech_to_text(b64_audio, language="mr")
        self.assertEqual(res["status"], "success")
        self.assertTrue(len(res["transcript"]) > 0)

    # 7. Text -> speech validation
    def test_text_to_speech_generation(self):
        res = self.client.text_to_speech("मासेमारीसाठी परिस्थिती सुरक्षित आहे.", "mr")
        self.assertEqual(res["status"], "success")
        self.assertIsNotNone(res["audio_base64"])
        # Should be valid base64
        raw = base64.b64decode(res["audio_base64"])
        self.assertTrue(len(raw) >= 44)

    # 8. Invalid / empty text handling
    def test_empty_text_handling(self):
        res_trans = self.client.translate_text("   ", "mr", "en")
        self.assertEqual(res_trans["status"], "error")

        res_det = self.client.detect_language("")
        self.assertEqual(res_det["status"], "error")

        res_tts = self.client.text_to_speech("", "mr")
        self.assertEqual(res_tts["status"], "error")

    # 9. Invalid audio handling
    def test_invalid_audio_handling(self):
        # Empty string
        res1 = self.client.speech_to_text("")
        self.assertEqual(res1["status"], "error")

        # Corrupt non-base64
        res2 = self.client.speech_to_text("!!!not-base-64!!!")
        self.assertEqual(res2["status"], "error")

        # Too small payload (< 32 bytes)
        tiny_b64 = base64.b64encode(b"short").decode("ascii")
        res3 = self.client.speech_to_text(tiny_b64)
        self.assertEqual(res3["status"], "error")

    # 10. Timeout resilience test
    @patch("requests.post")
    def test_timeout_resilience(self, mock_post):
        mock_post.side_effect = Exception("Connection timed out after 12.0s")
        client = BhashiniClient(inference_key="test-key")
        res = client.translate_text("Is it safe?", "en", "mr")
        # Should gracefully fall back without throwing unhandled exception
        self.assertEqual(res["status"], "fallback")
        self.assertTrue(len(res["translated_text"]) > 0)

    # 11. Upstream 500 error resilience
    @patch("requests.post")
    def test_upstream_500_resilience(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 502
        mock_resp.text = "Bad Gateway"
        mock_post.return_value = mock_resp

        client = BhashiniClient(inference_key="test-key")
        res = client.translate_text("Is it safe?", "en", "mr")
        self.assertEqual(res["status"], "fallback")


class TestFastAPIBhashiniIntegration(unittest.TestCase):
    """Integration tests for FastAPI endpoints with Bhashini layer."""

    def setUp(self):
        self.api = TestClient(app)

    # 12. Health check includes Bhashini information
    def test_health_check(self):
        res = self.api.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("bhashini_configured", data)
        self.assertIn("supported_languages", data)
        self.assertIn("mr", data["supported_languages"])

    # 13. Marathi Natural Language Query Assessment
    def test_marathi_assessment_flow(self):
        payload = {
            "query": "उद्या मासेमारीला जाणं सुरक्षित आहे का?",
            "latitude": 19.72,
            "longitude": 72.70,
            "date": "2026-09-08",
            "boat_width_m": 5.0,
            "language": "mr",
            "enable_tts": True,
        }
        res = self.api.post("/api/orca/assess", json=payload)
        self.assertEqual(res.status_code, 200, f"API failed: {res.text}")
        data = res.json()

        # Language metadata
        self.assertEqual(data.get("language"), "mr")
        self.assertEqual(data.get("language_name"), "Marathi")
        self.assertEqual(data.get("original_query"), "उद्या मासेमारीला जाणं सुरक्षित आहे का?")
        self.assertIn("safe", data.get("translated_query", "").lower())

        # Response and TTS
        self.assertTrue(len(data.get("recommendation", "")) > 0)
        self.assertIsNotNone(data.get("audio_base64"))
        self.assertEqual(data.get("audio_format"), "wav")

        # Deterministic Risk Engine check
        self.assertIn("risk", data)
        self.assertIn(data["risk"].get("status"), ("SAFE", "CAUTION", "DONT_GO"))

    # 14. Hindi Assessment Flow
    def test_hindi_assessment_flow(self):
        payload = {
            "query": "क्या कल मछली पकड़ना सुरक्षित है?",
            "latitude": 19.72,
            "longitude": 72.70,
            "date": "2026-09-08",
            "boat_width_m": 5.0,
            "language": "hi",
            "enable_tts": True,
        }
        res = self.api.post("/api/orca/assess", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("language"), "hi")
        self.assertIn("risk", data)

    # 15. Voice audio input flow (Speech-to-Text -> Assessment)
    def test_voice_audio_input_flow(self):
        dummy_wav = b"RIFF,\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x40\x1f\x00\x00\x40\x1f\x00\x00\x01\x00\x08\x00data\x00\x00\x00\x00"
        b64_audio = base64.b64encode(dummy_wav).decode("ascii")

        payload = {
            "audio_base64": b64_audio,
            "latitude": 19.72,
            "longitude": 72.70,
            "date": "2026-09-08",
            "boat_width_m": 5.0,
            "language": "mr",
            "enable_tts": True,
        }
        res = self.api.post("/api/orca/assess", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("language"), "mr")
        self.assertTrue(len(data.get("original_query", "")) > 0)

    # 16. Multi-turn conversation in Marathi
    def test_marathi_multiturn_conversation(self):
        session_id = "test-marathi-multiturn-101"

        # Turn 1: Ask for 2nd nearest PFZ in Marathi
        payload1 = {
            "query": "माझ्या स्थानावरून दुसरे पीएफझेड सांगा",
            "latitude": 19.72,
            "longitude": 72.70,
            "date": "2026-09-08",
            "boat_width_m": 5.0,
            "session_id": session_id,
            "language": "mr",
        }
        res1 = self.api.post("/api/orca/assess", json=payload1)
        self.assertEqual(res1.status_code, 200)
        data1 = res1.json()
        self.assertEqual(data1.get("entity_rank"), 2)

        # Turn 2: Map query referring to previous turn in Marathi
        payload2 = {
            "query": "नकाशात दाखवा",
            "latitude": 19.72,
            "longitude": 72.70,
            "date": "2026-09-08",
            "boat_width_m": 5.0,
            "session_id": session_id,
            "language": "mr",
        }
        res2 = self.api.post("/api/orca/assess", json=payload2)
        self.assertEqual(res2.status_code, 200)
        data2 = res2.json()
        self.assertIsNotNone(data2.get("ui_action"))
        self.assertEqual(data2.get("ui_action", {}).get("type"), "show_on_map")

    # 17. Modular Language Endpoints
    def test_modular_language_endpoints(self):
        # Language Detect
        res_det = self.api.post("/api/language/detect", json={"text": "मासेमारी सुरक्षित आहे का?"})
        self.assertEqual(res_det.status_code, 200)
        self.assertEqual(res_det.json().get("language"), "mr")

        # Language Translate
        res_trans = self.api.post(
            "/api/language/translate",
            json={
                "text": "उद्या मासेमारीला जाणं सुरक्षित आहे का?",
                "source_language": "mr",
                "target_language": "en",
            },
        )
        self.assertEqual(res_trans.status_code, 200)
        self.assertIn("safe", res_trans.json().get("translated_text", "").lower())

        # Text to Speech
        res_tts = self.api.post(
            "/api/language/text-to-speech",
            json={"text": "मासेमारी सुरक्षित आहे.", "language": "mr"},
        )
        self.assertEqual(res_tts.status_code, 200)
        self.assertIsNotNone(res_tts.json().get("audio_base64"))


if __name__ == "__main__":
    unittest.main()
