"""
Live Bhashini API Verification Suite
-------------------------------------
Executes live network calls against Bhashini Dhruva / ULCA endpoints
only if valid credentials are present in the environment (.env).
If credentials are not present, tests are skipped with a clear diagnostic message.
"""

import os
import sys
import unittest

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

# Ensure root workspace is in sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
_root_dir = os.path.abspath(os.path.join(_current_dir, ".."))
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

from agents.language import (
    BHASHINI_INFERENCE_KEY,
    BHASHINI_UDYAT_KEY,
    bhashini_client,
    is_bhashini_configured,
)


class TestBhashiniLiveIntegration(unittest.TestCase):
    """Live Bhashini network tests."""

    def setUp(self):
        if not is_bhashini_configured():
            self.skipTest(
                "Skipping Live Bhashini tests: BHASHINI_INFERENCE_KEY or BHASHINI_UDYAT_KEY not configured in .env."
            )

    def test_live_01_translation_marathi_to_english(self):
        query_mr = "उद्या मासेमारीला जाणं सुरक्षित आहे का?"
        english = bhashini_client.translate_text(query_mr, source_lang="mr", target_lang="en")
        print(f"\n[LIVE TEST] Marathi Input: {query_mr}")
        print(f"[LIVE TEST] English Output: {english}")
        self.assertIsNotNone(english)
        self.assertNotEqual(english, "")
        # Should contain fishing or safe
        lower = english.lower()
        self.assertTrue("safe" in lower or "fish" in lower or "tomorrow" in lower)

    def test_live_02_translation_english_to_marathi(self):
        text_en = "It is safe to go fishing tomorrow."
        marathi = bhashini_client.translate_text(text_en, source_lang="en", target_lang="mr")
        print(f"\n[LIVE TEST] English Input: {text_en}")
        print(f"[LIVE TEST] Marathi Output: {marathi}")
        self.assertIsNotNone(marathi)
        self.assertNotEqual(marathi, "")

    def test_live_03_tts_generation(self):
        marathi_text = "मासेमारीला जाणे सुरक्षित आहे."
        audio_b64 = bhashini_client.text_to_speech(marathi_text, target_lang="mr")
        print(f"\n[LIVE TEST] TTS Generated Audio Length: {len(audio_b64) if audio_b64 else 0} bytes")
        self.assertIsNotNone(audio_b64)
        self.assertGreater(len(audio_b64), 100)


if __name__ == "__main__":
    unittest.main(verbosity=2)
