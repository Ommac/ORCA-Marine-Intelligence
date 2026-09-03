/**
 * ORCA Centralized API Service
 * 
 * Central data gateway for all screens and components.
 * Consumes and returns strictly normalized OrcaResponse objects.
 */

import { OrcaRequest, OrcaResponse } from '../types/orca';
import { getMockResponseForRequest, MOCK_PALGHAR_RESPONSE } from '../mocks/orcaResponse';

// Configuration Flag: Set to true for offline mock mode, or false to call live backend
export const USE_MOCK_API = true;

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
 * Primary API method to fetch marine condition assessment.
 * Handles both Mock Mode and Live Backend REST calls.
 */
export async function getOrcaAssessment(request: OrcaRequest): Promise<OrcaResponse> {
  if (USE_MOCK_API) {
    // Simulate network latency (1000ms) for realistic UX and loading feedback
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const mockData = getMockResponseForRequest(request);
    notifyAssessmentListeners(mockData);
    return mockData;
  }

  try {
    const endpoint = `${BASE_URL.replace(/\/+$/, '')}/api/orca/query`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}: ${response.statusText}`);
    }

    const data: OrcaResponse = await response.json();
    notifyAssessmentListeners(data);
    return data;
  } catch (error: any) {
    console.error('ORCA API request failed:', error);
    throw new Error(error?.message || 'ORCA could not fetch the latest conditions.');
  }
}

/**
 * Natural language chat query method for the "Ask ORCA" screen.
 */
export async function queryOrcaAssistant(
  queryText: string,
  context?: Partial<OrcaRequest>
): Promise<{ text: string; assessment?: OrcaResponse }> {
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

    if (lower.includes('pfz') || lower.includes('zone') || lower.includes('fish')) {
      return {
        text: `The nearest Potential Fishing Zone is located ${pfzDist ?? 39.0} km away in direction ${pfzDir ?? 'W'}. You can view the live zone polygon and route on the Map tab!`,
        assessment: current,
      };
    }

    if (lower.includes('wave') || lower.includes('wind') || lower.includes('weather')) {
      return {
        text: `Current sea conditions: Waves are ${waves ?? 1.4} m with period of ${current.marine.wave_period_seconds ?? 8.0}s. Wind is ${wind ?? 8.7} knots with peak gusts up to ${current.marine.wind_gusts_knots ?? 18.3} knots.`,
        assessment: current,
      };
    }

    return {
      text: `Based on your selected location and boat size, overall conditions are rated ${status} (Risk score: ${current.assessment.risk_score}/100). Nearest fishing zone is ${pfzDist ?? 39.0} km away. Stay safe and monitor alerts!`,
      assessment: current,
    };
  }

  // Real backend call
  try {
    const endpoint = `${BASE_URL.replace(/\/+$/, '')}/api/orca/query`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: queryText,
        latitude: context?.latitude ?? currentAssessmentState.request?.latitude ?? 19.72,
        longitude: context?.longitude ?? currentAssessmentState.request?.longitude ?? 72.70,
        date: context?.date ?? currentAssessmentState.request?.date ?? '2026-09-03',
        boat_width_m: context?.boat_width_m ?? currentAssessmentState.request?.boat_width_m ?? 5.0,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: OrcaResponse = await response.json();
    notifyAssessmentListeners(data);
    return {
      text: data.assessment.summary || 'Assessment updated.',
      assessment: data,
    };
  } catch (error: any) {
    return {
      text: 'Sorry, I could not connect to the ORCA network right now. Please try again in a few moments.',
    };
  }
}
