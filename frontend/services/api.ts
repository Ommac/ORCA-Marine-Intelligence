/**
 * ORCA Centralized API Service
 * 
 * Central data gateway for all screens and components.
 * Consumes and returns strictly normalized OrcaResponse objects from the live ORCA backend.
 */

import { OrcaRequest, OrcaResponse, AssessmentStatus, SeverityLevel, Hazard, Alert, PFZCandidate, UIAction } from '../types/orca';
import { getMockResponseForRequest, MOCK_PALGHAR_RESPONSE } from '../mocks/orcaResponse';
import { getActiveTrip, getTodayDateISO, setActiveLocation, setActiveDate, setActiveBoatWidth } from './tripStore';

// Configuration Flag: Set to false for live backend API calls (POST /api/orca/assess)
export const USE_MOCK_API = false;

// Backend Base URL configured via environment variable
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

// Empty initial assessment — no mock/hardcoded data before first real assessment
const EMPTY_INITIAL_ASSESSMENT: OrcaResponse = {
  assessment: {
    status: 'SAFE' as AssessmentStatus,
    risk_score: 0,
    summary: '',
  },
  pfz: { available: false },
  marine: { available: false },
  svas: { available: false },
  hazards: [],
  alerts: [],
  meta: {},
};

// In-memory active session cache so tabs share the same trip state seamlessly
let currentAssessmentState: OrcaResponse = EMPTY_INITIAL_ASSESSMENT;

type AssessmentListener = (response: OrcaResponse) => void;
const listeners: Set<AssessmentListener> = new Set();

// Race condition guard: tracks the most recent request to prevent stale responses
let latestRequestId: string | null = null;

export function getCurrentAssessment(): OrcaResponse {
  return currentAssessmentState;
}

