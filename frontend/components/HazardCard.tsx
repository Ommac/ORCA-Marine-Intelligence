import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  AlertTriangle,
  Flame,
  Shield,
  Waves,
  CloudRain,
  Radio,
  CheckCircle2,
} from 'lucide-react-native';
import { Hazard, SeverityLevel } from '../types/orca';
import { getSeverityTheme } from '../utils/formatting';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';

interface HazardCardProps {
  hazards?: Hazard[];
}

export const HazardCard: React.FC<HazardCardProps> = ({ hazards = [] }) => {
  // Standard hazard baseline monitors
  const standardTypes = [
    { type: 'Cyclone', defaultTitle: 'Cyclone Threat', icon: <Flame size={18} color="#DC2626" /> },
    { type: 'Tsunami', defaultTitle: 'Tsunami Warning', icon: <Radio size={18} color="#2563EB" /> },
    { type: 'Storm Surge', defaultTitle: 'Storm Surge', icon: <Waves size={18} color="#0D9488" /> },
    { type: 'High Waves', defaultTitle: 'High Waves', icon: <CloudRain size={18} color="#D97706" /> },
  ];

  // Map known hazards or provide defaults
  const items = standardTypes.map((std) => {
    const found = hazards.find(
      (h) => h.type.toLowerCase().includes(std.type.toLowerCase()) ||
             std.type.toLowerCase().includes(h.type.toLowerCase())
    );

    return {
      type: std.type,
      title: found?.title || std.defaultTitle,
      severity: (found?.severity || 'NONE') as SeverityLevel,
      description: found?.description || 'No active alerts detected',
      icon: std.icon,
    };
  });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={styles.iconBox}>
            <AlertTriangle size={22} color="#DC2626" strokeWidth={2.4} />
          </View>
          <View>
            <Text style={styles.title}>Hazards & Warnings</Text>
            <Text style={styles.subtitle}>Emergency coastal alert feed</Text>
          </View>
        </View>
      </View>

      <View style={styles.list}>
        {items.map((item, index) => {
          const theme = getSeverityTheme(item.severity);
          const isSafe = item.severity === 'NONE' || item.severity === 'LOW';

          return (
            <View
              key={item.type}
              style={[
                styles.itemRow,
                index === items.length - 1 && styles.lastItemRow,
              ]}
            >
              <View style={styles.itemLeft}>
                <View style={styles.typeIconBox}>{item.icon}</View>
                <View style={styles.textCol}>
                  <Text style={styles.itemTitle}>{item.type}</Text>
                  <Text style={styles.itemDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.severityPill,
                  {
                    backgroundColor: theme.bgColor,
                    borderColor: theme.borderColor,
                  },
                ]}
              >
                {isSafe ? (
                  <CheckCircle2 size={13} color={theme.accentColor} />
                ) : (
                  <AlertTriangle size={13} color={theme.accentColor} />
                )}
                <Text style={[styles.severityText, { color: theme.textColor }]}>
                  {theme.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  list: {
    marginTop: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  lastItemRow: {
    borderBottomWidth: 0,
    paddingBottom: 4,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  typeIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textCol: {
    flex: 1,
  },
  itemTitle: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  itemDesc: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  severityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  severityText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
  },
});
