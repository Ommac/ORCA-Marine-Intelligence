/**
 * Map constants and ArcGIS World Imagery Satellite configuration.
 * Real geographic satellite map tile definitions for MapLibre (Web & Native).
 */

export const ARCGIS_SATELLITE_TILE_URL =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const ARCGIS_SATELLITE_ATTRIBUTION =
  'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

/**
 * Standard MapLibre Style JSON pointing to the ArcGIS World Imagery raster tiles.
 */
export const SATELLITE_MAP_STYLE = {
  version: 8 as const,
  sources: {
    'arcgis-satellite': {
      type: 'raster' as const,
      tiles: [ARCGIS_SATELLITE_TILE_URL],
      tileSize: 256,
      attribution: ARCGIS_SATELLITE_ATTRIBUTION,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'arcgis-satellite-layer',
      type: 'raster' as const,
      source: 'arcgis-satellite',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

// Aliases for backwards compatibility
export const ARCGIS_WORLD_STREET_TILE_URL = ARCGIS_SATELLITE_TILE_URL;
export const ARCGIS_ATTRIBUTION = ARCGIS_SATELLITE_ATTRIBUTION;
export const ARCGIS_MAP_STYLE = SATELLITE_MAP_STYLE;

export const DEFAULT_MAP_CENTER: [number, number] = [72.70, 19.72]; // [longitude, latitude]
export const DEFAULT_ZOOM = 9;
