/**
 * ORCA Alert Engine
 * -----------------
 * Pure-function utility that converts an OrcaResponse + ActiveTripState
 * into a prioritized, sorted list of OrcaAlert objects.
 *
 * Each alert generator only produces an alert when real backend data exists.
 * No fake, mocked, or hardcoded values are used.
 *
 * Matches the deterministic Risk Agent thresholds from agents/risk/main.py:
 *   Wave height:  < 1.0m (safe), 1.0-2.0m (moderate), 2.0-3.0m (high), >= 3.0m (severe)
 *   Wind speed:   < 10kt (safe), 10-20kt (moderate), 20-30kt (high), >= 30kt (severe)
 *   Wind gusts:   < 15kt (safe), 15-25kt (moderate), 25-35kt (high), >= 35kt (severe)
 *   Ocean current: < 1.0km/h (safe), 1.0-2.0km/h (moderate), 2.0-3.0km/h (high), >= 3.0km/h (severe)
 */

import {
  OrcaResponse,
  OrcaAlert,
  AlertEvidence,
  AlertSeverityLevel,
  AlertStatus,
  AlertCategory,
} from '../types/orca';
import { ActiveTripState } from '../services/tripStore';
import { formatDistance, formatKnots, formatMeters, formatKmh, formatDegreesToCompass } from './formatting';

// ===========================================================================
// Priority Scores
// ===========================================================================

const PRIORITY: Record<AlertSeverityLevel, number> = {
  CRITICAL: 100,
  HIGH: 80,
  CAUTION: 60,
  INFORMATION: 20,
  SAFE: 0,
};

// ===========================================================================
// Risk Agent Thresholds (matching agents/risk/main.py)
// ===========================================================================

const THRESHOLDS = {
  wave: { moderate: 1.0, high: 2.0, severe: 3.0 },
  wind: { moderate: 10.0, high: 20.0, severe: 30.0 },
  gust: { moderate: 15.0, high: 25.0, severe: 35.0 },
  current: { moderate: 1.0, high: 2.0, severe: 3.0 },
};

// ===========================================================================
// Individual Alert Generators
// ===========================================================================

/**
 * 1. SVAS Personalized Boat Alert
 * Uses: svas.available, svas.severity, svas.message, svas.boat_category, boat_width_m
 */
function generateSVASBoatAlert(data: OrcaResponse, trip: ActiveTripState): OrcaAlert | null {
  const svas = data.svas;
  if (!svas || !svas.available) return null;

  const severity = (svas.severity || '').toLowerCase();
  const message = (svas.message || '').toLowerCase();

  // Determine if this is a "should not sail" hard stop
  const shouldNotSailTriggers = [
    'should not sail', 'do not sail', 'not recommended to sail',
    'operations not recommended', 'do not venture', 'stop fishing', 'unsafe for sailing',
  ];
  const isShouldNotSail = shouldNotSailTriggers.some(t => message.includes(t)) || severity === 'danger';
  const isAlert = severity === 'alert' || severity === 'warning' || severity === 'high' || isShouldNotSail;

  if (!isAlert && severity === 'safe') {
    // Safe SVAS — return a compact safe status
    return {
      id: 'svas-boat-safe',
      type: 'svas_boat',
      severity: 'SAFE',
      priority: PRIORITY.SAFE,
      title: 'Small Vessel Advisory',
      subtitle: 'INCOIS Official Sailing Safety',
      evidence: [
        { label: 'Advisory', value: svas.message || 'Conditions normal for small fishing vessels.' },
        ...(svas.boat_category ? [{ label: 'Vessel Category', value: svas.boat_category.replace(/_/g, ' ').toUpperCase() }] : []),
        ...(svas.district ? [{ label: 'District', value: `${svas.district}${svas.state ? `, ${svas.state}` : ''}` }] : []),
      ],
      advice: 'Normal conditions for your vessel. Follow standard safety precautions.',
      source: 'INCOIS SVAS',
      status: 'active',
      category: 'boat_safety',
      icon: '🚤',
      updatedAt: data.meta.generated_at,
    };
  }

  const alertSeverity: AlertSeverityLevel = isShouldNotSail ? 'CRITICAL' : 'HIGH';

  const evidence: AlertEvidence[] = [];
  if (svas.message) evidence.push({ label: 'Advisory', value: svas.message });
  if (trip.boatWidthM) evidence.push({ label: 'Your Boat Width', value: `${trip.boatWidthM} m`, unit: 'm' });
  if (svas.boat_category) evidence.push({ label: 'Vessel Category', value: svas.boat_category.replace(/_/g, ' ').toUpperCase() });
  if (svas.district) evidence.push({ label: 'District', value: `${svas.district}${svas.state ? `, ${svas.state}` : ''}` });

  return {
    id: 'svas-boat-alert',
    type: 'svas_boat',
    severity: alertSeverity,
    priority: isShouldNotSail ? PRIORITY.CRITICAL + 10 : PRIORITY.HIGH + 5, // Always near top
    title: isShouldNotSail ? 'DO NOT SAIL — Your Boat Is Affected' : 'Your Boat Is Affected',
    subtitle: 'INCOIS Small Vessel Advisory',
    evidence,
    advice: isShouldNotSail
      ? 'Official advisory states that boats in your size category should NOT sail. Stay in port for safety.'
      : 'Caution advised for your vessel category. Consider staying closer to shore or postponing your trip.',
    source: 'INCOIS SVAS',
    status: 'active',
    category: 'boat_safety',
    icon: '🚤',
    updatedAt: data.meta.generated_at,
  };
}

