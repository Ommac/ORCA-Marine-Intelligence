import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Minus, Plus, Compass, Crosshair } from 'lucide-react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import {
  OrcaResponse,
  PFZNearest,
  PFZCandidate,
  ActiveMapLayers,
  SelectedMapObject,
} from '../../types/orca';
import {
  calculatePFZBounds,
  NormalizedPFZFeature,
  PFZLatLng,
  normalizePFZFeatures,
} from '../../utils/pfzGeometry';
import { ARCGIS_SATELLITE_ATTRIBUTION, ARCGIS_SATELLITE_TILE_URL } from '../../constants/map';
import { COLORS, TYPOGRAPHY, RADIUS, SHADOWS } from '../../constants/theme';
import { subscribeToMapFocus, MapFocusTarget } from '../../services/mapFocusStore';
import { calculateDistanceKm, calculateBearing, getCardinalDirection, formatCoordinates } from '../../utils/geo';

export interface WebMapProps {
  response?: OrcaResponse | null;
  activeLayers?: ActiveMapLayers;
  selectedObject?: SelectedMapObject | null;
  onSelectObject?: (obj: SelectedMapObject | null) => void;
  onSelectPFZ?: (nearest?: PFZNearest) => void;
  onViewDetails?: () => void;
}

const defaultActiveLayers: ActiveMapLayers = {
  pfz: true,
  fishingLocation: true,
  distance: true,
};

// -------------------------------------------------------------
// Custom Clean Leaflet DivIcons
// -------------------------------------------------------------

