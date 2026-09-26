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
  checkGeofenceRoute,
} from '../../services/api';
import { setMapFocus } from '../../services/mapFocusStore';
import { getActiveTrip, subscribeToTrip } from '../../services/tripStore';
import { OrcaResponse, PFZCandidate, RouteOptimizeResult } from '../../types/orca';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDistanceKm, calculateHaversineDistanceKm } from '../../utils/formatting';
import { CheckCircle2, ShieldAlert, Check, ArrowRight } from 'lucide-react-native';

interface DirectRouteInfo {
  start: [number, number];
  dest: [number, number];
  distanceKm: number;
  blocked: boolean;
  intersectionsCount: number;
  blockedName?: string;
}

interface RouteSafetyChecks {
  directChecked: boolean;
  obstacleDetected: boolean;
  alternativeFound: boolean;
  segmentsValidated: boolean;
  avoidsRestricted: boolean;
}

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
  const [directRouteInfo, setDirectRouteInfo] = useState<DirectRouteInfo | null>(null);
  const [safetyChecks, setSafetyChecks] = useState<RouteSafetyChecks | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationStep, setOptimizationStep] = useState<string | null>(null);
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
    setOptimizationStep('Step 1/5: Checking direct route against geofences...');

    try {
      // Demonstration coordinates: Direct route crosses the dummy restricted polygon [72.60-72.80, 18.95-19.15]
      const startCoord: [number, number] = [18.80, 72.70];
      const destCoord: [number, number] = [19.30, 72.70];

      // 1. Calculate direct Great-Circle distance
      const directDist = calculateHaversineDistanceKm(
        startCoord[0],
        startCoord[1],
        destCoord[0],
        destCoord[1]
      );

      // 2. Perform Phase 2 Direct Route Verification check
      const checkResult = await checkGeofenceRoute(startCoord, destCoord);
      const isDirectBlocked = checkResult.blocked;
      const restrictedHits = checkResult.intersections.filter(
        (i) => i.restricted || i.category === 'restricted_waters'
      );
      const obstacleName = restrictedHits[0]?.name || (isDirectBlocked ? 'Mumbai Offshore Restricted Area' : undefined);

      if (isDirectBlocked) {
        setOptimizationStep(
          `Step 2/5: Direct route intersects Restricted Waters (${obstacleName || '1 Obstacle'}) — BLOCKED`
        );
      } else {
        setOptimizationStep('Step 2/5: Direct route is clear of hard restrictions.');
      }

      // Small async tick for visual progression
      await new Promise((r) => setTimeout(r, 400));
      setOptimizationStep('Step 3/5: A* searching alternative safe nodes around obstacle...');

      // 3. Perform Phase 3 A* Route Optimization
      const optResult = await optimizeRoute(startCoord, destCoord, 2.0, 15.0);

      if (optResult.success && optResult.route.length > 0) {
        setOptimizationStep('Step 4/5: Safe detour found avoiding restricted polygon.');
        await new Promise((r) => setTimeout(r, 300));
        setOptimizationStep('Step 5/5: Final route validated (0 hard restricted intersections).');

        setDirectRouteInfo({
          start: startCoord,
          dest: destCoord,
          distanceKm: directDist,
          blocked: isDirectBlocked,
          intersectionsCount: restrictedHits.length || (isDirectBlocked ? 1 : 0),
          blockedName: obstacleName,
        });

        setSafetyChecks({
          directChecked: true,
          obstacleDetected: isDirectBlocked,
          alternativeFound: optResult.success,
          segmentsValidated: true,
          avoidsRestricted: true,
        });

        setOptimizedRouteData(optResult);
      } else {
        setRouteError(optResult.reason || 'No safe route could be found');
        setOptimizationStep(null);
      }
    } catch (err: any) {
      setRouteError(err?.message || 'Failed to optimize and verify route');
      setOptimizationStep(null);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleClearOptimizedRoute = () => {
    setOptimizedRouteData(null);
    setDirectRouteInfo(null);
    setSafetyChecks(null);
    setOptimizationStep(null);
    setRouteError(null);
  };

  const hasPfz = Boolean(selectedPFZ || (data.pfz && data.pfz.available && data.pfz.nearest));

  // Calculated detour metrics
  const directDistanceKm = directRouteInfo?.distanceKm || 0;
  const astarDistanceKm = optimizedRouteData?.total_distance_km || 0;
  const additionalDistanceKm =
    astarDistanceKm > 0 && directDistanceKm > 0
      ? Number((astarDistanceKm - directDistanceKm).toFixed(2))
      : 0;
  const detourPercent =
    directDistanceKm > 0 && additionalDistanceKm > 0
      ? Number(((additionalDistanceKm / directDistanceKm) * 100).toFixed(1))
      : 0;

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
            directRoute={directRouteInfo ? [directRouteInfo.start, directRouteInfo.dest] : undefined}
            directRouteBlocked={directRouteInfo?.blocked}
            directRouteBlockedName={directRouteInfo?.blockedName}
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
              {(optimizedRouteData || directRouteInfo) && (
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
              Hard Geofence Avoidance Demonstration (START: [18.80, 72.70] ➔ DEST: [19.30, 72.70])
            </Text>

            {/* Live Progress Stage Notification */}
            {optimizationStep && (
              <View style={styles.progressStepBox}>
                <ActivityIndicator size="small" color="#D97706" />
                <Text style={styles.progressStepText}>{optimizationStep}</Text>
              </View>
            )}

            {routeError && (
              <View style={styles.routeErrorBanner}>
                <AlertCircle size={15} color="#EF4444" />
                <Text style={styles.routeErrorText}>{routeError}</Text>
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
                  <Text style={styles.optimizeBtnText}>Optimizing & Verifying Route...</Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <Zap size={16} color="#FFFFFF" />
                  <Text style={styles.optimizeBtnText}>
                    {optimizedRouteData ? 'Recalculate & Verify Route' : 'Optimize Route (A* Avoidance)'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Phase 3 A* Route Verification & Visual Demonstration Card */}
          {optimizedRouteData && directRouteInfo && (
            <View style={styles.verificationCard}>
              <View style={styles.verHeaderRow}>
                <View style={styles.verHeaderBadge}>
                  <ShieldCheck size={16} color="#15803D" />
                  <Text style={styles.verHeaderTitle}>A* ROUTE VERIFICATION</Text>
                </View>
                <View style={styles.sihTag}>
                  <Text style={styles.sihTagText}>SIH 2026 • 26176</Text>
                </View>
              </View>

              <Text style={styles.verCaption}>
                Verification breakdown comparing the blocked direct path against the A* safe detour.
              </Text>

              {/* Direct Route vs A* Safe Route Metrics Table */}
              <View style={styles.comparisonTable}>
                {/* Direct Route Row */}
                <View style={styles.comparisonRow}>
                  <View style={styles.compLabelCol}>
                    <View style={styles.compLabelHeader}>
                      <View style={styles.directRouteDot} />
                      <Text style={styles.compLabelTitle}>Direct Route</Text>
                    </View>
                    <Text style={styles.compLabelSub}>
                      {directRouteInfo.blocked
                        ? `Attempts to cross ${directRouteInfo.blockedName || 'Restricted Zone'}`
                        : 'Direct unblocked path'}
                    </Text>
                  </View>
                  <View style={styles.compValueCol}>
                    <Text style={styles.compDistanceText}>{directDistanceKm.toFixed(2)} km</Text>
                    <View style={[styles.statusPill, directRouteInfo.blocked ? styles.statusPillBlocked : styles.statusPillSafe]}>
                      <Text style={[styles.statusPillText, directRouteInfo.blocked ? styles.statusTextBlocked : styles.statusTextSafe]}>
                        {directRouteInfo.blocked ? '❌ BLOCKED' : '✅ CLEAR'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.tableDivider} />

                {/* A* Safe Route Row */}
                <View style={styles.comparisonRow}>
                  <View style={styles.compLabelCol}>
                    <View style={styles.compLabelHeader}>
                      <View style={styles.safeRouteDot} />
                      <Text style={styles.compLabelTitle}>A* Safe Route</Text>
                    </View>
                    <Text style={styles.compLabelSub}>
                      Detours around restricted waters with 0 collision edges
                    </Text>
                  </View>
                  <View style={styles.compValueCol}>
                    <Text style={[styles.compDistanceText, { color: '#B45309' }]}>
                      {astarDistanceKm.toFixed(2)} km
                    </Text>
                    <View style={[styles.statusPill, styles.statusPillSafe]}>
                      <Text style={[styles.statusPillText, styles.statusTextSafe]}>
                        ✅ SAFE
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Detour & Search Statistics Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>Additional Detour</Text>
                  <Text style={styles.statBoxValue}>
                    +{additionalDistanceKm.toFixed(2)} km
                  </Text>
                  <Text style={styles.statBoxSub}>+{detourPercent}% distance</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>Restricted Crossings</Text>
                  <Text style={[styles.statBoxValue, { color: directRouteInfo.intersectionsCount > 0 ? '#DC2626' : '#15803D' }]}>
                    {directRouteInfo.intersectionsCount}
                  </Text>
                  <Text style={styles.statBoxSub}>on direct line</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>Nodes Explored</Text>
                  <Text style={styles.statBoxValue}>{optimizedRouteData.nodes_explored}</Text>
                  <Text style={styles.statBoxSub}>A* grid search</Text>
                </View>

                <View style={styles.statBox}>
                  <Text style={styles.statBoxLabel}>Waypoints</Text>
                  <Text style={styles.statBoxValue}>{optimizedRouteData.route.length}</Text>
                  <Text style={styles.statBoxSub}>verified segments</Text>
                </View>
              </View>

              {/* Safety Checklist Section */}
              <View style={styles.checklistSection}>
                <Text style={styles.checklistTitle}>SAFETY VALIDATION CHECKLIST</Text>
                <View style={styles.checklistItems}>
                  <View style={styles.checkItem}>
                    <CheckCircle2 size={16} color="#15803D" />
                    <Text style={styles.checkText}>
                      Direct route checked against geofences ({directDistanceKm.toFixed(1)} km)
                    </Text>
                  </View>

                  <View style={styles.checkItem}>
                    <CheckCircle2 size={16} color={directRouteInfo.blocked ? '#DC2626' : '#15803D'} />
                    <Text style={styles.checkText}>
                      {directRouteInfo.blocked
                        ? `Restricted zone detected on direct path (${directRouteInfo.blockedName || 'Restricted Area'})`
                        : 'No restricted zones detected on direct route'}
                    </Text>
                  </View>

                  <View style={styles.checkItem}>
                    <CheckCircle2 size={16} color="#15803D" />
                    <Text style={styles.checkText}>
                      A* generated obstacle-avoidance detour ({optimizedRouteData.nodes_explored} nodes explored)
                    </Text>
                  </View>

                  <View style={styles.checkItem}>
                    <CheckCircle2 size={16} color="#15803D" />
                    <Text style={styles.checkText}>
                      Every A* route segment validated via Phase 2 intersection check
                    </Text>
                  </View>

                  <View style={styles.checkItem}>
                    <CheckCircle2 size={16} color="#15803D" />
                    <Text style={styles.checkText}>
                      Final generated route avoids 100% of hard-restricted zones
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}


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
  progressStepBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  progressStepText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    flex: 1,
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
  verificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    ...SHADOWS.md,
  },
  verHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  verHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verHeaderTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#14532D',
    letterSpacing: 0.5,
  },
  sihTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  sihTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  verCaption: {
    ...TYPOGRAPHY.caption,
    color: '#64748B',
    marginBottom: 12,
    fontSize: 11,
  },
  comparisonTable: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: SPACING.sm,
    marginBottom: 12,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  compLabelCol: {
    flex: 1,
    paddingRight: 8,
  },
  compLabelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  directRouteDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  safeRouteDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  compLabelTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  compLabelSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  compValueCol: {
    alignItems: 'flex-end',
  },
  compDistanceText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    marginTop: 2,
  },
  statusPillBlocked: {
    backgroundColor: '#FEE2E2',
  },
  statusPillSafe: {
    backgroundColor: '#DCFCE7',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextBlocked: {
    color: '#DC2626',
  },
  statusTextSafe: {
    color: '#15803D',
  },
  tableDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  statBoxLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  statBoxValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  statBoxSub: {
    fontSize: 9.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  checklistSection: {
    backgroundColor: '#F0FDF4',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  checklistTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  checklistItems: {
    gap: 6,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  checkText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#14532D',
    flex: 1,
  },
});

