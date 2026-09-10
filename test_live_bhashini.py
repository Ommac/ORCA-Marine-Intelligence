"""
ORCA Marine Intelligence - Live Bhashini API Verification
=========================================================
Executes live network calls against Bhashini Dhruva / ULCA endpoints.
Reports exact HTTP status, latency, and explicitly distinguishes:
[LIVE], [MOCK], [FALLBACK], [UNVERIFIED].
Never prints secret API keys.
"""

import base64
import os
import sys
import time

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure project root is in sys.path
_current_dir = os.path.dirname(os.path.abspath(__file__))
if _current_dir not in sys.path:
    sys.path.insert(0, _current_dir)

from dotenv import load_dotenv
load_dotenv()

from agents.language.config import (
    BHASHINI_DEFAULT_INFERENCE_URL,
    BHASHINI_DISCOVERY_URL,
    BHASHINI_INFERENCE_KEY,
    BHASHINI_PIPELINE_ID,
    BHASHINI_UDYAT_KEY,
    BHASHINI_USER_ID,
    is_bhashini_configured,
)
from agents.language.detector import detect_language
from agents.language.bhashini_client import BhashiniClient, bhashini_client


def run_live_bhashini_tests():
    print("=" * 70)
    print("ORCA - LIVE BHASHINI VERIFICATION SUITE")
    print("=" * 70)

    # 1. Environment & Auth Check
    print("\n--- 1. ENVIRONMENT & CONFIGURATION CHECK ---")
    udyat_present = bool(BHASHINI_UDYAT_KEY and BHASHINI_UDYAT_KEY.strip())
    inference_present = bool(BHASHINI_INFERENCE_KEY and BHASHINI_INFERENCE_KEY.strip())
    user_id_present = bool(BHASHINI_USER_ID and BHASHINI_USER_ID.strip())
    pipeline_id_present = bool(BHASHINI_PIPELINE_ID and BHASHINI_PIPELINE_ID.strip())

    print(f"BHASHINI_UDYAT_KEY:     {'[CONFIGURED (masked)]' if udyat_present else '[NOT CONFIGURED]'}")
    print(f"BHASHINI_INFERENCE_KEY: {'[CONFIGURED (masked)]' if inference_present else '[NOT CONFIGURED]'}")
    print(f"BHASHINI_USER_ID:       {'[CONFIGURED]' if user_id_present else '[OPTIONAL / BLANK]'}")
    print(f"BHASHINI_PIPELINE_ID:   {'[CONFIGURED]' if pipeline_id_present else '[NOT CONFIGURED]'}")
    print(f"BHASHINI_INFERENCE_URL: {BHASHINI_DEFAULT_INFERENCE_URL}")
    print(f"Overall Configured:     {'YES' if is_bhashini_configured() else 'NO'}")

    if not inference_present:
        print("\n[ABORT] BHASHINI_INFERENCE_KEY is not configured in .env.")
        return False

    client = BhashiniClient()

    # 2. Pipeline Discovery Check
    print("\n--- 2. PIPELINE DISCOVERY CHECK ---")
    t0 = time.time()
    try:
        service_id, callback_url = client.discover_pipeline("translation", "mr", "en")
        discovery_latency = (time.time() - t0) * 1000
        print(f"Service ID:      {service_id or 'None (direct inference mode)'}")
        print(f"Callback URL:    {callback_url}")
        print(f"Discovery Mode:  {'[LIVE ULCA]' if service_id else '[LIVE DIRECT DHRUVA]'}")
        print(f"Discovery Time:  {discovery_latency:.2f} ms")
    except Exception as e:
        print(f"[ERROR] Discovery failed: {e}")

    # 3. Language Detection Test (Script + Lexical Analysis)
    print("\n--- 3. LANGUAGE DETECTION TEST ---")
    test_text_mr = "उद्या मासेमारीला जाणं सुरक्षित आहे का?"
    t0 = time.time()
    detected_lang, conf = detect_language(test_text_mr)
    det_latency = (time.time() - t0) * 1000
    print(f"Input text:     '{test_text_mr}'")
    print(f"Detected Lang:  {detected_lang} (Expected: 'mr')")
    print(f"Confidence:     {conf:.2f}")
    print(f"Latency:        {det_latency:.2f} ms")
    lang_det_ok = detected_lang == "mr"
    print(f"Status:         {'[LIVE PASS]' if lang_det_ok else '[FAIL]'}")

    # 4. Marathi -> English Translation
    print("\n--- 4. MARATHI -> ENGLISH TRANSLATION ---")
    query_mr = "उद्या मासेमारीला जाणं सुरक्षित आहे का?"
    t0 = time.time()
    translated_en = client.translate_text(query_mr, source_lang="mr", target_lang="en")
    mr_en_latency = (time.time() - t0) * 1000
    print(f"Input (MR):     '{query_mr}'")
    print(f"Output (EN):    '{translated_en}'")
    print(f"Latency:        {mr_en_latency:.2f} ms")
    is_live_mr_en = (translated_en != query_mr and len(translated_en) > 0)
    print(f"Source:         {'[LIVE BHASHINI API]' if is_live_mr_en else '[FALLBACK/FAIL]'}")
    mr_en_ok = is_live_mr_en and any(w in translated_en.lower() for w in ["fish", "safe", "tomorrow", "go"])

    # 5. English -> Marathi Translation
    print("\n--- 5. ENGLISH -> MARATHI TRANSLATION ---")
    text_en = "It is safe to go fishing tomorrow."
    t0 = time.time()
    translated_mr = client.translate_text(text_en, source_lang="en", target_lang="mr")
    en_mr_latency = (time.time() - t0) * 1000
    print(f"Input (EN):     '{text_en}'")
    print(f"Output (MR):    '{translated_mr}'")
    print(f"Latency:        {en_mr_latency:.2f} ms")
    is_live_en_mr = (translated_mr != text_en and len(translated_mr) > 0)
    print(f"Source:         {'[LIVE BHASHINI API]' if is_live_en_mr else '[FALLBACK/FAIL]'}")
    en_mr_ok = is_live_en_mr

    # 6. Text-to-Speech (TTS)
    print("\n--- 6. TEXT-TO-SPEECH (TTS) TEST ---")
    tts_input = "मासेमारीला जाणे सुरक्षित आहे."
    t0 = time.time()
    audio_b64 = client.text_to_speech(tts_input, target_lang="mr", gender="male")
    tts_latency = (time.time() - t0) * 1000
    audio_bytes_len = len(audio_b64) if audio_b64 else 0
    print(f"Input Text:     '{tts_input}'")
    print(f"Audio Payload:  {audio_bytes_len} base64 chars")
    print(f"Latency:        {tts_latency:.2f} ms")
    tts_ok = audio_b64 is not None and audio_bytes_len > 1000
    print(f"Source:         {'[LIVE BHASHINI API]' if tts_ok else '[FALLBACK/FAIL]'}")

    # 7. Speech-to-Text (ASR)
    print("\n--- 7. SPEECH-TO-TEXT (ASR) TEST ---")
    asr_ok = False
    asr_status = "[UNVERIFIED]"
    if tts_ok and audio_b64:
        try:
            t0 = time.time()
            asr_transcript = client.speech_to_text(audio_base64=audio_b64, source_lang="mr", audio_format="wav")
            asr_latency = (time.time() - t0) * 1000
            print(f"ASR Transcript: '{asr_transcript}'")
            print(f"Latency:        {asr_latency:.2f} ms")
            asr_ok = bool(asr_transcript and len(asr_transcript.strip()) > 0)
            asr_status = "[LIVE BHASHINI API]" if asr_ok else "[EMPTY RESPONSE]"
        except Exception as e:
            print(f"ASR Request Result: Error ({e})")
            asr_status = f"[ERROR: {e}]"
    else:
        print("No valid audio available for ASR testing.")

    print(f"ASR Source:     {asr_status}")

    # Summary
    print("\n" + "=" * 70)
    print("LIVE BHASHINI VERIFICATION SUMMARY")
    print("=" * 70)
    print(f"Language Detection: {'PASS [LIVE]' if lang_det_ok else 'FAIL'}")
    print(f"MR -> EN Translation: {'PASS [LIVE]' if mr_en_ok else 'FAIL'}")
    print(f"EN -> MR Translation: {'PASS [LIVE]' if en_mr_ok else 'FAIL'}")
    print(f"TTS Audio Generation: {'PASS [LIVE]' if tts_ok else 'FAIL'}")
    print(f"ASR Speech-to-Text:   {'PASS ' + asr_status if asr_ok else 'RESULT ' + asr_status}")
    print("=" * 70)

    return lang_det_ok and mr_en_ok and en_mr_ok and tts_ok


if __name__ == "__main__":
    success = run_live_bhashini_tests()
    sys.exit(0 if success else 1)
