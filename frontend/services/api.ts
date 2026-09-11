/**
 * ORCA Centralized API Service
 * 
 * Central data gateway for all screens and components.
 * Consumes and returns strictly normalized OrcaResponse objects from the live ORCA backend.
 */

import { OrcaRequest, OrcaResponse, AssessmentStatus, SeverityLevel, Hazard, Alert } from '../types/orca';
import { getMockResponseForRequest, MOCK_PALGHAR_RESPONSE } from '../mocks/orcaResponse';
import { getActiveTrip, getTodayDateISO, setActiveLocation, setActiveDate, setActiveBoatWidth } from './tripStore';

// Configuration Flag: Set to false for live backend API calls (POST /api/orca/assess)
export const USE_MOCK_API = false;

/**
 * Resolves the backend base URL dynamically:
 * 1. EXPO_PUBLIC_API_URL if configured
 * 2. Window location hostname if running in Web browser
 * 3. Fallback to http://127.0.0.1:8000
 */
export function getBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `http://${hostname}:8000`;
    }
  }
  return 'http://127.0.0.1:8000';
}

// Backend Base URL configured via environment variable
export const BASE_URL = getBaseUrl();

// Re-export shared assessment store functions to maintain backward compatibility and avoid circular dependencies
import {
  getCurrentAssessment,
  clearCurrentAssessment,
  subscribeToAssessment,
  subscribeToSelectedPFZ,
  notifyAssessmentListeners,
  setAssessmentState,
  getLatestRequestId,
  setLatestRequestId,
  getSelectedPFZId,
  setSelectedPFZId,
  getSelectedPFZ,
  EMPTY_INITIAL_ASSESSMENT,
} from './assessmentStore';

export {
  getCurrentAssessment,
  clearCurrentAssessment,
  subscribeToAssessment,
  subscribeToSelectedPFZ,
  notifyAssessmentListeners,
  setAssessmentState,
  getLatestRequestId,
  setLatestRequestId,
  getSelectedPFZId,
  setSelectedPFZId,
  getSelectedPFZ,
  EMPTY_INITIAL_ASSESSMENT,
};
export type { AssessmentListener, SelectedPFZListener } from './assessmentStore';


/**
 * Normalizes raw structured response from POST /api/orca/assess into OrcaResponse
 */
