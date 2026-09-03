import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Fish, MapPin, Compass, ArrowUpRight } from 'lucide-react-native';
import { PFZData } from '../types/orca';
import { formatDistance } from '../utils/formatting';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';

interface PFZCardProps {
  pfz?: PFZData;
  onViewOnMap?: () => void;
}

export const PFZCard: React.FC<PFZCardProps> = ({ pfz, onViewOnMap }) => {
  const isAvailable = pfz && pfz.available && pfz.nearest;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={styles.iconBox}>
            <Fish size={22} color="#16A34A" strokeWidth={2.4} />
          </View>
          <View>
            <Text style={styles.title}>Fishing Zone</Text>
            <Text style={styles.subtitle}>Potential Fishing Zone (INCOIS)</Text>
          </View>
        </View>

        {isAvailable && (
          <View style={styles.activePill}>
            <Text style={styles.activePillText}>Active Zone</Text>
          </View>
        )}
      </View>

      {isAvailable ? (
        <View style={styles.contentBody}>
          <View style={styles.metricRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Nearest Zone</Text>
              <Text style={styles.metricValue}>
                {formatDistance(pfz.nearest?.distance_km)}
              </Text>
            </View>

            <View style={styles.verticalDivider} />

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Direction</Text>
              <View style={styles.directionRow}>
                <Compass size={18} color={COLORS.oceanBlue} />
                <Text style={styles.metricValue}>
                  {pfz.nearest?.direction || 'W'}
                  {pfz.nearest?.bearing_degrees ? ` (${pfz.nearest.bearing_degrees.toFixed(0)}°)` : ''}
                </Text>
              </View>
            </View>
          </View>

          {onViewOnMap && (
            <TouchableOpacity
              style={styles.mapButton}
              onPress={onViewOnMap}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="View Fishing Zone on Map"
            >
              <Text style={styles.mapButtonText}>VIEW ON MAP</Text>
              <ArrowUpRight size={18} color={COLORS.oceanBlue} strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.unavailableBox}>
          <Text style={styles.unavailableText}>
            {pfz?.message || 'No active potential fishing zone detected nearby today.'}
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
    backgroundColor: '#DCFCE7',
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
  activePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  activePillText: {
    ...TYPOGRAPHY.caption,
    color: '#15803D',
    fontWeight: '800',
  },
  contentBody: {
    marginTop: 4,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  metricValue: {
    ...TYPOGRAPHY.statValue,
    color: COLORS.textPrimary,
    fontSize: 20,
  },
  directionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verticalDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.divider,
    marginHorizontal: 12,
  },
  mapButton: {
    marginTop: SPACING.md,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: COLORS.skyBlueBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapButtonText: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.oceanBlue,
    fontWeight: '800',
  },
  unavailableBox: {
    backgroundColor: COLORS.surfaceSubtle,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  unavailableText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
  },
});
