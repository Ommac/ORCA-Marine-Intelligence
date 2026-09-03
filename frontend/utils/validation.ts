/**
 * Input validation helpers for locations, dates, and boat dimensions.
 */

export function isValidLatitude(lat: number): boolean {
  return !isNaN(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lon: number): boolean {
  return !isNaN(lon) && lon >= -180 && lon <= 180;
}

export function isValidIndianCoastalCoords(lat: number, lon: number): boolean {
  // Rough bounding box covering Indian Exclusive Economic Zone & coastline (Lat: 4 to 26, Lon: 65 to 90)
  return lat >= 4 && lat <= 26 && lon >= 65 && lon <= 90;
}

export function validateCoordinates(latStr: string, lonStr: string): { valid: boolean; error?: string; lat?: number; lon?: number } {
  const lat = parseFloat(latStr.trim());
  const lon = parseFloat(lonStr.trim());

  if (isNaN(lat) || isNaN(lon)) {
    return { valid: false, error: 'Please enter valid numerical coordinates.' };
  }

  if (!isValidLatitude(lat)) {
    return { valid: false, error: 'Latitude must be between -90 and 90.' };
  }

  if (!isValidLongitude(lon)) {
    return { valid: false, error: 'Longitude must be between -180 and 180.' };
  }

  return { valid: true, lat, lon };
}
