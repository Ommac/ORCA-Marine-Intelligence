/**
 * Map constants and ArcGIS World Street Map MapServer configuration.
 * Real geographic map tile definitions for MapLibre (Web & Native).
 */

export const ARCGIS_WORLD_STREET_TILE_URL =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';

export const ARCGIS_ATTRIBUTION =
  'Tiles © Esri — Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, METI, TomTom';

/**
 * Standard MapLibre Style JSON pointing to the ArcGIS World Street Map MapServer raster tiles.
 */
export const ARCGIS_MAP_STYLE = {
  version: 8 as const,
  sources: {
    'arcgis-world-street': {
      type: 'raster' as const,
      tiles: [ARCGIS_WORLD_STREET_TILE_URL],
      tileSize: 256,
      attribution: ARCGIS_ATTRIBUTION,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'arcgis-world-street-layer',
      type: 'raster' as const,
      source: 'arcgis-world-street',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export const DEFAULT_MAP_CENTER: [number, number] = [72.70, 19.72]; // [longitude, latitude]
export const DEFAULT_ZOOM = 9;
