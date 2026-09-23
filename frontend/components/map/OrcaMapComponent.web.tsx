import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Minus, Navigation, Plus } from 'lucide-react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import { OrcaResponse, PFZNearest, PFZCandidate, GeofenceFeature, GeofenceCollection } from '../../types/orca';
import { computeBoundingBox, createDistanceLine } from '../../utils/mapAdapters';
import {
  calculatePFZBounds,
  NormalizedPFZFeature,
  PFZLatLng,
  normalizePFZFeatures,
} from '../../utils/pfzGeometry';
import { ARCGIS_SATELLITE_ATTRIBUTION, ARCGIS_SATELLITE_TILE_URL } from '../../constants/map';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { subscribeToMapFocus, MapFocusTarget } from '../../services/mapFocusStore';
import { getGeofences } from '../../services/api';

export interface MapViewProps {
  response: OrcaResponse;
  activeLayers?: { pfz?: boolean; myLocation?: boolean; distance?: boolean; geofences?: boolean; route?: boolean };
  selectedPFZId?: string | null;
  optimizedRoute?: [number, number][];
  onSelectPFZ?: (nearest?: PFZNearest) => void;
  onSelectCandidate?: (candidate: PFZCandidate) => void;
  onViewDetails?: () => void;
}



const arrowIcon = (rotation: number) => L.divIcon({
  className: 'orca-pfz-direction-arrow',
  html: `<span style="display:block;transform:rotate(${rotation}deg);color:#FDE047;font-size:22px;line-height:18px;text-shadow:0 1px 3px #064E3B">&#10132;</span>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function DirectionArrows({ lines }: { lines: PFZLatLng[][] }) {
  const arrows = useMemo(() => lines.flatMap((line, lineIndex) => {
    const step = Math.max(1, Math.ceil((line.length - 1) / 8));
    return line.slice(0, -1).reduce<{ position: PFZLatLng; rotation: number; key: string }[]>((items, point, index) => {
      if (index % step !== 0) return items;
      const next = line[index + 1];
      items.push({
        position: [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2],
        rotation: Math.atan2(next[1] - point[1], next[0] - point[0]) * (180 / Math.PI),
        key: `arrow-${lineIndex}-${index}`,
      });
      return items;
    }, []);
  }), [lines]);

  return <>{arrows.map((arrow) => <Marker key={arrow.key} position={arrow.position} icon={arrowIcon(arrow.rotation)} />)}</>;
}

function PFZPopup({ properties }: { properties: Record<string, unknown> }) {
  const findValue = (...keys: string[]) => keys.map((key) => properties[key]).find((value) => value !== undefined && value !== null && value !== '');
  const entries = [
    ['Sector', findValue('SECTORNAME', 'sectorname', 'category')],
    ['Year', findValue('Year', 'data_year')],
    ['Julian Day', findValue('Julian_day', 'julian_day')],
    ['Length', findValue('Length', 'length')],
    ['UID', findValue('UID', 'uid')],
  ].filter((entry): entry is [string, unknown] => entry[1] !== undefined);
  if (!entries.length) return null;
  return <Popup><strong>PFZ Advisory</strong>{entries.map(([label, value]) => <div key={label}>{label}: {String(value)}</div>)}</Popup>;
}

function PFZFeatureLayer({ feature }: { feature: NormalizedPFZFeature }) {
  const { geometry, properties } = feature;
  if (geometry.type === 'LineString') {
    return <><Polyline positions={geometry.coordinates} pathOptions={{ color: '#10B981', weight: 4, opacity: 0.9 }}><PFZPopup properties={properties} /></Polyline><DirectionArrows lines={[geometry.coordinates]} /></>;
  }
  if (geometry.type === 'MultiLineString') {
    return <>{geometry.coordinates.map((line, index) => <React.Fragment key={`${feature.id}-line-${index}`}><Polyline positions={line} pathOptions={{ color: '#10B981', weight: 4, opacity: 0.9 }}><PFZPopup properties={properties} /></Polyline><DirectionArrows lines={[line]} /></React.Fragment>)}</>;
  }
  if (geometry.type === 'Polygon') {
    return <Polygon positions={geometry.coordinates} pathOptions={{ color: '#10B981', weight: 3, fillColor: '#10B981', fillOpacity: 0.2 }}><PFZPopup properties={properties} /></Polygon>;
  }
  if (geometry.type === 'MultiPolygon') {
    return <>{geometry.coordinates.map((polygon, index) => <Polygon key={`${feature.id}-polygon-${index}`} positions={polygon} pathOptions={{ color: '#10B981', weight: 3, fillColor: '#10B981', fillOpacity: 0.2 }}><PFZPopup properties={properties} /></Polygon>)}</>;
  }
  if (geometry.type === 'Point') {
    return <CircleMarker center={geometry.coordinates} radius={7} pathOptions={{ color: '#FDE047', fillColor: '#10B981', fillOpacity: 1 }}><PFZPopup properties={properties} /></CircleMarker>;
  }
  return <>{geometry.coordinates.map((point, index) => <CircleMarker key={`${feature.id}-point-${index}`} center={point} radius={6} pathOptions={{ color: '#FDE047', fillColor: '#10B981', fillOpacity: 1 }}><PFZPopup properties={properties} /></CircleMarker>)}</>;
}

function getGeofenceStyle(category: string) {
  switch (category) {
    case 'eez':
      return {
        color: '#EF4444',
        fillColor: '#EF4444',
        fillOpacity: 0.08,
        weight: 2,
        dashArray: '6 6',
      };
    case 'restricted_waters':
      return {
        color: '#F97316',
        fillColor: '#F97316',
        fillOpacity: 0.25,
        weight: 2.5,
      };
    case 'mpa':
      return {
        color: '#10B981',
        fillColor: '#10B981',
        fillOpacity: 0.25,
        weight: 2.5,
      };
    case 'ecologically_sensitive':
      return {
        color: '#8B5CF6',
        fillColor: '#8B5CF6',
        fillOpacity: 0.25,
        weight: 2.5,
      };
    default:
      return {
        color: '#94A3B8',
        fillColor: '#94A3B8',
        fillOpacity: 0.2,
        weight: 2,
      };
  }
}

function GeofencePopup({ feature }: { feature: GeofenceFeature }) {
  const props = feature.properties || ({} as any);
  const style = getGeofenceStyle(props.category);
  return (
    <Popup>
      <div style={{ minWidth: 200, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 6 }}>
          <strong style={{ fontSize: 13, color: '#0F172A' }}>{props.name}</strong>
          <span style={{ fontSize: 9, fontWeight: 800, color: '#EF4444', backgroundColor: '#FEE2E2', padding: '2px 5px', borderRadius: 4 }}>
            DUMMY TEST DATA
          </span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: style.color, marginBottom: 4 }}>
          {props.category_label || props.category} ({props.restriction_level})
        </div>
        {props.description ? (
          <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.3 }}>
            {props.description}
          </div>
        ) : null}
      </div>
    </Popup>
  );
}

function GeofenceFeatureLayer({ feature }: { feature: GeofenceFeature }) {
  const { geometry, properties } = feature;
  const style = getGeofenceStyle(properties?.category || '');

  if (geometry?.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    const latLngs: PFZLatLng[] = geometry.coordinates[0].map(([lon, lat]: [number, number]) => [lat, lon] as PFZLatLng);
    return (
      <Polygon positions={latLngs} pathOptions={style}>
        <GeofencePopup feature={feature} />
      </Polygon>
    );
  }

  if (geometry?.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
    return (
      <>
        {geometry.coordinates.map((poly: any, idx: number) => {
          const latLngs: PFZLatLng[] = poly[0].map(([lon, lat]: [number, number]) => [lat, lon] as PFZLatLng);
          return (
            <Polygon key={`${feature.id || 'gf'}-${idx}`} positions={latLngs} pathOptions={style}>
              <GeofencePopup feature={feature} />
            </Polygon>
          );
        })}
      </>
    );
  }

  return null;
}

function MapCamera({

  bounds,
  fallback,
  focusTarget,
  onReady,
}: {
  bounds: [PFZLatLng, PFZLatLng] | null;
  fallback: PFZLatLng;
  focusTarget: MapFocusTarget | null;
  onReady: (map: any) => void;
}) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);

  useEffect(() => {
    if (focusTarget && focusTarget.coordinates) {
      map.setView([focusTarget.coordinates.latitude, focusTarget.coordinates.longitude], focusTarget.zoom || 11, { animate: true });
    } else if (bounds) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13, animate: true });
    } else {
      map.setView(fallback, 9);
    }
  }, [bounds, fallback, focusTarget, map]);

  return null;
}

export const OrcaMapComponent: React.FC<MapViewProps> = ({
  response,
  activeLayers = { pfz: true, myLocation: true, distance: true },
  selectedPFZId,
  optimizedRoute,
  onSelectCandidate,
  onViewDetails,
}) => {
  const mapRef = useRef<any>(null);


  const [mapReady, setMapReady] = useState(false);
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);
  const [geofences, setGeofences] = useState<GeofenceFeature[]>([]);

  useEffect(() => {
    let isMounted = true;
    getGeofences()
      .then((collection) => {
        if (isMounted && collection?.features) {
          setGeofences(collection.features);
        }
      })
      .catch((err) => {
        console.warn('Failed to load geofences in map:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const fisherLat = response.request?.latitude ?? 0;
  const fisherLon = response.request?.longitude ?? 0;
  const nearest = response.pfz.nearest;
  const fallback: PFZLatLng = [fisherLat, fisherLon];


  const topCandidates: PFZCandidate[] = useMemo(
    () => (response.pfz.top_candidates || response.top_pfz || focusTarget?.top_candidates || []) as PFZCandidate[],
    [response.pfz.top_candidates, response.top_pfz, focusTarget?.top_candidates]
  );

  const activeSelectedCandidate = useMemo(() => {
    if (topCandidates.length > 0) {
      if (selectedPFZId) {
        const found = topCandidates.find((c) => c.id === selectedPFZId);
        if (found) return found;
      }
      if (focusTarget?.rank) {
        const foundRank = topCandidates.find((c) => c.rank === focusTarget.rank);
        if (foundRank) return foundRank;
      }
      return topCandidates.find((c) => c.recommended) || topCandidates[0];
    }
    return null;
  }, [topCandidates, selectedPFZId, focusTarget]);

  const activePFZGeometry = useMemo(() => {
    return (
      activeSelectedCandidate?.geometry ||
      focusTarget?.geometry ||
      response.pfz.geometry
    );
  }, [activeSelectedCandidate?.geometry, focusTarget?.geometry, response.pfz.geometry]);

  const activePFZMetadata = useMemo(() => {
    const base = response.pfz.metadata || {};
    if (activeSelectedCandidate) {
      return {
        ...base,
        category: activeSelectedCandidate.category || base.category,
        uid: activeSelectedCandidate.uid || base.uid,
        sno: activeSelectedCandidate.sno || base.sno,
        data_year: activeSelectedCandidate.data_year || base.data_year,
        julian_day: activeSelectedCandidate.julian_day || base.julian_day,
        valid_until: activeSelectedCandidate.valid_until || base.valid_until,
        rank: activeSelectedCandidate.rank,
        label: activeSelectedCandidate.label,
        distance_km: activeSelectedCandidate.distance_km,
        direction: activeSelectedCandidate.direction,
      };
    }
    return base;
  }, [activeSelectedCandidate, response.pfz.metadata]);

  const hasLivePFZ = Boolean(activePFZGeometry || response.pfz.metadata !== undefined);
  const features = useMemo(
    () => (activePFZGeometry ? normalizePFZFeatures(activePFZGeometry, activePFZMetadata) : []),
    [activePFZGeometry, activePFZMetadata]
  );
  const bounds = useMemo(() => calculatePFZBounds(features), [features]);

  const routeBounds = useMemo(() => {
    if (!optimizedRoute || optimizedRoute.length < 2) return null;
    const lats = optimizedRoute.map((p) => p[0]);
    const lons = optimizedRoute.map((p) => p[1]);
    return [
      [Math.min(...lats), Math.min(...lons)],
      [Math.max(...lats), Math.max(...lons)],
    ] as [PFZLatLng, PFZLatLng];
  }, [optimizedRoute]);


  const targetPointForRoute = useMemo(() => {
    if (activeSelectedCandidate) {
      return {
        latitude: activeSelectedCandidate.coordinates.latitude,
        longitude: activeSelectedCandidate.coordinates.longitude,
        distance_km: activeSelectedCandidate.distance_km,
        direction: activeSelectedCandidate.direction,
      };
    }
    return nearest;
  }, [activeSelectedCandidate, nearest]);

  const distanceLine = useMemo(
    () => createDistanceLine(fisherLat, fisherLon, targetPointForRoute),
    [fisherLat, fisherLon, targetPointForRoute]
  );

  useEffect(() => {
    const unsub = subscribeToMapFocus((target) => {
      setFocusTarget(target);
      if (target && target.coordinates && mapRef.current) {
        mapRef.current.setView(
          [target.coordinates.latitude, target.coordinates.longitude],
          target.zoom || 11,
          { animate: true }
        );
      }
    });
    return () => unsub();
  }, []);

  const handleRecenter = () => {
    if (!mapRef.current) return;
    if (activeSelectedCandidate) {
      mapRef.current.setView(
        [activeSelectedCandidate.coordinates.latitude, activeSelectedCandidate.coordinates.longitude],
        focusTarget?.zoom || 11,
        { animate: true }
      );
      return;
    }
    if (focusTarget && focusTarget.coordinates) {
      mapRef.current.setView([focusTarget.coordinates.latitude, focusTarget.coordinates.longitude], focusTarget.zoom || 11, { animate: true });
      return;
    }
    if (bounds) {
      mapRef.current.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 });
      return;
    }
    const bbox = computeBoundingBox(fisherLat, fisherLon, nearest, response.pfz);
    mapRef.current.fitBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]], { padding: [36, 36], maxZoom: 13 });
  };

  return (
    <View style={styles.wrapper}>
      <MapContainer center={fallback} zoom={9} style={styles.map}>
        <TileLayer url={ARCGIS_SATELLITE_TILE_URL} attribution={ARCGIS_SATELLITE_ATTRIBUTION} />
        <MapCamera
          bounds={routeBounds || bounds}
          fallback={fallback}
          focusTarget={focusTarget}
          onReady={(map) => { mapRef.current = map; setMapReady(true); }}
        />
        {/* Dummy Geofencing Overlays (Phase 1) */}
        {(activeLayers.geofences ?? true) && geofences.map((gf) => (
          <GeofenceFeatureLayer key={gf.id || `geofence-${gf.properties?.id || Math.random()}`} feature={gf} />
        ))}

        {activeLayers.pfz && features.map((feature) => (
          <PFZFeatureLayer key={`${activeSelectedCandidate?.id || 'pfz'}-${feature.id}`} feature={feature} />
        ))}
        {activeLayers.myLocation && <CircleMarker center={fallback} radius={8} pathOptions={{ color: '#38BDF8', fillColor: '#0A2540', fillOpacity: 1 }}><Popup><strong>Fishing Location</strong></Popup></CircleMarker>}
        {activeLayers.distance && distanceLine && <Polyline positions={distanceLine.features[0].geometry.coordinates.map(([longitude, latitude]: [number, number]) => [latitude, longitude] as PFZLatLng)} pathOptions={{ color: '#38BDF8', weight: 3, dashArray: '8 8' }} />}

        {/* Phase 3 Optimized A* Route Overlay & Markers */}
        {(activeLayers.route ?? true) && optimizedRoute && optimizedRoute.length >= 2 && (
          <>
            <Polyline
              positions={optimizedRoute as PFZLatLng[]}
              pathOptions={{ color: '#F59E0B', weight: 4.5, opacity: 0.95 }}
            >
              <Popup>
                <div style={{ fontFamily: 'sans-serif' }}>
                  <strong>⚡ A* Optimized Safe Route</strong>
                  <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 'bold', marginTop: 2 }}>
                    Hard Geofence Avoidance Active
                  </div>
                </div>
              </Popup>
            </Polyline>
            <CircleMarker
              center={optimizedRoute[0]}
              radius={8}
              pathOptions={{ color: '#10B981', fillColor: '#064E3B', fillOpacity: 1, weight: 3 }}
            >
              <Popup>
                <strong>📍 Route Start</strong>
                <div>Lat: {optimizedRoute[0][0].toFixed(4)}°, Lon: {optimizedRoute[0][1].toFixed(4)}°</div>
              </Popup>
            </CircleMarker>
            <CircleMarker
              center={optimizedRoute[optimizedRoute.length - 1]}
              radius={8}
              pathOptions={{ color: '#EF4444', fillColor: '#991B1B', fillOpacity: 1, weight: 3 }}
            >
              <Popup>
                <strong>🎯 Route Destination</strong>
                <div>Lat: {optimizedRoute[optimizedRoute.length - 1][0].toFixed(4)}°, Lon: {optimizedRoute[optimizedRoute.length - 1][1].toFixed(4)}°</div>
              </Popup>
            </CircleMarker>
          </>
        )}




        {/* Multi-Candidate Top PFZ Markers */}
        {topCandidates.map((cand: PFZCandidate) => {
          const isSelected = activeSelectedCandidate ? cand.id === activeSelectedCandidate.id : cand.rank === 1;
          const markerColor = isSelected ? '#FACC15' : cand.rank === 1 ? '#10B981' : '#0284C7';
          const fillColor = isSelected ? '#0284C7' : cand.rank === 1 ? '#064E3B' : '#0369A1';
          const radius = isSelected ? 13 : 9;

          return (
            <CircleMarker
              key={cand.id || `map-cand-${cand.rank}`}
              center={[cand.coordinates.latitude, cand.coordinates.longitude]}
              radius={radius}
              eventHandlers={{
                click: () => onSelectCandidate?.(cand),
              }}
              pathOptions={{
                color: markerColor,
                fillColor: fillColor,
                fillOpacity: 0.95,
                weight: isSelected ? 3.5 : 2,
              }}
            >
              <Popup>
                <div style={{ minWidth: 170 }}>
                  <strong>{isSelected ? '🎯 Active Target: ' : ''}{cand.label || `PFZ #${cand.rank}`}</strong>
                  <div style={{ fontSize: 12, marginTop: 4, color: isSelected ? '#0284C7' : cand.rank === 1 ? '#15803D' : '#0369A1', fontWeight: 700 }}>
                    {cand.recommended ? '🥇 Recommended' : `Rank #${cand.rank}`} • {cand.distance_km.toFixed(1)} km ({cand.direction})
                  </div>
                  {cand.recommendation_reason && (
                    <div style={{ fontSize: 11, marginTop: 4, color: '#475569' }}>
                      {cand.recommendation_reason}
                    </div>
                  )}
                  <div style={{ fontSize: 10, marginTop: 4, color: '#94A3B8' }}>
                    Lat: {cand.coordinates.latitude.toFixed(4)}°, Lon: {cand.coordinates.longitude.toFixed(4)}°
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                    {!isSelected && (
                      <button
                        onClick={() => onSelectCandidate?.(cand)}
                        style={{
                          flex: 1,
                          padding: '4px 8px',
                          backgroundColor: '#0284C7',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        Select PFZ #{cand.rank}
                      </button>
                    )}
                    {onViewDetails && (
                      <button
                        onClick={() => onViewDetails()}
                        style={{
                          flex: 1,
                          padding: '4px 8px',
                          backgroundColor: '#0F172A',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        View Assessment
                      </button>
                    )}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Focused Target Single Marker Fallback if topCands is empty */}
        {focusTarget && focusTarget.coordinates && (!response.pfz.top_candidates || response.pfz.top_candidates.length === 0) && (
          <CircleMarker
            center={[focusTarget.coordinates.latitude, focusTarget.coordinates.longitude]}
            radius={11}
            pathOptions={{ color: '#FACC15', fillColor: '#0284C7', fillOpacity: 0.9, weight: 3 }}
          >
            <Popup>
              <strong>🎯 {focusTarget.label || 'Target PFZ Zone'}</strong>
              <div>Lat: {focusTarget.coordinates.latitude.toFixed(4)}</div>
              <div>Lon: {focusTarget.coordinates.longitude.toFixed(4)}</div>
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>
      {!mapReady && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color={COLORS.oceanBlue} /><Text style={styles.loadingText}>Loading map...</Text></View>}
      {mapReady && !features.length && <View style={styles.emptyOverlay}><Text style={styles.emptyText}>{response.pfz.message ? 'Unable to load PFZ data' : hasLivePFZ ? 'No PFZ data available' : 'Loading PFZ data...'}</Text></View>}
      <View style={styles.controlsCol}>
        <TouchableOpacity style={styles.controlBtn} onPress={() => mapRef.current?.zoomIn()} accessibilityLabel="Zoom In"><Plus size={20} color={COLORS.textPrimary} /></TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={() => mapRef.current?.zoomOut()} accessibilityLabel="Zoom Out"><Minus size={20} color={COLORS.textPrimary} /></TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={handleRecenter} accessibilityLabel="Recenter Map"><Navigation size={18} color={COLORS.oceanBlue} /></TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { height: 480, width: '100%', borderRadius: RADIUS.xl, overflow: 'hidden', position: 'relative', backgroundColor: '#0F172A', borderWidth: 1.5, borderColor: COLORS.skyBlueBorder, ...SHADOWS.md },
  map: { width: '100%', height: '100%' },
  loadingOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 20, gap: 10 },
  loadingText: { ...TYPOGRAPHY.bodySmall, color: '#F8FAFC', fontWeight: '700' },
  emptyOverlay: { position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(15, 23, 42, 0.86)', padding: SPACING.sm, borderRadius: RADIUS.md, zIndex: 5 },
  emptyText: { ...TYPOGRAPHY.caption, color: '#F8FAFC', fontWeight: '700' },
  controlsCol: { position: 'absolute', top: 14, left: 14, backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, zIndex: 10, ...SHADOWS.md },
  controlBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
});