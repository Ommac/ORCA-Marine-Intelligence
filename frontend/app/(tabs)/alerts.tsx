import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, ShieldAlert, Radio, AlertOctagon, ShieldCheck, Info, MapPin, Calendar, Ship } from 'lucide-react-native';
import { OrcaHeader } from '../../components/OrcaHeader';
import { AlertCard } from '../../components/AlertCard';
import { SVASCard } from '../../components/SVASCard';
import { EmptyState } from '../../components/EmptyState';
import { ResponsiveContainer } from '../../components/ResponsiveContainer';
import {
  getCurrentAssessment,
  subscribeToAssessment,
} from '../../services/api';
import { getActiveTrip, subscribeToTrip } from '../../services/tripStore';
import { OrcaResponse, Alert } from '../../types/orca';
import { formatDateToFisherman } from '../../utils/formatting';
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
  const [activeTrip, setActiveTrip] = useState(getActiveTrip());
  const [data, setData] = useState<OrcaResponse>(getCurrentAssessment());
  const [prevAlerts, setPrevAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    const unsubTrip = subscribeToTrip((trip) => {
      setActiveTrip(trip);
    });
    const unsubAssessment = subscribeToAssessment((updated) => {
      setData((current) => {
        setPrevAlerts(current.alerts || []);
        return updated;
      });
    });
    return () => {
      unsubTrip();
      unsubAssessment();
    };
  }, []);

  const currentRequestId = data.request_id || data.meta?.request_id;
  const rawAlerts = data.alerts || [];

  // Deduplicate before rendering based on type + severity + title + message + source
  const seenKeys = new Set<string>();
  const dedupedAlerts: Alert[] = [];
  for (const a of rawAlerts) {
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
  const hasAssessmentRun = !!currentRequestId || Boolean(data.marine?.available || data.assessment?.summary);

  // Count active high/critical alerts
  const activeWarningCount = sortedAlerts.filter(
    (a) => a.severity === 'critical' || a.severity === 'high'
  ).length + (data.svas?.severity?.toLowerCase() === 'alert' || data.svas?.severity?.toLowerCase() === 'danger' ? 1 : 0);

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
        <ResponsiveContainer>
          {/* Selected Fishing Location Context Strip */}
        <View style={styles.contextStrip}>
          <View style={styles.contextPill}>
            <MapPin size={13} color={COLORS.oceanBlue} />
            <Text style={styles.contextPillText} numberOfLines={1}>
              {activeTrip.location.name}
            </Text>
          </View>

          <View style={styles.contextPill}>
            <Calendar size={13} color={COLORS.oceanBlue} />
            <Text style={styles.contextPillText}>
              {formatDateToFisherman(activeTrip.date)}
            </Text>
          </View>

          <View style={styles.contextPill}>
            <Ship size={13} color={COLORS.oceanBlue} />
            <Text style={styles.contextPillText}>
              {activeTrip.boatWidthM}m Vessel
            </Text>
          </View>
        </View>

        {/* Active Alert Summary Banner */}
        <View
          style={[
            styles.bannerCard,
            activeWarningCount > 0 ? styles.bannerCardWarning : styles.bannerCardSafe,
          ]}
        >
          <View style={styles.bannerIconBox}>
            {activeWarningCount > 0 ? (
              <AlertOctagon size={26} color={COLORS.danger} />
            ) : (
              <ShieldCheck size={26} color={COLORS.safe} />
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
                ? 'Ready for Assessment'
                : activeWarningCount > 0
                  ? `${activeWarningCount} Active Warning${activeWarningCount > 1 ? 's' : ''}`
                  : 'All Clear – No Severe Hazards'}
            </Text>
            <Text style={styles.bannerSubtitle}>
              {hasAssessmentRun
                ? 'Monitored continuously via INCOIS, IMD & Maritime Safety Network'
                : 'Run "Check Marine Conditions" on the Home screen to evaluate live advisories'}
            </Text>
          </View>
        </View>

        {/* 1. Dedicated Small Vessel Advisory (SVAS) */}
        {hasAssessmentRun && (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeader}>Small Vessel Advisory Service</Text>
            <SVASCard svas={data.svas} dateStr={data.request?.date || activeTrip.date} />
          </View>
        )}

        {/* 2. Backend-generated Maritime Alerts */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeader}>
            Marine Safety Alerts {sortedAlerts.length > 0 ? `(${sortedAlerts.length})` : ''}
          </Text>

          {!hasAssessmentRun ? (
            <EmptyState
              title="No Assessment Available"
              message="Check marine conditions from the Home screen to generate localized safety alerts for your vessel."
            />
          ) : sortedAlerts.length > 0 ? (
            sortedAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))
          ) : (
            <EmptyState
              title="No Active Alerts"
              message="No critical marine alerts or emergency hazard warnings detected for the current assessment. Conditions appear within normal operational limits."
            />
          )}
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
  contextStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
  },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.skyBlueBorder,
    gap: 5,
    ...SHADOWS.sm,
  },
  contextPillText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 11.5,
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
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16.5,
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
    lineHeight: 16,
  },
  sectionBlock: {
    marginTop: SPACING.sm,
  },
  sectionHeader: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textPrimary,
    fontWeight: '800',
    marginVertical: SPACING.xs,
  },
});
