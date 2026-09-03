import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Plus, Minus, Navigation, Fish, Anchor } from 'lucide-react-native';
import { OrcaResponse, PFZNearest } from '../../types/orca';
import {
  createDistanceLine,
  pfzToGeoJSON,
  computeBoundingBox,
} from '../../utils/mapAdapters';
import { ARCGIS_MAP_STYLE } from '../../constants/map';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

let MapLibreGL: any = null;
try {
  MapLibreGL = require('@maplibre/maplibre-react-native');
  if (MapLibreGL && MapLibreGL.setAccessToken) {
    MapLibreGL.setAccessToken(null);
  }
} catch (e) {
  // Graceful fallback handled below
}

interface NativeMapProps {
  response: OrcaResponse;
  activeLayers?: {
    pfz: boolean;
    myLocation: boolean;
    distance: boolean;
  };
  onSelectPFZ?: (nearest?: PFZNearest) => void;
  onViewDetails?: () => void;
}

export const NativeMap: React.FC<NativeMapProps> = ({
  response,
  activeLayers = { pfz: true, myLocation: true, distance: true },
  onSelectPFZ,
  onViewDetails,
}) => {
  const cameraRef = useRef<any>(null);
  const [zoomLevel, setZoomLevel] = useState(9);

  const fisherLat = response.request?.latitude ?? 19.72;
  const fisherLon = response.request?.longitude ?? 72.70;
  const nearest = response.pfz.nearest;
  const pfz = response.pfz;

  const distanceLineGeoJSON = createDistanceLine(fisherLat, fisherLon, nearest);
  const pfzMultiLineGeoJSON = pfzToGeoJSON(pfz);
  const bbox = computeBoundingBox(fisherLat, fisherLon, nearest, pfz);

  if (!MapLibreGL || !MapLibreGL.MapView) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Map unavailable</Text>
        <Text style={styles.errorSubtitle}>
          Native MapLibre module requires a development build.
        </Text>
      </View>
    );
  }

  const handleRecenter = () => {
    if (cameraRef.current) {
      cameraRef.current.fitBounds(
        [bbox[2], bbox[3]], // ne
        [bbox[0], bbox[1]], // sw
        40,
        600
      );
    }
  };

  return (
    <View style={styles.container}>
      <MapLibreGL.MapView
        style={styles.fullMap}
        styleJSON={JSON.stringify(ARCGIS_MAP_STYLE)}
        logoEnabled={false}
        attributionEnabled={true}
        attributionPosition={{ bottom: 8, right: 8 }}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [fisherLon, fisherLat],
            zoomLevel: zoomLevel,
            bounds: {
              ne: [bbox[2], bbox[3]],
              sw: [bbox[0], bbox[1]],
              paddingBottom: 40,
              paddingLeft: 40,
              paddingRight: 40,
              paddingTop: 40,
            },
          }}
        />

        {/* Distance Line Layer */}
        {activeLayers.distance && distanceLineGeoJSON && (
          <MapLibreGL.ShapeSource id="nativeDistanceSource" shape={distanceLineGeoJSON}>
            <MapLibreGL.LineLayer
              id="nativeDistanceLayer"
              style={{
                lineColor: '#0066CC',
                lineWidth: 3.5,
                lineDasharray: [2, 2],
                lineOpacity: 0.9,
              }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* PFZ Geometry Layer */}
        {activeLayers.pfz && pfzMultiLineGeoJSON && (
          <MapLibreGL.ShapeSource id="nativePfzSource" shape={pfzMultiLineGeoJSON}>
            <MapLibreGL.LineLayer
              id="nativePfzHalo"
              style={{
                lineColor: '#064E3B',
                lineWidth: 7,
                lineOpacity: 0.8,
              }}
            />
            <MapLibreGL.LineLayer
              id="nativePfzLayer"
              style={{
                lineColor: '#10B981',
                lineWidth: 4.5,
                lineOpacity: 1.0,
              }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Fisherman Location Marker */}
        {activeLayers.myLocation && (
          <MapLibreGL.PointAnnotation
            id="nativeFisherMarker"
            coordinate={[fisherLon, fisherLat]}
            title="Fishing Location"
          >
            <View style={styles.fisherPin}>
              <Anchor size={16} color="#FFFFFF" strokeWidth={2.5} />
            </View>
          </MapLibreGL.PointAnnotation>
        )}

        {/* Nearest PFZ Spot Marker */}
        {activeLayers.pfz && nearest && !isNaN(nearest.latitude) && !isNaN(nearest.longitude) && (
          <MapLibreGL.PointAnnotation
            id="nativePFZMarker"
            coordinate={[nearest.longitude, nearest.latitude]}
            title="Nearest PFZ"
            onSelected={() => {
              if (onSelectPFZ) onSelectPFZ(nearest);
            }}
          >
            <View style={styles.pfzPin}>
              <Fish size={18} color="#FFFFFF" strokeWidth={2.5} />
            </View>
          </MapLibreGL.PointAnnotation>
        )}
      </MapLibreGL.MapView>

      {/* Touch Map Controls */}
      <View style={styles.controlsCol}>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setZoomLevel((prev) => Math.min(prev + 1, 16))}
          accessibilityLabel="Zoom In"
        >
          <Plus size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setZoomLevel((prev) => Math.max(prev - 1, 4))}
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
  container: {
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
  fullMap: {
    flex: 1,
  },
  fisherPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0A2540',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#38BDF8',
    ...SHADOWS.md,
  },
  pfzPin: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#15803D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#86EFAC',
    ...SHADOWS.md,
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
