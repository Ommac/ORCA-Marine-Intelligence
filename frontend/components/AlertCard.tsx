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
  Anchor,
  Gauge,
} from 'lucide-react-native';
import { Alert } from '../types/orca';
import { getSeverityTheme } from '../utils/formatting';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';

interface AlertCardProps {
  alert: Alert;
}

export const AlertCard: React.FC<AlertCardProps> = ({ alert }) => {
  const theme = getSeverityTheme(alert.severity.toUpperCase());

  const getAlertIcon = () => {
    const typeLower = alert.type.toLowerCase();
    const titleLower = alert.title.toLowerCase();
    if (titleLower.includes('cyclone')) {
      return <Flame size={24} color={theme.accentColor} strokeWidth={2.4} />;
    }
    if (titleLower.includes('wave')) {
      return <Waves size={24} color={theme.accentColor} strokeWidth={2.4} />;
    }
    if (titleLower.includes('wind') || titleLower.includes('gust')) {
      return <CloudRain size={24} color={theme.accentColor} strokeWidth={2.4} />;
    }
    if (titleLower.includes('tsunami')) {
      return <Radio size={24} color={theme.accentColor} strokeWidth={2.4} />;
    }
    if (typeLower === 'vessel') {
      return <Anchor size={24} color={theme.accentColor} strokeWidth={2.4} />;
    }
    if (typeLower === 'risk') {
      return <Gauge size={24} color={theme.accentColor} strokeWidth={2.4} />;
    }
    return <ShieldAlert size={24} color={theme.accentColor} strokeWidth={2.4} />;
  };

  // Format source name for display
  const formatSource = (source: string): string => {
    const sourceMap: Record<string, string> = {
      marine_weather: 'Marine Weather Assessment',
      ocean_analysis: 'Ocean Analysis Agent',
      svas: 'INCOIS SVAS Advisory',
      risk_engine: 'ORCA Risk Engine',
    };
    return sourceMap[source] || source;
  };

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: theme.borderColor,
          backgroundColor: theme.bgColor,
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
            <AlertTriangle size={14} color={theme.accentColor} />
            <Text style={[styles.severityLabel, { color: theme.textColor }]}>
              {theme.label}
            </Text>
          </View>
        </View>

        <View style={styles.iconCircle}>{getAlertIcon()}</View>
      </View>

      <Text style={[styles.title, { color: COLORS.textPrimary }]}>
        {alert.title}
      </Text>

      <Text style={styles.description}>
        {alert.message}
      </Text>

      {alert.action && (
        <View style={styles.actionBox}>
          <Text style={styles.actionLabel}>⚓ RECOMMENDED ACTION</Text>
          <Text style={styles.actionText}>{alert.action}</Text>
        </View>
      )}

      <View style={styles.footerRow}>
        {alert.source && (
          <View style={styles.footerItem}>
            <Building2 size={13} color={COLORS.textTertiary} />
            <Text style={styles.footerText}>{formatSource(alert.source)}</Text>
          </View>
        )}

        {alert.timestamp && (
          <View style={styles.footerItem}>
            <Clock size={13} color={COLORS.textTertiary} />
            <Text style={styles.footerText}>
              {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}
      </View>
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
  actionBox: {
    marginTop: SPACING.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.oceanBlue,
  },
  actionLabel: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
    color: COLORS.oceanBlue,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  actionText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    lineHeight: 20,
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
