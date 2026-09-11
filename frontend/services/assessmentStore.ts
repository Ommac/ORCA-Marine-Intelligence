/**
 * ORCA Centralized Assessment Store
 * ---------------------------------
 * Manages the active assessment result and subscribers across screens.
 * Decoupled from tripStore and api to eliminate circular dependencies.
 */

import { OrcaResponse, AssessmentStatus, PFZCandidate } from '../types/orca';

export const EMPTY_INITIAL_ASSESSMENT: OrcaResponse = {
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

let currentAssessmentState: OrcaResponse = EMPTY_INITIAL_ASSESSMENT;
let latestRequestId: string | null = null;
let selectedPFZId: string | null = null;

export type AssessmentListener = (response: OrcaResponse) => void;
const listeners: Set<AssessmentListener> = new Set();

export type SelectedPFZListener = (id: string | null) => void;
const pfzListeners: Set<SelectedPFZListener> = new Set();

export function getCurrentAssessment(): OrcaResponse {
  return currentAssessmentState;
}

export function clearCurrentAssessment(): void {
  currentAssessmentState = EMPTY_INITIAL_ASSESSMENT;
  latestRequestId = null;
  selectedPFZId = null;
  notifyAssessmentListeners(EMPTY_INITIAL_ASSESSMENT);
  notifyPFZListeners(null);
}

export function subscribeToAssessment(listener: AssessmentListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeToSelectedPFZ(listener: SelectedPFZListener): () => void {
  pfzListeners.add(listener);
  listener(selectedPFZId);
  return () => {
    pfzListeners.delete(listener);
  };
}

function notifyPFZListeners(id: string | null): void {
  pfzListeners.forEach((listener) => {
    try {
      listener(id);
    } catch (err) {
      console.error('Error notifying selected PFZ listener:', err);
    }
  });
}

export function notifyAssessmentListeners(response: OrcaResponse): void {
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

export function setAssessmentState(response: OrcaResponse): void {
  notifyAssessmentListeners(response);
}

export function setLatestRequestId(id: string | null): void {
  latestRequestId = id;
}

export function getLatestRequestId(): string | null {
  return latestRequestId;
}

export function getSelectedPFZId(): string | null {
  return selectedPFZId;
}

export function setSelectedPFZId(id: string | null): void {
  selectedPFZId = id;
  notifyPFZListeners(id);
}

/**
 * Single source of truth for resolving the active selected PFZ candidate.
 * Strictly avoids using nearest PFZ when a candidate is selected.
 */
export function getSelectedPFZ(response?: OrcaResponse | null, explicitId?: string | null): PFZCandidate | null {
  const data = response || currentAssessmentState;
  const topCandidates: PFZCandidate[] = (data?.pfz?.top_candidates || data?.top_pfz || []) as PFZCandidate[];
  const targetId = explicitId !== undefined && explicitId !== null ? explicitId : selectedPFZId;

  if (topCandidates.length > 0) {
    if (targetId) {
      const match = topCandidates.find((c) => c.id === targetId);
      if (match) return match;
      const rankNum = Number(targetId);
      if (!isNaN(rankNum)) {
        const matchRank = topCandidates.find((c) => c.rank === rankNum);
        if (matchRank) return matchRank;
      }
    }
    // Default to the first candidate (or recommended) if targetId is invalid or unset
    return topCandidates.find((c) => c.recommended) || topCandidates[0];
  }

  // Fallback when only nearest single point is available
  if (data?.pfz?.available && data?.pfz?.nearest) {
    const nearest = data.pfz.nearest;
    return {
      id: 'pfz-nearest',
      rank: 1,
      label: 'Nearest PFZ',
      name: 'Potential Fishing Zone #1',
      distance_km: nearest.distance_km,
      bearing_degrees: nearest.bearing_degrees,
      direction: nearest.direction,
      coordinates: {
        latitude: nearest.latitude,
        longitude: nearest.longitude,
      },
      geometry: data.pfz.geometry,
      category: typeof data.pfz.metadata?.category === 'string' ? data.pfz.metadata.category : 'Potential Fishing Zone',
      uid: data.pfz.metadata?.uid as string | number | undefined,
      sno: data.pfz.metadata?.sno as string | number | undefined,
      data_year: data.pfz.metadata?.data_year as number | undefined,
      julian_day: data.pfz.metadata?.julian_day as number | undefined,
      valid_until: (data.pfz.metadata?.valid_until as string | null | undefined) || null,
      recommended: true,
      recommendation_reason: 'Nearest identified zone.',
    };
  }

  return null;
}
