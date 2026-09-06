import { PFZGeometry } from '../types/orca';

export type PFZLatLng = [number, number];

export type NormalizedPFZGeometry =
  | { type: 'Point'; coordinates: PFZLatLng }
  | { type: 'MultiPoint'; coordinates: PFZLatLng[] }
  | { type: 'LineString'; coordinates: PFZLatLng[] }
  | { type: 'MultiLineString'; coordinates: PFZLatLng[][] }
  | { type: 'Polygon'; coordinates: PFZLatLng[][] }
  | { type: 'MultiPolygon'; coordinates: PFZLatLng[][][] };

export interface NormalizedPFZFeature {
  id: string;
  geometry: NormalizedPFZGeometry;
  properties: Record<string, unknown>;
}

type GeoJSONFeature = {
  type: 'Feature';
  id?: string | number;
  geometry?: PFZGeometry | null;
  properties?: Record<string, unknown> | null;
};

const SUPPORTED_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
]);

function isValidCoordinate(value: unknown): value is [number, number] {
  if (!Array.isArray(value) || value.length < 2) return false;
  const longitude = Number(value[0]);
  const latitude = Number(value[1]);
  return Number.isFinite(longitude) && Number.isFinite(latitude)
    && longitude >= -180 && longitude <= 180
    && latitude >= -90 && latitude <= 90;
}

function toLeafletCoordinate(value: unknown): PFZLatLng | null {
  if (!isValidCoordinate(value)) return null;
  return [Number(value[1]), Number(value[0])];
}

function normalizeLine(value: unknown): PFZLatLng[] {
  return Array.isArray(value)
    ? value.map(toLeafletCoordinate).filter((coordinate): coordinate is PFZLatLng => coordinate !== null)
    : [];
}

function normalizeGeometry(geometry: PFZGeometry | null | undefined): NormalizedPFZGeometry | null {
  if (!geometry || !SUPPORTED_TYPES.has(geometry.type) || !Array.isArray(geometry.coordinates)) {
    return null;
  }

  switch (geometry.type) {
    case 'Point': {
      const coordinate = toLeafletCoordinate(geometry.coordinates);
      return coordinate ? { type: 'Point', coordinates: coordinate } : null;
    }
    case 'MultiPoint': {
      const coordinates = geometry.coordinates.map(toLeafletCoordinate).filter(
        (coordinate): coordinate is PFZLatLng => coordinate !== null,
      );
      return coordinates.length ? { type: 'MultiPoint', coordinates } : null;
    }
    case 'LineString': {
      const coordinates = normalizeLine(geometry.coordinates);
      return coordinates.length >= 2 ? { type: 'LineString', coordinates } : null;
    }
    case 'MultiLineString': {
      const coordinates = geometry.coordinates
        .map(normalizeLine)
        .filter((line) => line.length >= 2);
      return coordinates.length ? { type: 'MultiLineString', coordinates } : null;
    }
    case 'Polygon': {
      const coordinates = geometry.coordinates
        .map(normalizeLine)
        .filter((ring) => ring.length >= 3);
      return coordinates.length ? { type: 'Polygon', coordinates } : null;
    }
    case 'MultiPolygon': {
      const coordinates = geometry.coordinates
        .map((polygon: unknown) => Array.isArray(polygon)
          ? polygon.map(normalizeLine).filter((ring) => ring.length >= 3)
          : [])
        .filter((polygon: PFZLatLng[][]) => polygon.length > 0);
      return coordinates.length ? { type: 'MultiPolygon', coordinates } : null;
    }
    default:
      return null;
  }
}

function asFeatures(input: unknown): GeoJSONFeature[] {
  if (!input || typeof input !== 'object') return [];
  const value = input as { type?: string; features?: unknown; geometry?: PFZGeometry | null };
  if (value.type === 'FeatureCollection' && Array.isArray(value.features)) {
    return value.features.filter((feature): feature is GeoJSONFeature => (
      Boolean(feature) && typeof feature === 'object' && (feature as GeoJSONFeature).type === 'Feature'
    ));
  }
  if (value.type === 'Feature') return [input as GeoJSONFeature];
  if (value.type && value.geometry === undefined) {
    return [{ type: 'Feature', geometry: input as PFZGeometry }];
  }
  return [];
}

export function normalizePFZFeatures(
  input: unknown,
  fallbackProperties: Record<string, unknown> = {},
): NormalizedPFZFeature[] {
  return asFeatures(input).reduce<NormalizedPFZFeature[]>((features, feature, index) => {
    const geometry = normalizeGeometry(feature.geometry);
    if (!geometry) return features;
    features.push({
      id: String(feature.id ?? `pfz-${index}`),
      geometry,
      properties: { ...fallbackProperties, ...(feature.properties || {}) },
    });
    return features;
  }, []);
}

export function calculatePFZBounds(
  features: NormalizedPFZFeature[],
): [PFZLatLng, PFZLatLng] | null {
  const positions: PFZLatLng[] = [];
  features.forEach(({ geometry }) => {
    const collect = (value: unknown): void => {
      if (Array.isArray(value) && typeof value[0] === 'number') {
        positions.push(value as PFZLatLng);
      } else if (Array.isArray(value)) {
        value.forEach(collect);
      }
    };
    collect(geometry.coordinates);
  });

  if (!positions.length) return null;
  const latitudes = positions.map(([latitude]) => latitude);
  const longitudes = positions.map(([, longitude]) => longitude);
  return [
    [Math.min(...latitudes), Math.min(...longitudes)],
    [Math.max(...latitudes), Math.max(...longitudes)],
  ];
}