import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, ShieldAlert, Radio, AlertOctagon } from 'lucide-react-native';
import { OrcaHeader } from '../../components/OrcaHeader';
import { AlertCard } from '../../components/AlertCard';
import { SVASCard } from '../../components/SVASCard';
import { EmptyState } from '../../components/EmptyState';
import {
  getCurrentAssessment,
  subscribeToAssessment,
} from '../../services/api';
import { OrcaResponse } from '../../types/orca';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export default function AlertsScreen() {
  const [data, setData] = useState<OrcaResponse>(getCurrentAssessment());

  useEffect(() => {
    const unsubscribe = subscribeToAssessment((updated) => {
      setData(updated);
    });
    return () => unsubscribe();
  }, []);

  const hazards = data.hazards || [];
  const hasAlerts = hazards.length > 0 || (data.svas && data.svas.available);

  // Count active high/medium warnings
  const activeWarningCount = hazards.filter(
    (h) => h.severity === 'HIGH' || h.severity === 'MEDIUM'
  ).length + (data.svas?.severity?.toLowerCase() === 'alert' ? 1 : 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <OrcaHeader
        title="Alerts & Warnings"
        subtitle="Official Coastal Safety Advisories"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Alert Summary Banner */}
        <View
          style={[
            styles.bannerCard,
            activeWarningCount > 0 ? styles.bannerCardWarning : styles.bannerCardSafe,
          ]}
        >
          <View style={styles.bannerIconBox}>
            {activeWarningCount > 0 ? (
              <AlertOctagon size={28} color={COLORS.danger} />
            ) : (
              <Radio size={28} color={COLORS.safe} />
            )}
          </View>
          <View style={styles.bannerTextCol}>
            <Text
              style={[
                styles.bannerTitle,
                activeWarningCount > 0 ? styles.bannerTitleWarning : styles.bannerTitleSafe,
              ]}
            >
              {activeWarningCount > 0
                ? `${activeWarningCount} Active Weather Advisory`
                : 'No Severe Warnings Active'}
            </Text>
            <Text style={styles.bannerSubtitle}>
              Monitored via INCOIS, IMD & Maritime Safety Network
            </Text>
          </View>
        </View>

        {/* 1. Dedicated Small Vessel Advisory (SVAS) */}
        <Text style={styles.sectionHeader}>Small Vessel Advisory</Text>
        <SVASCard svas={data.svas} dateStr={data.request?.date} />

        {/* 2. Coastal Hazard Feeds */}
        <Text style={[styles.sectionHeader, { marginTop: SPACING.lg }]}>
          Maritime Hazard Bulletins
        </Text>

        {hazards.length > 0 ? (
          hazards.map((hazard, index) => (
            <AlertCard key={hazard.id || `hazard-${index}`} hazard={hazard} />
          ))
        ) : (
          <EmptyState
            title="No Active Warnings"
            message="No cyclone, tsunami, storm surge, or severe wave warnings currently active."
          />
        )}
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
    paddingBottom: 40,
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.md,
    gap: 14,
    borderWidth: 1.5,
    ...SHADOWS.sm,
  },
  bannerCardWarning: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  bannerCardSafe: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  bannerIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 17,
  },
  bannerTitleWarning: {
    color: COLORS.danger,
  },
  bannerTitleSafe: {
    color: COLORS.safe,
  },
  bannerSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  sectionHeader: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textPrimary,
    fontWeight: '800',
    marginVertical: SPACING.xs,
  },
});