/**
 * 2. Lightning Alert
 * Uses: lightning data from ocean analysis agent
 */
function generateLightningAlert(data: OrcaResponse): OrcaAlert | null {
  const lightning = data.lightning;
  if (!lightning || !lightning.available || !lightning.data) return null;

  const lData = lightning.data;
  const isActive = !!lData.thunderstorm_active;
  const isElevated = !!lData.elevated_convective_risk || !!lData.thunderstorm_forecast_today;

  if (!isActive && !isElevated) return null;

  const evidence: AlertEvidence[] = [];

  if (lData.weather_description) {
    evidence.push({ label: 'Weather Condition', value: lData.weather_description });
  }

  if (lData.convective_available_potential_energy_j_kg) {
    const cape = lData.convective_available_potential_energy_j_kg;
    if (cape.max_cape !== undefined) {
      evidence.push({ label: 'Max CAPE', value: `${cape.max_cape} J/kg`, unit: 'J/kg' });
    }
    if (cape.instability_level) {
      evidence.push({ label: 'Instability Level', value: cape.instability_level });
    }
  }

  if (lData.thunderstorm_forecast_today) {
    evidence.push({ label: 'Thunderstorm Forecast', value: 'Thunderstorm activity forecast in the area today' });
  }

  if (lightning.source) {
    evidence.push({ label: 'Data Source', value: lightning.source });
  }

  const severity: AlertSeverityLevel = isActive ? 'HIGH' : 'CAUTION';

  return {
    id: 'lightning-alert',
    type: 'lightning',
    severity,
    priority: isActive ? PRIORITY.HIGH + 2 : PRIORITY.CAUTION,
    title: isActive ? 'Active Thunderstorm / Lightning' : 'Lightning Risk Detected',
    subtitle: isActive ? 'Active thunderstorm detected at your fishing location' : 'Elevated convective instability detected',
    evidence,
    advice: isActive
      ? 'Active thunderstorm detected. Avoid going offshore until conditions clear. Seek shelter if at sea.'
      : 'Elevated lightning risk detected. Monitor conditions closely and be prepared to return to shore.',
    source: lightning.source || 'MOSDAC / Open-Meteo',
    status: 'active',
    category: 'lightning',
    icon: '⚡',
    updatedAt: data.meta.generated_at,
  };
}

/**
 * 3. High Waves Alert
 * Uses: marine.wave_height_m (threshold from Risk Agent: >= 2.0m is HIGH)
 */
