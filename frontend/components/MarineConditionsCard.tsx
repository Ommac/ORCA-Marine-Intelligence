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

  const conditions = [
    {
      id: 'wind',
      label: 'Wind',
      value: formatKnots(marine?.wind_speed_knots),
      sublabel: marine?.wind_direction_degrees
        ? `From ${formatDegreesToCompass(marine.wind_direction_degrees)} (${marine.wind_direction_degrees}°)`
        : 'Direction N/A',
      icon: <Wind size={20} color={COLORS.oceanBlue} />,
    },
    {
      id: 'gusts',
      label: 'Strongest wind',
      value: formatKnots(marine?.wind_gusts_knots),
      sublabel: 'Peak gusts',
      icon: <Zap size={20} color="#EA580C" />,
    },
    {
      id: 'waves',
      label: 'Waves',
      value: formatMeters(marine?.wave_height_m),
      sublabel: marine?.wave_direction_degrees
        ? `Swell from ${formatDegreesToCompass(marine.wave_direction_degrees)}`
        : 'Surface swell',
      icon: <Waves size={20} color={COLORS.oceanBlue} />,
    },
    {
      id: 'wave_period',
      label: 'Wave period',
      value: formatSeconds(marine?.wave_period_seconds),
      sublabel: 'Time between waves',
      icon: <Gauge size={20} color="#0D9488" />,
    },
    {
      id: 'sst',
      label: 'Sea temperature',
      value: formatTemperature(
        marine?.sea_surface_temperature_c ?? marine?.temperature_c
      ),
      sublabel: 'Surface SST',
      icon: <Thermometer size={20} color="#E11D48" />,
    },
    {
      id: 'current',
      label: 'Current',
      value: formatKmh(marine?.ocean_current_velocity_kmh),
      sublabel: marine?.ocean_current_direction_degrees
        ? `Heading ${formatDegreesToCompass(marine.ocean_current_direction_degrees)}`
        : 'Ocean drift',
      icon: <Compass size={20} color="#2563EB" />,
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
            <Text style={styles.subtitle}>Real-time marine forecast</Text>
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
                {item.icon}
                <Text style={styles.itemLabel}>{item.label}</Text>
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
    gap: 6,
    marginBottom: 4,
  },
  itemLabel: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  itemValue: {
    ...TYPOGRAPHY.statValue,
    color: COLORS.textPrimary,
    fontSize: 20,
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