export function subscribeToAssessment(listener: AssessmentListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyAssessmentListeners(response: OrcaResponse) {
  // Race condition guard: only update if this is the latest request
  const incomingRequestId = response.request_id || response.meta?.request_id;
  if (latestRequestId && incomingRequestId && incomingRequestId !== latestRequestId) {
    console.warn(`[ORCA ALERTS] Ignoring stale response: ${incomingRequestId} (latest: ${latestRequestId})`);
    return;
  }
  currentAssessmentState = response;
  listeners.forEach((listener) => {
    try {
      listener(response);
    } catch (err) {
      console.error('Error notifying assessment listener:', err);
    }
  });
}

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
  const topCandidates: PFZCandidate[] = raw?.top_pfz || pfzRaw?.top_candidates || pfzDetails?.top_candidates || raw?.ui_action?.top_candidates || [];

  // Marine Weather Mapping
  const marineWeatherRaw = raw?.marine_weather || {};
  const isMarineAvailable = marineWeatherRaw.status === 'success';
  const weatherData = marineWeatherRaw.weather || {};
  const marineData = marineWeatherRaw.marine || {};

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

  return {
    request_id: requestId,
    request: req || {
      latitude: raw?.location?.latitude ?? raw?.input?.latitude ?? activeTrip.location.latitude,
      longitude: raw?.location?.longitude ?? raw?.input?.longitude ?? activeTrip.location.longitude,
      date: raw?.date ?? raw?.input?.date ?? activeTrip.date ?? getTodayDateISO(),
      boat_width_m: raw?.boat_width_m ?? raw?.input?.boat_width_m ?? activeTrip.boatWidthM ?? 5.0,
      query: raw?.query ?? raw?.input?.query,
      request_id: requestId,
      session_id: raw?.session_id,
      language: raw?.language,
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
      message: pfzRaw.error || pfzRaw.reason || (isPfzAvailable ? undefined : 'PFZ data feed is currently unavailable.'),
    },
    top_pfz: topCandidates.length > 0 ? topCandidates : undefined,
    display: raw?.display ? {
      pfz: Boolean(raw?.display?.pfz),
      pfz_mode: raw?.display?.pfz_mode || (raw?.display?.pfz ? (topCandidates.length === 1 ? 'single_pfz' : 'pfz_list') : 'none'),
      risk_explanation: Boolean(raw?.display?.risk_explanation),
      marine: Boolean(raw?.display?.marine ?? (raw?.marine_weather?.status === 'success')),
      svas: Boolean(raw?.display?.svas ?? (raw?.svas?.status === 'success')),
      ocean_hazards: Boolean(raw?.display?.ocean_hazards ?? (raw?.ocean_analysis?.status === 'success')),
      risk_assessment: Boolean(raw?.display?.risk_assessment ?? (raw?.risk_required || raw?.risk?.status)),
      map_action: Boolean(raw?.display?.map_action ?? (raw?.ui_action != null)),
    } : undefined,
    marine: {
      available: isMarineAvailable,
      temperature_c: weatherData.temperature_c,
      wind_speed_knots: weatherData.wind_speed_knots,
      wind_gusts_knots: weatherData.wind_gusts_knots,
      wave_height_m: marineData.wave_height_m,
      wave_period_seconds: marineData.wave_period_seconds,
      sea_surface_temperature_c: marineData.sea_surface_temperature_c,
      ocean_current_velocity_kmh: marineData.ocean_current_velocity_kmh,
      wind_direction_degrees: weatherData.wind_direction_degrees,
      wave_direction_degrees: marineData.wave_direction_degrees,
      ocean_current_direction_degrees: marineData.ocean_current_direction_degrees,
    },
    svas: {
      available: isSvasAvailable,
      district: svasRaw.area?.district || svasAdvisory.district,
      state: svasRaw.area?.state || svasAdvisory.state,
      severity: svasAdvisory.severity,
      message: svasAdvisory.message || svasRaw.reason || svasRaw.error || (isSvasAvailable ? undefined : 'Small Vessel Advisory Service (SVAS) data is currently unavailable from official feeds for this location/date.'),
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
    language: raw?.language || req?.language,
    language_name: raw?.language_name,
    original_query: raw?.original_query || req?.query,
    translated_query: raw?.translated_query,
    original_recommendation: raw?.original_recommendation,
    audio_base64: raw?.audio_base64,
    audio_format: raw?.audio_format || 'wav',
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
  };

  if (USE_MOCK_API) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const mockData = getMockResponseForRequest(effectiveRequest);
    notifyAssessmentListeners(mockData);
    return mockData;
  }

  // Track this as the latest request for race condition prevention
  latestRequestId = effectiveRequest.request_id || null;

  try {
    const endpoint = `${BASE_URL.replace(/\/+$/, '')}/api/orca/assess`;
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
 * Calls POST /api/orca/assess using the active trip context.
 */
export interface QueryOrcaResult {
  text: string;
  assessment?: OrcaResponse;
  rawBackendResponse?: any;
  requestId?: string;
  uiAction?: any;
  audioBase64?: string | null;
  audioFormat?: string;
  language?: string;
  originalRecommendation?: string;
}

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
];

/**
 * Natural language chat query method for the "Ask ORCA" screen.
 * Calls POST /api/orca/assess using the active trip context and conversational session.
 * Supports Bhashini multilingual translation, speech-to-text, and voice synthesis.
 */
export async function queryOrcaAssistant(
  queryText: string,
  context?: Partial<OrcaRequest>
): Promise<QueryOrcaResult> {
  const activeTrip = getActiveTrip();
  const targetLatitude = context?.latitude ?? activeTrip.location.latitude;
  const targetLongitude = context?.longitude ?? activeTrip.location.longitude;
  const targetDate = context?.date ?? activeTrip.date ?? getTodayDateISO();
  const targetBoatWidth = context?.boat_width_m ?? activeTrip.boatWidthM ?? 5.0;
  const sessionId = context?.session_id || persistentChatSessionId;
  const language = context?.language || 'auto';

  if (USE_MOCK_API) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const current = getCurrentAssessment();
    const status = current.assessment.status;
    const pfzDist = current.pfz.nearest?.distance_km;
    const pfzDir = current.pfz.nearest?.direction;
    const waves = current.marine.wave_height_m;
    const wind = current.marine.wind_speed_knots;

    const lower = queryText.toLowerCase();
    let text = `Based on your selected location (${activeTrip.location.name}) and boat size, overall conditions are rated ${status} (Risk score: ${current.assessment.risk_score}/100). Nearest fishing zone is ${pfzDist ?? 39.0} km away. Stay safe and monitor alerts!`;

    if (lower.includes('can i go') || lower.includes('safe') || lower.includes('tomorrow')) {
      if (status === 'SAFE') {
        text = `Yes, it looks SAFE to go fishing tomorrow! Waves are around ${waves ?? 1.2} m with calm winds of ${wind ?? 8} knots. Your nearest fishing zone is ${pfzDist ?? 25} km away (${pfzDir ?? 'W'}).`;
      } else if (status === 'CAUTION') {
        text = `Fishing requires CAUTION tomorrow. ${current.svas.message || 'Stronger wind gusts expected.'} If your vessel is under 6m, consider staying closer to shore or waiting for calmer water.`;
      } else {
        text = `Sailing is NOT RECOMMENDED tomorrow due to rough sea conditions and active weather warnings. Please prioritize safety and stay in port.`;
      }
    }

    if (language === 'mr') {
      text = `[मराठी] ${text}`;
    } else if (language === 'hi') {
      text = `[हिन्दी] ${text}`;
    }

    return {
      text,
      assessment: current,
      language,
      audioBase64: 'UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
      audioFormat: 'wav',
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
    language: context?.language,
    audio_base64: context?.audio_base64,
    audio_format: context?.audio_format || 'wav',
    enable_tts: context?.enable_tts ?? true,
  };

  latestRequestId = clientRequestId;

  try {
    const endpoint = `${BASE_URL.replace(/\/+$/, '')}/api/orca/assess`;
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
        audio_base64: reqBody.audio_base64,
        audio_format: reqBody.audio_format,
        enable_tts: reqBody.enable_tts,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`API error ${response.status}: ${errText || response.statusText}`);
    }

    const data = await response.json();
    const normalized = normalizeBackendResponse(data, reqBody);

    console.log(`[ORCA CHAT QUERY DATA] Request ID: ${data.request_id || clientRequestId}`);
    console.log(`[ORCA CHAT QUERY DATA] Status: ${normalized.assessment.status}, Intent: ${data.intent}, Lang: ${data.language}`);

    notifyAssessmentListeners(normalized);

    const answerText = data.recommendation || normalized.assessment.summary || 'Assessment received from ORCA.';

    return {
      text: answerText,
      assessment: normalized,
      rawBackendResponse: data,
      requestId: data.request_id || clientRequestId,
      uiAction: normalized.ui_action,
      audioBase64: data.audio_base64,
      audioFormat: data.audio_format || 'wav',
      language: data.language,
      originalRecommendation: data.original_recommendation,
    };
  } catch (error: any) {
    console.error('queryOrcaAssistant live backend error:', error);
    throw error;
  }
}
