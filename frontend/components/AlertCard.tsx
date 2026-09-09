import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Flame,
  Waves,
  CloudRain,
  Radio,
  ShieldAlert,
  Clock,
  Building2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react-native';
import { Hazard, Alert, SeverityLevel } from '../types/orca';
import { getSeverityTheme } from '../utils/formatting';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export interface AlertCardProps {
  hazard?: Hazard;
  alert?: Alert;
}

export const AlertCard: React.FC<AlertCardProps> = ({ hazard, alert }) => {
  const itemTitle = alert?.title || hazard?.title || '';
  const itemDesc = alert?.message || hazard?.description || '';
  const itemType = alert?.type || hazard?.type || 'Hazard';
  const rawSeverity = (alert?.severity || hazard?.severity || 'NONE').toUpperCase();
  const severity = (['CRITICAL', 'HIGH', 'MODERATE', 'MEDIUM', 'LOW', 'INFO', 'NONE'].includes(rawSeverity)
    ? rawSeverity
    : 'NONE') as SeverityLevel;
  const itemSource = alert?.source || hazard?.source;
  const itemUpdated = alert?.timestamp || hazard?.updated_at;

  const theme = getSeverityTheme(severity);
  const isNone = severity === 'NONE';

  const getHazardIcon = () => {
    const typeLower = itemType.toLowerCase();
    if (typeLower.includes('cyclone')) {
      return <Flame size={24} color={theme.accentColor} strokeWidth={2.4} />;
    }
    if (typeLower.includes('wave')) {
      return <Waves size={24} color={theme.accentColor} strokeWidth={2.4} />;
    }
    if (typeLower.includes('surge')) {
      return <CloudRain size={24} color={theme.accentColor} strokeWidth={2.4} />;
    }
    if (typeLower.includes('tsunami')) {
      return <Radio size={24} color={theme.accentColor} strokeWidth={2.4} />;
    }
    return <ShieldAlert size={24} color={theme.accentColor} strokeWidth={2.4} />;
  };

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: theme.borderColor,
          backgroundColor: isNone ? COLORS.cardBg : theme.bgColor,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.severityBadge}>
          <View
            style={[
              styles.severityPill,
              { backgroundColor: theme.bgColor, borderColor: theme.borderColor },
            ]}
          >
            {isNone ? (
              <CheckCircle2 size={14} color={theme.accentColor} />
            ) : (
              <AlertTriangle size={14} color={theme.accentColor} />
            )}
            <Text style={[styles.severityLabel, { color: theme.textColor }]}>
              {theme.label}
            </Text>
          </View>
        </View>

        <View style={styles.iconCircle}>{getHazardIcon()}</View>
      </View>

      <Text style={[styles.title, { color: COLORS.textPrimary }]}>
        {itemTitle}
      </Text>

      <Text style={styles.description}>
        {itemDesc}
      </Text>

      {(itemUpdated || itemSource) && (
        <View style={styles.footerRow}>
          {itemUpdated && (
            <View style={styles.footerItem}>
              <Clock size={13} color={COLORS.textTertiary} />
              <Text style={styles.footerText}>Updated: {itemUpdated}</Text>
            </View>
          )}

          {itemSource && (
            <View style={styles.footerItem}>
              <Building2 size={13} color={COLORS.textTertiary} />
              <Text style={styles.footerText}>Source: {itemSource}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginVertical: SPACING.sm,
    borderWidth: 1.5,
    ...SHADOWS.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  severityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  severityLabel: {
    ...TYPOGRAPHY.caption,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...TYPOGRAPHY.h3,
    fontSize: 19,
    marginBottom: 6,
  },
  description: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
    lineHeight: 21,
  },
  footerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    gap: 8,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  footerText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontSize: 12,
  },
});