function generateWaveAlert(data: OrcaResponse): OrcaAlert | null {
  const marine = data.marine;
  if (!marine || !marine.available || marine.wave_height_m === undefined || marine.wave_height_m === null) return null;

  const val = marine.wave_height_m;
  if (val < THRESHOLDS.wave.high) return null; // Only alert at HIGH or above

  const severity: AlertSeverityLevel = val >= THRESHOLDS.wave.severe ? 'CRITICAL' : 'HIGH';

  const evidence: AlertEvidence[] = [
    { label: 'Wave Height', value: formatMeters(val), unit: 'm' },
  ];
  if (marine.wave_period_seconds !== undefined) {
    evidence.push({ label: 'Wave Period', value: `${marine.wave_period_seconds.toFixed(1)} s`, unit: 's' });
  }
  if (marine.wave_direction_degrees !== undefined) {
    evidence.push({ label: 'Swell Direction', value: `From ${formatDegreesToCompass(marine.wave_direction_degrees)}` });
  }

  return {
    id: 'wave-alert',
    type: 'high_waves',
    severity,
    priority: PRIORITY[severity],
    title: val >= THRESHOLDS.wave.severe ? 'Severe Wave Hazard' : 'High Waves Expected',
    subtitle: `Wave height is ${val.toFixed(1)} m`,
    evidence,
    advice: val >= THRESHOLDS.wave.severe
      ? 'Dangerous wave conditions. Do not go to sea. Stay in port.'
      : 'High waves expected. Small vessels should avoid open sea. Stay close to shore if sailing.',
    source: 'Open-Meteo Marine Forecast',
    status: 'active',
    category: 'weather',
    icon: '🌊',
    updatedAt: data.meta.generated_at,
  };
}

/**
 * 4. Strong Wind Alert
 * Uses: marine.wind_speed_knots (threshold from Risk Agent: >= 20kt is HIGH)
 */
function generateWindAlert(data: OrcaResponse): OrcaAlert | null {
  const marine = data.marine;
  if (!marine || !marine.available || marine.wind_speed_knots === undefined || marine.wind_speed_knots === null) return null;

  const val = marine.wind_speed_knots;
  if (val < THRESHOLDS.wind.high) return null;

  const severity: AlertSeverityLevel = val >= THRESHOLDS.wind.severe ? 'CRITICAL' : 'HIGH';

  const evidence: AlertEvidence[] = [
    { label: 'Wind Speed', value: formatKnots(val), unit: 'knots' },
  ];
  if (marine.wind_direction_degrees !== undefined) {
    evidence.push({ label: 'Wind Direction', value: `From ${formatDegreesToCompass(marine.wind_direction_degrees)}` });
  }

  return {
    id: 'wind-alert',
    type: 'strong_wind',
    severity,
    priority: PRIORITY[severity],
    title: val >= THRESHOLDS.wind.severe ? 'Gale / Storm Winds' : 'Strong Winds',
    subtitle: `Sustained wind speed is ${val.toFixed(1)} knots`,
    evidence,
    advice: val >= THRESHOLDS.wind.severe
      ? 'Storm-force winds. Do not sail. Secure your vessel and stay ashore.'
      : 'Strong winds expected. Small craft should exercise extreme caution.',
    source: 'Open-Meteo Weather Forecast',
    status: 'active',
    category: 'weather',
    icon: '💨',
    updatedAt: data.meta.generated_at,
  };
}

/**
 * 5. Wind Gust Alert
 * Uses: marine.wind_gusts_knots (threshold from Risk Agent: >= 25kt is HIGH)
 */
function generateGustAlert(data: OrcaResponse): OrcaAlert | null {
  const marine = data.marine;
  if (!marine || !marine.available || marine.wind_gusts_knots === undefined || marine.wind_gusts_knots === null) return null;

  const val = marine.wind_gusts_knots;
  if (val < THRESHOLDS.gust.high) return null;

  const severity: AlertSeverityLevel = val >= THRESHOLDS.gust.severe ? 'CRITICAL' : 'HIGH';

  const evidence: AlertEvidence[] = [
    { label: 'Peak Wind Gusts', value: formatKnots(val), unit: 'knots' },
  ];
  if (marine.wind_speed_knots !== undefined) {
    evidence.push({ label: 'Sustained Wind', value: formatKnots(marine.wind_speed_knots), unit: 'knots' });
  }

  return {
    id: 'gust-alert',
    type: 'wind_gust',
    severity,
    priority: PRIORITY[severity] - 1, // Slightly below sustained wind
    title: val >= THRESHOLDS.gust.severe ? 'Dangerous Squall Conditions' : 'Strong Wind Gusts',
    subtitle: `Gusts reaching ${val.toFixed(1)} knots`,
    evidence,
    advice: val >= THRESHOLDS.gust.severe
      ? 'Dangerous squall gusts. All vessels should remain in port.'
      : 'Strong gusts can destabilize small vessels. Avoid sailing in open waters.',
    source: 'Open-Meteo Weather Forecast',
    status: 'active',
    category: 'weather',
    icon: '🌬️',
    updatedAt: data.meta.generated_at,
  };
}

