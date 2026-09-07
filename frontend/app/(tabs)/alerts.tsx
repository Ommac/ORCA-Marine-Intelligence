import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, ShieldAlert, Radio, AlertOctagon, ShieldCheck, Info } from 'lucide-react-native';
import { OrcaHeader } from '../../components/OrcaHeader';
import { AlertCard } from '../../components/AlertCard';
import { SVASCard } from '../../components/SVASCard';
import { EmptyState } from '../../components/EmptyState';
import {
  getCurrentAssessment,
  subscribeToAssessment,
} from '../../services/api';
import { OrcaResponse, Alert } from '../../types/orca';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

// Severity ordering for display (critical first)
const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  moderate: 2,
  low: 3,
  info: 4,
};

function sortAlertsBySeverity(alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => {
    const orderA = SEVERITY_ORDER[a.severity] ?? 5;
    const orderB = SEVERITY_ORDER[b.severity] ?? 5;
    return orderA - orderB;
  });
}

export default function AlertsScreen() {
  const [data, setData] = useState<OrcaResponse>(getCurrentAssessment());
  const [prevAlerts, setPrevAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToAssessment((updated) => {
      setData((current) => {
        setPrevAlerts(current.alerts || []);
        return updated;
      });
    });
    return () => unsubscribe();
  }, []);

  const currentRequestId = data.request_id || data.meta?.request_id;
  const rawAlerts = data.alerts || [];

  // Deduplicate before rendering based on type + severity + title + message + source
  const seenKeys = new Set<string>();
  const dedupedAlerts: Alert[] = [];
  for (const a of rawAlerts) {
    // Only render alerts that belong to the current assessment request if tagged
    if (currentRequestId && a.request_id && a.request_id !== currentRequestId) {
      continue;
    }
    const key = `${a.type.toLowerCase()}|${a.severity.toLowerCase()}|${a.title.toLowerCase()}|${a.message.toLowerCase()}|${a.source.toLowerCase()}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      dedupedAlerts.push(a);
    }
  }

  const sortedAlerts = sortAlertsBySeverity(dedupedAlerts);
  const hasAssessmentRun = !!currentRequestId;

  // Count active high/critical alerts
  const activeWarningCount = sortedAlerts.filter(
    (a) => a.severity === 'critical' || a.severity === 'high'
  ).length + (data.svas?.severity?.toLowerCase() === 'alert' || data.svas?.severity?.toLowerCase() === 'danger' ? 1 : 0);

  // Temporary Frontend Debug Logging
  console.log('======================================================================');
  console.log('[ORCA FRONTEND ALERTS DEBUG]');
  console.log(`  Request ID: ${currentRequestId || 'None (Initial State)'}`);
  console.log(`  Alerts Received from API: ${rawAlerts.length}`);
  console.log(`  Current Alerts State Count: ${rawAlerts.length}`, rawAlerts.map(a => a.id));
  console.log(`  Previous Alerts State Count: ${prevAlerts.length}`, prevAlerts.map(a => a.id));
  console.log(`  Rendered Alert IDs:`, sortedAlerts.map(a => a.id));
  console.log('======================================================================');

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
              {!hasAssessmentRun
                ? 'No Assessment Yet'
                : activeWarningCount > 0
                  ? `${activeWarningCount} Active Warning${activeWarningCount > 1 ? 's' : ''}`
                  : 'No Severe Warnings Active'}
            </Text>
            <Text style={styles.bannerSubtitle}>
              {hasAssessmentRun
                ? 'Monitored via INCOIS, IMD & Maritime Safety Network'
                : 'Run an assessment from the Home screen to see alerts'}
            </Text>
          </View>
        </View>

        {/* 1. Dedicated Small Vessel Advisory (SVAS) */}
        {hasAssessmentRun && (
          <>
            <Text style={styles.sectionHeader}>Small Vessel Advisory</Text>
            <SVASCard svas={data.svas} dateStr={data.request?.date} />
          </>
        )}

        {/* 2. Backend-generated Alerts */}
        <Text style={[styles.sectionHeader, { marginTop: SPACING.lg }]}>
          Marine Safety Alerts
        </Text>

        {!hasAssessmentRun ? (
          <EmptyState
            title="No Assessment Available"
            message="Check marine conditions from the Home screen to generate safety alerts for your location."
          />
        ) : sortedAlerts.length > 0 ? (
          sortedAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))
        ) : (
          <EmptyState
            title="No Active Alerts"
            message="No critical marine alerts detected for the current assessment. Conditions appear within normal limits."
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
