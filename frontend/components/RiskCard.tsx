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

  const renderIcon = () => {
    switch (assessment.status) {
      case 'SAFE':
        return <CheckCircle2 size={44} color={statusTheme.accentColor} strokeWidth={2.5} />;
      case 'CAUTION':
        return <AlertTriangle size={44} color={statusTheme.accentColor} strokeWidth={2.5} />;
      case 'NOT_RECOMMENDED':
      default:
        return <AlertOctagon size={44} color={statusTheme.accentColor} strokeWidth={2.5} />;
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
            <Text style={[styles.scoreBadge, { color: statusTheme.textColor }]}>
              {statusTheme.subtitle} • {assessment.risk_score}/100
            </Text>
          </View>
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
    marginVertical: SPACING.md,
    borderWidth: 2,
    ...SHADOWS.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCol: {
    flex: 1,
  },
  statusText: {
    ...TYPOGRAPHY.heroBadge,
    fontSize: 26,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  scoreBadge: {
    ...TYPOGRAPHY.caption,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginVertical: SPACING.md,
  },
  summaryText: {
    ...TYPOGRAPHY.bodyLarge,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
});