/**
 * 6. Strong Current Alert
 * Uses: marine.ocean_current_velocity_kmh (threshold from Risk Agent: >= 2.0 km/h is HIGH)
 */
function generateCurrentAlert(data: OrcaResponse): OrcaAlert | null {
  const marine = data.marine;
  if (!marine || !marine.available || marine.ocean_current_velocity_kmh === undefined || marine.ocean_current_velocity_kmh === null) return null;

  const val = marine.ocean_current_velocity_kmh;
  if (val < THRESHOLDS.current.high) return null;

  const severity: AlertSeverityLevel = val >= THRESHOLDS.current.severe ? 'CRITICAL' : 'HIGH';

  const evidence: AlertEvidence[] = [
    { label: 'Current Velocity', value: formatKmh(val), unit: 'km/h' },
  ];
  if (marine.ocean_current_direction_degrees !== undefined) {
    evidence.push({ label: 'Current Direction', value: `Heading ${formatDegreesToCompass(marine.ocean_current_direction_degrees)}` });
  }

  return {
    id: 'current-alert',
    type: 'strong_current',
    severity,
    priority: PRIORITY[severity] - 2,
    title: val >= THRESHOLDS.current.severe ? 'Dangerous Rip / Drift Current' : 'Strong Ocean Current',
    subtitle: `Current velocity is ${val.toFixed(1)} km/h`,
    evidence,
    advice: val >= THRESHOLDS.current.severe
      ? 'Dangerous drift current. Risk of being carried out to sea. Do not sail.'
      : 'Strong ocean current detected. Navigate carefully and account for drift.',
    source: 'Open-Meteo Marine Forecast',
    status: 'active',
    category: 'weather',
    icon: '🌊',
    updatedAt: data.meta.generated_at,
  };
}

/**
 * 7. PFZ Safety Alert
 * Uses: pfz.available, pfz.nearest, assessment.status, assessment.risk_score
 */
function generatePFZSafetyAlert(data: OrcaResponse): OrcaAlert | null {
  const pfz = data.pfz;
  if (!pfz || !pfz.available || !pfz.nearest) return null;

  const nearest = pfz.nearest;
  const assessment = data.assessment;

  const evidence: AlertEvidence[] = [
    { label: 'Nearest Fishing Zone', value: formatDistance(nearest.distance_km) },
  ];
  if (nearest.direction) {
    evidence.push({ label: 'Direction', value: `${nearest.direction}${nearest.bearing_degrees ? ` (${nearest.bearing_degrees.toFixed(0)}°)` : ''}` });
  }
  evidence.push({ label: 'Marine Safety Status', value: `${assessment.status} (${assessment.risk_score}/100)` });

  const isHighRisk = assessment.status === 'HIGH_RISK' || assessment.status === 'NOT_RECOMMENDED';
  const isCaution = assessment.status === 'CAUTION';

  let advice: string;
  if (isHighRisk) {
    advice = 'A fishing zone is available, but current marine conditions are not recommended for sailing. Wait for safer conditions.';
  } else if (isCaution) {
    advice = 'Fishing zone available nearby. Marine conditions require caution — monitor weather closely during your trip.';
  } else {
    advice = 'Fishing zone available with favourable marine conditions. Follow standard safety precautions.';
  }

  const severity: AlertSeverityLevel = isHighRisk ? 'CAUTION' : 'INFORMATION';

  return {
    id: 'pfz-safety',
    type: 'pfz_safety',
    severity,
    priority: isHighRisk ? PRIORITY.CAUTION - 5 : PRIORITY.INFORMATION,
    title: 'Fishing Zone Safety Status',
    subtitle: `Nearest PFZ: ${formatDistance(nearest.distance_km)} ${nearest.direction || ''}`,
    distance: formatDistance(nearest.distance_km),
    direction: nearest.direction,
    evidence,
    advice,
    source: 'INCOIS PFZ + ORCA Risk Assessment',
    status: isHighRisk ? 'active' : 'informational',
    category: 'pfz_safety',
    icon: '🎣',
    updatedAt: data.meta.generated_at,
  };
}

/**
 * 8. Ocean Hazard Alerts (cyclone, tsunami, etc.)
 * Uses: hazards[] from ocean_analysis.warnings
 */
