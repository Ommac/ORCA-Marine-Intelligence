import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock, Building2 } from 'lucide-react-native';
import { OrcaAlert } from '../../types/orca';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { getAlertSeverityTheme, formatAlertTime } from '../../utils/formatting';
import { WhyThisAlert } from './WhyThisAlert';
import { DistanceDirectionRow } from './DistanceDirectionRow';

interface ActiveAlertCardProps {
  alert: OrcaAlert;
  showEvidence?: boolean;
}

export const ActiveAlertCard: React.FC<ActiveAlertCardProps> = ({ 
  alert, 
  showEvidence = false 
}) => {
  const theme = getAlertSeverityTheme(alert.severity);

  return (
    <View style={[styles.card, { borderLeftColor: theme.accentColor }]}>
      <View style={styles.header}>
        <View style={[styles.pill, { backgroundColor: theme.pillBg }]}>
          <Text style={[styles.pillText, { color: theme.pillText }]}>{theme.label}</Text>
        </View>
        {alert.icon && <Text style={styles.icon}>{alert.icon}</Text>}
      </View>

      <Text style={styles.title}>{alert.title}</Text>
      {alert.subtitle && <Text style={styles.subtitle}>{alert.subtitle}</Text>}

      {(alert.distance || alert.direction) && (
        <View style={styles.distanceRow}>
          <DistanceDirectionRow 
            distance={alert.distance} 
            direction={alert.direction} 
          />
        </View>
      )}

      <View style={[styles.adviceBanner, { backgroundColor: theme.pillBg }]}>
        <Text style={[styles.adviceText, { color: theme.textColor }]}>
          {alert.advice}
        </Text>
      </View>

      {alert.evidence && alert.evidence.length > 0 && (
        <WhyThisAlert 
          evidence={alert.evidence} 
          advice={alert.advice}
          source={alert.source}
        />
      )}

      <View style={styles.footer}>
        {alert.source && (
          <View style={styles.footerItem}>
            <Building2 size={14} color={COLORS.textTertiary} />
            <Text style={styles.footerText}>{alert.source}</Text>
          </View>
        )}
        {alert.updatedAt && (
          <View style={styles.footerItem}>
            <Clock size={14} color={COLORS.textTertiary} />
            <Text style={styles.footerText}>{formatAlertTime(alert.updatedAt)}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.md,
    borderLeftWidth: 4,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  pill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  pillText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
  },
  icon: {
    fontSize: 20,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  distanceRow: {
    marginBottom: SPACING.sm,
  },
  adviceBanner: {
    padding: SPACING.md,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.sm,
  },
  adviceText: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
  },
});
