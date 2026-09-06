import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertOctagon, AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import { AssessmentStatus, AlertSeverityLevel } from '../../types/orca';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { getStatusTheme } from '../../utils/formatting';

interface AlertSummaryBannerProps {
  assessmentStatus: AssessmentStatus;
  riskScore: number;
  alertCounts: Record<AlertSeverityLevel, number>;
  totalActiveAlerts: number;
}

export const AlertSummaryBanner: React.FC<AlertSummaryBannerProps> = ({
  assessmentStatus,
  riskScore,
  alertCounts,
  totalActiveAlerts
}) => {
  const hasCriticalOrHigh = (alertCounts['CRITICAL'] || 0) > 0 || (alertCounts['HIGH'] || 0) > 0;
  const isHighRisk = assessmentStatus === 'NOT_RECOMMENDED' || assessmentStatus === 'HIGH_RISK';
  const hasCaution = (alertCounts['CAUTION'] || 0) > 0;
  
  let bgColor = COLORS.safeBg;
  let borderColor = COLORS.safeBorder;
  let textColor = COLORS.safeText;
  let IconComponent = CheckCircle2;
  let statusText = 'SAFE';

  if (hasCriticalOrHigh || isHighRisk) {
    bgColor = COLORS.dangerBg;
    borderColor = COLORS.dangerBorder;
    textColor = COLORS.dangerText;
    IconComponent = AlertOctagon;
    statusText = isHighRisk ? 'NOT RECOMMENDED' : 'HIGH RISK';
  } else if (hasCaution || assessmentStatus === 'CAUTION') {
    bgColor = COLORS.cautionBg;
    borderColor = COLORS.cautionBorder;
    textColor = COLORS.cautionText;
    IconComponent = AlertTriangle;
    statusText = 'CAUTION';
  }

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderColor }]}>
      <View style={styles.topRow}>
        <IconComponent size={32} color={textColor} />
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: textColor }]}>
            {statusText}
          </Text>
          <Text style={[styles.subtitle, { color: textColor }]}>
            {totalActiveAlerts} Active Alert{totalActiveAlerts !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>
      <View style={styles.footerRow}>
        <Text style={[styles.footerText, { color: textColor }]}>
          Monitored via INCOIS, IMD & Maritime Safety Network
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  textContainer: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  title: {
    ...TYPOGRAPHY.h2,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '700',
  },
  footerRow: {
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  footerText: {
    ...TYPOGRAPHY.caption,
    opacity: 0.8,
  }
});
