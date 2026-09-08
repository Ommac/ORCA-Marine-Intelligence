import { UIAction, PFZCandidate } from '../types/orca';

export interface MapFocusTarget {
  coordinates: {
    latitude: number;
    longitude: number;
  };
  label?: string;
  zoom?: number;
  rank?: number;
  geometry?: any;
  top_candidates?: PFZCandidate[];
  timestamp: number;
}

type MapFocusListener = (target: MapFocusTarget | null) => void;

let currentFocusTarget: MapFocusTarget | null = null;
const listeners = new Set<MapFocusListener>();

export function setMapFocus(target: Omit<MapFocusTarget, 'timestamp'> | UIAction) {
  if (!target || !target.coordinates) return;
  const focusTarget: MapFocusTarget = {
    coordinates: target.coordinates,
    label: target.label,
    zoom: target.zoom || 11,
    rank: target.rank,
    geometry: target.geometry,
    top_candidates: (target as any).top_candidates,
    timestamp: Date.now(),
  };
  currentFocusTarget = focusTarget;
  listeners.forEach((listener) => {
    try {
      listener(focusTarget);
    } catch (err) {
      console.error('Error notifying map focus listener:', err);
    }
  });
}

export function getMapFocus(): MapFocusTarget | null {
  return currentFocusTarget;
}

export function clearMapFocus() {
  currentFocusTarget = null;
  listeners.forEach((listener) => {
    try {
      listener(null);
    } catch (err) {
      console.error('Error clearing map focus listener:', err);
    }
  });
}

export function subscribeToMapFocus(listener: MapFocusListener): () => void {
  listeners.add(listener);
  if (currentFocusTarget) {
    listener(currentFocusTarget);
  }
  return () => {
    listeners.delete(listener);
  };
}
