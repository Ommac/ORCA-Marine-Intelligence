import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MapPin,
  Calendar,
  Ship,
  HelpCircle,
  Share2,
  Map as MapIcon,
} from 'lucide-react-native';
import { OrcaHeader } from '../components/OrcaHeader';
import { RiskCard } from '../components/RiskCard';
import { PFZCard } from '../components/PFZCard';
import { MarineConditionsCard } from '../components/MarineConditionsCard';
import { SVASCard } from '../components/SVASCard';
import { HazardCard } from '../components/HazardCard';
import { EmptyState } from '../components/EmptyState';
import {
  getCurrentAssessment,
  subscribeToAssessment,
} from '../services/api';
import { OrcaResponse } from '../types/orca';
import { formatDateToFisherman } from '../utils/formatting';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export default function AssessmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [data, setData] = useState<OrcaResponse>(getCurrentAssessment());

  useEffect(() => {
    // Keep synced with centralized active session
    const unsubscribe = subscribeToAssessment((updated) => {
      setData(updated);
    });
    return () => unsubscribe();
  }, []);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `ORCA Marine Assessment for ${data.request?.date || 'Today'}: Overall condition is ${data.assessment.status} (Risk Score: ${data.assessment.risk_score}/100). Nearest Fishing Zone: ${data.pfz.nearest?.distance_km ?? 'N/A'} km away.`,
      });
    } catch {
      // ignore
    }
  };

  const handleViewOnMap = () => {
    router.push('/(tabs)/map');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <OrcaHeader
        title="Trip Assessment"
        subtitle="ORCA Safety Recommendation"
        showBack={true}
        rightAction={
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShare}
            accessibilityLabel="Share assessment"
          >
            <Share2 size={20} color={COLORS.textInverse} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Selected Trip Parameters Chips */}
        <View style={styles.tripSummaryRow}>
          <View style={styles.tripChip}>
            <MapPin size={14} color={COLORS.oceanBlue} />
            <Text style={styles.tripChipText} numberOfLines={1}>
              {params.locationName || `${data.request?.latitude?.toFixed(2)}°N, ${data.request?.longitude?.toFixed(2)}°E`}
            </Text>
          </View>

          <View style={styles.tripChip}>
            <Calendar size={14} color={COLORS.oceanBlue} />
            <Text style={styles.tripChipText}>
              {formatDateToFisherman(data.request?.date || '2026-09-03')}
            </Text>
          </View>

          <View style={styles.tripChip}>
            <Ship size={14} color={COLORS.oceanBlue} />
            <Text style={styles.tripChipText}>
              {data.request?.boat_width_m ? `${data.request.boat_width_m} m Boat` : '5 m Boat'}
            </Text>
          </View>
        </View>

        {/* 1. Large Status & Risk Card */}
        <RiskCard assessment={data.assessment} />

        {/* 2. Potential Fishing Zone (PFZ) Card */}
        <PFZCard pfz={data.pfz} onViewOnMap={handleViewOnMap} />

        {/* 3. Sea Conditions Grid Card */}
        <MarineConditionsCard marine={data.marine} />

        {/* 4. Small Vessel Advisory (SVAS) Card */}
        <SVASCard svas={data.svas} dateStr={data.request?.date} />

        {/* 5. Hazards & Emergency Warning Checklist */}
        <HazardCard hazards={data.hazards} />

        {/* 6. "Why this result?" Fisherman Explanation Card */}
        <View style={styles.explanationCard}>
          <View style={styles.explanationHeader}>
            <HelpCircle size={20} color={COLORS.oceanBlue} />
            <Text style={styles.explanationTitle}>Why this result?</Text>
          </View>
          <Text style={styles.explanationText}>
            {data.assessment.summary ||
              'ORCA analyzed combined oceanographic factors including wave height, wind speeds, distance to high-chlorophyll fishing zones, and active government advisories from INCOIS to produce this recommendation.'}
          </Text>
        </View>

        {/* Bottom CTA to open full map */}
        <TouchableOpacity
          style={styles.fullMapCTA}
          onPress={handleViewOnMap}
          activeOpacity={0.85}
        >
          <MapIcon size={22} color={COLORS.textInverse} />
          <Text style={styles.fullMapCTAText}>OPEN INTERACTIVE MAP</Text>
        </TouchableOpacity>
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
    paddingBottom: 40,
  },
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: SPACING.sm,
  },
  tripChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.skyBlueBorder,
    gap: 6,
    ...SHADOWS.sm,
  },
  tripChipText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  explanationCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  explanationTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  explanationText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  fullMapCTA: {
    backgroundColor: COLORS.oceanBlue,
    height: 56,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: SPACING.md,
    ...SHADOWS.md,
  },
  fullMapCTAText: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textInverse,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
