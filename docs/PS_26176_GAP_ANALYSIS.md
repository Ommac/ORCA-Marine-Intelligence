# SIH 2026 Problem Statement 26176 — Comprehensive Gap Analysis
**Problem Title:** ORCA Marine EcOsystem Reasoning with Collaborative Agents  
**Organization / Ministry:** Indian Space Research Organisation (ISRO) / Department of Space (DoS)  
**Baseline Date:** 2026-09-23  

---

## 1. Summary Matrix: 24 Core PS Requirements

| # | Requirement | Status | Primary Modules |
| :---: | :--- | :---: | :--- |
| **1** | Natural-language intent understanding | **IMPLEMENTED** | [`agents/orchestrator/graph.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/graph.py), [`agents/language/detector.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/language/detector.py) |
| **2** | Autonomous planning | **IMPLEMENTED** | [`agents/orchestrator/graph.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/graph.py) (LangGraph Supervisor) |
| **3** | Task decomposition | **IMPLEMENTED** | [`agents/orchestrator/graph.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/graph.py) (Parallel Specialist Fan-out) |
| **4** | Specialized agent collaboration | **IMPLEMENTED** | [`agents/pfz/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/pfz/), [`agents/marine_weather/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/marine_weather/), [`agents/svas/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/svas/), [`agents/ocean_analysis/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/ocean_analysis/), [`agents/risk/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/risk/) |
| **5** | Automatic language detection | **IMPLEMENTED** | [`agents/language/detector.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/language/detector.py), [`api/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/api/main.py) |
| **6** | Indian regional language support | **IMPLEMENTED** | [`agents/language/bhashini_client.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/language/bhashini_client.py) (10 languages) |
| **7** | Multi-turn contextual conversations | **IMPLEMENTED** | [`agents/orchestrator/session_store.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/session_store.py) |
| **8** | Marine/ocean/weather/geospatial data integration | **IMPLEMENTED** | INCOIS WFS, Open-Meteo, SVAS, Ocean feeds |
| **9** | Spatial reasoning | **IMPLEMENTED** | [`agents/geofencing/detection.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/detection.py), [`agents/pfz/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/pfz/main.py) |
| **10** | Temporal reasoning | **IMPLEMENTED** | [`agents/orchestrator/graph.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/graph.py) (Temporal entity resolver) |
| **11** | Evidence-based recommendations | **IMPLEMENTED** | [`agents/orchestrator/graph.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/graph.py) (`AggregatorNode`) |
| **12** | Explainable recommendations | **IMPLEMENTED** | [`agents/risk/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/risk/main.py), [`frontend/components/RiskExplanationCard.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/components/RiskExplanationCard.tsx) |
| **13** | Maps and geospatial visualization | **IMPLEMENTED** | [`frontend/app/(tabs)/map.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/app/(tabs)/map.tsx), [`frontend/components/map/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/components/map/) |
| **14** | Lightning alerts | **IMPLEMENTED** | [`agents/ocean_analysis/sources.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/ocean_analysis/sources.py), [`agents/marine_weather/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/marine_weather/main.py) |
| **15** | Cyclone alerts | **IMPLEMENTED** | [`agents/ocean_analysis/sources.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/ocean_analysis/sources.py), [`agents/risk/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/risk/main.py) |
| **16** | Hazard/weather alerts | **IMPLEMENTED** | [`agents/risk/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/risk/main.py), [`frontend/app/(tabs)/alerts.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/app/(tabs)/alerts.tsx) |
| **17** | EEZ boundary notifications | **IMPLEMENTED** | [`agents/geofencing/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/), [`api/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/api/main.py) |
| **18** | Restricted-water notifications | **IMPLEMENTED** | [`agents/geofencing/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/), [`api/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/api/main.py) |
| **19** | MPA notifications | **IMPLEMENTED** | [`agents/geofencing/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/), [`api/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/api/main.py) |
| **20** | ESZ notifications | **IMPLEMENTED** | [`agents/geofencing/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/), [`api/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/api/main.py) |
| **21** | Safe route optimization | **IMPLEMENTED** | [`agents/geofencing/routing.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/routing.py) (A* algorithm) |
| **22** | PFZ discovery | **IMPLEMENTED** | [`agents/pfz/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/pfz/main.py), [`frontend/components/PFZTopCards.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/components/PFZTopCards.tsx) |
| **23** | Ocean productivity / fish-decline reasoning | **PARTIALLY IMPLEMENTED** | [`agents/ocean_analysis/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/ocean_analysis/main.py), [`agents/orchestrator/graph.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/graph.py) |
| **24** | Supporting evidence & reasoning for recommendations | **IMPLEMENTED** | [`agents/risk/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/risk/main.py), [`agents/orchestrator/graph.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/graph.py) |

