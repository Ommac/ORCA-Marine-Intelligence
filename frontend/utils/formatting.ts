/**
 * Fisherman-friendly string and data formatters.
 * Translates technical oceanographic terms into natural, practical fishing language.
 */

import { AssessmentStatus, SeverityLevel } from '../types/orca';
import { COLORS } from '../constants/theme';

/**
 * KM-only distance formatter (converts numeric distance in km to user-facing string).
 * All user-facing distances in ORCA must be displayed in kilometers (km).
 */
export function formatDistanceKm(distanceKm?: number): string {
  if (distanceKm === undefined || distanceKm === null || isNaN(distanceKm)) return 'Not available';
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Converts distance in Nautical Miles (NM) to Kilometers (km) and formats as user-facing string.
 * 1 NM = 1.852 km
 */
export function formatDistanceKmFromNm(distanceNm?: number): string {
  if (distanceNm === undefined || distanceNm === null || isNaN(distanceNm)) return 'Not available';
  const km = distanceNm * 1.852;
  return `${km.toFixed(1)} km`;
}

export function formatDistance(km?: number): string {
  return formatDistanceKm(km);
}

export function formatKnots(knots?: number): string {
  if (knots === undefined || knots === null || isNaN(knots)) return 'Not available';
  return `${knots.toFixed(1)} knots`;
}

export function formatMeters(meters?: number): string {
  if (meters === undefined || meters === null || isNaN(meters)) return 'Not available';
  return `${meters.toFixed(1)} m`;
}

export function formatSeconds(seconds?: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return 'Not available';
  return `${seconds.toFixed(1)} s`;
}

export function formatTemperature(celsius?: number): string {
  if (celsius === undefined || celsius === null || isNaN(celsius)) return 'Not available';
  return `${celsius.toFixed(1)} °C`;
}

export function formatKmh(kmh?: number): string {
  if (kmh === undefined || kmh === null || isNaN(kmh)) return 'Not available';
  return `${kmh.toFixed(1)} km/h`;
}

export function formatDegreesToCompass(deg?: number): string {
  if (deg === undefined || deg === null || isNaN(deg)) return '';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((deg %= 360) < 0 ? deg + 360 : deg) / 22.5) % 16;
  return directions[index];
}

export function formatDateToFisherman(dateStr: string): string {
  if (!dateStr) return 'Selected Date';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIndex = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, monthIndex, day);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDate = new Date(year, monthIndex, day);
      targetDate.setHours(0, 0, 0, 0);
      
      const diffTime = targetDate.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formatted = `${day} ${monthNames[monthIndex]} ${year}`;
      
      if (diffDays === 0) return `Today (${formatted})`;
      if (diffDays === 1) return `Tomorrow (${formatted})`;
      return formatted;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export function getStatusTheme(status: AssessmentStatus) {
  switch (status) {
    case 'SAFE':
      return {
        label: 'SAFE',
        subtitle: 'LOW RISK',
        textColor: COLORS.safeText,
        bgColor: COLORS.safeBg,
        borderColor: COLORS.safeBorder,
        accentColor: COLORS.safe,
        icon: 'check-circle',
        friendlyMessage: 'Suitable conditions expected for fishing.',
      };
    case 'CAUTION':
      return {
        label: 'CAUTION',
        subtitle: 'MODERATE RISK',
        textColor: COLORS.cautionText,
        bgColor: COLORS.cautionBg,
        borderColor: COLORS.cautionBorder,
        accentColor: COLORS.caution,
        icon: 'alert-triangle',
        friendlyMessage: 'Fishing conditions require caution. Monitor changing weather.',
      };
    case 'NOT_RECOMMENDED':
    default:
      return {
        label: 'NOT RECOMMENDED',
        subtitle: 'HIGH RISK',
        textColor: COLORS.dangerText,
        bgColor: COLORS.dangerBg,
        borderColor: COLORS.dangerBorder,
        accentColor: COLORS.danger,
        icon: 'alert-octagon',
        friendlyMessage: 'Dangerous sea conditions. Sailing is not recommended.',
      };
  }
}

export function getSeverityTheme(severity: SeverityLevel | string) {
  const norm = (severity || 'NONE').toUpperCase();
  switch (norm) {
    case 'HIGH':
      return {
        label: 'HIGH',
        textColor: COLORS.dangerText,
        bgColor: COLORS.dangerBg,
        borderColor: COLORS.dangerBorder,
        accentColor: COLORS.danger,
      };
    case 'MEDIUM':
      return {
        label: 'MEDIUM',
        textColor: COLORS.cautionText,
        bgColor: COLORS.cautionBg,
        borderColor: COLORS.cautionBorder,
        accentColor: COLORS.caution,
      };
    case 'LOW':
      return {
        label: 'LOW',
        textColor: COLORS.safeText,
        bgColor: COLORS.safeBg,
        borderColor: COLORS.safeBorder,
        accentColor: COLORS.safe,
      };
    case 'NONE':
    default:
      return {
        label: 'NONE',
        textColor: COLORS.neutralText,
        bgColor: COLORS.neutralBg,
        borderColor: COLORS.neutralBorder,
        accentColor: COLORS.neutral,
      };
  }
}

// ===========================================================================
// Alert System Formatting Helpers
// ===========================================================================

import { AlertSeverityLevel } from '../types/orca';

export function getAlertSeverityTheme(severity: AlertSeverityLevel) {
  switch (severity) {
    case 'CRITICAL':
      return {
        label: 'CRITICAL',
        textColor: '#FFFFFF',
        bgColor: '#991B1B',
        borderColor: '#B91C1C',
        accentColor: '#DC2626',
        pillBg: '#FEE2E2',
        pillText: '#7F1D1D',
      };
    case 'HIGH':
      return {
        label: 'HIGH',
        textColor: COLORS.dangerText,
        bgColor: COLORS.dangerBg,
        borderColor: COLORS.dangerBorder,
        accentColor: COLORS.danger,
        pillBg: COLORS.dangerBg,
        pillText: COLORS.dangerText,
      };
    case 'CAUTION':
      return {
        label: 'CAUTION',
        textColor: COLORS.cautionText,
        bgColor: COLORS.cautionBg,
        borderColor: COLORS.cautionBorder,
        accentColor: COLORS.caution,
        pillBg: COLORS.cautionBg,
        pillText: COLORS.cautionText,
      };
    case 'INFORMATION':
      return {
        label: 'INFO',
        textColor: COLORS.oceanBlueDark,
        bgColor: COLORS.skyBlue,
        borderColor: COLORS.skyBlueBorder,
        accentColor: COLORS.oceanBlue,
        pillBg: COLORS.skyBlue,
        pillText: COLORS.oceanBlueDark,
      };
    case 'SAFE':
    default:
      return {
        label: 'SAFE',
        textColor: COLORS.safeText,
        bgColor: COLORS.safeBg,
        borderColor: COLORS.safeBorder,
        accentColor: COLORS.safe,
        pillBg: COLORS.safeBg,
        pillText: COLORS.safeText,
      };
  }
}

export function formatBoatCategory(widthM: number): string {
  if (widthM < 4.0) return 'Non-Mechanised';
  if (widthM < 6.0) return 'Mechanised — Below 2 Tonne';
  return 'Mechanised — 2 Tonne & Above';
}

export function formatAlertTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${monthNames[date.getMonth()]} ${displayHour}:${minutes} ${ampm}`;
  } catch {
    return isoString;
  }
}

/**
 * Calculates Great-Circle Haversine distance between two coordinates in Kilometers (km).
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadiusKm = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadiusKm * c).toFixed(2));
}

