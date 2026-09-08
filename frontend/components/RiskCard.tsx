import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle2, AlertTriangle, AlertOctagon, ShieldAlert } from 'lucide-react-native';
import { Assessment } from '../types/orca';
import { getStatusTheme } from '../utils/formatting';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';

interface RiskCardProps {
  assessment?: Assessment;
}

export const RiskCard: React.FC<RiskCardProps> = ({ assessment }) => {
  if (!assessment) {
    return null;
  }

  const statusTheme = getStatusTheme(assessment.status);
  const score = Math.min(Math.max(assessment.risk_score || 0, 0), 100);

  const renderIcon = () => {
    switch (assessment.status) {
      case 'SAFE':
        return <CheckCircle2 size={36} color={statusTheme.accentColor} strokeWidth={2.6} />;
      case 'CAUTION':
        return <AlertTriangle size={36} color={statusTheme.accentColor} strokeWidth={2.6} />;
      case 'NOT_RECOMMENDED':
      default:
        return <AlertOctagon size={36} color={statusTheme.accentColor} strokeWidth={2.6} />;
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: statusTheme.bgColor,
          borderColor: statusTheme.borderColor,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.iconWrapper}>{renderIcon()}</View>

        <View style={styles.statusCol}>
          <Text style={[styles.statusText, { color: statusTheme.textColor }]}>
            {statusTheme.label}
          </Text>

          <View style={styles.scoreRow}>
            <View
              style={[
                styles.scorePill,
                { backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: statusTheme.borderColor },
              ]}
            >
              <Text style={[styles.scoreBadge, { color: statusTheme.textColor }]}>
                {statusTheme.subtitle} • {score}/100 Risk Score
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Visual Risk Progress Bar */}
      <View style={styles.meterContainer}>
        <View style={styles.meterTrack}>
          <View
            style={[
              styles.meterFill,
              {
                width: `${score}%`,
                backgroundColor: statusTheme.accentColor,
              },
            ]}
          />
        </View>
        <View style={styles.meterLabels}>
          <Text style={styles.meterLabelText}>0 (Low Risk)</Text>
          <Text style={styles.meterLabelText}>100 (Critical)</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <Text style={[styles.summaryText, { color: statusTheme.textColor }]}>
        {assessment.summary || statusTheme.friendlyMessage}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginVertical: SPACING.sm,
    borderWidth: 2,
    ...SHADOWS.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrapper: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  statusCol: {
    flex: 1,
  },
  statusText: {
    ...TYPOGRAPHY.heroBadge,
    fontSize: 22,
    letterSpacing: 0.3,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  scorePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  scoreBadge: {
    ...TYPOGRAPHY.caption,
    fontSize: 11.5,
    fontWeight: '800',
  },
  meterContainer: {
    marginTop: SPACING.md,
  },
  meterTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
  },
  meterLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  meterLabelText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    color: COLORS.textTertiary,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginVertical: SPACING.md,
  },
  summaryText: {
    ...TYPOGRAPHY.bodyLarge,
    fontSize: 14.5,
    lineHeight: 21,
    fontWeight: '600',
  },
});