---

## 2. Detailed Requirement-by-Requirement Analysis

### 1. Natural-Language Intent Understanding
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Dual-tier intent classification in [`agents/orchestrator/graph.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/graph.py) using fast pattern/keyword analysis and Gemini LLM fallback. Correctly identifies `safety_assessment`, `pfz_query`, `weather_query`, `hazard_query`, `route_query`, `general_marine_query`.
- **Files Involved:** [`agents/orchestrator/graph.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/graph.py), [`agents/language/detector.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/language/detector.py)
- **Gaps:** None.

### 2. Autonomous Planning
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** The LangGraph Supervisor node plans execution by dynamically resolving entities, selecting only required specialists (e.g. PFZ-only vs all 4 specialists + risk engine), and deciding UI display modes (`pfz_list`, `risk_explanation`, `none`).
- **Files Involved:** [`agents/orchestrator/graph.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/graph.py)
- **Gaps:** None.

### 3. Task Decomposition
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** LangGraph fan-out architecture decomposes complex queries into concurrent sub-tasks across PFZ, Marine Weather, SVAS, and Ocean Analysis agents.
- **Files Involved:** [`agents/orchestrator/graph.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/graph.py)
- **Gaps:** None.

### 4. Specialized Agent Collaboration
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Dedicated specialist agents execute domain-specific logic and feed their normalized evidence into the `AggregatorNode` and authoritative Risk Engine.
- **Files Involved:** [`agents/pfz/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/pfz/), [`agents/marine_weather/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/marine_weather/), [`agents/svas/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/svas/), [`agents/ocean_analysis/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/ocean_analysis/), [`agents/risk/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/risk/)
- **Gaps:** None.

### 5. Automatic Language Detection
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** `detect_user_language()` identifies Indian scripts (Devanagari/Marathi/Hindi, Tamil, Telugu, Gujarati, Kannada, Malayalam, Bengali, Odia) and Latin script with confidence metrics.
- **Files Involved:** [`agents/language/detector.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/language/detector.py), [`api/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/api/main.py)
- **Gaps:** None.

### 6. Indian Regional Language Support
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Full Bhashini integration for 10 languages: Speech-to-Text (ASR), Text Translation (NMT), and Text-to-Speech (TTS) with transparent envelope translation of Explanation Cards.
- **Files Involved:** [`agents/language/bhashini_client.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/language/bhashini_client.py), [`agents/language/config.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/language/config.py)
- **Gaps:** Upstream Bhashini TTS service occasionally times out (>15s). Gracefully falls back to text.

### 7. Multi-turn Contextual Conversations
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** `SessionStore` maintains in-memory sliding window history, caches previously fetched PFZ candidates, and resolves follow-up ordinal references ("Show me the 2nd one", "Is it safe to travel there?"). Verified in [`test_live_http_endpoints.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/test_live_http_endpoints.py).
- **Files Involved:** [`agents/orchestrator/session_store.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/session_store.py), [`agents/orchestrator/graph.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/graph.py)
- **Gaps:** None.

### 8. Marine/Ocean/Weather/Geospatial Data Integration
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Ingests live INCOIS GeoServer WFS PFZ data, Open-Meteo marine wave and hourly weather forecast APIs, INCOIS SVAS advisory thresholds, and GeoJSON maritime polygons.
- **Files Involved:** [`agents/pfz/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/pfz/main.py), [`agents/marine_weather/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/marine_weather/main.py), [`agents/geofencing/registry.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/registry.py)
- **Gaps:** None.

