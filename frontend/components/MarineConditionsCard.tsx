import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Wind,
  Waves,
  Thermometer,
  Gauge,
  Compass,
  Zap,
} from 'lucide-react-native';
import { MarineData } from '../types/orca';
import {
  formatKnots,
  formatMeters,
  formatSeconds,
  formatTemperature,
  formatKmh,
  formatDegreesToCompass,
} from '../utils/formatting';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';

interface MarineConditionsCardProps {
  marine?: MarineData;
}

export const MarineConditionsCard: React.FC<MarineConditionsCardProps> = ({
  marine,
}) => {
  const isAvailable = marine && marine.available;

  // Condition evaluation helpers for fisherman readability
  const getWaveStatus = (h?: number) => {
    if (h === undefined || h === null) return null;
    if (h < 1.5) return { label: 'Calm', bg: COLORS.safeBg, text: COLORS.safeText, border: COLORS.safeBorder };
    if (h <= 2.5) return { label: 'Moderate', bg: COLORS.cautionBg, text: COLORS.cautionText, border: COLORS.cautionBorder };
    return { label: 'Rough', bg: COLORS.dangerBg, text: COLORS.dangerText, border: COLORS.dangerBorder };
  };

  const getWindStatus = (w?: number) => {
    if (w === undefined || w === null) return null;
    if (w < 15) return { label: 'Light', bg: COLORS.safeBg, text: COLORS.safeText, border: COLORS.safeBorder };
    if (w <= 22) return { label: 'Moderate', bg: COLORS.cautionBg, text: COLORS.cautionText, border: COLORS.cautionBorder };
    return { label: 'Strong', bg: COLORS.dangerBg, text: COLORS.dangerText, border: COLORS.dangerBorder };
  };

  const getGustStatus = (g?: number) => {
    if (g === undefined || g === null) return null;
    if (g < 20) return { label: 'Safe', bg: COLORS.safeBg, text: COLORS.safeText, border: COLORS.safeBorder };
    if (g <= 30) return { label: 'Breezy', bg: COLORS.cautionBg, text: COLORS.cautionText, border: COLORS.cautionBorder };
    return { label: 'Gale', bg: COLORS.dangerBg, text: COLORS.dangerText, border: COLORS.dangerBorder };
  };

  const getCurrentStatus = (c?: number) => {
    if (c === undefined || c === null) return null;
    if (c < 2.0) return { label: 'Gentle', bg: COLORS.safeBg, text: COLORS.safeText, border: COLORS.safeBorder };
    if (c <= 4.0) return { label: 'Moderate', bg: COLORS.cautionBg, text: COLORS.cautionText, border: COLORS.cautionBorder };
    return { label: 'Strong', bg: COLORS.dangerBg, text: COLORS.dangerText, border: COLORS.dangerBorder };
  };

  const waveBadge = getWaveStatus(marine?.wave_height_m);
  const windBadge = getWindStatus(marine?.wind_speed_knots);
  const gustBadge = getGustStatus(marine?.wind_gusts_knots);
  const currentBadge = getCurrentStatus(marine?.ocean_current_velocity_kmh);

  const conditions = [
    {
      id: 'waves',
      label: 'Wave Height',
      value: formatMeters(marine?.wave_height_m),
      sublabel: marine?.wave_direction_degrees
        ? `Swell from ${formatDegreesToCompass(marine.wave_direction_degrees)} (${marine.wave_direction_degrees}°)`
        : 'Surface swell',
      icon: <Waves size={18} color={COLORS.oceanBlue} />,
      statusBadge: waveBadge,
    },
    {
      id: 'wind',
      label: 'Wind Speed',
      value: formatKnots(marine?.wind_speed_knots),
      sublabel: marine?.wind_direction_degrees
        ? `From ${formatDegreesToCompass(marine.wind_direction_degrees)} (${marine.wind_direction_degrees}°)`
        : 'Direction N/A',
      icon: <Wind size={18} color={COLORS.oceanBlue} />,
      statusBadge: windBadge,
    },
    {
      id: 'gusts',
      label: 'Strongest Gusts',
      value: formatKnots(marine?.wind_gusts_knots),
      sublabel: 'Peak gust velocity',
      icon: <Zap size={18} color="#EA580C" />,
      statusBadge: gustBadge,
    },
    {
      id: 'wave_period',
      label: 'Wave Period',
      value: formatSeconds(marine?.wave_period_seconds),
      sublabel: 'Time between wave crests',
      icon: <Gauge size={18} color="#0D9488" />,
      statusBadge: null,
    },
    {
      id: 'sst',
      label: 'Sea Temperature',
      value: formatTemperature(
        marine?.sea_surface_temperature_c ?? marine?.temperature_c
      ),
      sublabel: 'Surface SST',
      icon: <Thermometer size={18} color="#E11D48" />,
      statusBadge: null,
    },
    {
      id: 'current',
      label: 'Ocean Current',
      value: formatKmh(marine?.ocean_current_velocity_kmh),
      sublabel: marine?.ocean_current_direction_degrees
        ? `Heading ${formatDegreesToCompass(marine.ocean_current_direction_degrees)}`
        : 'Ocean drift',
      icon: <Compass size={18} color="#2563EB" />,
      statusBadge: currentBadge,
    },
  ];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={styles.iconBox}>
            <Waves size={22} color={COLORS.oceanBlue} strokeWidth={2.4} />
          </View>
          <View>
            <Text style={styles.title}>Sea Conditions</Text>
            <Text style={styles.subtitle}>Real-time marine & ocean forecast</Text>
          </View>
        </View>

        {isAvailable && (
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceText}>Open-Meteo</Text>
          </View>
        )}
      </View>

      {isAvailable ? (
        <View style={styles.grid}>
          {conditions.map((item) => (
            <View key={item.id} style={styles.gridItem}>
              <View style={styles.itemHeader}>
                <View style={styles.itemHeaderLeft}>
                  {item.icon}
                  <Text style={styles.itemLabel}>{item.label}</Text>
                </View>
                {item.statusBadge && (
                  <View
                    style={[
                      styles.miniBadge,
                      {
                        backgroundColor: item.statusBadge.bg,
                        borderColor: item.statusBadge.border,
                      },
                    ]}
                  >
                    <Text style={[styles.miniBadgeText, { color: item.statusBadge.text }]}>
                      {item.statusBadge.label}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.itemValue}>{item.value}</Text>
              <Text style={styles.itemSublabel} numberOfLines={1}>
                {item.sublabel}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.unavailableBox}>
          <Text style={styles.unavailableText}>
            Marine weather data currently unavailable for this coastal zone.
          </Text>
        </View>
      )}
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
    justifyContent: 'space-between',
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
    backgroundColor: '#E0F2FE',
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
  sourceBadge: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  sourceText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridItem: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  miniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
  },
  miniBadgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    fontWeight: '800',
  },
  itemLabel: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  itemValue: {
    ...TYPOGRAPHY.statValue,
    color: COLORS.textPrimary,
    fontSize: 19,
    marginTop: 2,
  },
  itemSublabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    marginTop: 4,
    fontSize: 11,
  },
  unavailableBox: {
    backgroundColor: COLORS.surfaceSubtle,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  unavailableText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
  },
});
