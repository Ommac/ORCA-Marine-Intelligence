import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Line, Circle as SvgCircle } from 'react-native-svg';
import {
  AlertCircle,
  Minus,
  Plus,
  Compass,
  Crosshair,
} from 'lucide-react-native';
import {
  OrcaResponse,
  PFZNearest,
  PFZCandidate,
  ActiveMapLayers,
  SelectedMapObject,
} from '../../types/orca';
import { COLORS, RADIUS, SHADOWS, TYPOGRAPHY } from '../../constants/theme';
import { DEFAULT_ZOOM } from '../../constants/map';
import { subscribeToMapFocus, MapFocusTarget } from '../../services/mapFocusStore';
import {
  calculateDistanceKm,
  calculateBearing,
  getCardinalDirection,
  formatCoordinates,
} from '../../utils/geo';

export interface NativeMapProps {
  response?: OrcaResponse | null;
  activeLayers?: ActiveMapLayers;
  selectedObject?: SelectedMapObject | null;
  onSelectObject?: (obj: SelectedMapObject | null) => void;
  onSelectPFZ?: (nearest?: PFZNearest) => void;
  onViewDetails?: () => void;
}

type Coordinates = { latitude: number; longitude: number };
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const defaultActiveLayers: ActiveMapLayers = {
  pfz: true,
  fishingLocation: true,
  distance: true,
};