### 9. Spatial Reasoning
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Exact Haversine distance, Great Circle bearings, compass 8-way directions (NW, SSE), Shapely polygon containment, boundary proximity distance calculation, and line-of-sight intersection.
- **Files Involved:** [`agents/pfz/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/pfz/main.py), [`agents/geofencing/detection.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/detection.py)
- **Gaps:** None.

### 10. Temporal Reasoning
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Resolves relative temporal terms ("today", "tomorrow", "day after tomorrow", "next Monday") relative to reference dates and selects corresponding daily forecast horizons in Open-Meteo and INCOIS feeds.
- **Files Involved:** [`agents/orchestrator/graph.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/graph.py)
- **Gaps:** None.

### 11. Evidence-Based Recommendations
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Recommendations are synthesized strictly from structured numerical and categorical evidence matrices gathered by the specialists (waves, wind, gusts, currents, SVAS status, geofences).
- **Files Involved:** [`agents/orchestrator/graph.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/graph.py), [`agents/risk/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/risk/main.py)
- **Gaps:** None.

### 12. Explainable Recommendations
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Risk Engine produces structured explanation cards containing:
  - Canonical 3-state decision (🟢 GO / 🟡 CAUTION / 🔴 DON'T GO)
  - Dominant hazard identification
  - Primary thing to watch and reason
  - Per-factor impact chips (waves, wind, current, etc.)
  - Concrete operational action guidance for the fisherman.
- **Files Involved:** [`agents/risk/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/risk/main.py), [`frontend/components/RiskExplanationCard.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/components/RiskExplanationCard.tsx)
- **Gaps:** None.

### 13. Maps and Geospatial Visualization
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Cross-platform interactive map with ArcGIS World Imagery Satellite tiles, rendering vessel location, PFZ points/polylines, color-coded geofences (EEZ, Restricted, MPA, ESZ), A* safe route detours, and MapLegend.
- **Files Involved:** [`frontend/app/(tabs)/map.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/app/(tabs)/map.tsx), [`frontend/components/map/OrcaMapComponent.web.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/components/map/OrcaMapComponent.web.tsx), [`frontend/components/map/OrcaMapComponent.native.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/components/map/OrcaMapComponent.native.tsx)
- **Gaps:** None.

### 14. Lightning Alerts
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Analyzes convective available potential energy (CAPE) / thunderstorm probability from Open-Meteo and convective hazard flags from ocean sources. Raises critical warnings when elevated.
- **Files Involved:** [`agents/ocean_analysis/sources.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/ocean_analysis/sources.py), [`agents/marine_weather/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/marine_weather/main.py)
- **Gaps:** None.

### 15. Cyclone Alerts
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Evaluates cyclone tracking data feeds. When active, triggers hard safety override forcing immediate `DON'T GO` (Risk Score 100).
- **Files Involved:** [`agents/ocean_analysis/sources.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/ocean_analysis/sources.py), [`agents/risk/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/risk/main.py)
- **Gaps:** None.

### 16. Hazard / Weather Alerts
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Comprehensive rule-based alert generation for high swell, strong gale gusts, extreme currents, and small-craft swamping warnings.
- **Files Involved:** [`agents/risk/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/risk/main.py), [`frontend/app/(tabs)/alerts.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/app/(tabs)/alerts.tsx)
- **Gaps:** None.

### 17. EEZ Boundary Notifications
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Point-in-polygon and distance checks against Indian EEZ boundary polygon.
- **Files Involved:** [`agents/geofencing/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/), [`api/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/api/main.py)
- **Gaps:** None.

### 18. Restricted-Water Notifications
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Hard barrier spatial evaluation with `SAFE`, `WARNING`, and `RESTRICTED` status triggers and route intersection detection.
- **Files Involved:** [`agents/geofencing/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/), [`api/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/api/main.py)
- **Gaps:** None.

### 19. MPA Notifications (Marine Protected Areas)
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Dedicated MPA category loading, spatial detection, proximity warnings, and visual map layer representation.
- **Files Involved:** [`agents/geofencing/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/), [`frontend/components/MapLegend.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/components/MapLegend.tsx)
- **Gaps:** None.

