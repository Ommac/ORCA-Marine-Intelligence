"""
ORCA Marine Intelligence - Complete End-to-End Validation Suite
--------------------------------------------------------------
Tests all required flows from the user specification:
1. English safety query
2. Native-language / Bhashini query
3. Location selection -> assessment
4. PFZ selection -> assessment
5. Voice input (ASR) -> ORCA response
6. ORCA response -> voice playback (TTS)
7. Deterministic Risk Engine + Specialist Agents
8. CORS headers verification
"""

import sys
import base64
import requests
import json
import time

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

BASE_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:8081"

test_results = {}

def report(name, passed, details=""):
    test_results[name] = passed
    status_str = "PASS" if passed else "FAIL"
    print(f"[{status_str}] {name}: {details}")

print("=" * 80)
print("  ORCA MARINE INTELLIGENCE - FULL SYSTEM VALIDATION")
print("=" * 80)

# ---------------------------------------------------------------------------
# Test 1: Backend Health & Service Metadata
# ---------------------------------------------------------------------------
try:
    r = requests.get(f"{BASE_URL}/health", timeout=10)
    data = r.json()
    bhashini_ok = data.get("bhashini_configured") is True
    report("Backend Health", r.status_code == 200 and bhashini_ok, f"Status: {data.get('status')}, Bhashini: {bhashini_ok}")
except Exception as e:
    report("Backend Health", False, str(e))

# ---------------------------------------------------------------------------
# Test 2: CORS Header Verification for Expo Frontend
# ---------------------------------------------------------------------------
try:
    headers = {
        "Origin": "http://localhost:8081",
        "Access-Control-Request-Method": "POST",
    }
    r = requests.options(f"{BASE_URL}/api/orca/assess", headers=headers, timeout=10)
    cors_origin = r.headers.get("access-control-allow-origin")
    cors_cred = r.headers.get("access-control-allow-credentials")
    cors_passed = cors_origin == "http://localhost:8081" and cors_cred == "true"
    report("CORS Configuration", cors_passed, f"Origin: {cors_origin}, Credentials: {cors_cred}")
except Exception as e:
    report("CORS Configuration", False, str(e))

# ---------------------------------------------------------------------------
# Test 3: Flow 1 - English Safety Query
# ---------------------------------------------------------------------------
try:
    payload = {
        "query": "Is it safe to go fishing tomorrow near Palghar?",
        "latitude": 19.72,
        "longitude": 72.70,
        "date": "2026-09-12",
        "boat_width_m": 5.0,
        "language": "en"
    }
    r = requests.post(f"{BASE_URL}/api/orca/assess", json=payload, timeout=60)
    data = r.json()
    risk = data.get("risk", {})
    rec = data.get("recommendation", "")
    passed = r.status_code == 200 and risk.get("status") is not None and len(rec) > 20
    report("Flow 1: English Safety Query", passed, f"Risk Status: {risk.get('status')}, Score: {risk.get('risk_score')}/100, Rec: '{rec[:60]}...'")
except Exception as e:
    report("Flow 1: English Safety Query", False, str(e))

# ---------------------------------------------------------------------------
# Test 4: Flow 2 - Native-Language / Bhashini Query (Marathi)
# ---------------------------------------------------------------------------
try:
    payload = {
        "query": "उद्या मासेमारीसाठी जाणे सुरक्षित आहे का?",
        "latitude": 19.72,
        "longitude": 72.70,
        "date": "2026-09-12",
        "boat_width_m": 5.0,
        "language": "mr"
    }
    r = requests.post(f"{BASE_URL}/api/orca/assess", json=payload, timeout=60)
    data = r.json()
    lang = data.get("language")
    mr_rec = data.get("recommendation", "")
    orig_rec = data.get("original_recommendation", "")
    passed = r.status_code == 200 and lang == "mr" and len(mr_rec) > 20
    report("Flow 2: Native-Language Query (Marathi)", passed, f"Language: {lang}, MR Rec: '{mr_rec[:60]}...'")
except Exception as e:
    report("Flow 2: Native-Language Query (Marathi)", False, str(e))

# ---------------------------------------------------------------------------
# Test 5: Flow 3 - Location Selection -> Assessment (Ratnagiri)
# ---------------------------------------------------------------------------
try:
    payload = {
        "query": "Assess marine conditions for Ratnagiri",
        "latitude": 16.99,
        "longitude": 73.29,
        "date": "2026-09-12",
        "boat_width_m": 6.5,
        "language": "en"
    }
    r = requests.post(f"{BASE_URL}/api/orca/assess", json=payload, timeout=60)
    data = r.json()
    marine = data.get("marine_weather", {})
    svas = data.get("svas", {})
    passed = r.status_code == 200 and marine.get("status") in ["success", "partial"]
    report("Flow 3: Location Selection -> Assessment", passed, f"Marine: {marine.get('status')}, SVAS: {svas.get('status')}")