export const OrcaMapComponent: React.FC<NativeMapProps> = ({
  response,
  activeLayers = defaultActiveLayers,
  selectedObject,
  onSelectObject,
  onSelectPFZ,
}) => {
  const fisher: Coordinates = {
    latitude: response?.request?.latitude ?? 19.72,
    longitude: response?.request?.longitude ?? 72.70,
  };

  const [center, setCenter] = useState<Coordinates>(fisher);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);

  const top3Candidates = useMemo<PFZCandidate[]>(() => {
    let rawCands: PFZCandidate[] = [];

    if (response?.pfz?.top_candidates && response.pfz.top_candidates.length > 0) {
      rawCands = response.pfz.top_candidates;
    } else if (response?.top_pfz && response.top_pfz.length > 0) {
      rawCands = response.top_pfz;
    } else if (response?.pfz?.nearest) {
      const nr = response.pfz.nearest;
      rawCands = [
        {
          id: 'pfz-cand-1',
          rank: 1,
          label: 'PFZ #1',
          distance_km: nr.distance_km,
          bearing_degrees: nr.bearing_degrees,
          direction: nr.direction,
          coordinates: { latitude: nr.latitude, longitude: nr.longitude },
          recommended: true,
        },
      ];
    }

    const sliced = rawCands.slice(0, 3);

    return sliced.map((cand, idx) => {
      const rank = cand.rank || idx + 1;
      const dist = calculateDistanceKm(fisher.latitude, fisher.longitude, cand.coordinates.latitude, cand.coordinates.longitude);
      const bearing = calculateBearing(fisher.latitude, fisher.longitude, cand.coordinates.latitude, cand.coordinates.longitude);
      const dir = getCardinalDirection(bearing);

      return {
        ...cand,
        rank,
        label: `PFZ #${rank}`,
        distance_km: dist,
        bearing_degrees: bearing,
        direction: dir,
        recommended: rank === 1,
      };
    });
  }, [response?.pfz?.top_candidates, response?.top_pfz, response?.pfz?.nearest, fisher.latitude, fisher.longitude]);

  const lonSpan = Math.max(360 / Math.pow(2, zoom), 0.025);
  const latSpan = Math.max(lonSpan * 0.62, 0.015);

  useEffect(() => {
    setCenter(fisher);
  }, [fisher.latitude, fisher.longitude]);

  useEffect(() => {
    return subscribeToMapFocus((target) => {
      setFocusTarget(target);
      if (target?.coordinates) {
        setCenter(target.coordinates);
        setZoom(target.zoom || 11);
      }
    });
  }, []);

  const imageUrl = useMemo(() => {
    const minLon = clamp(center.longitude - lonSpan / 2, -180, 180);
    const maxLon = clamp(center.longitude + lonSpan / 2, -180, 180);
    const minLat = clamp(center.latitude - latSpan / 2, -85, 85);
    const maxLat = clamp(center.latitude + latSpan / 2, -85, 85);
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${minLon},${minLat},${maxLon},${maxLat}&bboxSR=4326&imageSR=4326&size=960,600&format=png32&transparent=false&f=image`;
  }, [center.latitude, center.longitude, latSpan, lonSpan]);

  useEffect(() => {
    setImageLoading(true);
    setImageError(false);
  }, [imageUrl]);

  const panStartRef = useRef<{ lat: number; lon: number }>({ lat: center.latitude, lon: center.longitude });
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6,
        onPanResponderGrant: () => {
          panStartRef.current = { lat: center.latitude, lon: center.longitude };
        },
        onPanResponderMove: (_, gestureState) => {
          const deltaLon = -(gestureState.dx / 350) * lonSpan;
          const deltaLat = (gestureState.dy / 300) * latSpan;
          setCenter({
            latitude: clamp(panStartRef.current.lat + deltaLat, -85, 85),
            longitude: clamp(panStartRef.current.lon + deltaLon, -180, 180),
          });
        },
      }),
    [center.latitude, center.longitude, latSpan, lonSpan]
  );

  const projectPercent = (coordinates: Coordinates) => ({
    xPct: clamp(((coordinates.longitude - (center.longitude - lonSpan / 2)) / lonSpan) * 100, 3, 97),
    yPct: clamp(((center.latitude + latSpan / 2 - coordinates.latitude) / latSpan) * 100, 3, 97),
  });

  const project = (coordinates: Coordinates) => {
    const { xPct, yPct } = projectPercent(coordinates);
    return {
      left: `${xPct}%` as const,
      top: `${yPct}%` as const,
    };
  };

  const selectedCandidate = useMemo(() => {
    if (selectedObject?.type !== 'pfz') return null;
    if (selectedObject.candidate) {
      return top3Candidates.find((c) => c.rank === selectedObject.candidate?.rank) || selectedObject.candidate;
    }
    return null;
  }, [selectedObject, top3Candidates]);

  const handleSelectCandidate = (candidate: PFZCandidate) => {
    if (selectedObject?.type === 'pfz' && selectedObject.candidate?.rank === candidate.rank) {
      onSelectObject?.(null);
      return;
    }

    const dist = calculateDistanceKm(fisher.latitude, fisher.longitude, candidate.coordinates.latitude, candidate.coordinates.longitude);
    const bearing = calculateBearing(fisher.latitude, fisher.longitude, candidate.coordinates.latitude, candidate.coordinates.longitude);
    const dir = getCardinalDirection(bearing);

    const selected: SelectedMapObject = {
      type: 'pfz',
      title: `PFZ #${candidate.rank}`,
      subtitle: candidate.recommended ? 'Recommended PFZ Zone' : `Candidate #${candidate.rank}`,
      latitude: candidate.coordinates.latitude,
      longitude: candidate.coordinates.longitude,
      distanceFromFishermanKm: dist,
      bearingFromFishermanDegrees: bearing,
      directionFromFisherman: dir,
      candidate,
      metadata: {
        category: candidate.category,
        valid_until: candidate.valid_until,
      },
    };

    onSelectObject?.(selected);
    onSelectPFZ?.({
      latitude: candidate.coordinates.latitude,
      longitude: candidate.coordinates.longitude,
      distance_km: dist,
      bearing_degrees: bearing,
      direction: dir,
    });
  };

  const handleSelectFishingSpot = () => {
    if (selectedObject?.type === 'fishingLocation') {
      onSelectObject?.(null);
      return;
    }

    onSelectObject?.({
      type: 'fishingLocation',
      title: 'Selected Fishing Location',
      subtitle: formatCoordinates(fisher.latitude, fisher.longitude),
      latitude: fisher.latitude,
      longitude: fisher.longitude,
      distanceFromFishermanKm: 0,
      bearingFromFishermanDegrees: 0,
      directionFromFisherman: 'Spot',
      marine: response?.marine,
    });
  };

  const handleRecenter = () => {
    setFocusTarget(null);
    setCenter(fisher);
    setZoom(DEFAULT_ZOOM);
  };

  const fisherProj = projectPercent(fisher);

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <ImageBackground
        source={{ uri: imageUrl }}
        style={styles.map}
        resizeMode="cover"
        onLoadEnd={() => setImageLoading(false)}
        onError={() => {
          setImageLoading(false);
          setImageError(true);
        }}
      >
        {/* Selected Route Line: ONLY rendered for the single selected PFZ */}
        {activeLayers.distance && selectedCandidate && (() => {
          const candProj = projectPercent(selectedCandidate.coordinates);
          return (
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
              <Line
                x1={`${fisherProj.xPct}%`}
                y1={`${fisherProj.yPct}%`}
                x2={`${candProj.xPct}%`}
                y2={`${candProj.yPct}%`}
                stroke="#10B981"
                strokeWidth="3.5"
                strokeDasharray="8, 6"
                opacity={0.95}
              />
            </Svg>
          );
        })()}

        {activeLayers.fishingLocation && (
          <TouchableOpacity
            style={[styles.fishingMarker, project(fisher)]}
            onPress={handleSelectFishingSpot}
            accessibilityLabel="Selected Fishing Location"
            activeOpacity={0.8}
          >
            <Text style={styles.fishingMarkerText}>🎣</Text>
          </TouchableOpacity>
        )}

        {activeLayers.pfz &&
          top3Candidates.map((cand) => {
            const isSelected =
              selectedObject?.type === 'pfz' &&
              selectedObject.candidate?.rank === cand.rank;

            return (
              <TouchableOpacity
                key={`native-cand-${cand.rank}`}
                style={[
                  styles.pfzMarker,
                  project(cand.coordinates),
                  isSelected
                    ? styles.focusedPfzMarker
                    : cand.recommended
                    ? styles.recommendedPfzMarker
                    : styles.secondaryPfzMarker,
                ]}
                onPress={() => handleSelectCandidate(cand)}
                accessibilityLabel={`PFZ Zone rank ${cand.rank}`}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.pfzMarkerText,
                    isSelected && styles.focusedPfzMarkerText,
                  ]}
                >
                  {isSelected ? `★ PFZ #${cand.rank}` : `● PFZ #${cand.rank}`}
                </Text>
              </TouchableOpacity>
            );
          })}

        {imageLoading && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#FFF" />
          </View>
        )}

        {imageError && (
          <View style={styles.error}>
            <AlertCircle size={24} color="#F87171" />
            <Text style={styles.errorText}>Imagery unavailable</Text>
          </View>
        )}
      </ImageBackground>

      <View style={styles.controls} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.control}
          onPress={() => setZoom((value) => Math.min(value + 1, 14))}
          accessibilityLabel="Zoom In"
        >
          <Plus size={18} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.control}
          onPress={() => setZoom((value) => Math.max(value - 1, 4))}
          accessibilityLabel="Zoom Out"
        >
          <Minus size={18} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.control}
          onPress={handleRecenter}
          accessibilityLabel="Recenter on Selected Fishing Location"
        >
          <Crosshair size={18} color={COLORS.oceanBlue} />
        </TouchableOpacity>
      </View>

      {/* Clean Top-Right Summary Chip for Selected PFZ or Nearest PFZ */}
      {selectedCandidate ? (
        <View style={styles.nearestChip} pointerEvents="box-none">
          <Compass size={13} color="#15803D" />
          <Text style={styles.nearestChipText}>
            PFZ #{selectedCandidate.rank}: {selectedCandidate.distance_km.toFixed(1)} km {selectedCandidate.direction}
          </Text>
        </View>
      ) : top3Candidates.length > 0 ? (
        <View style={styles.nearestChip} pointerEvents="box-none">
          <Compass size={13} color="#15803D" />
          <Text style={styles.nearestChipText}>
            PFZ: {top3Candidates[0].distance_km.toFixed(1)} km {top3Candidates[0].direction}
          </Text>
        </View>
      ) : null}
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
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#334155',
    ...SHADOWS.md,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  error: {
    position: 'absolute',
    left: 40,
    right: 40,
    top: '40%',
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    gap: 6,
  },
  errorText: {
    ...TYPOGRAPHY.bodySmall,
    color: '#F87171',
    textAlign: 'center',
    fontWeight: '700',
  },
  fishingMarker: {
    position: 'absolute',
    width: 38,
    height: 38,
    marginLeft: -19,
    marginTop: -19,
    borderRadius: 19,
    backgroundColor: '#0066CC',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
    zIndex: 10,
  },
  fishingMarkerText: {
    fontSize: 18,
  },
  pfzMarker: {
    position: 'absolute',
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: -32,
    marginTop: -14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFF',
    ...SHADOWS.md,
    zIndex: 9,
  },
  recommendedPfzMarker: {
    backgroundColor: '#10B981',
  },
  secondaryPfzMarker: {
    backgroundColor: '#0284C7',
  },
  focusedPfzMarker: {
    backgroundColor: '#10B981',
    borderColor: '#FEF08A',
    borderWidth: 2.5,
  },
  pfzMarkerText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 11,
  },
  focusedPfzMarkerText: {
    color: '#FFFFFF',
  },
  controls: {
    position: 'absolute',
    left: 14,
    top: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 20,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  control: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    backgroundColor: '#FFFFFF',
  },
  nearestChip: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    zIndex: 20,
    ...SHADOWS.md,
  },
  nearestChipText: {
    ...TYPOGRAPHY.caption,
    color: '#15803D',
    fontWeight: '800',
    fontSize: 11,
  },
});
