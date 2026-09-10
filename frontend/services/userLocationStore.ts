/**
 * ORCA Centralized Live GPS User Location Store
 * Manages the fisherman/vessel real-time GPS coordinates.
 */

export interface UserLocationState {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp: number;
  isLive: boolean;
  isLoading: boolean;
  error?: string | null;
}

let currentUserLocation: UserLocationState = {
  latitude: 19.72,
  longitude: 72.70,
  timestamp: Date.now(),
  isLive: false,
  isLoading: false,
  error: null,
};

type UserLocationListener = (state: UserLocationState) => void;
const listeners = new Set<UserLocationListener>();

function notifyListeners() {
  const snapshot: UserLocationState = { ...currentUserLocation };
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (err) {
      console.error('Error notifying user location listener:', err);
    }
  });
}

/**
 * Returns current snapshot of user location.
 */
export function getUserLocation(): UserLocationState {
  return { ...currentUserLocation };
}

/**
 * Triggers a live GPS location acquisition.
 */
export async function refreshUserLocation(): Promise<UserLocationState> {
  currentUserLocation = {
    ...currentUserLocation,
    isLoading: true,
    error: null,
  };
  notifyListeners();

  return new Promise((resolve) => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          currentUserLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            speed: position.coords.speed,
            heading: position.coords.heading,
            timestamp: position.timestamp || Date.now(),
            isLive: true,
            isLoading: false,
            error: null,
          };
          notifyListeners();
          resolve({ ...currentUserLocation });
        },
        (error) => {
          console.warn('GPS location request failed:', error.message);
          currentUserLocation = {
            ...currentUserLocation,
            isLoading: false,
            error: error.message || 'GPS location unavailable.',
          };
          notifyListeners();
          resolve({ ...currentUserLocation });
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000,
        }
      );
    } else {
      currentUserLocation = {
        ...currentUserLocation,
        isLoading: false,
        error: 'Geolocation API not supported in this environment.',
      };
      notifyListeners();
      resolve({ ...currentUserLocation });
    }
  });
}

/**
 * Subscribes to live user location changes.
 */
export function subscribeToUserLocation(
  listener: UserLocationListener
): () => void {
  listeners.add(listener);
  try {
    listener({ ...currentUserLocation });
  } catch (err) {
    console.error('Immediate user location listener notification failed:', err);
  }

  return () => {
    listeners.delete(listener);
  };
}
