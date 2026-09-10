import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapPin,
  Compass,
} from 'lucide-react-native';
import { OrcaHeader } from '../../components/OrcaHeader';
import { OrcaMapView } from '../../components/MapView';
import { MapLegend } from '../../components/MapLegend';
import { MapInspectionPanel } from '../../components/MapInspectionPanel';
import { ResponsiveContainer } from '../../components/ResponsiveContainer';
import {
  getCurrentAssessment,
  subscribeToAssessment,
  getSelectedPFZId,
  setSelectedPFZId,
} from '../../services/api';
import { getActiveTrip, subscribeToTrip } from '../../services/tripStore';
import { formatCoordinates } from '../../utils/geo';
import { OrcaResponse, ActiveMapLayers, SelectedMapObject, PFZCandidate } from '../../types/orca';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDistance } from '../../utils/formatting';

export default function MapScreen() {
  const router = useRouter();
  const [activeTrip, setActiveTrip] = useState(getActiveTrip());
  const [data, setData] = useState<OrcaResponse>(getCurrentAssessment());
  const [selectedPFZId, setSelectedPFZIdState] = useState<string | null>(getSelectedPFZId());

  const [activeLayers, setActiveLayers] = useState<ActiveMapLayers>({
    pfz: true,
    fishingLocation: true,
    distance: true,
  });

  useEffect(() => {
    const unsubTrip = subscribeToTrip((trip) => {
      setActiveTrip(trip);
    });
    const unsubAssessment = subscribeToAssessment((updated) => {
      setData(updated);
      setSelectedPFZIdState(getSelectedPFZId());
    });

    return () => {
      unsubTrip();
      unsubAssessment();
    };
  }, []);

  const top3Candidates = useMemo<PFZCandidate[]>(() => {
    let rawCands: PFZCandidate[] = [];
    if (data?.pfz?.top_candidates && data.pfz.top_candidates.length > 0) {
      rawCands = data.pfz.top_candidates;
    } else if (data?.top_pfz && data.top_pfz.length > 0) {
      rawCands = data.top_pfz;
    } else if (data?.pfz?.nearest) {
      const nr = data.pfz.nearest;
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
    return rawCands.slice(0, 3).map((cand, idx) => ({
      ...cand,
      id: cand.id || `pfz-cand-${cand.rank || idx + 1}`,
      rank: cand.rank || idx + 1,
      label: `PFZ #${cand.rank || idx + 1}`,
      recommended: (cand.rank || idx + 1) === 1,
    }));
  }, [data?.pfz?.top_candidates, data?.top_pfz, data?.pfz?.nearest]);

  const selectedCandidate = useMemo<PFZCandidate | null>(() => {
    if (!selectedPFZId) return null;
    return (
      top3Candidates.find(
        (c) => c.id === selectedPFZId || `pfz-${c.rank}` === selectedPFZId || c.rank.toString() === selectedPFZId
      ) || null
    );
  }, [selectedPFZId, top3Candidates]);

  const selectedObject = useMemo<SelectedMapObject | null>(() => {
    if (!selectedCandidate) return null;
    return {
      type: 'pfz',
      title: `PFZ #${selectedCandidate.rank}`,
      subtitle: selectedCandidate.recommended ? 'Recommended PFZ Zone' : `Candidate #${selectedCandidate.rank}`,
      latitude: selectedCandidate.coordinates.latitude,
      longitude: selectedCandidate.coordinates.longitude,
      distanceFromFishermanKm: selectedCandidate.distance_km,
      bearingFromFishermanDegrees: selectedCandidate.bearing_degrees,
      directionFromFisherman: selectedCandidate.direction,
      candidate: selectedCandidate,
      metadata: {
        category: selectedCandidate.category,
        valid_until: selectedCandidate.valid_until,
        recommendation_reason: selectedCandidate.recommendation_reason,
      },
    };
  }, [selectedCandidate]);

  const handleToggleLayer = useCallback((key: keyof ActiveMapLayers) => {
    setActiveLayers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handleSelectCandidate = useCallback((cand: PFZCandidate | null) => {
    if (!cand) {
      setSelectedPFZId(null);
      setSelectedPFZIdState(null);
      return;
    }
    if (selectedPFZId === cand.id || selectedPFZId === `pfz-${cand.rank}`) {
      setSelectedPFZId(null);
      setSelectedPFZIdState(null);
    } else {
      setSelectedPFZId(cand.id);
      setSelectedPFZIdState(cand.id);
    }
  }, [selectedPFZId]);

  const handleSelectMapObject = useCallback((obj: SelectedMapObject | null) => {
    if (!obj || obj.type !== 'pfz') {
      setSelectedPFZId(null);
      setSelectedPFZIdState(null);
    } else if (obj.candidate) {
      handleSelectCandidate(obj.candidate);
    }
  }, [handleSelectCandidate]);

  const handleViewAssessment = useCallback((cand?: PFZCandidate) => {
    const target = cand || selectedCandidate;
    if (target) {
      setSelectedPFZId(target.id);
      router.push({
        pathname: '/assessment',
        params: {
          pfzId: target.id,
          rank: target.rank.toString(),
        },
      });
    } else {
      router.push('/assessment');
    }
  }, [router, selectedCandidate]);

  const nearestPfz = data.pfz && data.pfz.available ? data.pfz.nearest : null;
  const hasLivePFZ = !!(data.pfz?.available || data.pfz?.nearest || (data.pfz?.top_candidates && data.pfz.top_candidates.length > 0));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <OrcaHeader
        title="Interactive Fishing Map"
        subtitle="Selected Spot & INCOIS PFZ Navigation"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContainer>
          {/* Clean Top Info Header: Selected Location, Coordinates, and Nearest PFZ */}
          <View style={styles.topInfoCard}>
            <View style={styles.topRow}>
              <View style={styles.spotInfoLeft}>
                <View style={styles.pinCircle}>
                  <MapPin size={18} color="#0066CC" />
                </View>
                <View style={styles.spotTextCol}>
                  <Text style={styles.spotName} numberOfLines={1}>
                    {activeTrip.location.name}
                  </Text>
                  <Text style={styles.spotCoords}>
                    {formatCoordinates(activeTrip.location.latitude, activeTrip.location.longitude)}
                  </Text>
                </View>
              </View>

              {/* Data Freshness / Live Indicator */}
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            </View>

            {/* Nearest PFZ Summary Line */}
            {nearestPfz && (
              <View style={styles.nearestPfzRow}>
                <Compass size={13} color="#15803D" />
                <Text style={styles.nearestPfzText}>
                  PFZ: {formatDistance(nearestPfz.distance_km)} {nearestPfz.direction || 'W'}
                </Text>
              </View>
            )}
          </View>

          {/* Simple, Clean Satellite Fishing & PFZ Map */}
          <View style={styles.mapWrapper}>
            <OrcaMapView
              response={data}
              activeLayers={activeLayers}
              selectedObject={selectedObject}
              onSelectObject={handleSelectMapObject}
              onViewDetails={handleViewAssessment}
            />
          </View>

          {/* 3 Essential Layer Toggles: PFZ Zones, Fishing Location, Distance & Bearing */}
          <View style={styles.legendWrapper}>
            <MapLegend
              activeLayers={activeLayers}
              onToggleLayer={handleToggleLayer}
              pfzCount={data.pfz?.top_candidates?.length ? Math.min(data.pfz.top_candidates.length, 3) : 3}
            />
          </View>

          {/* Single Compact Information Card: Fishing Location + Top 3 Recommended PFZs */}
          <View style={styles.bottomCardWrapper}>
            <MapInspectionPanel
              selectedObject={selectedObject}
              response={data}
              onSelectCandidate={handleSelectCandidate}
              onViewAssessmentDetails={handleViewAssessment}
            />
          </View>
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
  topInfoCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spotInfoLeft: {
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
  liveBadge: {
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
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#15803D',
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  nearestPfzRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  nearestPfzText: {
    ...TYPOGRAPHY.caption,
    color: '#15803D',
    fontWeight: '800',
    fontSize: 11,
  },
  mapWrapper: {
    marginBottom: SPACING.md,
  },
  legendWrapper: {
    marginBottom: SPACING.md,
  },
  bottomCardWrapper: {
    marginBottom: SPACING.md,
  },
});