const createFishermanPinIcon = () =>
  L.divIcon({
    className: 'orca-fishing-spot-marker',
    html: `
      <div style="
        position: relative;
        width: 40px;
        height: 40px;
        border-radius: 20px;
        background: #0066CC;
        border: 3px solid #FFFFFF;
        box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        cursor: pointer;
        user-select: none;
      ">
        🎣
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  });

const createPfzRankIcon = (rank: number, recommended: boolean, isSelected: boolean) => {
  // When selected, any candidate (PFZ #1, #2, or #3) gets vibrant emerald green active styling
  const isGreen = isSelected || recommended;
  const bg = isGreen ? '#10B981' : '#0284C7';
  const textCol = '#FFFFFF';
  const borderCol = isSelected ? '#FEF08A' : '#FFFFFF';
  const label = isSelected ? `★ PFZ #${rank}` : `PFZ #${rank}`;

  return L.divIcon({
    className: `orca-pfz-marker rank-${rank}`,
    html: `
      <div style="
        padding: 4px 10px;
        border-radius: 14px;
        background: ${bg};
        border: 2.5px solid ${borderCol};
        box-shadow: ${isSelected ? '0 0 0 3.5px rgba(16, 185, 129, 0.5), 0 4px 14px rgba(0,0,0,0.6)' : '0 3px 10px rgba(0,0,0,0.5)'};
        color: ${textCol};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 11px;
        font-weight: 900;
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
        cursor: pointer;
        user-select: none;
        transform: ${isSelected ? 'scale(1.1)' : 'scale(1)'};
        transition: transform 0.15s ease;
      ">
        <span style="color: ${isSelected ? '#FEF08A' : '#FFFFFF'};">●</span>
        <span>${label}</span>
      </div>
    `,
    iconSize: [isSelected ? 78 : 68, 28],
    iconAnchor: [isSelected ? 39 : 34, 14],
    popupAnchor: [0, -16],
  });
};

// -------------------------------------------------------------
// Direction Arrows & Geometry rendering for INCOIS PFZ Zones
// -------------------------------------------------------------

function PFZFeatureLayer({
  feature,
  onSelectFeature,
}: {
  feature: NormalizedPFZFeature;
  onSelectFeature: () => void;
}) {
  const { geometry } = feature;
  const pathOpts = { color: '#10B981', weight: 3.5, opacity: 0.9 };
  const polyOpts = { color: '#10B981', weight: 2.5, fillColor: '#10B981', fillOpacity: 0.2 };

  const eventHandlers = {
    click: onSelectFeature,
  };

  if (geometry.type === 'LineString') {
    return <Polyline positions={geometry.coordinates} pathOptions={pathOpts} eventHandlers={eventHandlers} />;
  }
  if (geometry.type === 'MultiLineString') {
    return (
      <>
        {geometry.coordinates.map((line, index) => (
          <Polyline key={`${feature.id}-line-${index}`} positions={line} pathOptions={pathOpts} eventHandlers={eventHandlers} />
        ))}
      </>
    );
  }
  if (geometry.type === 'Polygon') {
    return <Polygon positions={geometry.coordinates} pathOptions={polyOpts} eventHandlers={eventHandlers} />;
  }
  if (geometry.type === 'MultiPolygon') {
    return (
      <>
        {geometry.coordinates.map((polygon, index) => (
          <Polygon key={`${feature.id}-poly-${index}`} positions={polygon} pathOptions={polyOpts} eventHandlers={eventHandlers} />
        ))}
      </>
    );
  }
  if (geometry.type === 'Point') {
    return (
      <CircleMarker
        center={geometry.coordinates}
        radius={7}
        pathOptions={{ color: '#FFFFFF', fillColor: '#10B981', fillOpacity: 0.9 }}
        eventHandlers={eventHandlers}
      />
    );
  }
  return null;
}

// -------------------------------------------------------------
// Map Camera Controller
// -------------------------------------------------------------

function MapCamera({
  fitBoundsCoord,
  fallback,
  focusTarget,
  onReady,
}: {
  fitBoundsCoord: [PFZLatLng, PFZLatLng] | null;
  fallback: PFZLatLng;
  focusTarget: MapFocusTarget | null;
  onReady: (map: L.Map) => void;
}) {
  const map = useMap();

  useEffect(() => {
    onReady(map);
    // Invalidate size on mount to ensure smooth drag/pan
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [map, onReady]);

  useEffect(() => {
    if (focusTarget && focusTarget.coordinates) {
      map.setView([focusTarget.coordinates.latitude, focusTarget.coordinates.longitude], focusTarget.zoom || 11, {
        animate: true,
      });
    } else if (fitBoundsCoord) {
      map.fitBounds(fitBoundsCoord, { padding: [50, 50], maxZoom: 12, animate: true });
    } else {
      map.setView(fallback, 9);
    }
  }, [fitBoundsCoord, fallback, focusTarget, map]);

  return null;
}

export const OrcaMapComponent: React.FC<WebMapProps> = ({
  response,
  activeLayers = defaultActiveLayers,
  selectedObject,
  onSelectObject,
  onSelectPFZ,
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);

  // 1. Selected Fishing Location
  const fisherLat = response?.request?.latitude ?? 19.72;
  const fisherLon = response?.request?.longitude ?? 72.70;
  const fallback: PFZLatLng = [fisherLat, fisherLon];

  // 2. Filter / Extract ONLY TOP 3 PFZs
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

    // Strictly limit to TOP 3
    const sliced = rawCands.slice(0, 3);

    // Ensure all 3 have accurately calculated distance, bearing, and direction relative to fishing location
    return sliced.map((cand, idx) => {
      const rank = cand.rank || idx + 1;
      const dist = calculateDistanceKm(fisherLat, fisherLon, cand.coordinates.latitude, cand.coordinates.longitude);
      const bearing = calculateBearing(fisherLat, fisherLon, cand.coordinates.latitude, cand.coordinates.longitude);
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
  }, [response?.pfz?.top_candidates, response?.top_pfz, response?.pfz?.nearest, fisherLat, fisherLon]);

  // 3. Extract currently selected PFZ candidate (if any)
  const selectedCandidate = useMemo(() => {
    if (selectedObject?.type !== 'pfz') return null;
    if (selectedObject.candidate) {
      return top3Candidates.find((c) => c.rank === selectedObject.candidate?.rank) || selectedObject.candidate;
    }
    return null;
  }, [selectedObject, top3Candidates]);

  // Real INCOIS PFZ Geometry features for the SELECTED candidate ONLY
  const activeFeatures = useMemo<NormalizedPFZFeature[]>(() => {
    if (!activeLayers.pfz || !selectedCandidate) return [];

    // 1. Candidate's own actual GeoJSON geometry
    if (selectedCandidate.geometry) {
      return normalizePFZFeatures(selectedCandidate.geometry, {
        rank: selectedCandidate.rank,
        category: selectedCandidate.category,
        id: selectedCandidate.id,
      });
    }

    // 2. If candidate is rank 1 and response.pfz.geometry is available
    if (selectedCandidate.rank === 1 && response?.pfz?.geometry) {
      return normalizePFZFeatures(response.pfz.geometry, response.pfz.metadata);
    }

    return [];
  }, [activeLayers.pfz, selectedCandidate, response?.pfz?.geometry, response?.pfz?.metadata]);

  // Compute Auto-fit Bounding Box encompassing Fishing Location + Top 3 PFZs
  const fitBoundsCoord = useMemo<[PFZLatLng, PFZLatLng] | null>(() => {
    const lats = [fisherLat, ...top3Candidates.map((c) => c.coordinates.latitude)];
    const lons = [fisherLon, ...top3Candidates.map((c) => c.coordinates.longitude)];

    if (lats.length === 1) return null;

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    // Add slight margin
    const latMargin = Math.max((maxLat - minLat) * 0.15, 0.04);
    const lonMargin = Math.max((maxLon - minLon) * 0.15, 0.04);

    return [
      [minLat - latMargin, minLon - lonMargin],
      [maxLat + latMargin, maxLon + lonMargin],
    ];
  }, [fisherLat, fisherLon, top3Candidates]);

  useEffect(() => {
    const unsub = subscribeToMapFocus((target) => {
      setFocusTarget(target);
      if (target && target.coordinates && mapRef.current) {
        mapRef.current.setView([target.coordinates.latitude, target.coordinates.longitude], target.zoom || 11, {
          animate: true,
        });
      }
    });
    return () => unsub();
  }, []);

  const handleRecenter = () => {
    if (!mapRef.current) return;
    if (fitBoundsCoord) {
      mapRef.current.fitBounds(fitBoundsCoord, { padding: [50, 50], maxZoom: 12 });
    } else {
      mapRef.current.setView(fallback, 10);
    }
  };

  const handleSelectCandidate = (cand: PFZCandidate) => {
    // If the candidate is already selected, tapping it toggles/clears selection
    if (selectedObject?.type === 'pfz' && (selectedObject.candidate?.id === cand.id || selectedObject.candidate?.rank === cand.rank)) {
      onSelectObject?.(null);
      return;
    }

    const dist = calculateDistanceKm(fisherLat, fisherLon, cand.coordinates.latitude, cand.coordinates.longitude);
    const bearing = calculateBearing(fisherLat, fisherLon, cand.coordinates.latitude, cand.coordinates.longitude);
    const dir = getCardinalDirection(bearing);

    const selected: SelectedMapObject = {
      type: 'pfz',
      title: `PFZ #${cand.rank}`,
      subtitle: cand.recommended ? 'Recommended PFZ Zone' : `Candidate #${cand.rank}`,
      latitude: cand.coordinates.latitude,
      longitude: cand.coordinates.longitude,
      distanceFromFishermanKm: dist,
      bearingFromFishermanDegrees: bearing,
      directionFromFisherman: dir,
      candidate: cand,
      metadata: {
        category: cand.category,
        valid_until: cand.valid_until,
      },
    };

    onSelectObject?.(selected);
    onSelectPFZ?.({
      latitude: cand.coordinates.latitude,
      longitude: cand.coordinates.longitude,
      distance_km: dist,
      bearing_degrees: bearing,
      direction: dir,
    });
  };

  const handleSelectFishingLocation = () => {
    if (selectedObject?.type === 'fishingLocation') {
      onSelectObject?.(null);
      return;
    }

    const selected: SelectedMapObject = {
      type: 'fishingLocation',
      title: 'Selected Fishing Location',
      subtitle: formatCoordinates(fisherLat, fisherLon),
      latitude: fisherLat,
      longitude: fisherLon,
      distanceFromFishermanKm: 0,
      bearingFromFishermanDegrees: 0,
      directionFromFisherman: 'Spot',
      marine: response?.marine,
    };

    onSelectObject?.(selected);
  };

  return (
    <View style={styles.wrapper}>
      <MapContainer
        center={fallback}
        zoom={9}
        style={styles.map}
        dragging={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        touchZoom={true}
      >
        <TileLayer url={ARCGIS_SATELLITE_TILE_URL} attribution={ARCGIS_SATELLITE_ATTRIBUTION} />

        <MapCamera
          fitBoundsCoord={fitBoundsCoord}
          fallback={fallback}
          focusTarget={focusTarget}
          onReady={(map) => {
            mapRef.current = map;
            setMapReady(true);
            setTimeout(() => map.invalidateSize(), 150);
          }}
        />

        {/* Real INCOIS PFZ Geometry features for the single selected PFZ */}
        {activeLayers.pfz &&
          activeFeatures.map((feature) => (
            <PFZFeatureLayer
              key={`selected-geom-${selectedCandidate?.rank}-${feature.id}`}
              feature={feature}
              onSelectFeature={() => {
                if (selectedCandidate) {
                  handleSelectCandidate(selectedCandidate);
                }
              }}
            />
          ))}

        {/* Selected Route / Direction Line: ONLY rendered for the single selected PFZ */}
        {activeLayers.distance && selectedCandidate && (
          <Polyline
            key={`selected-route-${selectedCandidate.rank}`}
            positions={[
              [fisherLat, fisherLon],
              [selectedCandidate.coordinates.latitude, selectedCandidate.coordinates.longitude],
            ]}
            pathOptions={{
              color: '#10B981',
              weight: 3.5,
              dashArray: '8 6',
              opacity: 0.95,
            }}
          />
        )}

        {/* 1. Selected Fishing Location Marker */}
        {activeLayers.fishingLocation && (
          <Marker
            position={fallback}
            icon={createFishermanPinIcon()}
            eventHandlers={{
              click: handleSelectFishingLocation,
            }}
          >
            <Popup>
              <div style={{ minWidth: 150 }}>
                <strong style={{ fontSize: 13, color: '#0F172A' }}>🎣 Fishing Location</strong>
                <div style={{ fontSize: 12, marginTop: 4, color: '#0066CC', fontWeight: 700 }}>
                  {formatCoordinates(fisherLat, fisherLon)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* 2. Top 3 PFZ Markers */}
        {activeLayers.pfz &&
          top3Candidates.map((cand: PFZCandidate) => {
            const isSelected = selectedObject?.type === 'pfz' && selectedObject.candidate?.rank === cand.rank;
            return (
              <Marker
                key={`pfz-marker-${cand.rank}`}
                position={[cand.coordinates.latitude, cand.coordinates.longitude]}
                icon={createPfzRankIcon(cand.rank, cand.recommended, isSelected)}
                eventHandlers={{
                  click: () => handleSelectCandidate(cand),
                }}
              >
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <strong style={{ fontSize: 13, color: '#0F172A' }}>
                      {cand.rank === 1
                        ? '🥇 PFZ #1 (Recommended)'
                        : isSelected
                        ? `★ PFZ #${cand.rank} (Selected)`
                        : `PFZ #${cand.rank}`}
                    </strong>
                    <div
                      style={{
                        fontSize: 12,
                        marginTop: 4,
                        color: isSelected || cand.rank === 1 ? '#15803D' : '#0284C7',
                        fontWeight: 800,
                      }}
                    >
                      {cand.distance_km.toFixed(1)} km • {cand.direction}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4, color: '#64748B' }}>
                      {formatCoordinates(cand.coordinates.latitude, cand.coordinates.longitude)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>

      {/* Loading Overlay */}
      {!mapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.oceanBlue} />
          <Text style={styles.loadingText}>Loading Marine Satellite Map...</Text>
        </View>
      )}

      {/* Floating Essential Map Controls: Zoom +, Zoom -, Recenter */}
      <View style={styles.controlsCol} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => mapRef.current?.zoomIn()}
          accessibilityLabel="Zoom In"
        >
          <Plus size={18} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => mapRef.current?.zoomOut()}
          accessibilityLabel="Zoom Out"
        >
          <Minus size={18} color={COLORS.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlBtn}
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
  wrapper: {
    height: 480,
    width: '100%',
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: COLORS.skyBlueBorder,
    ...SHADOWS.md,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    gap: 10,
  },
  loadingText: {
    ...TYPOGRAPHY.bodySmall,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  controlsCol: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 10,
    ...SHADOWS.md,
    overflow: 'hidden',
  },
  controlBtn: {
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
    zIndex: 10,
    ...SHADOWS.md,
  },
  nearestChipText: {
    ...TYPOGRAPHY.caption,
    color: '#15803D',
    fontWeight: '800',
    fontSize: 11,
  },
});