### 20. ESZ Notifications (Ecologically Sensitive Zones)
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Dedicated ESZ category loading, spatial proximity alerts, and visual map layer representation.
- **Files Involved:** [`agents/geofencing/`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/), [`frontend/components/MapLegend.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/components/MapLegend.tsx)
- **Gaps:** None.

### 21. Safe Route Optimization
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Discrete 8-connected grid A* algorithm with Euclidean/Haversine heuristic navigating around restricted polygons with configurable safety margins.
- **Files Involved:** [`agents/geofencing/routing.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/geofencing/routing.py), [`api/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/api/main.py)
- **Gaps:** None.

### 22. PFZ Discovery
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Parses live INCOIS GeoServer WFS PFZ geometries, ranks top candidates by proximity, displays distance in km and Great Circle bearing, and renders interactive cards.
- **Files Involved:** [`agents/pfz/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/pfz/main.py), [`frontend/components/PFZTopCards.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/components/PFZTopCards.tsx)
- **Gaps:** None.

### 23. Ocean Productivity & Fish-Decline Reasoning
- **Status:** **PARTIALLY IMPLEMENTED**
- **Existing Implementation:** Ocean Analysis Agent extracts Chlorophyll-a and Sea Surface Temperature (SST) ranges, and Gemini synthesizes general fishing condition commentary.
- **What is Missing:**
  1. A dedicated reasoning heuristic that models biophysical fish concentration mechanics (e.g. thermal fronts, chlorophyll gradients, upwelling indices).
  2. Structured explanation when fish catch is predicted to decline (e.g. elevated SST / marine heatwave, seasonal hypoxia, upwelling cessation, or post-monsoon dispersal).
- **Files Involved:** [`agents/ocean_analysis/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/ocean_analysis/main.py), [`agents/ocean_analysis/sources.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/ocean_analysis/sources.py), [`agents/orchestrator/graph.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/orchestrator/graph.py)
- **Minimal Implementation Required:**
  - Add biophysical productivity & fish-decline reasoning helpers in `agents/ocean_analysis/main.py` analyzing SST thermal gradient anomalies, chlorophyll thresholds (>0.5 mg/m³ for pelagic concentration), and seasonal ban indicators.
  - Return structured `productivity_index` and `catch_prospects` (`HIGH`, `MODERATE`, `LOW_MIGRATED`) in Ocean Analysis specialist response.
- **Dependencies:** Existing `agents/ocean_analysis/` and `agents/orchestrator/graph.py`.
- **Tests Required:** `agents/ocean_analysis/test_main.py` test cases for ocean productivity calculations and fish decline explanations.

### 24. Supporting Evidence and Reasoning for Recommendations
- **Status:** **IMPLEMENTED**
- **Existing Implementation:** Every recommendation is accompanied by an itemized list of contributing physical factors, vessel suitability checks, and clear operational rationale.
- **Files Involved:** [`agents/risk/main.py`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/agents/risk/main.py), [`frontend/components/RiskExplanationCard.tsx`](file:///c:/Users/arfat/ORCA_Marine_SIH_2026/frontend/components/RiskExplanationCard.tsx)
- **Gaps:** None.

---

## 3. Recommended Implementation Phases (For Future Execution)

1. **Phase A: Ecosystem & Fish Decline Reasoning Enhancement (Requirement #23)**
   - Enhance `agents/ocean_analysis/main.py` with explicit biophysical gradient analysis (SST anomalies, thermal front detection, chlorophyll productivity zones).
   - Add structured productivity/catch prospect insights to the final assessment envelope.

2. **Phase B: Model Configuration & Latency Optimization**
   - Update `.env` / Gemini model cascade configuration to prioritize valid active models (`gemini-2.0-flash`, `gemini-1.5-flash`, etc.) without incurring 404 fallback retries.

3. **Phase C: Types & Schema Normalization**
   - Align frontend `AssessmentStatus` (`SAFE | CAUTION | NOT_RECOMMENDED | DANGER`) with backend Risk Engine canonical enums.

4. **Phase D: Pan-India Maritime GeoJSON Expansion**
   - Add East Coast maritime boundary polygons (Bay of Bengal, Tamil Nadu, Andhra Pradesh, Odisha) to `agents/geofencing/data/`.
