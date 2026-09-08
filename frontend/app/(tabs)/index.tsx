import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Fish,
  Waves,
  ShieldAlert,
  MessageSquareQuote,
  Sparkles,
  Compass,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Wind,
  Thermometer,
  Gauge,
  ArrowRight,
  ShieldCheck,
  Radio,
  Cpu,
  HelpCircle,
  Clock,
  Layers,
  MapPin,
  ChevronRight,
} from 'lucide-react-native';
import { OrcaHeader } from '../../components/OrcaHeader';
import { LocationSelector } from '../../components/LocationSelector';
import { DateSelector } from '../../components/DateSelector';
import { BoatSizeSelector } from '../../components/BoatSizeSelector';
import { CheckConditionsButton } from '../../components/CheckConditionsButton';
import { LoadingState } from '../../components/LoadingState';
import { MarineConditionsCard } from '../../components/MarineConditionsCard';
import { PFZCard } from '../../components/PFZCard';
import { SVASCard } from '../../components/SVASCard';
import { ResponsiveContainer } from '../../components/ResponsiveContainer';
import { PRESET_LOCATIONS, BOAT_SIZES } from '../../constants/locations';
import { getOrcaAssessment, getCurrentAssessment, subscribeToAssessment } from '../../services/api';
import {
  getActiveTrip,
  setActiveLocation,
  setActiveDate,
  setActiveBoatWidth,
  subscribeToTrip,
  getTodayDateISO,
} from '../../services/tripStore';
import { OrcaResponse } from '../../types/orca';
import { formatDateToFisherman, getStatusTheme } from '../../utils/formatting';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const initialTrip = getActiveTrip();

  // Primary Trip State synced with Centralized Trip Store
  const [selectedLocation, setSelectedLocation] = useState(initialTrip.location);
  const [selectedDate, setSelectedDate] = useState(initialTrip.date || getTodayDateISO());
  const [selectedBoatWidth, setSelectedBoatWidth] = useState(initialTrip.boatWidthM || 5.0);
  const [loading, setLoading] = useState(false);
  const [assessmentData, setAssessmentData] = useState<OrcaResponse>(getCurrentAssessment());

  useEffect(() => {
    const unsubscribeTrip = subscribeToTrip((trip) => {
      setSelectedLocation(trip.location);
      setSelectedDate(trip.date);
      setSelectedBoatWidth(trip.boatWidthM);
    });

    const unsubscribeAssessment = subscribeToAssessment((updated) => {
      setAssessmentData(updated);
    });

    return () => {
      unsubscribeTrip();
      unsubscribeAssessment();
    };
  }, []);

  const handleCheckConditions = async () => {
    setLoading(true);
    try {
      const response = await getOrcaAssessment({
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        date: selectedDate,
        boat_width_m: selectedBoatWidth,
        query: `Check conditions for ${selectedLocation.name}`,
      });

      // Update local state and stay on dashboard or navigate
      setAssessmentData(response);
    } catch (err: any) {
      Alert.alert(
        'Assessment Notice',
        err?.message || 'ORCA could not fetch the latest conditions. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const hasAssessment = Boolean(
    assessmentData.request_id ||
    assessmentData.meta?.request_id ||
    assessmentData.marine?.available ||
    assessmentData.assessment?.summary
  );

  const statusTheme = getStatusTheme(assessmentData.assessment?.status || 'SAFE');
  const riskScore = assessmentData.assessment?.risk_score ?? 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <OrcaHeader />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContainer>
          {/* Welcome Tagline Banner */}
          <View style={styles.heroBanner}>
            <View style={styles.heroTagRow}>
              <View style={styles.heroTagBadge}>
                <Radio size={13} color="#0284C7" strokeWidth={2.5} />
                <Text style={styles.heroTagText}>INCOIS & Open-Meteo Synced</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>Smart Advice. Safe Fishing.</Text>
            <Text style={styles.heroSubtitle}>
              AI-orchestrated marine intelligence for safe coastal navigation and high-yield fishing zones.
            </Text>
          </View>

          {/* 1. Trip Context Configuration Card */}
          <View style={styles.formCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <MapPin size={18} color={COLORS.oceanBlue} />
                <Text style={styles.cardHeaderTitle}>Plan Your Trip</Text>
              </View>
              <Text style={styles.cardHeaderSub}>Authoritative Parameters</Text>
            </View>

            {/* Location Selection */}
            <LocationSelector
              selectedLocation={selectedLocation}
              onSelectLocation={(loc) => {
                const newLoc = {
                  id: (loc as any).id || 'custom',
                  name: loc.name,
                  state: loc.state || 'Coastal Zone',
                  district: (loc as any).district,
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                };
                setSelectedLocation(newLoc);
                setActiveLocation(newLoc);
              }}
            />

            {/* Date Selection */}
            <DateSelector
              selectedDate={selectedDate}
              onSelectDate={(dateISO) => {
                setSelectedDate(dateISO);
                setActiveDate(dateISO);
              }}
            />

            {/* Boat Size Selection */}
            <BoatSizeSelector
              selectedBoatWidth={selectedBoatWidth}
              onSelectBoat={(opt) => {
                setSelectedBoatWidth(opt.boat_width_m);
                setActiveBoatWidth(opt.boat_width_m);
              }}
            />

            {/* Primary CTA */}
            <CheckConditionsButton
              onPress={handleCheckConditions}
              loading={loading}
              label={hasAssessment ? 'RE-CHECK CONDITIONS' : 'CHECK MARINE CONDITIONS'}
            />
          </View>

        {/* Loading Step Animation when checking conditions */}
        {loading && <LoadingState />}

        {/* 2. Live Safety Intelligence Summary (When Assessment Available) */}
        {hasAssessment && !loading && (
          <View style={styles.assessmentSection}>
            {/* Primary Safety & Risk Badge */}
            <View
              style={[
                styles.safetyHeroCard,
                {
                  backgroundColor: statusTheme.bgColor,
                  borderColor: statusTheme.borderColor,
                },
              ]}
            >
              <View style={styles.safetyTopRow}>
                <View
                  style={[
                    styles.safetyIconWrapper,
                    { backgroundColor: 'rgba(255, 255, 255, 0.9)' },
                  ]}
                >
                  {assessmentData.assessment.status === 'SAFE' ? (
                    <CheckCircle2 size={36} color={statusTheme.accentColor} strokeWidth={2.6} />
                  ) : assessmentData.assessment.status === 'CAUTION' ? (
                    <AlertTriangle size={36} color={statusTheme.accentColor} strokeWidth={2.6} />
                  ) : (
                    <AlertOctagon size={36} color={statusTheme.accentColor} strokeWidth={2.6} />
                  )}
                </View>

                <View style={styles.safetyCol}>
                  <Text style={[styles.safetyStatusText, { color: statusTheme.textColor }]}>
                    {statusTheme.label}
                  </Text>
                  <View style={styles.safetyScorePill}>
                    <Text style={[styles.safetyScoreText, { color: statusTheme.textColor }]}>
                      {statusTheme.subtitle} • {riskScore}/100 Risk Score
                    </Text>
                  </View>
                </View>
              </View>

              {/* Visual Progress Bar */}
              <View style={styles.riskTrack}>
                <View
                  style={[
                    styles.riskFill,
                    {
                      width: `${Math.min(Math.max(riskScore, 0), 100)}%`,
                      backgroundColor: statusTheme.accentColor,
                    },
                  ]}
                />
              </View>

              {/* Safety Summary Rationale */}
              <Text style={[styles.safetySummaryText, { color: statusTheme.textColor }]}>
                {assessmentData.assessment.summary || statusTheme.friendlyMessage}
              </Text>

              {/* Quick Metrics Strip */}
              <View style={styles.quickMetricsStrip}>
                <View style={styles.quickMetricCol}>
                  <Text style={styles.quickMetricLabel}>WAVE HEIGHT</Text>
                  <Text style={styles.quickMetricVal}>
                    {assessmentData.marine?.wave_height_m !== undefined
                      ? `${assessmentData.marine.wave_height_m.toFixed(1)} m`
                      : 'N/A'}
                  </Text>
                </View>

                <View style={styles.quickMetricDivider} />

                <View style={styles.quickMetricCol}>
                  <Text style={styles.quickMetricLabel}>WIND SPEED</Text>
                  <Text style={styles.quickMetricVal}>
                    {assessmentData.marine?.wind_speed_knots !== undefined
                      ? `${assessmentData.marine.wind_speed_knots.toFixed(0)} kts`
                      : 'N/A'}
                  </Text>
                </View>

                <View style={styles.quickMetricDivider} />

                <View style={styles.quickMetricCol}>
                  <Text style={styles.quickMetricLabel}>NEAREST PFZ</Text>
                  <Text style={styles.quickMetricVal}>
                    {assessmentData.pfz?.nearest?.distance_km !== undefined
                      ? `${assessmentData.pfz.nearest.distance_km.toFixed(0)} km`
                      : 'None'}
                  </Text>
                </View>
              </View>

              {/* Button to Drill Down into Full Report */}
              <TouchableOpacity
                style={styles.drillDownBtn}
                onPress={() =>
                  router.push({
                    pathname: '/assessment',
                    params: {
                      locationName: selectedLocation.name,
                      date: selectedDate,
                      boatWidth: selectedBoatWidth.toString(),
                    },
                  })
                }
                activeOpacity={0.8}
              >
                <Text style={styles.drillDownBtnText}>VIEW FULL INTELLIGENCE REPORT</Text>
                <ChevronRight size={18} color={COLORS.oceanBlue} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            {/* 3. Live Sea Conditions Grid */}
            <MarineConditionsCard marine={assessmentData.marine} />

            {/* 4. Potential Fishing Zones Card */}
            <PFZCard
              pfz={assessmentData.pfz}
              onViewOnMap={() => router.push('/(tabs)/map')}
            />

            {/* 5. Small Vessel Advisory Card */}
            <SVASCard svas={assessmentData.svas} dateStr={selectedDate} />
          </View>
        )}

        {/* Multi-Agent Intelligence Status Strip */}
        <View style={styles.agentSection}>
          <View style={styles.agentHeader}>
            <Cpu size={16} color={COLORS.oceanBlue} />
            <Text style={styles.agentHeaderTitle}>Specialist Multi-Agent Architecture</Text>
          </View>

          <View style={styles.agentBadgesGrid}>
            <View style={styles.agentBadge}>
              <View style={[styles.agentDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.agentBadgeText}>Marine Weather</Text>
            </View>

            <View style={styles.agentBadge}>
              <View style={[styles.agentDot, { backgroundColor: '#0284C7' }]} />
              <Text style={styles.agentBadgeText}>Ocean Current</Text>
            </View>

            <View style={styles.agentBadge}>
              <View style={[styles.agentDot, { backgroundColor: '#059669' }]} />
              <Text style={styles.agentBadgeText}>INCOIS PFZ</Text>
            </View>

            <View style={styles.agentBadge}>
              <View style={[styles.agentDot, { backgroundColor: '#D97706' }]} />
              <Text style={styles.agentBadgeText}>SVAS Safety</Text>
            </View>

            <View style={styles.agentBadge}>
              <View style={[styles.agentDot, { backgroundColor: '#7C3AED' }]} />
              <Text style={styles.agentBadgeText}>Risk Engine</Text>
            </View>
          </View>
        </View>

        {/* Quick Action Navigation Hub */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.quickActionsTitle}>ORCA Marine Hub</Text>

          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/map')}
              activeOpacity={0.8}
            >
              <View style={[styles.quickIconBox, { backgroundColor: '#DCFCE7' }]}>
                <Fish size={22} color="#15803D" strokeWidth={2.4} />
              </View>
              <Text style={styles.quickActionLabel}>Fishing Zones</Text>
              <Text style={styles.quickActionSub}>Map & Coordinates</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/alerts')}
              activeOpacity={0.8}
            >
              <View style={[styles.quickIconBox, { backgroundColor: '#FEE2E2' }]}>
                <ShieldAlert size={22} color="#DC2626" strokeWidth={2.4} />
              </View>
              <Text style={styles.quickActionLabel}>Alerts & SVAS</Text>
              <Text style={styles.quickActionSub}>Emergency Feeds</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/ask')}
              activeOpacity={0.8}
            >
              <View style={[styles.quickIconBox, { backgroundColor: '#F3E8FF' }]}>
                <MessageSquareQuote size={22} color="#7E22CE" strokeWidth={2.4} />
              </View>
              <Text style={styles.quickActionLabel}>Ask ORCA</Text>
              <Text style={styles.quickActionSub}>AI Marine Advice</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={handleCheckConditions}
              activeOpacity={0.8}
            >
              <View style={[styles.quickIconBox, { backgroundColor: '#E0F2FE' }]}>
                <Waves size={22} color={COLORS.oceanBlue} strokeWidth={2.4} />
              </View>
              <Text style={styles.quickActionLabel}>Re-evaluate</Text>
              <Text style={styles.quickActionSub}>Fresh Live Sync</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Safety Tips Banner */}
        <View style={styles.infoBanner}>
          <Sparkles size={20} color={COLORS.oceanBlue} />
          <Text style={styles.infoBannerText}>
            Always check Small Vessel Advisories (SVAS) before sailing in motorized craft under 6m. Safe fishing begins with accurate intelligence.
          </Text>
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
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 48,
  },
  heroBanner: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  heroTagRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  heroTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  heroTagText: {
    ...TYPOGRAPHY.caption,
    color: '#0284C7',
    fontWeight: '800',
    fontSize: 11,
  },
  heroTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.primary,
    fontSize: 24,
  },
  heroSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    marginBottom: SPACING.xs,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardHeaderTitle: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  cardHeaderSub: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontSize: 11,
  },
  assessmentSection: {
    marginTop: SPACING.md,
  },
  safetyHeroCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginVertical: SPACING.sm,
    borderWidth: 2,
    ...SHADOWS.md,
  },
  safetyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  safetyIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  safetyCol: {
    flex: 1,
  },
  safetyStatusText: {
    ...TYPOGRAPHY.heroBadge,
    fontSize: 22,
    letterSpacing: 0.3,
  },
  safetyScorePill: {
    marginTop: 3,
  },
  safetyScoreText: {
    ...TYPOGRAPHY.caption,
    fontSize: 12,
    fontWeight: '800',
  },
  riskTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  riskFill: {
    height: '100%',
    borderRadius: 3,
  },
  safetySummaryText: {
    ...TYPOGRAPHY.bodyLarge,
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: '600',
    marginTop: 4,
  },
  quickMetricsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: RADIUS.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  quickMetricCol: {
    alignItems: 'center',
    flex: 1,
  },
  quickMetricLabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 9.5,
    color: COLORS.textTertiary,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  quickMetricVal: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '800',
    color: COLORS.textPrimary,
    fontSize: 15,
    marginTop: 2,
  },
  quickMetricDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  drillDownBtn: {
    marginTop: SPACING.md,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.skyBlueBorder,
    ...SHADOWS.sm,
  },
  drillDownBtnText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.oceanBlue,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  agentSection: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  agentHeaderTitle: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  agentBadgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  agentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  agentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  agentBadgeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  quickActionsSection: {
    marginTop: SPACING.lg,
  },
  quickActionsTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  quickIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  quickActionSub: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    gap: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoBannerText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
});
