"""
ORCA Marine Intelligence - Live HTTP Endpoints & E2E Flow Test
==============================================================
Validates:
1. Language API endpoints (/api/language/detect, /translate, /text-to-speech, /speech-to-text)
2. English E2E ORCA Assessment flow (lat 19.72, lon 72.70, boat 5.0m)
3. Marathi E2E ORCA Assessment flow ('उद्या मासेमारीला जाणं सुरक्षित आहे का?')
4. Voice E2E Audio Pipeline
"""

import base64
import json
import os
import sys
import time
import requests

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_URL = "http://127.0.0.1:8000"


def test_language_endpoints():
    print("\n" + "=" * 70)
    print("STEP 6: TESTING LANGUAGE HTTP ENDPOINTS")
    print("=" * 70)

    # 1. POST /api/language/detect
    detect_payload = {"text": "उद्या मासेमारीला जाणं सुरक्षित आहे का?"}
    r = requests.post(f"{BASE_URL}/api/language/detect", json=detect_payload, timeout=10)
    print(f"POST /api/language/detect: HTTP {r.status_code} -> {r.json()}")
    assert r.status_code == 200
    assert r.json()["language"] == "mr"

    # 2. POST /api/language/translate
    trans_payload = {
        "text": "उद्या मासेमारीला जाणं सुरक्षित आहे का?",
        "source_language": "mr",
        "target_language": "en",
    }
    r = requests.post(f"{BASE_URL}/api/language/translate", json=trans_payload, timeout=15)
    print(f"POST /api/language/translate: HTTP {r.status_code} -> {r.json()}")
    assert r.status_code == 200
    assert "safe" in r.json()["translated_text"].lower() or "fish" in r.json()["translated_text"].lower()

    # 3. POST /api/language/text-to-speech
    tts_payload = {
        "text": "मासेमारीला जाणे सुरक्षित आहे.",
        "language": "mr",
        "gender": "male",
    }
    r = requests.post(f"{BASE_URL}/api/language/text-to-speech", json=tts_payload, timeout=20)
    audio_b64 = r.json().get("audio_base64")
    print(f"POST /api/language/text-to-speech: HTTP {r.status_code}, Status: {r.json().get('status')}, Audio length: {len(audio_b64) if audio_b64 else 0} bytes")
    assert r.status_code == 200
    assert audio_b64 is not None and len(audio_b64) > 1000

    # 4. POST /api/language/speech-to-text
    asr_payload = {
        "audio_base64": audio_b64,
        "language": "mr",
        "audio_format": "wav",
        "sampling_rate": 16000,
    }
    r = requests.post(f"{BASE_URL}/api/language/speech-to-text", json=asr_payload, timeout=20)
    print(f"POST /api/language/speech-to-text: HTTP {r.status_code} -> {r.json()}")
    assert r.status_code == 200
    print("All Step 6 Language Endpoints: PASS [LIVE]")
    return audio_b64


def test_english_assessment():
    print("\n" + "=" * 70)
    print("STEP 7: COMPLETE ORCA TEXT FLOW (ENGLISH)")
    print("=" * 70)
    payload = {
        "query": "Is it safe for me to go fishing tomorrow?",
        "latitude": 19.72,
        "longitude": 72.70,
        "date": "2026-09-11",
        "boat_width_m": 5.0,
        "session_id": "sess-live-test-en",
        "language": "en",
        "generate_audio": False,
    }
    t0 = time.time()
    r = requests.post(f"{BASE_URL}/api/orca/assess", json=payload, timeout=60)
    elapsed = (time.time() - t0) * 1000
    print(f"HTTP Status: {r.status_code} in {elapsed:.2f} ms")
    assert r.status_code == 200
    data = r.json()

    # Verify specialists & risk engine
    print(f"Decision / Action:      {data.get('final_action')}")
    print(f"Risk Score:             {data.get('risk_score')}")
    print(f"Primary Hazard:         {data.get('primary_hazard')}")
    print(f"Intent:                 {data.get('intent')}")
    print(f"Specialists in response: {[k for k in ['pfz', 'weather', 'svas', 'ocean'] if k in data]}")
    print(f"Recommendation:         {data.get('recommendation')[:120]}...")
    
    # Confirm authoritative deterministic decision
    assert data.get("final_action") in ["GO", "CAUTION", "DON'T GO"]
    assert "risk_score" in data
    assert "recommendation" in data
    print("Complete English Text Flow: PASS [LIVE]")
    return data


