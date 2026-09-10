/**
 * ORCA Marine Intelligence - Geographic & Navigation Engine
 * Pure mathematical functions for marine distances, bearings, and direction.
 */

const EARTH_RADIUS_KM = 6371.0;

/**
 * Calculates great-circle distance between two coordinates in kilometers (Haversine formula).
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2) ||
    (lat1 === lat2 && lon1 === lon2)
  ) {
    return 0;
  }

  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const radLat1 = lat1 * (Math.PI / 180);
  const radLat2 = lat2 * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = EARTH_RADIUS_KM * c;

  return Math.round(dist * 10) / 10;
}

/**
 * Calculates initial true bearing from point 1 to point 2 in degrees (0° - 360°).
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2) ||
    (lat1 === lat2 && lon1 === lon2)
  ) {
    return 0;
  }

  const phi1 = lat1 * (Math.PI / 180);
  const phi2 = lat2 * (Math.PI / 180);
  const lambdaDiff = (lon2 - lon1) * (Math.PI / 180);

  const y = Math.sin(lambdaDiff) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambdaDiff);

  const theta = Math.atan2(y, x);
  const bearing = (theta * (180 / Math.PI) + 360) % 360;

  return Math.round(bearing * 10) / 10;
}

/**
 * Maps a bearing in degrees to standard 16-point cardinal direction string.
 */
export function getCardinalDirection(bearingDegrees: number): string {
  if (isNaN(bearingDegrees)) return 'N';
  const normalized = (bearingDegrees % 360 + 360) % 360;

  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];

  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
}

/**
 * Formats latitude and longitude coordinates into navigation string (e.g. "19.72°N, 72.70°E").
 */
export function formatCoordinates(lat: number, lon: number, precision: number = 2): string {
  if (isNaN(lat) || isNaN(lon)) return '0.00°N, 0.00°E';
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(precision)}°${latDir}, ${Math.abs(lon).toFixed(precision)}°${lonDir}`;
}

export interface NavigationRouteInfo {
  distanceKm: number;
  bearingDegrees: number;
  cardinalDirection: string;
  formattedText: string;
}

/**
 * Calculates complete navigation metrics between two points.
 */
export function calculateNavigationRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): NavigationRouteInfo {
  const dist = calculateDistanceKm(fromLat, fromLon, toLat, toLon);
  const bearing = calculateBearing(fromLat, fromLon, toLat, toLon);
  const dir = getCardinalDirection(bearing);

  return {
    distanceKm: dist,
    bearingDegrees: bearing,
    cardinalDirection: dir,
    formattedText: `${dist.toFixed(1)} km (${dir} • ${bearing.toFixed(0)}°)`,
  };
}