export function normalizeBackendResponse(raw: any, req?: OrcaRequest): OrcaResponse {
  const activeTrip = getActiveTrip();
  const riskStatus: AssessmentStatus =
    raw?.risk?.status || raw?.risk?.risk_status || 'SAFE';

  const riskScore: number = raw?.risk?.risk_score ?? 0;

  const summaryText: string =
    raw?.recommendation ||
    (raw?.risk?.reasons && raw?.risk?.reasons.length > 0
      ? raw.risk.reasons.join(' ')
      : `Overall status is ${riskStatus} (Risk score: ${riskScore}/100).`);

  // PFZ Mapping
  const pfzRaw = raw?.pfz || {};
  const isPfzAvailable = pfzRaw.status === 'success';
  const pfzDetails = pfzRaw.pfz || {};
  const pfzNearest = pfzDetails.nearest || pfzDetails.nearest_point || undefined;
  const pfzMetadata = {
    category: pfzDetails.category,
    uid: pfzDetails.uid,
    sno: pfzDetails.sno,
    data_year: pfzDetails.data_year,
    julian_day: pfzDetails.julian_day,
    valid_until: pfzDetails.valid_until,
  };
  const topCandidates =
    (Array.isArray(pfzRaw?.top_candidates) && pfzRaw.top_candidates.length > 0)
      ? pfzRaw.top_candidates
      : (raw?.top_pfz || pfzDetails?.top_candidates || raw?.ui_action?.top_candidates || []);

  // Marine Weather Mapping
  const marineWeatherRaw = raw?.marine_weather || {};
  const weatherData = marineWeatherRaw.weather || {};
  const marineData = marineWeatherRaw.marine || {};
  const isMarineAvailable = marineWeatherRaw.status === 'success' || marineWeatherRaw.status === 'partial' || Boolean(weatherData.temperature_c !== undefined || marineData.wave_height_m !== undefined);

  // SVAS Mapping
  const svasRaw = raw?.svas || {};
  const isSvasAvailable = svasRaw.status === 'success';
  const svasAdvisory = svasRaw.advisory || {};

  // Hazards Mapping from Ocean Analysis
  const oceanRaw = raw?.ocean_analysis || {};
  const warningsList: any[] = Array.isArray(oceanRaw.warnings) ? oceanRaw.warnings : [];
  const hazardsList: Hazard[] = warningsList.map((w: any, idx: number) => ({
    id: `hazard-${idx}`,
    type: w.type || 'Environmental Warning',
    severity: (w.severity?.toUpperCase() as SeverityLevel) || 'MEDIUM',
    title: w.type || 'Ocean Advisory',
    description: w.message || 'Environmental hazard reported.',
  }));

  const requestId = raw?.request_id || req?.request_id;

  // Map structured alerts from backend (deterministic alert generator)
  const rawAlerts: Alert[] = Array.isArray(raw?.alerts) ? raw.alerts.map((a: any) => ({
    id: a.id || `alert-${a.source || 'orca'}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    request_id: a.request_id || requestId,
    type: a.type || 'risk',
    severity: (a.severity || 'info').toLowerCase() as any,
    title: a.title || 'Marine Alert',
    message: a.message || '',
    source: a.source || 'orca',
    timestamp: a.timestamp || new Date().toISOString(),
    action: a.action,
  })) : [];

  // Deduplicate alerts by type+severity+title+message+source
  const alertDeduplicationKeys = new Set<string>();
  const dedupedAlerts: Alert[] = [];
  for (const alert of rawAlerts) {
    const key = `${alert.type.trim().toLowerCase()}|${alert.severity.trim().toLowerCase()}|${alert.title.trim().toLowerCase()}|${alert.message.trim().toLowerCase()}|${alert.source.trim().toLowerCase()}`;
    if (!alertDeduplicationKeys.has(key)) {
      alertDeduplicationKeys.add(key);
      dedupedAlerts.push(alert);
    }
  }

  // Display Flags Mapping
  const displayFlags = {
    pfz: Boolean(raw?.display?.pfz),
    pfz_mode: raw?.display?.pfz_mode || (raw?.display?.pfz ? (topCandidates.length === 1 ? 'single_pfz' : 'pfz_list') : 'none'),
    risk_explanation: Boolean(raw?.display?.risk_explanation),
    marine: Boolean(raw?.display?.marine ?? isMarineAvailable),
    svas: Boolean(raw?.display?.svas ?? (raw?.svas?.status === 'success' || raw?.svas?.status === 'partial')),
    ocean_hazards: Boolean(raw?.display?.ocean_hazards ?? (raw?.ocean_analysis?.status === 'success' || raw?.ocean_analysis?.status === 'partial')),
    risk_assessment: Boolean(raw?.display?.risk_assessment ?? (raw?.risk_required || raw?.risk?.status)),
    map_action: Boolean(raw?.display?.map_action ?? (raw?.ui_action != null)),
  };

  return {
    request_id: requestId,
    request: req || {
      latitude: raw?.location?.latitude ?? raw?.input?.latitude ?? activeTrip.location.latitude,
      longitude: raw?.location?.longitude ?? raw?.input?.longitude ?? activeTrip.location.longitude,
      date: raw?.date ?? raw?.input?.date ?? activeTrip.date ?? getTodayDateISO(),
      boat_width_m: raw?.boat_width_m ?? raw?.input?.boat_width_m ?? activeTrip.boatWidthM ?? 5.0,
      query: raw?.query ?? raw?.input?.query,
      request_id: requestId,
    },
    assessment: {
      status: riskStatus,
      risk_score: riskScore,
      summary: summaryText,
    },
    pfz: {
      available: isPfzAvailable,
      nearest: pfzNearest,
      geometry: pfzDetails.geometry,
      metadata: pfzMetadata,
      top_candidates: topCandidates.length > 0 ? topCandidates : undefined,
      selected_rank: pfzRaw?.selected_rank,
      total_candidates: pfzRaw?.total_candidates,
      message: pfzRaw.error || pfzRaw.reason || (isPfzAvailable ? undefined : (raw?.pfz !== undefined ? 'PFZ data feed is currently unavailable.' : undefined)),
    },
    top_pfz: topCandidates.length > 0 ? topCandidates : undefined,
    display: displayFlags,
    marine: {
      available: isMarineAvailable,
      temperature_c: weatherData.temperature_c ?? marineData.temperature_c,
      wind_speed_knots: weatherData.wind_speed_knots ?? marineData.wind_speed_knots,
      wind_gusts_knots: weatherData.wind_gusts_knots ?? marineData.wind_gusts_knots,
      wave_height_m: marineData.wave_height_m ?? weatherData.wave_height_m,
      wave_period_seconds: marineData.wave_period_seconds ?? weatherData.wave_period_seconds,
      sea_surface_temperature_c: marineData.sea_surface_temperature_c ?? weatherData.sea_surface_temperature_c,
      ocean_current_velocity_kmh: marineData.ocean_current_velocity_kmh ?? weatherData.ocean_current_velocity_kmh,
      wind_direction_degrees: weatherData.wind_direction_degrees ?? marineData.wind_direction_degrees,
      wave_direction_degrees: marineData.wave_direction_degrees ?? weatherData.wave_direction_degrees,
      ocean_current_direction_degrees: marineData.ocean_current_direction_degrees ?? weatherData.ocean_current_direction_degrees,
    },
    svas: {
      available: isSvasAvailable,
      district: svasRaw.area?.district || svasAdvisory.district,
      state: svasRaw.area?.state || svasAdvisory.state,
      severity: svasAdvisory.severity,
      message: svasAdvisory.message || svasRaw.reason || svasRaw.error || (isSvasAvailable ? undefined : (raw?.svas !== undefined ? 'Small Vessel Advisory Service (SVAS) data is currently unavailable from official feeds.' : undefined)),
      reason: svasRaw.reason,
    },
    hazards: hazardsList,
    alerts: dedupedAlerts,
    meta: {
      generated_at: raw?.timestamp || new Date().toISOString(),
      sources: raw?.risk?.source_status ? Object.keys(raw.risk.source_status) : [],
      version: '1.0.0',
      request_id: requestId,
    },
    recommendation: raw?.recommendation,
    risk_explanation: raw?.risk_explanation || raw?.risk?.explanation_card || undefined,
    language: raw?.language,
    original_recommendation: raw?.original_recommendation,
    audio_base64: raw?.audio_base64,
    ui_action: raw?.ui_action ? {
      type: raw.ui_action.type || 'show_on_map',
      target: raw.ui_action.target,
      rank: raw.ui_action.rank,
      coordinates: raw.ui_action.coordinates,
      label: raw.ui_action.label,
      zoom: raw.ui_action.zoom,
      geometry: raw.ui_action.geometry,
      top_candidates: raw.ui_action.top_candidates || (topCandidates.length > 0 ? topCandidates : undefined),
    } : undefined,
  };
}

/**
 * Primary API method to fetch marine condition assessment.
 * Calls POST /api/orca/assess on backend.
 */
export async function getOrcaAssessment(request: OrcaRequest): Promise<OrcaResponse> {
  const activeTrip = getActiveTrip();
  const effectiveRequest: OrcaRequest = {
    query: request.query || `Check conditions for ${activeTrip.location.name}`,
    latitude: request.latitude ?? activeTrip.location.latitude,
    longitude: request.longitude ?? activeTrip.location.longitude,
    date: request.date ?? activeTrip.date ?? getTodayDateISO(),
    boat_width_m: request.boat_width_m ?? activeTrip.boatWidthM ?? 5.0,
    request_id: request.request_id || `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    session_id: request.session_id,
    language: request.language,
    generate_audio: request.generate_audio,
  };

  if (USE_MOCK_API) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const mockData = getMockResponseForRequest(effectiveRequest);
    notifyAssessmentListeners(mockData);
    return mockData;
  }

  // Track this as the latest request for race condition prevention
  setLatestRequestId(effectiveRequest.request_id || null);

  try {
    const endpoint = `${getBaseUrl()}/api/orca/assess`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: effectiveRequest.query,
        latitude: effectiveRequest.latitude,
        longitude: effectiveRequest.longitude,
        date: effectiveRequest.date,
        boat_width_m: effectiveRequest.boat_width_m,
        request_id: effectiveRequest.request_id,
        session_id: effectiveRequest.session_id,
        language: effectiveRequest.language,
        generate_audio: effectiveRequest.generate_audio,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Server returned status ${response.status}: ${errText || response.statusText}`);
    }

    const rawData = await response.json();
    const normalized: OrcaResponse = normalizeBackendResponse(rawData, effectiveRequest);

    console.log(`[ORCA ALERTS DEBUG] Request ID: ${effectiveRequest.request_id}`);
    console.log(`[ORCA ALERTS DEBUG] Alerts received: ${normalized.alerts?.length ?? 0}`);
    console.log(`[ORCA ALERTS DEBUG] Alert IDs:`, normalized.alerts?.map(a => a.id));

    notifyAssessmentListeners(normalized);
    return normalized;
  } catch (error: any) {
    console.error('ORCA API request failed:', error);
    throw new Error(error?.message || 'ORCA could not fetch the latest conditions.');
  }
}

// Persistent chat session identifier
let persistentChatSessionId: string = `sess-chat-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

export function getChatSessionId(): string {
  return persistentChatSessionId;
}

export function resetChatSessionId(): string {
  persistentChatSessionId = `sess-chat-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  return persistentChatSessionId;
}

/**
 * Natural language chat query method for the "Ask ORCA" screen.
 * Calls POST /api/orca/assess using the active trip context and conversational session.
 */
export async function queryOrcaAssistant(
  queryText: string,
  context?: Partial<OrcaRequest>
): Promise<{ text: string; assessment?: OrcaResponse; rawBackendResponse?: any; requestId?: string; uiAction?: any; audioBase64?: string }> {
  const activeTrip = getActiveTrip();
  const targetLatitude = context?.latitude ?? activeTrip.location.latitude;
  const targetLongitude = context?.longitude ?? activeTrip.location.longitude;
  const targetDate = context?.date ?? activeTrip.date ?? getTodayDateISO();
  const targetBoatWidth = context?.boat_width_m ?? activeTrip.boatWidthM ?? 5.0;
  const sessionId = context?.session_id || persistentChatSessionId;
  const preferredLang = context?.language || 'en';
  const shouldGenAudio = context?.generate_audio ?? false;

  if (USE_MOCK_API) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const current = getCurrentAssessment();
    const status = current.assessment.status;
    const pfzDist = current.pfz.nearest?.distance_km;
    const pfzDir = current.pfz.nearest?.direction;
    const waves = current.marine.wave_height_m;
    const wind = current.marine.wind_speed_knots;

    const lower = queryText.toLowerCase();

    if (lower.includes('can i go') || lower.includes('safe') || lower.includes('tomorrow')) {
      if (status === 'SAFE') {
        return {
          text: `Yes, it looks SAFE to go fishing tomorrow! Waves are around ${waves ?? 1.2} m with calm winds of ${wind ?? 8} knots. Your nearest fishing zone is ${pfzDist ?? 25} km away (${pfzDir ?? 'W'}).`,
          assessment: current,
        };
      } else if (status === 'CAUTION') {
        return {
          text: `Fishing requires CAUTION tomorrow. ${current.svas.message || 'Stronger wind gusts expected.'} If your vessel is under 6m, consider staying closer to shore or waiting for calmer water.`,
          assessment: current,
        };
      } else {
        return {
          text: `Sailing is NOT RECOMMENDED tomorrow due to rough sea conditions and active weather warnings. Please prioritize safety and stay in port.`,
          assessment: current,
        };
      }
    }

    return {
      text: `Based on your selected location (${activeTrip.location.name}) and boat size, overall conditions are rated ${status} (Risk score: ${current.assessment.risk_score}/100). Nearest fishing zone is ${pfzDist ?? 39.0} km away. Stay safe and monitor alerts!`,
      assessment: current,
    };
  }

  const clientRequestId = context?.request_id || `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const reqBody: OrcaRequest = {
    query: queryText,
    latitude: targetLatitude,
    longitude: targetLongitude,
    date: targetDate,
    boat_width_m: targetBoatWidth,
    request_id: clientRequestId,
    session_id: sessionId,
    conversation_history: context?.conversation_history,
    language: preferredLang,
    generate_audio: shouldGenAudio,
  };

  setLatestRequestId(clientRequestId);

  try {
    const endpoint = `${getBaseUrl()}/api/orca/assess`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: reqBody.query,
        latitude: reqBody.latitude,
        longitude: reqBody.longitude,
        date: reqBody.date,
        boat_width_m: reqBody.boat_width_m,
        request_id: reqBody.request_id,
        session_id: reqBody.session_id,
        conversation_history: reqBody.conversation_history,
        language: reqBody.language,
        generate_audio: reqBody.generate_audio,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`API error ${response.status}: ${errText || response.statusText}`);
    }

    const data = await response.json();
    const normalized = normalizeBackendResponse(data, reqBody);

    const answerText = data.recommendation || normalized.assessment.summary || 'Assessment received from ORCA.';

    return {
      text: answerText,
      assessment: normalized,
      rawBackendResponse: data,
      requestId: data.request_id || clientRequestId,
      uiAction: normalized.ui_action,
      audioBase64: data.audio_base64 || normalized.audio_base64,
    };
  } catch (error: any) {
    console.error('queryOrcaAssistant live backend error:', error);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Bhashini Multilingual & Voice Dedicated API Helpers
// -----------------------------------------------------------------------------

export async function detectLanguage(text: string): Promise<{ language: string; confidence: number; language_name: string }> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/language/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('detectLanguage failed, defaulting to en:', err);
    return { language: 'en', confidence: 1.0, language_name: 'English' };
  }
}

export async function translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
  if (!text || sourceLang === targetLang) return text;
  try {
    const res = await fetch(`${getBaseUrl()}/api/language/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        source_language: sourceLang,
        target_language: targetLang,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.translated_text || text;
  } catch (err) {
    console.warn('translateText failed, returning original:', err);
    return text;
  }
}

export async function transcribeAudio(audioBase64: string, language: string = 'mr'): Promise<{ transcript: string; language: string }> {
  const res = await fetch(`${getBaseUrl()}/api/language/speech-to-text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audio_base64: audioBase64,
      language,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Speech-to-text error (${res.status}): ${text}`);
  }
  const data = await res.json();
  return {
    transcript: data.transcript,
    language: data.language || language,
  };
}

export async function synthesizeSpeech(text: string, language: string = 'mr'): Promise<string | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/language/text-to-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        language,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.audio_base64 || null;
  } catch (err) {
    console.warn('synthesizeSpeech failed:', err);
    return null;
  }
}


