import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Plus, Minus, Navigation, Layers, Check } from 'lucide-react-native';
import { OrcaResponse, PFZNearest } from '../../types/orca';
import {
  createFishermanPoint,
  createNearestPFZPoint,
  createDistanceLine,
  pfzToGeoJSON,
  computeBoundingBox,
} from '../../utils/mapAdapters';
import { ARCGIS_MAP_STYLE } from '../../constants/map';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

interface WebMapProps {
  response: OrcaResponse;
  activeLayers?: {
    pfz: boolean;
    myLocation: boolean;
    distance: boolean;
  };
  onSelectPFZ?: (nearest?: PFZNearest) => void;
  onViewDetails?: () => void;
}

export const WebMap: React.FC<WebMapProps> = ({
  response,
  activeLayers = { pfz: true, myLocation: true, distance: true },
  onSelectPFZ,
  onViewDetails,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const fisherLat = response.request?.latitude ?? 19.72;
  const fisherLon = response.request?.longitude ?? 72.70;
  const nearest = response.pfz.nearest;
  const pfz = response.pfz;

  // Inject MapLibre GL CSS on web
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const cssId = 'maplibre-gl-css';
      if (!document.getElementById(cssId)) {
        const link = document.createElement('link');
        link.id = cssId;
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
        document.head.appendChild(link);
      }
    }
  }, []);

  // Initialize MapLibre GL Map
  useEffect(() => {
    let map: any = null;

    const initMap = async () => {
      try {
        const maplibregl = await import('maplibre-gl');
        if (!mapContainerRef.current) return;

        map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: ARCGIS_MAP_STYLE as any,
          center: [fisherLon, fisherLat],
          zoom: 9,
        });

        map.on('load', () => {
          setMapLoaded(true);
          mapInstanceRef.current = map;
          updateMapLayersAndMarkers(map);
        });

        map.on('error', (e: any) => {
          console.warn('MapLibre tile/render warning:', e);
        });
      } catch (err: any) {
        console.error('Failed to initialize WebMap:', err);
        setMapError('Map service unavailable');
      }
    };

    initMap();

    return () => {
      if (map) {
        map.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Helper to sync layers, markers, and camera bounds
  const updateMapLayersAndMarkers = (map: any) => {
    if (!map || !map.isStyleLoaded()) return;

    // Clear previous markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const maplibregl = require('maplibre-gl');

    // 1. PFZ Geometry Layer
    const pfzGeoJSON = pfzToGeoJSON(pfz);
    if (map.getSource('pfz-source')) {
      map.getSource('pfz-source').setData(pfzGeoJSON || { type: 'FeatureCollection', features: [] });
    } else if (pfzGeoJSON) {
      map.addSource('pfz-source', {
        type: 'geojson',
        data: pfzGeoJSON,
      });

      // PFZ Dark Outer Halo for High Sunlight Contrast
      map.addLayer({
        id: 'pfz-halo',
        type: 'line',
        source: 'pfz-source',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          visibility: activeLayers.pfz ? 'visible' : 'none',
        },
        paint: {
          'line-color': '#064E3B',
          'line-width': 7,
          'line-opacity': 0.8,
        },
      });

      // PFZ Vibrant Emerald Line
      map.addLayer({
        id: 'pfz-line',
        type: 'line',
        source: 'pfz-source',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          visibility: activeLayers.pfz ? 'visible' : 'none',
        },
        paint: {
          'line-color': '#10B981',
          'line-width': 4.5,
          'line-opacity': 1.0,
        },
      });
    }

    // 2. Distance Route Line Layer
    const distanceGeoJSON = createDistanceLine(fisherLat, fisherLon, nearest);
    if (map.getSource('distance-source')) {
      map.getSource('distance-source').setData(distanceGeoJSON || { type: 'FeatureCollection', features: [] });
    } else if (distanceGeoJSON) {
      map.addSource('distance-source', {
        type: 'geojson',
        data: distanceGeoJSON,
      });

      map.addLayer({
        id: 'distance-line',
        type: 'line',
        source: 'distance-source',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          visibility: activeLayers.distance ? 'visible' : 'none',
        },
        paint: {
          'line-color': '#0066CC',
          'line-width': 3.5,
          'line-dasharray': [2, 2],
          'line-opacity': 0.9,
        },
      });
    }

    // 3. Fisherman Location Marker (HTML Custom Element)
    if (activeLayers.myLocation) {
      const elFisher = document.createElement('div');
      elFisher.className = 'orca-fisher-marker';
      elFisher.innerHTML = `
        <div style="
          background-color: #0A2540;
          color: white;
          padding: 4px 8px;
          border-radius: 6px;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 11px;
          font-weight: bold;
          white-space: nowrap;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          border: 2px solid #38BDF8;
          display: flex;
          align-items: center;
          gap: 4px;
        ">
          <span style="font-size: 13px;">📍</span> Fishing Location
        </div>
      `;

      const mFisher = new maplibregl.Marker({ element: elFisher, anchor: 'bottom' })
        .setLngLat([fisherLon, fisherLat])
        .addTo(map);

      markersRef.current.push(mFisher);
    }

    // 4. Nearest PFZ Spot Marker (HTML Custom Element with Backend Distance & Direction)
    if (activeLayers.pfz && nearest && !isNaN(nearest.latitude) && !isNaN(nearest.longitude)) {
      const elPFZ = document.createElement('div');
      elPFZ.className = 'orca-pfz-marker';
      elPFZ.style.cursor = 'pointer';
      elPFZ.innerHTML = `
        <div style="
          background-color: #15803D;
          color: white;
          padding: 5px 10px;
          border-radius: 8px;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: 0 3px 8px rgba(0,0,0,0.4);
          border: 2px solid #86EFAC;
          display: flex;
          flex-direction: column;
          align-items: center;
        ">
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="font-size: 14px;">🐟</span> Nearest PFZ
          </div>
          <div style="font-size: 10px; color: #DCFCE7; font-weight: 700; margin-top: 1px;">
            ${nearest.distance_km ? `${nearest.distance_km.toFixed(1)} km ${nearest.direction || ''}` : ''}
          </div>
        </div>
      `;

      elPFZ.addEventListener('click', () => {
        if (onSelectPFZ) onSelectPFZ(nearest);
      });

      const mPFZ = new maplibregl.Marker({ element: elPFZ, anchor: 'bottom' })
        .setLngLat([nearest.longitude, nearest.latitude])
        .addTo(map);

      markersRef.current.push(mPFZ);
    }

    // 5. Dynamic Camera Auto-Fit around Active Trip Data
    const bbox = computeBoundingBox(fisherLat, fisherLon, nearest, pfz);
    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      {
        padding: 50,
        maxZoom: 13,
        duration: 800,
      }
    );
  };

  // Synchronize layer visibility when activeLayers prop changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && mapLoaded) {
      updateMapLayersAndMarkers(map);
    }
  }, [activeLayers, response, mapLoaded]);

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      const bbox = computeBoundingBox(fisherLat, fisherLon, nearest, pfz);
      mapInstanceRef.current.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        { padding: 50, maxZoom: 13, duration: 600 }
      );
    }
  };

  if (mapError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Map unavailable</Text>
        <Text style={styles.errorSubtitle}>
          Could not connect to the ArcGIS geographic map tile service.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* Real Map Container */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />

      {/* Loading Indicator */}
      {!mapLoaded && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.oceanBlue} />
          <Text style={styles.loadingText}>Loading ArcGIS Geographic Tiles...</Text>
        </View>
      )}

      {/* Map Control Buttons */}
      <View style={styles.controlsCol}>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={handleZoomIn}
          accessibilityLabel="Zoom In"
        >
          <Plus size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={handleZoomOut}
          accessibilityLabel="Zoom Out"
        >
          <Minus size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={handleRecenter}
          accessibilityLabel="Recenter Map"
        >
          <Navigation size={18} color={COLORS.oceanBlue} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    height: 480,
    width: '100%',
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
    borderWidth: 1.5,
    borderColor: COLORS.skyBlueBorder,
    ...SHADOWS.md,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    gap: 10,
  },
  loadingText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  controlsCol: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 10,
    ...SHADOWS.md,
  },
  controlBtn: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  errorContainer: {
    height: 480,
    width: '100%',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  errorTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  errorSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
