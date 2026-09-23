import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Compass, Navigation, ArrowUpRight, Radio, Zap, ShieldCheck, AlertCircle, RefreshCw, X } from 'lucide-react-native';
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
  optimizeRoute,
} from '../../services/api';
import { setMapFocus } from '../../services/mapFocusStore';
import { getActiveTrip, subscribeToTrip } from '../../services/tripStore';
import { OrcaResponse, PFZCandidate, RouteOptimizeResult } from '../../types/orca';
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
    geofences: true,
    route: true,
  });

  const [optimizedRouteData, setOptimizedRouteData] = useState<RouteOptimizeResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);



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

  const handleRunAStarOptimization = async () => {
    setIsOptimizing(true);
    setRouteError(null);
    try {
      // Demonstration test coordinates that go around the dummy restricted waters polygon [72.60-72.80, 18.95-19.15]
      const startCoord: [number, number] = [18.80, 72.70];
      const destCoord: [number, number] = [19.30, 72.70];
      const result = await optimizeRoute(startCoord, destCoord, 2.0, 15.0);
      if (result.success && result.route.length > 0) {
        setOptimizedRouteData(result);
      } else {
        setRouteError(result.reason || 'No safe route found');
      }
    } catch (err: any) {
      setRouteError(err?.message || 'Failed to optimize route');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleClearOptimizedRoute = () => {
    setOptimizedRouteData(null);
    setRouteError(null);
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
          optimizedRoute={optimizedRouteData?.route}
          onSelectCandidate={handleSelectCandidate}
          onViewDetails={() => handleViewAssessment(selectedPFZ)}
        />

        {/* Phase 3 A* Route Optimizer Test Control */}
        <View style={styles.routeOptCard}>
          <View style={styles.routeOptHeader}>
            <View style={styles.routeOptHeaderLeft}>
              <Zap size={18} color="#D97706" />
              <Text style={styles.routeOptTitle}>A* Geographic Route Optimizer</Text>
            </View>
            {optimizedRouteData && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={handleClearOptimizedRoute}
                accessibilityLabel="Clear Optimized Route"
              >
                <X size={14} color="#64748B" />
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.routeOptSubtitle}>
            Avoids Hard-Restricted Maritime Geofences (Demo: [18.80, 72.70] ➔ [19.30, 72.70])
          </Text>

          {routeError && (
            <View style={styles.routeErrorBanner}>
              <AlertCircle size={15} color="#EF4444" />
              <Text style={styles.routeErrorText}>{routeError}</Text>
            </View>
          )}

          {optimizedRouteData && (
            <View style={styles.routeResultCard}>
              <View style={styles.routeResultBadge}>
                <ShieldCheck size={14} color="#15803D" />
                <Text style={styles.routeResultBadgeText}>Safe Route Found (A* Detour Active)</Text>
              </View>
              <View style={styles.routeStatsRow}>
                <View style={styles.routeStatCol}>
                  <Text style={styles.routeStatLabel}>Total Distance</Text>
                  <Text style={styles.routeStatValue}>{optimizedRouteData.total_distance_km?.toFixed(1)} km</Text>
                </View>
                <View style={styles.routeStatCol}>
                  <Text style={styles.routeStatLabel}>Nodes Explored</Text>
                  <Text style={styles.routeStatValue}>{optimizedRouteData.nodes_explored}</Text>
                </View>
                <View style={styles.routeStatCol}>
                  <Text style={styles.routeStatLabel}>Waypoints</Text>
                  <Text style={styles.routeStatValue}>{optimizedRouteData.route.length}</Text>
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.optimizeBtn, isOptimizing && styles.optimizeBtnDisabled]}
            onPress={handleRunAStarOptimization}
            disabled={isOptimizing}
            activeOpacity={0.8}
          >
            {isOptimizing ? (
              <View style={styles.btnRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.optimizeBtnText}>Optimizing Route...</Text>
              </View>
            ) : (
              <View style={styles.btnRow}>
                <Zap size={16} color="#FFFFFF" />
                <Text style={styles.optimizeBtnText}>
                  {optimizedRouteData ? 'Recalculate A* Route' : 'Optimize Route (A* Avoidance)'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>


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
  routeOptCard: {
    marginTop: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    ...SHADOWS.md,
  },
  routeOptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  routeOptHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  routeOptTitle: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '800',
    color: '#92400E',
  },
  routeOptSubtitle: {
    ...TYPOGRAPHY.caption,
    color: '#64748B',
    marginBottom: 10,
    fontSize: 11,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  routeErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  routeErrorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    flex: 1,
  },
  routeResultCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  routeResultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  routeResultBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  routeStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  routeStatCol: {
    alignItems: 'center',
  },
  routeStatLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  routeStatValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  optimizeBtn: {
    backgroundColor: '#D97706',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  optimizeBtnDisabled: {
    opacity: 0.65,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optimizeBtnText: {
    ...TYPOGRAPHY.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});

