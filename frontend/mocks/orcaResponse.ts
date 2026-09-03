import { OrcaResponse, OrcaRequest } from '../types/orca';

/**
 * Realistic Mock Response adhering strictly to the OrcaResponse data contract.
 * Primary Scenario: Palghar test scenario (Caution, SVAS alert for boats < 6m).
 */
export const MOCK_PALGHAR_RESPONSE: OrcaResponse = {
  request: {
    latitude: 19.72,
    longitude: 72.70,
    date: '2026-09-03',
    boat_width_m: 5.0,
    query: 'Check fishing conditions near Palghar',
  },
  assessment: {
    status: 'CAUTION',
    risk_score: 62,
    summary: 'Fishing conditions require caution. Small craft advisory active for vessels under 6m.',
  },
  pfz: {
    available: true,
    nearest: {
      latitude: 19.7286,
      longitude: 72.32727,
      distance_km: 39.03,
      bearing_degrees: 271.5,
      direction: 'W',
    },
    geometry: {
      type: 'MultiLineString',
      coordinates: [
        [
          [72.30, 19.80],
          [72.32727, 19.7286],
          [72.35, 19.65],
          [72.38, 19.55],
        ],
        [
          [72.25, 19.95],
          [72.28, 19.88],
          [72.31, 19.82],
        ],
      ],
    },
  },
  marine: {
    available: true,
    temperature_c: 28.0,
    wind_speed_knots: 8.7,
    wind_gusts_knots: 18.3,
    wave_height_m: 1.4,
    wave_period_seconds: 8.05,
    sea_surface_temperature_c: 29.5,
    ocean_current_velocity_kmh: 0.4,
    wind_direction_degrees: 262,
    wave_direction_degrees: 249,
    ocean_current_direction_degrees: 117,
  },
  svas: {
    available: true,
    district: 'Palghar',
    state: 'Maharashtra',
    severity: 'alert',
    boat_category: 'under_6m',
    message: 'Palghar district (0-100)km, Boats less than 6m wide should not sail.',
  },
  hazards: [
    {
      id: 'h-1',
      type: 'Cyclone',
      severity: 'HIGH',
      title: 'Cyclone Alert (180 km offshore)',
      description: 'Deep depression in Arabian Sea moving WNW. Strong gusts expected.',
      updated_at: '2 Sep 2026, 09:30 AM',
      source: 'IMD / INCOIS',
      distance_km: 180,
      direction: 'WNW',
    },
    {
      id: 'h-2',
      type: 'High Waves',
      severity: 'MEDIUM',
      title: 'High Waves Advisory',
      description: 'Waves may reach 2.5 - 3.0 m in offshore waters after 18:00.',
      updated_at: '2 Sep 2026, 09:30 AM',
      source: 'INCOIS',
    },
    {
      id: 'h-3',
      type: 'Storm Surge',
      severity: 'LOW',
      title: 'Storm Surge',
      description: 'No significant surge expected along Palghar coastline.',
      updated_at: '2 Sep 2026, 09:30 AM',
      source: 'INCOIS',
    },
    {
      id: 'h-4',
      type: 'Tsunami Warning',
      severity: 'NONE',
      title: 'Tsunami Warning',
      description: 'No tsunami threat for Indian coasts.',
      updated_at: '2 Sep 2026, 09:30 AM',
      source: 'INCOIS',
    },
  ],
  meta: {
    generated_at: '2026-09-02T17:00:00',
    sources: ['INCOIS', 'Open-Meteo', 'IMD'],
    version: '1.0.0',
  },
};

/**
 * Secondary Scenario: Ratnagiri Safe Scenario (Matches the mockup design).
 */
export const MOCK_RATNAGIRI_SAFE_RESPONSE: OrcaResponse = {
  request: {
    latitude: 16.99,
    longitude: 73.29,
    date: '2026-09-02',
    boat_width_m: 6.5,
    query: 'Can I go fishing tomorrow near Ratnagiri?',
  },
  assessment: {
    status: 'SAFE',
    risk_score: 18,
    summary: 'Suitable conditions expected for fishing. PFZ nearby with calm waters.',
  },
  pfz: {
    available: true,
    nearest: {
      latitude: 16.92,
      longitude: 73.08,
      distance_km: 23.4,
      bearing_degrees: 290.0,
      direction: 'WNW',
    },
    geometry: {
      type: 'MultiLineString',
      coordinates: [
        [
          [73.02, 17.10],
          [73.08, 16.92],
          [73.12, 16.75],
        ],
        [
          [72.95, 17.25],
          [73.00, 17.15],
        ],
      ],
    },
  },
  marine: {
    available: true,
    temperature_c: 28.2,
    wind_speed_knots: 7.2,
    wind_gusts_knots: 11.5,
    wave_height_m: 0.9,
    wave_period_seconds: 7.8,
    sea_surface_temperature_c: 28.2,
    ocean_current_velocity_kmh: 0.8,
    wind_direction_degrees: 280,
    wave_direction_degrees: 270,
    ocean_current_direction_degrees: 150,
  },
  svas: {
    available: true,
    district: 'Ratnagiri',
    state: 'Maharashtra',
    severity: 'safe',
    boat_category: '6_7m',
    message: 'No small vessel restrictions for Ratnagiri district.',
  },
  hazards: [
    {
      id: 'h-1',
      type: 'Cyclone',
      severity: 'NONE',
      title: 'Cyclone',
      description: 'No cyclone threats in the coastal area.',
      updated_at: '2 Sep 2026, 09:30 AM',
      source: 'IMD',
    },
    {
      id: 'h-2',
      type: 'High Waves',
      severity: 'LOW',
      title: 'High Waves',
      description: 'Normal wave activity below 1.2 m.',
      updated_at: '2 Sep 2026, 09:30 AM',
      source: 'INCOIS',
    },
    {
      id: 'h-3',
      type: 'Storm Surge',
      severity: 'NONE',
      title: 'Storm Surge',
      description: 'No surge expected.',
      updated_at: '2 Sep 2026, 09:30 AM',
      source: 'INCOIS',
    },
    {
      id: 'h-4',
      type: 'Tsunami Warning',
      severity: 'NONE',
      title: 'Tsunami Warning',
      description: 'No tsunami threat for Indian coasts.',
      updated_at: '2 Sep 2026, 09:30 AM',
      source: 'INCOIS',
    },
  ],
  meta: {
    generated_at: '2026-09-02T17:00:00',
    sources: ['INCOIS', 'Open-Meteo'],
    version: '1.0.0',
  },
};

/**
 * Returns mock response dynamically matching the user's requested location coordinates.
 */
export function getMockResponseForRequest(req: OrcaRequest): OrcaResponse {
  // If close to Ratnagiri
  if (Math.abs(req.latitude - 16.99) < 1.0) {
    return {
      ...MOCK_RATNAGIRI_SAFE_RESPONSE,
      request: req,
    };
  }

  // Default to Palghar scenario with requested coordinates overlaid
  return {
    ...MOCK_PALGHAR_RESPONSE,
    request: req,
  };
}
