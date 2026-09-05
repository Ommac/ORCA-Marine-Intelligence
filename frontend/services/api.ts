/**
 * ORCA Centralized API Service
 * 
 * Central data gateway for all screens and components.
 * Consumes and returns strictly normalized OrcaResponse objects from the live ORCA backend.
 */

import { OrcaRequest, OrcaResponse, AssessmentStatus, SeverityLevel, Hazard } from '../types/orca';
import { getMockResponseForRequest, MOCK_PALGHAR_RESPONSE } from '../mocks/orcaResponse';

// Configuration Flag: Set to false for live backend API calls (POST /api/orca/assess)
export const USE_MOCK_API = false;

// Backend Base URL configured via environment variable
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

// In-memory active session cache so tabs share the same trip state seamlessly
let currentAssessmentState: OrcaResponse = MOCK_PALGHAR_RESPONSE;

type AssessmentListener = (response: OrcaResponse) => void;
const listeners: Set<AssessmentListener> = new Set();

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
  const pfzNearest = pfzDetails.nearest || undefined;

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

  return {
    request: req || {
      latitude: raw?.input?.latitude ?? 19.72,
      longitude: raw?.input?.longitude ?? 72.70,
      date: raw?.input?.date ?? '2026-09-04',
      boat_width_m: raw?.input?.boat_width_m ?? 5.0,
      query: raw?.input?.query,
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
      message: pfzRaw.error || pfzRaw.reason || (isPfzAvailable ? undefined : 'PFZ data feed is currently unavailable.'),
    },
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
    meta: {
      generated_at: raw?.timestamp || new Date().toISOString(),
      sources: raw?.risk?.source_status ? Object.keys(raw.risk.source_status) : [],
      version: '1.0.0',
    },
    recommendation: raw?.recommendation,
  };
}

/**
 * Primary API method to fetch marine condition assessment.
 * Calls POST /api/orca/assess on backend.
 */
export async function getOrcaAssessment(request: OrcaRequest): Promise<OrcaResponse> {
  if (USE_MOCK_API) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const mockData = getMockResponseForRequest(request);
    notifyAssessmentListeners(mockData);
    return mockData;
  }

  try {
    const endpoint = `${BASE_URL.replace(/\/+$/, '')}/api/orca/assess`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: request.query || 'Check marine conditions for fishing.',
        latitude: request.latitude,
        longitude: request.longitude,
        date: request.date,
        boat_width_m: request.boat_width_m,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Server returned status ${response.status}: ${errText || response.statusText}`);
    }

    const rawData = await response.json();
    const normalized: OrcaResponse = normalizeBackendResponse(rawData, request);
    notifyAssessmentListeners(normalized);
    return normalized;
  } catch (error: any) {
    console.error('ORCA API request failed:', error);
    throw new Error(error?.message || 'ORCA could not fetch the latest conditions.');
  }
}

/**
 * Natural language chat query method for the "Ask ORCA" screen.
 * Calls POST /api/orca/assess
 */
export async function queryOrcaAssistant(
  queryText: string,
  context?: Partial<OrcaRequest>
): Promise<{ text: string; assessment?: OrcaResponse; rawBackendResponse?: any }> {
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
      text: `Based on your selected location and boat size, overall conditions are rated ${status} (Risk score: ${current.assessment.risk_score}/100). Nearest fishing zone is ${pfzDist ?? 39.0} km away. Stay safe and monitor alerts!`,
      assessment: current,
    };
  }

  const reqBody: OrcaRequest = {
    query: queryText,
    latitude: context?.latitude ?? currentAssessmentState.request?.latitude ?? 19.72,
    longitude: context?.longitude ?? currentAssessmentState.request?.longitude ?? 72.70,
    date: context?.date ?? currentAssessmentState.request?.date ?? '2026-09-04',
    boat_width_m: context?.boat_width_m ?? currentAssessmentState.request?.boat_width_m ?? 5.0,
  };

  try {
    const endpoint = `${BASE_URL.replace(/\/+$/, '')}/api/orca/assess`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(reqBody),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`API error ${response.status}: ${errText || response.statusText}`);
    }

    const data = await response.json();
    const normalized = normalizeBackendResponse(data, reqBody);
    notifyAssessmentListeners(normalized);

    const answerText = data.recommendation || normalized.assessment.summary || 'Assessment received from ORCA.';

    return {
      text: answerText,
      assessment: normalized,
      rawBackendResponse: data,
    };
  } catch (error: any) {
    console.error('queryOrcaAssistant live backend error:', error);
    throw error;
  }
}