function generateOceanHazardAlerts(data: OrcaResponse): OrcaAlert[] {
  const hazards = data.hazards || [];
  if (hazards.length === 0) return [];

  return hazards
    .filter(h => h.severity === 'HIGH' || h.severity === 'MEDIUM')
    .map((h, idx) => {
      const severity: AlertSeverityLevel = h.severity === 'HIGH' ? 'HIGH' : 'CAUTION';
      const evidence: AlertEvidence[] = [
        { label: 'Hazard Type', value: h.type },
        { label: 'Description', value: h.description },
      ];
      if (h.source) evidence.push({ label: 'Source', value: h.source });
      if (h.distance_km !== undefined) evidence.push({ label: 'Distance', value: formatDistance(h.distance_km) });

      const typeLower = h.type.toLowerCase();
      let icon = '⚠️';
      if (typeLower.includes('cyclone')) icon = '🌀';
      else if (typeLower.includes('tsunami')) icon = '🌊';
      else if (typeLower.includes('thunder') || typeLower.includes('lightning')) icon = '⚡';
      else if (typeLower.includes('surge')) icon = '🌊';

      return {
        id: h.id || `hazard-${idx}`,
        type: h.type.toLowerCase().replace(/\s+/g, '_'),
        severity,
        priority: PRIORITY[severity] + 1,
        title: h.title || h.type,
        subtitle: h.description,
        distance: h.distance_km !== undefined ? formatDistance(h.distance_km) : undefined,
        direction: h.direction,
        evidence,
        advice: severity === 'HIGH'
          ? 'Active hazard warning. Avoid the affected area and prioritize safety.'
          : 'Environmental advisory in effect. Monitor conditions and exercise caution.',
        source: h.source,
        status: 'active' as AlertStatus,
        category: 'ocean_hazard' as AlertCategory,
        icon,
        updatedAt: h.updated_at || data.meta.generated_at,
      };
    });
}

/**
 * 9. Forecast-Based Alerts (approaching thresholds)
 * Uses: marine data values between moderate and high thresholds
 * These represent "conditions are not yet dangerous but approaching dangerous levels"
 */
function generateForecastAlerts(data: OrcaResponse): OrcaAlert[] {
  const marine = data.marine;
  if (!marine || !marine.available) return [];

  const alerts: OrcaAlert[] = [];

  // Wave height approaching high threshold (1.5m - 2.0m)
  if (marine.wave_height_m !== undefined && marine.wave_height_m !== null) {
    const val = marine.wave_height_m;
    if (val >= 1.5 && val < THRESHOLDS.wave.high) {
      alerts.push({
        id: 'forecast-wave',
        type: 'forecast_wave',
        severity: 'CAUTION',
        priority: PRIORITY.CAUTION - 10,
        title: 'Waves Approaching Rough Conditions',
        subtitle: `Wave height is ${val.toFixed(1)} m — approaching the ${THRESHOLDS.wave.high} m high-risk threshold`,
        evidence: [
          { label: 'Current Wave Height', value: formatMeters(val), unit: 'm' },
          { label: 'High-Risk Threshold', value: `${THRESHOLDS.wave.high} m`, unit: 'm' },
        ],
        advice: 'Waves are building up. Be prepared for rough conditions if heading offshore.',
        source: 'Open-Meteo Marine Forecast',
        status: 'forecast',
        category: 'forecast',
        icon: '🌊',
        updatedAt: data.meta.generated_at,
      });
    }
  }

  // Wind speed approaching high threshold (15kt - 20kt)
  if (marine.wind_speed_knots !== undefined && marine.wind_speed_knots !== null) {
    const val = marine.wind_speed_knots;
    if (val >= 15 && val < THRESHOLDS.wind.high) {
      alerts.push({
        id: 'forecast-wind',
        type: 'forecast_wind',
        severity: 'CAUTION',
        priority: PRIORITY.CAUTION - 11,
        title: 'Winds Picking Up',
        subtitle: `Wind speed is ${val.toFixed(1)} knots — approaching strong wind conditions`,
        evidence: [
          { label: 'Current Wind Speed', value: formatKnots(val), unit: 'knots' },
          { label: 'Strong Wind Threshold', value: `${THRESHOLDS.wind.high} knots`, unit: 'knots' },
        ],
        advice: 'Winds are increasing. Monitor conditions and plan return to shore if they strengthen.',
        source: 'Open-Meteo Weather Forecast',
        status: 'forecast',
        category: 'forecast',
        icon: '💨',
        updatedAt: data.meta.generated_at,
      });
    }
  }

  // Gusts approaching high threshold (20kt - 25kt)
  if (marine.wind_gusts_knots !== undefined && marine.wind_gusts_knots !== null) {
    const val = marine.wind_gusts_knots;
    if (val >= 20 && val < THRESHOLDS.gust.high) {
      alerts.push({
        id: 'forecast-gust',
        type: 'forecast_gust',
        severity: 'CAUTION',
        priority: PRIORITY.CAUTION - 12,
        title: 'Wind Gusts Intensifying',
        subtitle: `Gusts at ${val.toFixed(1)} knots — approaching strong gust conditions`,
        evidence: [
          { label: 'Current Gusts', value: formatKnots(val), unit: 'knots' },
          { label: 'Strong Gust Threshold', value: `${THRESHOLDS.gust.high} knots`, unit: 'knots' },
        ],
        advice: 'Wind gusts increasing. Small vessels should prepare for choppy conditions.',
        source: 'Open-Meteo Weather Forecast',
        status: 'forecast',
        category: 'forecast',
        icon: '🌬️',
        updatedAt: data.meta.generated_at,
      });
    }
  }

  return alerts;
}

