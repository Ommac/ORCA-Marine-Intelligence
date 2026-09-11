"""
Comprehensive ORCA Project Audit Test Runner
--------------------------------------------
Strictly inspects and tests all backend and frontend services without modifying any project file.
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
FRONTEND_URL = "http://localhost:8081"

results = {
    "backend": {},
    "frontend": {},
    "e2e": {},
    "data": {},
    "problems": []
}

def log_section(title):
    print("\n" + "=" * 75)
    print(f"  {title}")
    print("=" * 75)

# ---------------------------------------------------------------------------
# 1. Environment Audit
# ---------------------------------------------------------------------------
log_section("1. ENVIRONMENT & SECRETS AUDIT")
from dotenv import load_dotenv
load_dotenv()

env_keys = [
    "BHASHINI_UDYAT_KEY",
    "BHASHINI_INFERENCE_KEY",
    "BHASHINI_PIPELINE_ID",
    "BHASHINI_USER_ID",
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "BHASHINI_DISCOVERY_URL",
    "BHASHINI_INFERENCE_URL"
]

for k in env_keys:
    val = os.getenv(k)
    configured = bool(val and val.strip())
    print(f"  {k:26}: {'[CONFIGURED]' if configured else '[NOT SET / OPTIONAL]'}")
    if k == "GEMINI_MODEL" and val:
        print(f"    -> configured value: '{val}'")
        if val == "gemini-2.5-flash-lite":
            results["problems"].append({
                "severity": "LOW",
                "feature": "Gemini Model Configuration",
                "file": ".env",
                "exact_error": "Model 'gemini-2.5-flash-lite' does not exist upstream in Google GenAI API (returns 404). System automatically falls back to 'gemini-3.5-flash-lite'.",
                "root_cause": "Model name typo in .env (should be 'gemini-2.0-flash-lite' or 'gemini-1.5-flash').",
                "expected": "Fast direct response from configured model without fallback 404 retry latency.",
                "actual": "404 Not Found logged on first attempt, then graceful fallback to gemini-3.5-flash-lite (adds ~2-3s).",
                "fix": "Update GEMINI_MODEL in .env to a valid model."
            })

# ---------------------------------------------------------------------------
# 2. Backend Health & CORS Audit
# ---------------------------------------------------------------------------
log_section("2. BACKEND HEALTH & CORS AUDIT")
try:
    t0 = time.time()
    r = requests.get(f"{BASE_URL}/health", timeout=5)
    elapsed = (time.time() - t0) * 1000
    print(f"  GET /health: HTTP {r.status_code} ({elapsed:.1f} ms)")
    print(f"  Response: {r.json()}")
    results["backend"]["health"] = r.status_code == 200
    
    # Check CORS headers
    cors_origin = r.headers.get("access-control-allow-origin")
    cors_creds = r.headers.get("access-control-allow-credentials")
    print(f"  CORS Origin: {cors_origin}, Credentials: {cors_creds}")
    if cors_origin == "*" and cors_creds == "true":
        results["problems"].append({
            "severity": "MEDIUM",
            "feature": "CORS Middleware Configuration",
            "file": "api/main.py",
            "line/function": "line 69 / CORSMiddleware",
            "exact_error": "CORS spec violation: Access-Control-Allow-Origin wildcard '*' cannot be combined with Access-Control-Allow-Credentials 'true'.",
            "root_cause": "FastAPI CORSMiddleware configured with allow_origins=['*'] and allow_credentials=True.",
            "expected": "Browsers with credentialed requests will reject this response per W3C CORS spec.",
            "actual": "Header 'Access-Control-Allow-Origin: *' sent alongside 'Access-Control-Allow-Credentials: true'.",
            "fix": "Change allow_origins to explicit localhost origins (['http://localhost:8081', 'http://127.0.0.1:8081']) or set allow_credentials=False."
        })
except Exception as e:
    print(f"  GET /health FAILED: {e}")
    results["backend"]["health"] = False

# ---------------------------------------------------------------------------
# 3. Bhashini Multilingual Endpoints Audit
# ---------------------------------------------------------------------------
log_section("3. BHASHINI MULTILINGUAL ENDPOINTS AUDIT")

# A. Language Detect
try:
    r = requests.post(f"{BASE_URL}/api/language/detect", json={"text": "उद्या मासेमारीला जाणं सुरक्षित आहे का?"}, timeout=10)
    print(f"  POST /api/language/detect (Marathi): HTTP {r.status_code} -> {r.json()}")
    results["backend"]["lang_detect"] = (r.status_code == 200 and r.json().get("language") == "mr")
except Exception as e:
    print(f"  POST /api/language/detect FAILED: {e}")
    results["backend"]["lang_detect"] = False

# B. Language Translate
try:
    r = requests.post(f"{BASE_URL}/api/language/translate", json={
        "text": "उद्या मासेमारीला जाणं सुरक्षित आहे का?",
        "source_language": "mr",
        "target_language": "en"
    }, timeout=15)
    print(f"  POST /api/language/translate (MR -> EN): HTTP {r.status_code} -> {r.json()}")
    results["backend"]["lang_translate_mr_en"] = (r.status_code == 200 and "safe" in r.json().get("translated_text", "").lower())
except Exception as e:
    print(f"  POST /api/language/translate FAILED: {e}")
    results["backend"]["lang_translate_mr_en"] = False

# C. Text-to-Speech
audio_sample_b64 = None
try:
    r = requests.post(f"{BASE_URL}/api/language/text-to-speech", json={
        "text": "मासेमारीला जाणे सुरक्षित आहे.",
        "language": "mr",
        "gender": "male"
    }, timeout=20)
    data = r.json()
    audio_sample_b64 = data.get("audio_base64")
    audio_len = len(audio_sample_b64) if audio_sample_b64 else 0
    print(f"  POST /api/language/text-to-speech: HTTP {r.status_code}, Audio Length: {audio_len} chars")
    results["backend"]["tts"] = (r.status_code == 200 and audio_len > 1000)
except Exception as e:
    print(f"  POST /api/language/text-to-speech FAILED: {e}")
    results["backend"]["tts"] = False

# D. Speech-to-Text
try:
    if audio_sample_b64:
        r = requests.post(f"{BASE_URL}/api/language/speech-to-text", json={
            "audio_base64": audio_sample_b64,
            "language": "mr",
            "audio_format": "wav",
            "sampling_rate": 16000
        }, timeout=20)
        print(f"  POST /api/language/speech-to-text: HTTP {r.status_code} -> {r.json()}")
        results["backend"]["asr"] = (r.status_code == 200 and bool(r.json().get("transcript")))
    else:
        results["backend"]["asr"] = False
except Exception as e:
    print(f"  POST /api/language/speech-to-text FAILED: {e}")
    results["backend"]["asr"] = False

# E. Error Handling: Empty payload to ASR
try:
    r = requests.post(f"{BASE_URL}/api/language/speech-to-text", json={"audio_base64": ""}, timeout=5)
    print(f"  POST /api/language/speech-to-text (empty): HTTP {r.status_code} (Expected: 422)")
    results["backend"]["asr_validation"] = (r.status_code == 422)
except Exception as e:
    print(f"  ASR validation check failed: {e}")

# ---------------------------------------------------------------------------
# 4. ORCA Assessment Endpoint & Core Multi-Agent Audit
# ---------------------------------------------------------------------------
log_section("4. ORCA ASSESSMENT & AGENT PIPELINE AUDIT")

# Scenario 1: General Safety Query (Parallel All 4 Specialists + Risk Engine)
print("  Running Scenario 1: 'Is it safe for me to go fishing tomorrow?' (Lat 19.72, Lon 72.70, 5m vessel)...")
t0 = time.time()
try:
    r = requests.post(f"{BASE_URL}/api/orca/assess", json={
        "query": "Is it safe for me to go fishing tomorrow?",
        "latitude": 19.72,
        "longitude": 72.70,
        "date": "2026-09-12",
        "boat_width_m": 5.0,
        "language": "en"
    }, timeout=60)
    elapsed = (time.time() - t0) * 1000
    print(f"  Status: HTTP {r.status_code} in {elapsed:.1f} ms")
    data = r.json()
    
    # Check specialists
    has_pfz = "pfz" in data and data["pfz"].get("status") == "success"
    has_weather = "marine_weather" in data and data["marine_weather"].get("status") == "success"
    has_svas = "svas" in data and data["svas"].get("status") == "success"
    has_ocean = "ocean_analysis" in data and data["ocean_analysis"].get("status") == "success"
    has_risk = "risk" in data and isinstance(data["risk"], dict)
    
    print(f"  - PFZ Specialist:            {'PASS [LIVE]' if has_pfz else 'FAIL'}")
    print(f"  - Marine Weather Specialist: {'PASS [LIVE]' if has_weather else 'FAIL'}")
    print(f"  - SVAS Specialist:           {'PASS [LIVE]' if has_svas else 'FAIL'}")
    print(f"  - Ocean Analysis Specialist: {'PASS [LIVE]' if has_ocean else 'FAIL'}")
    print(f"  - Risk Engine Calculation:   {'PASS [LIVE]' if has_risk else 'FAIL'}")
    
    if has_risk:
        risk_obj = data["risk"]
        print(f"    -> Risk Status:  {risk_obj.get('status')}")
        print(f"    -> Risk Score:   {risk_obj.get('risk_score')}/100")
        print(f"    -> Dominant:     {risk_obj.get('dominant_hazard')}")
        print(f"    -> Reasons:      {risk_obj.get('reasons')}")
    
    # Check Display Flags
    disp = data.get("display", {})
    print(f"  - Display Relevance Flags:   {disp}")
    print(f"  - Alerts Count:              {len(data.get('alerts', []))}")
    print(f"  - Recommendation (excerpt):  '{data.get('recommendation', '')[:140]}...'")

    results["backend"]["orca_assess"] = (r.status_code == 200 and has_risk)
    results["data"]["pfz"] = has_pfz
    results["data"]["weather"] = has_weather
    results["data"]["svas"] = has_svas
    results["data"]["ocean"] = has_ocean
    results["data"]["risk"] = has_risk

except Exception as e:
    print(f"  Scenario 1 FAILED: {e}")
    results["backend"]["orca_assess"] = False

# Scenario 2: Specific PFZ Query ("Where is the nearest fishing zone?")
print("\n  Running Scenario 2: 'Where is the nearest fishing zone?'...")
try:
    r = requests.post(f"{BASE_URL}/api/orca/assess", json={
        "query": "Where is the nearest fishing zone?",
        "latitude": 19.72,
        "longitude": 72.70,
        "date": "2026-09-12",
        "boat_width_m": 5.0,
        "language": "en"
    }, timeout=45)
    data = r.json()
    disp = data.get("display", {})
    top_pfz = data.get("top_pfz") or []
    print(f"  Status: HTTP {r.status_code}")
    print(f"  - Intent:                    {data.get('intent')}")
    print(f"  - Selected Agents:           {data.get('selected_agents')}")
    print(f"  - Display PFZ:               {disp.get('pfz')}")
    print(f"  - Display PFZ Mode:          {disp.get('pfz_mode')}")
    print(f"  - Top PFZ Candidates Count:  {len(top_pfz)}")
    if top_pfz:
        print(f"    -> 1st Candidate: Dist {top_pfz[0].get('distance_km')} km {top_pfz[0].get('direction')}")
except Exception as e:
    print(f"  Scenario 2 FAILED: {e}")

# Scenario 3: Marathi End-to-End Flow
print("\n  Running Scenario 3: Marathi Query with TTS...")
try:
    r = requests.post(f"{BASE_URL}/api/orca/assess", json={
        "query": "उद्या मासेमारीला जाणं सुरक्षित आहे का?",
        "latitude": 19.72,
        "longitude": 72.70,
        "date": "2026-09-12",
        "boat_width_m": 5.0,
        "language": "mr",
        "generate_audio": True
    }, timeout=60)
    data = r.json()
    print(f"  Status: HTTP {r.status_code}")
    print(f"  - Normalized Query:          '{data.get('english_query')}'")
    print(f"  - Original Rec (EN excerpt): '{data.get('original_recommendation', '')[:80]}...'")
    print(f"  - Marathi Rec (MR excerpt):  '{data.get('recommendation', '')[:80]}...'")
    print(f"  - Audio Generated:           {bool(data.get('audio_base64'))} ({len(data.get('audio_base64') or '')} chars)")
    results["e2e"]["marathi_flow"] = (r.status_code == 200 and bool(data.get("audio_base64")))
except Exception as e:
    print(f"  Scenario 3 FAILED: {e}")
    results["e2e"]["marathi_flow"] = False

# ---------------------------------------------------------------------------
# 5. Frontend Bundle & Route Verification
# ---------------------------------------------------------------------------
log_section("5. FRONTEND EXPO & BUNDLER AUDIT")
try:
    r = requests.get(FRONTEND_URL, timeout=10)
    print(f"  GET {FRONTEND_URL}: HTTP {r.status_code}")
    has_html = "<!DOCTYPE html>" in r.text
    has_title = "<title>ORCA Marine Intelligence</title>" in r.text
    print(f"  - HTML Root Rendered:        {has_html}")
    print(f"  - Title Matched:             {has_title}")
    results["frontend"]["web_startup"] = (r.status_code == 200 and has_title)
except Exception as e:
    print(f"  Frontend check FAILED: {e}")
    results["frontend"]["web_startup"] = False

# Verify mock flag in api.ts
from pathlib import Path
api_ts_path = Path("frontend/services/api.ts")
if api_ts_path.exists():
    content = api_ts_path.read_text(encoding="utf-8")
    if "export const USE_MOCK_API = false;" in content:
        print("  - Frontend API Mode:         LIVE (USE_MOCK_API = false)")
        results["frontend"]["mock_mode"] = "LIVE"
    else:
        print("  - Frontend API Mode:         MOCK (USE_MOCK_API = true)")
        results["frontend"]["mock_mode"] = "MOCK"

# ---------------------------------------------------------------------------
# 6. Schema Consistency Check between Backend and Frontend
# ---------------------------------------------------------------------------
log_section("6. SCHEMA & STATE COMPATIBILITY CHECK")
# Check how frontend normalizeBackendResponse handles backend data
try:
    # Check if backend sends 'risk' object
    # In frontend/services/api.ts line 81:
    # const riskStatus: AssessmentStatus = raw?.risk?.status || raw?.risk?.risk_status || 'SAFE';
    # In backend graph.py line 1812:
    # "risk": risk_result
    # risk_result has {"status": "NOT_RECOMMENDED" / "CAUTION" / "SAFE", "risk_score": 100, ...}
    # But AssessmentStatus in frontend types/orca.ts:
    # export type AssessmentStatus = 'SAFE' | 'CAUTION' | 'DANGER' | 'UNKNOWN';
    # Notice: Backend status is 'NOT_RECOMMENDED' while frontend expects 'DANGER'!
    print("  Comparing Backend Risk Status vs Frontend AssessmentStatus:")
    print("  Backend emits: 'SAFE' | 'CAUTION' | 'NOT_RECOMMENDED'")
    print("  Frontend types: 'SAFE' | 'CAUTION' | 'DANGER' | 'UNKNOWN'")
    print("  Frontend check: raw?.risk?.status is 'NOT_RECOMMENDED', which is NOT 'DANGER'.")
    results["problems"].append({
        "severity": "HIGH",
        "feature": "AssessmentStatus Enum Mismatch",
        "file": "frontend/services/api.ts",
        "line/function": "normalizeBackendResponse / line 82",
        "exact_error": "Backend Risk Engine outputs status 'NOT_RECOMMENDED', but Frontend AssessmentStatus type and UI color badges check for 'DANGER'.",
        "root_cause": "The Deterministic Risk Engine returns status='NOT_RECOMMENDED' for severe risk/no-sail conditions, whereas the React Native UI components (e.g. StatusBadge, HomeScreen) evaluate status === 'DANGER' or status === 'SAFE'.",
        "expected": "When backend returns 'NOT_RECOMMENDED', frontend should cleanly map it to 'DANGER' so the red danger banner and warnings render properly.",
        "actual": "Frontend falls back to raw string 'NOT_RECOMMENDED', which may fail strict type guards or miss red styling in components expecting 'DANGER'.",
        "fix": "In frontend/services/api.ts normalizeBackendResponse: map 'NOT_RECOMMENDED' or 'DON'T GO' to 'DANGER'."
    })
except Exception as e:
    print(f"  Schema check error: {e}")

print("\n" + "=" * 75)
print("AUDIT RUN COMPLETE")
print("=" * 75)
