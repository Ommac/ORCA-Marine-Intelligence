import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Compass, Navigation, ArrowUpRight, Radio } from 'lucide-react-native';
import { OrcaHeader } from '../../components/OrcaHeader';
import { OrcaMapView } from '../../components/MapView';
import { MapLegend, ActiveMapLayers } from '../../components/MapLegend';
import { PFZCard } from '../../components/PFZCard';
import { PFZTopCards } from '../../components/PFZTopCards';
import { ResponsiveContainer } from '../../components/ResponsiveContainer';
import {
  getCurrentAssessment,
  subscribeToAssessment,
  getSelectedPFZ,
  setSelectedPFZId,
  getSelectedPFZId,
  subscribeToSelectedPFZ,
} from '../../services/api';
import { setMapFocus } from '../../services/mapFocusStore';
import { getActiveTrip, subscribeToTrip } from '../../services/tripStore';
import { OrcaResponse, PFZCandidate } from '../../types/orca';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDistanceKm } from '../../utils/formatting';

export default function MapScreen() {
  const router = useRouter();
  const [activeTrip, setActiveTrip] = useState(getActiveTrip());
  const [data, setData] = useState<OrcaResponse>(getCurrentAssessment());
  const [selectedPFZId, setSelectedPFZIdState] = useState<string | null>(getSelectedPFZId());
  const [activeLayers, setActiveLayers] = useState<ActiveMapLayers>({
    pfz: true,
    myLocation: true,
    distance: true,
  });

  useEffect(() => {
    const unsubTrip = subscribeToTrip((trip) => {
      setActiveTrip(trip);
    });
    const unsubAssessment = subscribeToAssessment((updated) => {
      setData(updated);
    });
    const unsubPFZ = subscribeToSelectedPFZ((id) => {
      setSelectedPFZIdState(id);
    });
    return () => {
      unsubTrip();
      unsubAssessment();
      unsubPFZ();
    };
  }, []);

  const handleToggleLayer = (key: keyof ActiveMapLayers) => {
    setActiveLayers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const topCandidates = (data.pfz?.top_candidates || data.top_pfz || []) as PFZCandidate[];
  const selectedPFZ = getSelectedPFZ(data, selectedPFZId);

  const handleSelectCandidate = (cand: PFZCandidate) => {
    setSelectedPFZId(cand.id);
    setSelectedPFZIdState(cand.id);
    setMapFocus({
      coordinates: cand.coordinates,
      rank: cand.rank,
      label: cand.label || `PFZ #${cand.rank}`,
      geometry: cand.geometry,
      zoom: 12,
      top_candidates: topCandidates,
    });
  };

  const handleViewAssessment = (targetPFZ?: PFZCandidate | null) => {
    const cand = targetPFZ !== undefined ? targetPFZ : selectedPFZ;
    if (cand) {
      setSelectedPFZId(cand.id);
      router.push({
        pathname: '/assessment',
        params: {
          pfzId: cand.id,
          rank: String(cand.rank),
        },
      });
    } else {
      router.push('/assessment');
    }
  };

  const hasPfz = Boolean(selectedPFZ || (data.pfz && data.pfz.available && data.pfz.nearest));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <OrcaHeader
        title="Interactive Fishing Map"
        subtitle="ArcGIS Topo Basemap & INCOIS PFZ Geometry"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContainer>
          {/* Active Spot Header Chip */}
        <View style={styles.tripSpotBanner}>
          <View style={styles.spotLeft}>
            <View style={styles.pinCircle}>
              <MapPin size={18} color={COLORS.oceanBlue} />
            </View>
            <View style={styles.spotTextCol}>
              <Text style={styles.spotName}>{activeTrip.location.name}</Text>
              <Text style={styles.spotCoords}>
                {activeTrip.location.latitude.toFixed(2)}°N, {activeTrip.location.longitude.toFixed(2)}°E
              </Text>
            </View>
          </View>

          {selectedPFZ ? (
            <View style={styles.pfzBadge}>
              <Compass size={14} color="#15803D" />
              <Text style={styles.pfzBadgeText}>
                PFZ #{selectedPFZ.rank}: {formatDistanceKm(selectedPFZ.distance_km)} ({selectedPFZ.direction || 'W'})
              </Text>
            </View>
          ) : hasPfz ? (
            <View style={styles.pfzBadge}>
              <Compass size={14} color="#15803D" />
              <Text style={styles.pfzBadgeText}>
                PFZ: {formatDistanceKm(data.pfz.nearest?.distance_km)} ({data.pfz.nearest?.direction || 'W'})
              </Text>
            </View>
          ) : (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveIndicatorText}>Live GIS</Text>
            </View>
          )}
        </View>

        {/* Real Interactive Map with Dynamic ArcGIS World Street Map Tiles */}
        <OrcaMapView
          response={data}
          activeLayers={activeLayers}
          selectedPFZId={selectedPFZ?.id}
          onSelectCandidate={handleSelectCandidate}
          onViewDetails={() => handleViewAssessment(selectedPFZ)}
        />

        {/* SAMUDRA-style Layer Toggles & Legend */}
        <View style={styles.legendWrapper}>
          <MapLegend
            activeLayers={activeLayers}
            onToggleLayer={handleToggleLayer}
          />
        </View>

        {/* Top PFZ Candidate Selection Cards if available */}
        {topCandidates.length > 0 && (
          <View style={styles.candidatesWrapper}>
            <PFZTopCards
              candidates={topCandidates}
              selectedId={selectedPFZ?.id}
              selectedRank={selectedPFZ?.rank || 1}
              onSelect={handleSelectCandidate}
              onViewAssessment={(cand) => handleViewAssessment(cand)}
            />
          </View>
        )}

        {/* Selected / Nearest PFZ Summary Card with Action */}
        <PFZCard
          pfz={data.pfz}
          candidate={selectedPFZ}
          onViewOnMap={() => handleViewAssessment(selectedPFZ)}
        />
        </ResponsiveContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 48,
  },
  tripSpotBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  spotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotTextCol: {
    flex: 1,
  },
  spotName: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  spotCoords: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  pfzBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  pfzBadgeText: {
    ...TYPOGRAPHY.caption,
    color: '#15803D',
    fontWeight: '800',
    fontSize: 11,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.oceanBlue,
  },
  liveIndicatorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  legendWrapper: {
    marginTop: SPACING.md,
  },
  candidatesWrapper: {
    marginTop: SPACING.md,
  },
});
