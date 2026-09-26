# ORCA Marine Intelligence — Baseline System Report
**SIH 2026 Problem Statement 26176**  
*Project: ORCA (Oceanic Risk Calculation & Advisory / Marine EcOsystem Reasoning with Collaborative Agents)*  
*Generated: 2026-09-23 | Environment: Local Windows 10/11 | Branch: `arfat`*

---

## 1. Executive Summary

This report establishes the verified baseline of the local **ORCA Marine Intelligence** codebase. All findings are derived strictly from local inspections, unit/integration test executions, static type analysis, and runtime verification. **Zero external Git operations or code mutations** have been performed.

---

## 2. Current Architecture

ORCA employs a **4-tier micro-agentic architecture** connecting a mobile-first React Native / Expo client to a FastAPI backend powered by LangGraph multi-agent orchestration and a deterministic mathematical risk engine.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TIER 1: PRESENTATION & CLIENT                          │
│  Expo SDK 52+ / React Native 0.86+ | React-Leaflet (Web) / MapLibre (Native) │
│  Bhashini Voice (ASR / TTS) | Multi-lingual UI (10+ Indian Languages)       │
│  Tabs: Home (Overview) | Map (Geospatial) | Ask (Voice/Chat) | Alerts       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / JSON (Port 8000)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    TIER 2: API GATEWAY & DISPATCHER                         │
│  FastAPI (api/main.py) | Pydantic v2 Schemas | CORS Middleware               │
│  Endpoints: /api/orca/assess, /api/orca/geofences, /api/orca/route/optimize  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│            TIER 3: LANGGRAPH MULTI-AGENT ORCHESTRATOR & RISK ENGINE         │
│  Supervisor Node (Intent & Entity Resolution) -> Fan-out Execution          │
│  Specialist Agents: PFZ (#1), Weather (#2), SVAS (#3), Ocean (#4)           │
│  Authoritative Deterministic Risk Engine (0-100 Score & 3-State Decision)   │
│  Gemini Synthesis Node (Multi-model cascade + Deterministic Fallback)       │
│  Bhashini Multilingual Translation & Voice Synthesis Layer                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                      TIER 4: GEOSPATIAL & DATA LAYER                        │
│  Shapely Vector Processing | 8-Connected Grid A* Pathfinding                 │
│  INCOIS WFS Live / Mock PFZ | Open-Meteo Marine | INCOIS SVAS Feeds         │
│  GeoJSON Maritime Boundaries: EEZ, Restricted Waters, MPAs, ESZs            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Current Agents Inventory

| Agent Name | Module Path | Data Source / Method | Primary Function | Current Health |
| :--- | :--- | :--- | :--- | :--- |
| **Supervisor Node** | [`agents/orchestrator/graph.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/graph.py) | Regex intent resolver + LLM Intent classification | Classifies user queries, resolves multi-turn ordinals, selects required specialist agents. | **OPERATIONAL** |
| **PFZ Specialist (#1)** | [`agents/pfz/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/pfz/main.py) | Live INCOIS GeoServer WFS + Local Mock Fallback | Fetches Potential Fishing Zone lines/polygons, computes Haversine distance and Great Circle bearing, ranks top 3 candidates. | **OPERATIONAL** |
| **Marine Weather Specialist (#2)** | [`agents/marine_weather/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/marine_weather/main.py) | Open-Meteo Marine & Weather Forecast API | Fetches wave height, period, swell, wind speed, gusts, direction, precipitation, thunderstorm probability. | **OPERATIONAL** |
| **SVAS Specialist (#3)** | [`agents/svas/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/svas/main.py) | INCOIS Small Vessel Advisory Service feed / Mock | Evaluates boat dimensions (<4m, 4-6m, 6-7m, 7m+) against swamping/capsizing risk thresholds. | **OPERATIONAL** |
| **Ocean Analysis Specialist (#4)** | [`agents/ocean_analysis/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/ocean_analysis/main.py) | [`agents/ocean_analysis/sources.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/ocean_analysis/sources.py) | Analyzes Sea Surface Temperature (SST), Chlorophyll-a, lightning probability, cyclonic storm tracks, tsunami warnings. | **OPERATIONAL** |
| **Deterministic Risk Engine** | [`agents/risk/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/risk/main.py) | Arithmetic dynamic weight renormalization (0–100) | **Authoritative Safety Authority**. Computes composite risk score, dominant hazards, primary watch items, and canonical 3-state decision (🟢 GO / 🟡 CAUTION / 🔴 DON'T GO). Never yields authority to LLMs. | **OPERATIONAL** |
| **Bhashini Multilingual Specialist** | [`agents/language/bhashini_client.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/language/bhashini_client.py) | MeitY Bhashini REST API (ASR / NMT / TTS) | Automatic language detection, bi-directional query/response translation for 10+ Indian languages, voice synthesis. | **OPERATIONAL** |

---

## 4. Current API Endpoints

| Endpoint | Method | Input Schema | Output Summary | Status |
| :--- | :--- | :--- | :--- | :--- |
| `/health` | `GET` | None | Service status, Bhashini configuration status, supported languages list | Active (200 OK) |
| `/api/language/detect` | `POST` | `LanguageDetectRequest` (`text`) | Detected language code, confidence score, language name | Active (200 OK) |
| `/api/language/translate` | `POST` | `LanguageTranslateRequest` (`text`, `src`, `tgt`) | Translated text string | Active (200 OK) |
| `/api/language/speech-to-text` | `POST` | `SpeechToTextRequest` (`audio_base64`, `lang`) | Transcribed query string, detected language, confidence | Active (200 OK) |
| `/api/language/text-to-speech` | `POST` | `TextToSpeechRequest` (`text`, `lang`, `gender`) | Base64-encoded audio WAV | Active (200 OK) |
| `/api/orca/assess` | `POST` | `OrcaAssessRequest` (`query`, `lat`, `lon`, `date`, `boat_width_m`, `session_id`, `language`, `generate_audio`) | Full ORCA assessment envelope: canonical decision, 0-100 risk score, explanation factors, top PFZ zones, display flags, multilingual translation, audio | Active (200 OK) |
| `/api/orca/geofences` | `GET` | Query params: `category`, `force_reload` | GeoJSON FeatureCollection of maritime boundaries (EEZ, restricted waters, MPAs, ESZs) | Active (200 OK) |
| `/api/orca/geofences/check` | `GET` | Query params: `latitude`, `longitude`, `warning_distance_km` | Spatial point status (`SAFE`, `WARNING`, `RESTRICTED`), nearest zone, boundary distance in km | Active (200 OK) |
| `/api/orca/geofences/route-check` | `POST` | `OrcaRouteCheckRequest` (`start` [lat, lon], `end` [lat, lon]) | Line-segment intersection status, intersecting geofence list, blocking flag | Active (200 OK) |
| `/api/orca/route/optimize` | `POST` | `OrcaRouteOptimizeRequest` (`start`, `destination`, `grid_spacing_km`, `search_margin_km`) | A* obstacle-avoiding waypoint path, total distance in km, detour status, safety validation | Active (200 OK) |

---

## 5. Current Frontend Modules (Expo / React Native)

| Screen / Component | File Path | Capabilities |
| :--- | :--- | :--- |
| **Root Layout** | [`frontend/app/_layout.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/app/_layout.tsx) | App initialization, Language and Audio Provider envelopes, status bar theme. |
| **Home Screen** | [`frontend/app/(tabs)/index.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/app/(tabs)/index.tsx) | Quick assessment status widget, vessel dimensions, weather summary, voice query button. |
| **Interactive Map Screen** | [`frontend/app/(tabs)/map.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/app/(tabs)/map.tsx) | Full-screen interactive map displaying live GPS, PFZ zones, geofence layers, A* detour path, MapLegend. |
| **Ask ORCA (Voice/Chat)** | [`frontend/app/(tabs)/ask.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/app/(tabs)/ask.tsx) | Multi-turn conversational interface, Push-to-Talk audio recording, audio playback of responses, PFZ card integration. |
| **Alerts Screen** | [`frontend/app/(tabs)/alerts.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/app/(tabs)/alerts.tsx) | Real-time weather warnings, high-wind advisories, lightning alerts, SVAS capsizing advisories. |
| **Assessment Modal** | [`frontend/app/assessment.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/app/assessment.tsx) | In-depth breakdown modal showing 3-state decision, risk factors table, vessel suitability, action guidance. |
| **Web Map Component** | [`frontend/components/map/OrcaMapComponent.web.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/components/map/OrcaMapComponent.web.tsx) | Leaflet raster map rendering ArcGIS World Imagery tiles, GeoJSON boundary layers, PFZ coordinates, route polylines. |
| **Native Map Component** | [`frontend/components/map/OrcaMapComponent.native.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/components/map/OrcaMapComponent.native.tsx) | Native MapLibre/MapView rendering satellite tiles, vector polygons, markers, polylines. |
| **Map Legend Component** | [`frontend/components/MapLegend.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/components/MapLegend.tsx) | Visual legend explaining map colors (EEZ, Restricted Waters, MPA, ESZ, PFZ, Safe Routes). |
| **Risk Explanation Card** | [`frontend/components/RiskExplanationCard.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/components/RiskExplanationCard.tsx) | High-contrast visual card rendering the canonical decision, risk score bar, dominant hazard badge, and factor chips. |
| **PFZ Top Cards** | [`frontend/components/PFZTopCards.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/components/PFZTopCards.tsx) | Carousel/list of top 3 ranked PFZ zones with distance in km, bearing, and "Show on Map" triggers. |
| **Frontend API Service** | [`frontend/services/api.ts`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/services/api.ts) | HTTP client service wrapping `/api/orca/assess`, `/api/orca/geofences`, and Bhashini language endpoints. |

---

## 6. Current Geofencing & Route Optimization Subsystem

### Geofencing Registry & Data
- **Registry**: [`agents/geofencing/registry.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/registry.py) loads and caches 4 maritime polygon categories with automated topological repair (`shapely.validation.make_valid`):
  1. **EEZ (Exclusive Economic Zone)**: [`agents/geofencing/data/eez_india.geojson`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/data/eez_india.geojson) (Informational boundary).
  2. **Restricted Waters**: [`agents/geofencing/data/restricted_waters.geojson`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/data/restricted_waters.geojson) (Hard restricted / blocking).
  3. **Marine Protected Areas (MPA)**: [`agents/geofencing/data/marine_protected_areas.geojson`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/data/marine_protected_areas.geojson) (Restricted ecological zone).
  4. **Ecologically Sensitive Zones (ESZ)**: [`agents/geofencing/data/ecologically_sensitive_zones.geojson`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/data/ecologically_sensitive_zones.geojson) (Warning / restricted breeding zone).

### Spatial Detection & Distance Computation
- **Detection**: [`agents/geofencing/detection.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/detection.py) evaluates points and line segments:
  - Point status: `SAFE` (clear), `WARNING` (within `warning_distance_km`, default 5 km), `RESTRICTED` (inside polygon).
  - Accurate minimum Euclidean-to-Haversine boundary distance computation.
  - Route line segment intersection testing via Shapely `LineString.intersects()`.

### A* Obstacle-Avoidance Route Optimization
- **Routing Engine**: [`agents/geofencing/routing.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/routing.py):
  - Direct path check first (instant return if clear).
  - 8-connected regular 2D grid generation over search bounding box (`grid_spacing_km=2.0`).
  - Pre-computed spatial index / polygon masks for fast obstacle classification.
  - A* algorithm with Euclidean/Haversine heuristic minimizing total travel distance.
  - Waypoint simplification and safety validation.

---

## 7. Current Multilingual & Voice Functionality

- **Provider**: Government of India MeitY Bhashini AI Suite (`https://dhruva-api.bhashini.gov.in`).
- **Supported Languages**: English (`en`), Marathi (`mr`), Hindi (`hi`), Tamil (`ta`), Telugu (`te`), Gujarati (`gu`), Kannada (`kn`), Malayalam (`ml`), Bengali (`bn`), Odia (`or`).
- **Pipeline**:
  1. **Language Detection**: `detect_user_language()` combines fast regex Unicode script analysis with Bhashini API fallback.
  2. **Query Normalization**: Queries in regional scripts are translated to English before LangGraph orchestrator dispatch to preserve exact deterministic logic.
  3. **Response Translation**: English recommendations and Explanation Cards are translated back to the user's language.
  4. **Text-to-Speech (TTS)**: Synthesizes regional language audio in base64 WAV format.

---

## 8. Current Alert Functionality

- **Weather & Storm Alerts**: Emitted when wind > 25 kt, wave height > 2.5 m, or convective gusts > 35 kt.
- **Lightning Hazard**: Emitted when CAPE / convective storm indices or lightning probability exceed safety thresholds.
- **SVAS Capsizing Alert**: Triggered when small craft wave-to-length ratio indicates high swamping risk.
- **Hard Safety Overrides**: Cyclone tracking, active tsunami warnings, or SVAS "Prohibited" status trigger immediate `DON'T GO` override.

---

## 9. Test Suite Execution & Baseline Results

### Unit & Regression Test Execution
- Command: `api\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py" -v`
- **Result**: **51 Passed, 1 Failed** (52 total tests).
  - `tests/test_geofence_phase1.py` (9/9 PASSED)
  - `tests/test_geofence_phase2.py` (10/10 PASSED)
  - `tests/test_geofence_phase3.py` (9/9 PASSED)
  - `tests/test_bhashini_service.py` (7/7 PASSED)
  - `tests/test_bhashini_live.py` (2/3 PASSED, 1 failure on live TTS audio stream response due to upstream Bhashini TTS timeout)

### End-to-End & Consistency Test Execution
- `test_geofence_consistency.py`: **ALL PASSED**
- `test_pfz_consistency.py`: **ALL PASSED**
- `test_live_http_endpoints.py`: **ALL PASSED**
- `test_e2e_complete_validation.py`: **ALL PASSED**

### Frontend Type & Syntax Check
- Command: `npm run ts:check` in `frontend/`
- **Result**: **0 errors (100% clean TypeScript compilation)**.

---

## 10. Current Limitations & Identified Issues

1. **Gemini Model Name Fallback Latency**:
   - In `.env`, `GEMINI_MODEL` is set to `gemini-2.5-flash-lite`. Upstream Google GenAI returns HTTP 404 for this model ID.
   - The orchestrator catches this error and gracefully falls back to deterministic synthesis or secondary models, but it adds ~2–3 seconds of retry latency per request.
2. **Bhashini Live TTS Upstream Latency**:
   - Upstream Dhruva Bhashini TTS endpoint occasionally experiences read timeouts (>15s), causing voice audio to return as null while text fallback succeeds.
3. **Frontend / Backend Status Enum Alignment**:
   - Backend Risk Engine emits `SAFE`, `CAUTION`, `NOT_RECOMMENDED`.
   - Frontend TypeScript types include `SAFE`, `CAUTION`, `DANGER`, `UNKNOWN`.
   - The frontend mapper translates `NOT_RECOMMENDED` to `DANGER`, but type definitions should be completely unified.
4. **Geofence Dataset Scope**:
   - Current GeoJSON boundaries cover West Coast (Maharashtra / Gujarat / Mumbai) representative zones. Expansion to East Coast (Bay of Bengal, Tamil Nadu, Andhra Pradesh, Odisha) requires additional polygon ingestion.
5. **Fish Decline / Marine Ecosystem Reasoning Depth**:
   - While ocean chlorophyll and SST data are fetched, specialized reasoning about fish migration patterns, ocean productivity declines, and seasonal bans (e.g. monsoon fishing bans) is partially integrated into prompt synthesis rather than a dedicated ecosystem modeling agent.