// ===========================================================================
// Main Alert Generator
// ===========================================================================

/**
 * Generate all alerts from an OrcaResponse and ActiveTripState.
 * Returns alerts sorted by priority (highest first).
 */
export function generateAlerts(data: OrcaResponse | null, trip: ActiveTripState): OrcaAlert[] {
  if (!data) return [];
  const alerts: OrcaAlert[] = [];

  // 1. SVAS Boat Alert (always try — may return safe status)
  const svasAlert = generateSVASBoatAlert(data, trip);
  if (svasAlert) alerts.push(svasAlert);

  // 2. Lightning Alert
  const lightningAlert = generateLightningAlert(data);
  if (lightningAlert) alerts.push(lightningAlert);

  // 3. High Waves
  const waveAlert = generateWaveAlert(data);
  if (waveAlert) alerts.push(waveAlert);

  // 4. Strong Wind
  const windAlert = generateWindAlert(data);
  if (windAlert) alerts.push(windAlert);

  // 5. Wind Gust
  const gustAlert = generateGustAlert(data);
  if (gustAlert) alerts.push(gustAlert);

  // 6. Strong Current
  const currentAlert = generateCurrentAlert(data);
  if (currentAlert) alerts.push(currentAlert);

  // 7. PFZ Safety
  const pfzAlert = generatePFZSafetyAlert(data);
  if (pfzAlert) alerts.push(pfzAlert);

  // 8. Ocean Hazards (cyclone, tsunami, etc.)
  const hazardAlerts = generateOceanHazardAlerts(data);
  alerts.push(...hazardAlerts);

  // 9. Forecast-Based Alerts
  const forecastAlerts = generateForecastAlerts(data);
  alerts.push(...forecastAlerts);

  // Sort by priority descending (highest first)
  alerts.sort((a, b) => b.priority - a.priority);

  return alerts;
}

/**
 * Categorize alerts by status for screen rendering.
 */
export function categorizeAlerts(alerts: OrcaAlert[]): {
  active: OrcaAlert[];
  forecast: OrcaAlert[];
  informational: OrcaAlert[];
  safe: OrcaAlert[];
} {
  return {
    active: alerts.filter(a => a.status === 'active' && a.severity !== 'SAFE'),
    forecast: alerts.filter(a => a.status === 'forecast'),
    informational: alerts.filter(a => a.status === 'informational' || a.status === 'unavailable'),
    safe: alerts.filter(a => a.severity === 'SAFE'),
  };
}

/**
 * Count alerts by severity level.
 */
export function countAlertsBySeverity(alerts: OrcaAlert[]): Record<AlertSeverityLevel, number> {
  return {
    CRITICAL: alerts.filter(a => a.severity === 'CRITICAL').length,
    HIGH: alerts.filter(a => a.severity === 'HIGH').length,
    CAUTION: alerts.filter(a => a.severity === 'CAUTION').length,
    INFORMATION: alerts.filter(a => a.severity === 'INFORMATION').length,
    SAFE: alerts.filter(a => a.severity === 'SAFE').length,
  };
}
