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
import { OrcaResponse, PFZNearest } from '../../types/orca';
import { computeBoundingBox, createDistanceLine } from '../../utils/mapAdapters';
import {
  calculatePFZBounds,
  NormalizedPFZFeature,
  PFZLatLng,
  normalizePFZFeatures,
} from '../../utils/pfzGeometry';
import { ARCGIS_SATELLITE_ATTRIBUTION, ARCGIS_SATELLITE_TILE_URL } from '../../constants/map';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export interface MapViewProps {
  response: OrcaResponse;
  activeLayers?: { pfz: boolean; myLocation: boolean; distance: boolean };
  onSelectPFZ?: (nearest?: PFZNearest) => void;
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

function MapCamera({ bounds, fallback, onReady }: { bounds: [PFZLatLng, PFZLatLng] | null; fallback: PFZLatLng; onReady: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13, animate: true });
    else map.setView(fallback, 9);
  }, [bounds, fallback, map]);
  return null;
}

export const OrcaMapComponent: React.FC<MapViewProps> = ({ response, activeLayers = { pfz: true, myLocation: true, distance: true } }) => {
  const mapRef = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const fisherLat = response.request?.latitude ?? 0;
  const fisherLon = response.request?.longitude ?? 0;
  const nearest = response.pfz.nearest;
  const fallback: PFZLatLng = [fisherLat, fisherLon];
  const hasLivePFZ = response.pfz.metadata !== undefined;
  const features = useMemo(() => hasLivePFZ ? normalizePFZFeatures(response.pfz.geometry, response.pfz.metadata) : [], [hasLivePFZ, response.pfz.geometry, response.pfz.metadata]);
  const bounds = useMemo(() => calculatePFZBounds(features), [features]);
  const distanceLine = useMemo(() => createDistanceLine(fisherLat, fisherLon, nearest), [fisherLat, fisherLon, nearest]);

  const handleRecenter = () => {
    if (!mapRef.current) return;
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
        <MapCamera bounds={bounds} fallback={fallback} onReady={(map) => { mapRef.current = map; setMapReady(true); }} />
        {activeLayers.pfz && features.map((feature) => <PFZFeatureLayer key={feature.id} feature={feature} />)}
        {activeLayers.myLocation && <CircleMarker center={fallback} radius={8} pathOptions={{ color: '#38BDF8', fillColor: '#0A2540', fillOpacity: 1 }}><Popup><strong>Fishing Location</strong></Popup></CircleMarker>}
        {activeLayers.distance && distanceLine && <Polyline positions={distanceLine.features[0].geometry.coordinates.map(([longitude, latitude]: [number, number]) => [latitude, longitude] as PFZLatLng)} pathOptions={{ color: '#38BDF8', weight: 3, dashArray: '8 8' }} />}
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