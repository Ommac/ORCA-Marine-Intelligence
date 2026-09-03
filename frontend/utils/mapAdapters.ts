/**
 * Map Data Adapters for ORCA
 * Converts normalized backend responses into GeoJSON structures for MapLibre.
 * Strictly preserves backend coordinates and does not compute risk or geographic data.
 */

import { PFZData, PFZNearest } from '../types/orca';

export interface GeoJSONFeature<G = any, P = any> {
  type: 'Feature';
  geometry: G;
  properties: P;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * Creates a GeoJSON Point Feature for the fisherman's chosen launch/fishing coordinate.
 */
export function createFishermanPoint(
  lat: number,
  lon: number,
  title: string = 'Fishing Location'
): GeoJSONFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lon, lat], // GeoJSON order: [longitude, latitude]
        },
        properties: {
          title,
          type: 'fisherman_location',
          latitude: lat,
          longitude: lon,
        },
      },
    ],
  };
}

/**
 * Creates a GeoJSON Point Feature for the nearest PFZ spot.
 */
export function createNearestPFZPoint(
  nearest?: PFZNearest
): GeoJSONFeatureCollection | null {
  if (!nearest || isNaN(nearest.latitude) || isNaN(nearest.longitude)) {
    return null;
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [nearest.longitude, nearest.latitude],
        },
        properties: {
          title: 'Nearest PFZ',
          distance_km: nearest.distance_km,
          direction: nearest.direction || '',
          bearing_degrees: nearest.bearing_degrees,
          type: 'nearest_pfz',
          latitude: nearest.latitude,
          longitude: nearest.longitude,
        },
      },
    ],
  };
}

/**
 * Creates a GeoJSON LineString Feature connecting the fisherman's location to the nearest PFZ.
 */
export function createDistanceLine(
  fisherLat: number,
  fisherLon: number,
  nearest?: PFZNearest
): GeoJSONFeatureCollection | null {
  if (!nearest || isNaN(nearest.latitude) || isNaN(nearest.longitude)) {
    return null;
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [fisherLon, fisherLat],
            [nearest.longitude, nearest.latitude],
          ],
        },
        properties: {
          type: 'distance_route',
          distance_km: nearest.distance_km,
          direction: nearest.direction,
        },
      },
    ],
  };
}

/**
 * Converts PFZ geometry directly from response.pfz.geometry into a GeoJSON FeatureCollection.
 * Supports MultiLineString, LineString, Polygon, MultiPolygon formats.
 */
export function pfzToGeoJSON(pfz?: PFZData): GeoJSONFeatureCollection | null {
  if (!pfz || !pfz.available || !pfz.geometry) {
    return null;
  }

  const geom = pfz.geometry;

  // If geometry is already a GeoJSON FeatureCollection
  if ((geom as any).type === 'FeatureCollection') {
    return geom as any;
  }

  // If geometry is already a GeoJSON Feature
  if ((geom as any).type === 'Feature') {
    return {
      type: 'FeatureCollection',
      features: [geom as any],
    };
  }

  // If it is a raw geometry object (MultiLineString or LineString)
  if (geom.type && geom.coordinates) {
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: geom.type as any,
            coordinates: geom.coordinates,
          },
          properties: {
            type: 'pfz_geometry',
            title: 'Potential Fishing Zone',
            distance_km: pfz.nearest?.distance_km,
            direction: pfz.nearest?.direction,
          },
        },
      ],
    };
  }

  return null;
}

/**
 * Computes bounding box [minLon, minLat, maxLon, maxLat] from all active coordinates
 * to automatically position the map camera around user location and PFZ features.
 */
export function computeBoundingBox(
  fisherLat: number,
  fisherLon: number,
  nearest?: PFZNearest,
  pfz?: PFZData
): [number, number, number, number] {
  let minLon = fisherLon;
  let maxLon = fisherLon;
  let minLat = fisherLat;
  let maxLat = fisherLat;

  if (nearest && !isNaN(nearest.longitude) && !isNaN(nearest.latitude)) {
    minLon = Math.min(minLon, nearest.longitude);
    maxLon = Math.max(maxLon, nearest.longitude);
    minLat = Math.min(minLat, nearest.latitude);
    maxLat = Math.max(maxLat, nearest.latitude);
  }

  const parseCoords = (coords: any) => {
    if (!Array.isArray(coords)) return;
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const [lon, lat] = coords;
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    } else {
      coords.forEach(parseCoords);
    }
  };

  if (pfz?.geometry?.coordinates) {
    parseCoords(pfz.geometry.coordinates);
  }

  // Add slight padding around bounds
  const lonPadding = Math.max((maxLon - minLon) * 0.3, 0.15);
  const latPadding = Math.max((maxLat - minLat) * 0.3, 0.15);

  return [
    minLon - lonPadding,
    minLat - latPadding,
    maxLon + lonPadding,
    maxLat + latPadding,
  ];
}
