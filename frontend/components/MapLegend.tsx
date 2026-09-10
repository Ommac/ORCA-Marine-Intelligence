import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, Compass, MapPin, Radio, Layers } from 'lucide-react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { ActiveMapLayers } from '../types/orca';

export { ActiveMapLayers };

interface MapLegendProps {
  activeLayers: ActiveMapLayers;
  onToggleLayer: (key: keyof ActiveMapLayers) => void;
  pfzCount?: number;
}

export const MapLegend: React.FC<MapLegendProps> = ({
  activeLayers,
  onToggleLayer,
  pfzCount = 3,
}) => {
  const layerItems: Array<{
    key: keyof ActiveMapLayers;
    label: string;
    badge?: string;
    indicatorColor: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'pfz',
      label: 'PFZ Zones',
      badge: pfzCount > 0 ? `Top ${pfzCount}` : undefined,
      indicatorColor: '#10B981',
      icon: <Compass size={14} color="#10B981" />,
    },
    {
      key: 'fishingLocation',
      label: 'Fishing Location',
      badge: 'Target',
      indicatorColor: '#0066CC',
      icon: <MapPin size={14} color="#0066CC" />,
    },
    {
      key: 'distance',
      label: 'Distance & Bearing',
      badge: 'Lines',
      indicatorColor: '#38BDF8',
      icon: <Radio size={14} color="#0284C7" />,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Layers size={14} color={COLORS.oceanBlue} />
        <Text style={styles.headerTitle}>MAP LAYERS</Text>
      </View>

      <View style={styles.pillsRow}>
        {layerItems.map((item) => {
          const isActive = activeLayers[item.key] ?? true;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.pill,
                isActive ? styles.pillActive : styles.pillInactive,
              ]}
              onPress={() => onToggleLayer(item.key)}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isActive }}
              accessibilityLabel={`Toggle ${item.label}`}
            >
              <View
                style={[
                  styles.checkbox,
                  isActive
                    ? { backgroundColor: item.indicatorColor, borderColor: item.indicatorColor }
                    : styles.checkboxInactive,
                ]}
              >
                {isActive && <Check size={10} color="#FFFFFF" strokeWidth={3} />}
              </View>

              <Text
                style={[
                  styles.pillLabel,
                  isActive ? styles.pillLabelActive : styles.pillLabelInactive,
                ]}
              >
                {item.label}
              </Text>

              {item.badge && (
                <View
                  style={[
                    styles.badge,
                    isActive ? styles.badgeActive : styles.badgeInactive,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      isActive ? styles.badgeTextActive : styles.badgeTextInactive,
                    ]}
                  >
                    {item.badge}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  headerTitle: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
    fontSize: 11,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    gap: 7,
  },
  pillActive: {
    backgroundColor: '#F0F9FF',
    borderColor: '#7DD3FC',
  },
  pillInactive: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.65,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  checkboxInactive: {
    backgroundColor: 'transparent',
    borderColor: '#94A3B8',
  },
  pillLabel: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '700',
  },
  pillLabelActive: {
    color: COLORS.textPrimary,
  },
  pillLabelInactive: {
    color: COLORS.textSecondary,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeActive: {
    backgroundColor: '#E0F2FE',
  },
  badgeInactive: {
    backgroundColor: '#E2E8F0',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  badgeTextActive: {
    color: '#0284C7',
  },
  badgeTextInactive: {
    color: '#64748B',
  },
});


