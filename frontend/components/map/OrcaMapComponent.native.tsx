import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MapView, { Callout, Circle, Marker, Polygon, Polyline, Region } from 'react-native-maps';
import { Minus, Navigation, Plus } from 'lucide-react-native';
import { OrcaResponse, PFZNearest } from '../../types/orca';
import { NormalizedPFZFeature, PFZLatLng, calculatePFZBounds, normalizePFZFeatures } from '../../utils/pfzGeometry';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export interface MapViewProps {
  response: OrcaResponse;
  activeLayers?: { pfz: boolean; myLocation: boolean; distance: boolean };
  onSelectPFZ?: (nearest?: PFZNearest) => void;
  onViewDetails?: () => void;
}

function PFZCallout({ properties }: { properties: Record<string, unknown> }) {
  const findValue = (...keys: string[]) => keys.map((key) => properties[key]).find((value) => value !== undefined && value !== null && value !== '');
  const entries = [
    ['Sector', findValue('SECTORNAME', 'sectorname', 'category')],
    ['Year', findValue('Year', 'data_year')],
    ['Julian Day', findValue('Julian_day', 'julian_day')],
    ['Length', findValue('Length', 'length')],
    ['UID', findValue('UID', 'uid')],
  ].filter((entry): entry is [string, unknown] => entry[1] !== undefined);
  return <Callout><Text style={styles.calloutTitle}>PFZ Advisory</Text>{entries.map(([label, value]) => <Text key={label}>{label}: {String(value)}</Text>)}</Callout>;
}

function DirectionArrows({ lines }: { lines: PFZLatLng[][] }) {
  const arrows = lines.flatMap((line, lineIndex) => {
    const step = Math.max(1, Math.ceil((line.length - 1) / 8));
    return line.slice(0, -1).reduce<{ position: PFZLatLng; rotation: number; key: string }[]>((items, point, index) => {
      if (index % step !== 0) return items;
      const next = line[index + 1];
      items.push({ position: [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2], rotation: Math.atan2(next[1] - point[1], next[0] - point[0]) * (180 / Math.PI), key: `native-arrow-${lineIndex}-${index}` });
      return items;
    }, []);
  });
  return <>{arrows.map((arrow) => <Marker key={arrow.key} coordinate={{ latitude: arrow.position[0], longitude: arrow.position[1] }} rotation={arrow.rotation} flat anchor={{ x: 0.5, y: 0.5 }}><Text style={styles.arrow}>➤</Text></Marker>)}</>;
}

function PFZFeatureLayer({ feature }: { feature: NormalizedPFZFeature }) {
  const { geometry, properties } = feature;
  if (geometry.type === 'LineString') {
    const coordinates = geometry.coordinates.map(([latitude, longitude]) => ({ latitude, longitude }));
    return <><Polyline coordinates={coordinates} strokeColor="#10B981" strokeWidth={4} tappable /><Marker coordinate={coordinates[0]}><PFZCallout properties={properties} /></Marker><DirectionArrows lines={[geometry.coordinates]} /></>;
  }
  if (geometry.type === 'MultiLineString') {
    return <>{geometry.coordinates.map((line, index) => { const coordinates = line.map(([latitude, longitude]) => ({ latitude, longitude })); return <React.Fragment key={`${feature.id}-line-${index}`}><Polyline coordinates={coordinates} strokeColor="#10B981" strokeWidth={4} tappable /><Marker coordinate={coordinates[0]}><PFZCallout properties={properties} /></Marker><DirectionArrows lines={[line]} /></React.Fragment>; })}</>;
  }
  if (geometry.type === 'Polygon') {
    const coordinates = geometry.coordinates[0].map(([latitude, longitude]) => ({ latitude, longitude }));
    return <><Polygon coordinates={coordinates} strokeColor="#10B981" fillColor="rgba(16,185,129,0.2)" strokeWidth={3} tappable /><Marker coordinate={coordinates[0]}><PFZCallout properties={properties} /></Marker></>;
  }
  if (geometry.type === 'MultiPolygon') {
    return <>{geometry.coordinates.map((polygon, index) => { const coordinates = polygon[0].map(([latitude, longitude]) => ({ latitude, longitude })); return <React.Fragment key={`${feature.id}-polygon-${index}`}><Polygon coordinates={coordinates} strokeColor="#10B981" fillColor="rgba(16,185,129,0.2)" strokeWidth={3} tappable /><Marker coordinate={coordinates[0]}><PFZCallout properties={properties} /></Marker></React.Fragment>; })}</>;
  }
  if (geometry.type === 'Point') return <Marker coordinate={{ latitude: geometry.coordinates[0], longitude: geometry.coordinates[1] }}><PFZCallout properties={properties} /></Marker>;
  return <>{geometry.coordinates.map((point, index) => <Marker key={`${feature.id}-point-${index}`} coordinate={{ latitude: point[0], longitude: point[1] }}><PFZCallout properties={properties} /></Marker>)}</>;
}

