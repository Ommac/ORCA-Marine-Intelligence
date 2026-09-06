/**
 * ORCA Centralized Active Trip Store
 * ----------------------------------
 * Manages the active trip context (selected location coordinates, fishing date, boat size)
 * across all screens (Home, Map, Alerts, Ask ORCA, Assessment).
 * 
 * Features:
 * - Persists coordinates and date immediately upon selection to AsyncStorage.
 * - Restores stored trip on startup / reload.
 * - Calculates today's local date dynamically in YYYY-MM-DD format.
 * - Provides synchronous in-memory access and reactive subscriptions.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRESET_LOCATIONS } from '../constants/locations';
import { PresetLocation } from '../types/orca';
import { clearCurrentAssessment } from './api';

export interface TripLocation {
  id?: string;
  name: string;
  latitude: number;
  longitude: number;
  state?: string;
  district?: string;
  isCustom?: boolean;
}

export interface ActiveTripState {
  location: TripLocation;
  date: string; // ISO date format YYYY-MM-DD
  boatWidthM: number;
  hasUserSelectedLocation: boolean;
}

const STORAGE_KEY = '@orca_active_trip_v2';

/**
 * Calculates today's local date in YYYY-MM-DD format using the device's local timezone.
 */
export function getTodayDateISO(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Creates the default initial trip state with today's local date and Palghar preset.
 */
export function getInitialTripState(): ActiveTripState {
  const defaultPreset = PRESET_LOCATIONS[0] || {
    id: 'loc-1',
    name: 'Palghar Coast',
    state: 'Maharashtra',
    district: 'Palghar',
    latitude: 19.72,
    longitude: 72.70,
  };

  return {
    location: {
      id: defaultPreset.id,
      name: defaultPreset.name,
      latitude: defaultPreset.latitude,
      longitude: defaultPreset.longitude,
      state: defaultPreset.state,
      district: defaultPreset.district,
      isCustom: false,
    },
    date: getTodayDateISO(),
    boatWidthM: 5.0,
    hasUserSelectedLocation: false,
  };
}

// In-memory active trip state singleton
let activeTripState: ActiveTripState = getInitialTripState();

type TripListener = (state: ActiveTripState) => void;
const tripListeners: Set<TripListener> = new Set();

function notifyTripListeners() {
  const snapshot: ActiveTripState = {
    ...activeTripState,
    location: { ...activeTripState.location },
  };
  tripListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (err) {
      console.error('Error notifying trip listener:', err);
    }
  });
}

/**
 * Saves current active trip state to AsyncStorage asynchronously.
 */
async function persistTripState(state: ActiveTripState): Promise<void> {
  try {
    const payload = JSON.stringify(state);
    await AsyncStorage.setItem(STORAGE_KEY, payload);
  } catch (err) {
    console.warn('Failed to persist active trip to AsyncStorage:', err);
  }
}

/**
 * Initializes and hydrates the trip store from storage on app startup.
 */
export async function initTripStore(): Promise<ActiveTripState> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        parsed &&
        parsed.location &&
        typeof parsed.location.latitude === 'number' &&
        typeof parsed.location.longitude === 'number'
      ) {
        // If the stored date is in the past, roll it forward to today
        const today = getTodayDateISO();
        const storedDate = parsed.date;
        const validDate = storedDate && storedDate >= today ? storedDate : today;

        activeTripState = {
          location: {
            id: parsed.location.id || 'saved',
            name: parsed.location.name || 'Saved Fishing Spot',
            latitude: parsed.location.latitude,
            longitude: parsed.location.longitude,
            state: parsed.location.state,
            district: parsed.location.district,
            isCustom: parsed.location.isCustom ?? false,
          },
          date: validDate,
          boatWidthM: typeof parsed.boatWidthM === 'number' && parsed.boatWidthM > 0 ? parsed.boatWidthM : 5.0,
          hasUserSelectedLocation: parsed.hasUserSelectedLocation ?? true,
        };

        notifyTripListeners();
        return { ...activeTripState, location: { ...activeTripState.location } };
      }
    }
  } catch (err) {
    console.warn('Error reading stored trip from AsyncStorage:', err);
  }

  // If no stored trip, ensure date is today's date
  activeTripState.date = getTodayDateISO();
  notifyTripListeners();
  return { ...activeTripState, location: { ...activeTripState.location } };
}

/**
 * Synchronously returns a copy of the current active trip state.
 */
export function getActiveTrip(): ActiveTripState {
  return {
    ...activeTripState,
    location: { ...activeTripState.location },
  };
}

/**
 * Updates the active trip location immediately and persists to storage.
 */
export function setActiveLocation(location: TripLocation | PresetLocation): void {
  activeTripState = {
    ...activeTripState,
    location: {
      id: (location as any).id || 'custom',
      name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      state: location.state || 'Coastal Zone',
      district: (location as any).district,
      isCustom: !(location as any).id || (location as any).id === 'custom',
    },
    hasUserSelectedLocation: true,
  };

  clearCurrentAssessment();
  notifyTripListeners();
  persistTripState(activeTripState);
}

/**
 * Updates the active trip fishing date immediately and persists to storage.
 */
export function setActiveDate(dateISO: string): void {
  if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
    dateISO = getTodayDateISO();
  }

  activeTripState = {
    ...activeTripState,
    date: dateISO,
  };

  clearCurrentAssessment();
  notifyTripListeners();
  persistTripState(activeTripState);
}

/**
 * Updates the active boat width immediately and persists to storage.
 */
export function setActiveBoatWidth(widthM: number): void {
  if (!widthM || widthM <= 0) {
    widthM = 5.0;
  }

  activeTripState = {
    ...activeTripState,
    boatWidthM: widthM,
  };

  clearCurrentAssessment();
  notifyTripListeners();
  persistTripState(activeTripState);
}

/**
 * Subscribes to changes in the active trip state.
 * Returns an unsubscribe function.
 */
export function subscribeToTrip(listener: TripListener): () => void {
  tripListeners.add(listener);
  // Immediately notify the new listener with current state
  try {
    listener({ ...activeTripState, location: { ...activeTripState.location } });
  } catch (err) {
    console.error('Error in immediate trip listener notification:', err);
  }

  return () => {
    tripListeners.delete(listener);
  };
}