except Exception as e:
    report("Flow 3: Location Selection -> Assessment", False, str(e))

# ---------------------------------------------------------------------------
# Test 6: Flow 4 - PFZ Selection -> Assessment
# ---------------------------------------------------------------------------
try:
    payload = {
        "query": "Where is the nearest fishing zone?",
        "latitude": 19.72,
        "longitude": 72.70,
        "date": "2026-09-12",
        "boat_width_m": 5.0,
        "language": "en"
    }
    r = requests.post(f"{BASE_URL}/api/orca/assess", json=payload, timeout=60)
    data = r.json()
    top_pfz = data.get("top_pfz") or []
    intent = data.get("intent")
    passed = r.status_code == 200 and len(top_pfz) > 0 and intent == "pfz_query"
    candidate = top_pfz[0] if top_pfz else {}
    report("Flow 4: PFZ Selection -> Assessment", passed, f"Intent: {intent}, Candidates: {len(top_pfz)}, 1st: {candidate.get('distance_km')}km {candidate.get('direction')}")
except Exception as e:
    report("Flow 4: PFZ Selection -> Assessment", False, str(e))

# ---------------------------------------------------------------------------
# Test 7: Flow 5 - Voice Input (ASR) -> Response
# ---------------------------------------------------------------------------
try:
    # 1. Synthesize sample audio for "मराठी"
    tts_payload = {"text": "मासेमारीला जाणे सुरक्षित आहे", "language": "mr"}
    tts_res = requests.post(f"{BASE_URL}/api/language/text-to-speech", json=tts_payload, timeout=30)
    audio_b64 = tts_res.json().get("audio_base64")
    
    # 2. Transcribe using Bhashini ASR
    asr_payload = {"audio_base64": audio_b64, "language": "mr"}
    asr_res = requests.post(f"{BASE_URL}/api/language/speech-to-text", json=asr_payload, timeout=30)
    transcript = asr_res.json().get("transcript", "")
    
    # 3. Query ORCA with transcribed text
    query_payload = {
        "query": transcript or "मासेमारीला जाणे सुरक्षित आहे",
        "latitude": 19.72,
        "longitude": 72.70,
        "date": "2026-09-12",
        "boat_width_m": 5.0,
        "language": "mr"
    }
    q_res = requests.post(f"{BASE_URL}/api/orca/assess", json=query_payload, timeout=45)
    q_data = q_res.json()
    passed = bool(transcript) and q_res.status_code == 200
    report("Flow 5: Voice Input (ASR) -> ORCA Response", passed, f"Transcript: '{transcript}', Response Rec: '{q_data.get('recommendation', '')[:50]}...'")
except Exception as e:
    report("Flow 5: Voice Input (ASR) -> ORCA Response", False, str(e))

# ---------------------------------------------------------------------------
# Test 8: Flow 6 - ORCA Response -> Voice Playback (TTS)
# ---------------------------------------------------------------------------
try:
    payload = {
        "query": "उद्या मासेमारीला जाणं सुरक्षित आहे का?",
        "latitude": 19.72,
        "longitude": 72.70,
        "date": "2026-09-12",
        "boat_width_m": 5.0,
        "language": "mr",
        "generate_audio": True
    }
    r = requests.post(f"{BASE_URL}/api/orca/assess", json=payload, timeout=60)
    data = r.json()
    audio_out = data.get("audio_base64")
    passed = r.status_code == 200 and bool(audio_out) and len(audio_out) > 1000
    report("Flow 6: ORCA Response -> Voice Playback (TTS)", passed, f"Audio Length: {len(audio_out or '')} base64 chars")
except Exception as e:
    report("Flow 6: ORCA Response -> Voice Playback (TTS)", False, str(e))

# ---------------------------------------------------------------------------
# Test 9: Frontend Web Bundle & Routing
# ---------------------------------------------------------------------------
try:
    r = requests.get(FRONTEND_URL, timeout=10)
    has_title = "<title>ORCA Marine Intelligence</title>" in r.text
    report("Frontend Web Bundle", r.status_code == 200 and has_title, f"HTTP {r.status_code}, Title matched: {has_title}")
except Exception as e:
    report("Frontend Web Bundle", False, str(e))

print("=" * 80)
total_tests = len(test_results)
passed_tests = sum(1 for v in test_results.values() if v)
print(f"Summary: {passed_tests}/{total_tests} Tests Passed")
print("=" * 80)

if passed_tests == total_tests:
    print("ALL VALIDATION TESTS PASSED SUCCESSFULLY!")
    sys.exit(0)
else:
    print("SOME TESTS FAILED - REVIEW LOGS ABOVE.")
    sys.exit(1)
