import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Fish, MapPin, Compass, ArrowUpRight } from 'lucide-react-native';
import { PFZData, PFZCandidate } from '../types/orca';
import { formatDistanceKm } from '../utils/formatting';
import { getSelectedPFZId } from '../services/assessmentStore';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export interface PFZCardProps {
  pfz?: PFZData;
  candidate?: PFZCandidate | null;
  onViewOnMap?: () => void;
  title?: string;
}

export const PFZCard: React.FC<PFZCardProps> = ({ pfz, candidate, onViewOnMap, title }) => {
  // Resolve active candidate: explicit candidate prop -> selected candidate from store -> first candidate -> pfz.nearest
  const activeCandidate =
    candidate !== undefined
      ? candidate
      : pfz?.top_candidates?.find((c) => c.id === getSelectedPFZId()) ||
        pfz?.top_candidates?.[0] ||
        null;

  const isAvailable = Boolean(
    (activeCandidate && activeCandidate.distance_km !== undefined) ||
    (pfz && pfz.available && pfz.nearest)
  );

  const displayDistance = activeCandidate ? activeCandidate.distance_km : pfz?.nearest?.distance_km;
  const displayDirection = activeCandidate ? activeCandidate.direction : pfz?.nearest?.direction;
  const displayBearing = activeCandidate ? activeCandidate.bearing_degrees : pfz?.nearest?.bearing_degrees;
  const displayRank = activeCandidate?.rank;
  const displayCoords = activeCandidate?.coordinates || (pfz?.nearest ? { latitude: pfz.nearest.latitude, longitude: pfz.nearest.longitude } : null);

  const cardTitle = title || (displayRank && displayRank > 1 ? `Fishing Zone #${displayRank}` : 'Fishing Zone');
  const metricLabel = displayRank && displayRank > 1 ? `Selected Zone #${displayRank}` : (activeCandidate?.recommended ? 'Recommended Zone' : 'Nearest Zone');
  const pillLabel = activeCandidate?.recommended ? 'Recommended Zone' : displayRank ? `Option #${displayRank}` : 'Active Zone';

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View style={styles.iconBox}>
            <Fish size={22} color="#16A34A" strokeWidth={2.4} />
          </View>
          <View>
            <Text style={styles.title}>{cardTitle}</Text>
            <Text style={styles.subtitle}>
              {displayRank && displayRank > 1 ? `Target Option #${displayRank} (INCOIS)` : 'Latest Satellite Observation (INCOIS)'}
            </Text>
          </View>
        </View>

        {isAvailable && (
          <View style={styles.activePill}>
            <Text style={styles.activePillText}>{pillLabel}</Text>
          </View>
        )}
      </View>

      {isAvailable ? (
        <View style={styles.contentBody}>
          <View style={styles.metricRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>{metricLabel}</Text>
              <Text style={styles.metricValue}>
                {formatDistanceKm(displayDistance)}
              </Text>
            </View>

            <View style={styles.verticalDivider} />

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Direction</Text>
              <View style={styles.directionRow}>
                <Compass size={18} color={COLORS.oceanBlue} />
                <Text style={styles.metricValue}>
                  {displayDirection || 'W'}
                  {displayBearing !== undefined && displayBearing !== null ? ` (${Math.round(displayBearing)}°)` : ''}
                </Text>
              </View>
            </View>
          </View>

          {displayCoords && (
            <View style={styles.coordRow}>
              <MapPin size={13} color={COLORS.textSecondary} />
              <Text style={styles.coordText}>
                Target: {displayCoords.latitude.toFixed(3)}°N, {displayCoords.longitude.toFixed(3)}°E
              </Text>
            </View>
          )}

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
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  coordText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
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