function featureCoordinates(features: NormalizedPFZFeature[]): PFZLatLng[] {
  const positions: PFZLatLng[] = [];
  features.forEach(({ geometry }) => {
    const collect = (value: unknown): void => {
      if (Array.isArray(value) && typeof value[0] === 'number') positions.push(value as PFZLatLng);
      else if (Array.isArray(value)) value.forEach(collect);
    };
    collect(geometry.coordinates);
  });
  return positions;
}

export const OrcaMapComponent: React.FC<MapViewProps> = ({ response, activeLayers = { pfz: true, myLocation: true, distance: true }, onSelectPFZ }) => {
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const fisherLat = response.request?.latitude ?? 0;
  const fisherLon = response.request?.longitude ?? 0;
  const hasLivePFZ = response.pfz.metadata !== undefined;
  const features = useMemo(() => hasLivePFZ ? normalizePFZFeatures(response.pfz.geometry, response.pfz.metadata) : [], [hasLivePFZ, response.pfz.geometry, response.pfz.metadata]);
  const bounds = useMemo(() => calculatePFZBounds(features), [features]);
  const center: Region = { latitude: fisherLat, longitude: fisherLon, latitudeDelta: 4, longitudeDelta: 4 };

  useEffect(() => {
    const coordinates = featureCoordinates(features);
    if (mapRef.current && coordinates.length) mapRef.current.fitToCoordinates(coordinates.map(([latitude, longitude]) => ({ latitude, longitude })), { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true });
  }, [features, bounds]);

  const recenter = () => {
    const coordinates = featureCoordinates(features);
    if (mapRef.current && coordinates.length) mapRef.current.fitToCoordinates(coordinates.map(([latitude, longitude]) => ({ latitude, longitude })), { edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true });
    else mapRef.current?.animateToRegion(center, 600);
  };

  return <View style={styles.container}>
    <MapView ref={mapRef} style={styles.fullMap} mapType="satellite" initialRegion={center} onMapReady={() => setMapReady(true)}>
      {activeLayers.pfz && features.map((feature) => <PFZFeatureLayer key={feature.id} feature={feature} />)}
      {activeLayers.myLocation && <Circle center={{ latitude: fisherLat, longitude: fisherLon }} radius={500} strokeColor="#38BDF8" fillColor="rgba(10,37,64,0.7)" />}
      {activeLayers.myLocation && <Marker coordinate={{ latitude: fisherLat, longitude: fisherLon }} title="Fishing Location" />}
      {activeLayers.pfz && response.pfz.nearest && <Marker coordinate={{ latitude: response.pfz.nearest.latitude, longitude: response.pfz.nearest.longitude }} title="Nearest PFZ" onPress={() => onSelectPFZ?.(response.pfz.nearest)} />}
    </MapView>
    {!mapReady && <View style={styles.loadingOverlay}><Text style={styles.loadingText}>Loading map...</Text></View>}
    {mapReady && !features.length && <View style={styles.emptyOverlay}><Text style={styles.emptyText}>{response.pfz.message ? 'Unable to load PFZ data' : hasLivePFZ ? 'No PFZ data available' : 'Loading PFZ data...'}</Text></View>}
    <View style={styles.controlsCol}>
      <TouchableOpacity style={styles.controlBtn} onPress={() => mapRef.current?.getCamera().then((camera) => mapRef.current?.animateCamera({ ...camera, zoom: (camera.zoom || 9) + 1 }))} accessibilityLabel="Zoom In"><Plus size={20} color={COLORS.textPrimary} /></TouchableOpacity>
      <TouchableOpacity style={styles.controlBtn} onPress={() => mapRef.current?.getCamera().then((camera) => mapRef.current?.animateCamera({ ...camera, zoom: Math.max((camera.zoom || 9) - 1, 1) }))} accessibilityLabel="Zoom Out"><Minus size={20} color={COLORS.textPrimary} /></TouchableOpacity>
      <TouchableOpacity style={styles.controlBtn} onPress={recenter} accessibilityLabel="Recenter Map"><Navigation size={18} color={COLORS.oceanBlue} /></TouchableOpacity>
    </View>
  </View>;
};

const styles = StyleSheet.create({
  container: { height: 480, width: '100%', borderRadius: RADIUS.xl, overflow: 'hidden', position: 'relative', backgroundColor: '#0F172A', borderWidth: 1.5, borderColor: COLORS.skyBlueBorder, ...SHADOWS.md },
  fullMap: { flex: 1 },
  arrow: { color: '#FDE047', fontSize: 22, textShadowColor: '#064E3B', textShadowRadius: 3 },
  calloutTitle: { fontWeight: '700', marginBottom: 4 },
  loadingOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  loadingText: { ...TYPOGRAPHY.bodySmall, color: '#F8FAFC', fontWeight: '700' },
  emptyOverlay: { position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(15, 23, 42, 0.86)', padding: SPACING.sm, borderRadius: RADIUS.md, zIndex: 5 },
  emptyText: { ...TYPOGRAPHY.caption, color: '#F8FAFC', fontWeight: '700' },
  controlsCol: { position: 'absolute', top: 14, left: 14, backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, zIndex: 10, ...SHADOWS.md },
  controlBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
});