def test_marathi_assessment():
    print("\n" + "=" * 70)
    print("STEP 8: COMPLETE MARATHI TEXT FLOW")
    print("=" * 70)
    marathi_query = "उद्या मासेमारीला जाणं सुरक्षित आहे का?"
    payload = {
        "query": marathi_query,
        "latitude": 19.72,
        "longitude": 72.70,
        "date": "2026-09-11",
        "boat_width_m": 5.0,
        "session_id": "sess-live-test-mr",
        "language": "mr",
        "generate_audio": True,
    }
    t0 = time.time()
    r = requests.post(f"{BASE_URL}/api/orca/assess", json=payload, timeout=60)
    elapsed = (time.time() - t0) * 1000
    print(f"HTTP Status: {r.status_code} in {elapsed:.2f} ms")
    assert r.status_code == 200
    data = r.json()

    print(f"Raw Query:              '{data.get('raw_query')}'")
    print(f"Normalized English:     '{data.get('english_query')}'")
    print(f"Language:               {data.get('language')}")
    print(f"Decision / Action:      {data.get('final_action')}")
    print(f"Risk Score:             {data.get('risk_score')}")
    print(f"Original English Rec:   {data.get('original_recommendation', '')[:100]}...")
    print(f"Marathi Recommendation: {data.get('recommendation', '')[:120]}...")
    audio_present = bool(data.get("audio_base64"))
    audio_len = len(data.get("audio_base64") or "")
    print(f"TTS Audio Generated:    {audio_present} ({audio_len} base64 chars)")

    # Assertions
    assert data.get("language") == "mr"
    assert data.get("final_action") in ["GO", "CAUTION", "DON'T GO"]
    assert data.get("recommendation") != data.get("original_recommendation")
    assert audio_present and audio_len > 1000
    print("Complete Marathi Text + Translation + TTS Flow: PASS [LIVE]")
    return data


def test_voice_pipeline(sample_audio_b64: str):
    print("\n" + "=" * 70)
    print("STEP 9: COMPLETE VOICE FLOW (ASR -> ORCA -> RISK -> TTS)")
    print("=" * 70)

    # 1. Send fisherman spoken audio to ASR
    asr_res = requests.post(
        f"{BASE_URL}/api/language/speech-to-text",
        json={"audio_base64": sample_audio_b64, "language": "mr"},
        timeout=25,
    )
    assert asr_res.status_code == 200
    transcript = asr_res.json().get("transcript", "")
    print(f"1. Spoken Audio Transcribed via Bhashini ASR: '{transcript}'")
    assert transcript, "ASR returned empty transcript"

    # 2. Feed transcript directly into ORCA Assessment
    assess_res = requests.post(
        f"{BASE_URL}/api/orca/assess",
        json={
            "query": transcript,
            "latitude": 19.72,
            "longitude": 72.70,
            "date": "2026-09-11",
            "boat_width_m": 5.0,
            "language": "mr",
            "generate_audio": True,
        },
        timeout=60,
    )
    assert assess_res.status_code == 200
    data = assess_res.json()
    print(f"2. ORCA Decision:            {data.get('final_action')}")
    print(f"3. Risk Score:               {data.get('risk_score')}")
    print(f"4. Translated Advice (MR):   {data.get('recommendation', '')[:100]}...")
    out_audio = data.get("audio_base64")
    print(f"5. Generated Response Audio: {len(out_audio) if out_audio else 0} base64 chars")
    assert out_audio is not None and len(out_audio) > 1000

    print("Backend voice pipeline verified; physical microphone UI not verified.")
    print("Complete Voice Flow: PASS [LIVE]")


if __name__ == "__main__":
    audio_b64 = test_language_endpoints()
    test_english_assessment()
    test_marathi_assessment()
    test_voice_pipeline(audio_b64)
    print("\n" + "=" * 70)
    print("ALL LIVE ENDPOINTS AND FLOWS VERIFIED SUCCESSFULLY!")
    print("=" * 70)
