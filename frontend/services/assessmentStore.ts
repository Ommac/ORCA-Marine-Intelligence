/**
 * ORCA Centralized Assessment Store
 * ---------------------------------
 * Manages the authoritative assessment state (conditions, PFZ, marine, SVAS, alerts, risk).
 * Provides synchronous in-memory access and reactive subscriptions across all screens.
 */

import { OrcaResponse, AssessmentStatus } from '../types/orca';

export type AssessmentListener = (response: OrcaResponse) => void;

// Empty initial assessment state — no stale/mock data before first real assessment
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

let currentAssessmentState: OrcaResponse = { ...EMPTY_INITIAL_ASSESSMENT };
const listeners: Set<AssessmentListener> = new Set();
let latestRequestId: string | null = null;
let selectedPFZIdState: string | null = null;

export function getCurrentAssessment(): OrcaResponse {
  return currentAssessmentState;
}

export function getSelectedPFZId(): string | null {
  return selectedPFZIdState;
}

export function setSelectedPFZId(id: string | null): void {
  selectedPFZIdState = id;
  notifyListeners(currentAssessmentState);
}

export function getLatestRequestId(): string | null {
  return latestRequestId;
}

export function setLatestRequestId(id: string | null): void {
  latestRequestId = id;
}

export function subscribeToAssessment(listener: AssessmentListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setAssessmentState(response: OrcaResponse): void {
  const incomingRequestId = response.request_id || response.meta?.request_id;
  if (latestRequestId && incomingRequestId && incomingRequestId !== latestRequestId) {
    console.warn(`[ORCA ALERTS] Ignoring stale response: ${incomingRequestId} (latest: ${latestRequestId})`);
    return;
  }
  currentAssessmentState = response;
  notifyListeners(response);
}

export function clearCurrentAssessment(): void {
  latestRequestId = null;
  selectedPFZIdState = null;
  currentAssessmentState = { ...EMPTY_INITIAL_ASSESSMENT };
  notifyListeners(currentAssessmentState);
}

function notifyListeners(response: OrcaResponse): void {
  listeners.forEach((listener) => {
    try {
      listener(response);
    } catch (err) {
      console.error('Error notifying assessment listener:', err);
    }
  });
}
