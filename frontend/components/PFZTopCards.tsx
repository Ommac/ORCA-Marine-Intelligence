import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Map, Navigation, Compass, CheckCircle2 } from 'lucide-react-native';
import { PFZCandidate } from '../types/orca';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { formatDistance } from '../utils/formatting';

interface PFZTopCardsProps {
  candidates?: PFZCandidate[];
  onSelect?: (candidate: PFZCandidate) => void;
  selectedRank?: number;
}

export const PFZTopCards: React.FC<PFZTopCardsProps> = ({
  candidates = [],
  onSelect,
  selectedRank = 1,
}) => {
  if (!candidates || candidates.length === 0) {
    return null;
  }

  const getRankMedal = (rank: number) => {
    switch (rank) {
      case 1:
        return { medal: '🥇', label: 'Nearest (Shortest Transit)', color: '#15803D', bg: '#DCFCE7', border: '#86EFAC' };
      case 2:
        return { medal: '🥈', label: 'Alternative Option #2', color: '#0369A1', bg: '#E0F2FE', border: '#BAE6FD' };
      case 3:
        return { medal: '🥉', label: 'Alternative Option #3', color: '#7C3AED', bg: '#F3E8FF', border: '#DDD6FE' };
      default:
        return { medal: '📍', label: `Option #${rank}`, color: '#475569', bg: '#F1F5F9', border: '#CBD5E1' };
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Compass size={16} color={COLORS.oceanBlue} />
        <Text style={styles.headerTitle}>
          {candidates.length === 1
            ? candidates[0].rank === 1
              ? 'Nearest Potential Fishing Zone (INCOIS)'
              : `Potential Fishing Zone #${candidates[0].rank} (INCOIS)`
            : 'Nearby Potential Fishing Zones (INCOIS)'}
        </Text>
      </View>

      <View style={styles.cardsList}>
        {candidates.map((cand) => {
          const rankInfo = getRankMedal(cand.rank);
          const isPrimary = cand.rank === 1 || cand.recommended;
          const isSelected = selectedRank === cand.rank;

          return (
            <View
              key={cand.id || `cand-${cand.rank}`}
              style={[
                styles.card,
                isPrimary && styles.cardPrimary,
                isSelected && styles.cardSelected,
              ]}
            >
              {/* Card Top Row: Badge & Distance */}
              <View style={styles.cardHeader}>
                <View style={[styles.rankBadge, { backgroundColor: rankInfo.bg, borderColor: rankInfo.border }]}>
                  <Text style={styles.rankMedal}>{rankInfo.medal}</Text>
                  <Text style={[styles.rankLabel, { color: rankInfo.color }]}>
                    {rankInfo.label}
                  </Text>
                </View>

                <View style={styles.distanceBlock}>
                  <Text style={styles.distanceValue}>
                    {formatDistance(cand.distance_km)}
                  </Text>
                  <Text style={styles.directionValue}>
                    {cand.direction || 'Sea'}
                    {cand.bearing_degrees !== undefined ? ` (${Math.round(cand.bearing_degrees)}°)` : ''}
                  </Text>
                </View>
              </View>

              {/* Recommendation Reason */}
              {cand.recommendation_reason && (
                <View style={styles.reasonRow}>
                  {isPrimary && <CheckCircle2 size={13} color="#15803D" style={{ marginTop: 2 }} />}
                  <Text style={[styles.reasonText, isPrimary && styles.reasonTextPrimary]}>
                    {cand.recommendation_reason}
                  </Text>
                </View>
              )}

              {/* Coordinates & Metadata */}
              <View style={styles.metaRow}>
                <Text style={styles.coordText}>
                  📍 {cand.coordinates?.latitude?.toFixed(3)}°N, {cand.coordinates?.longitude?.toFixed(3)}°E
                </Text>
                {cand.category && (
                  <Text style={styles.categoryBadge}>{cand.category}</Text>
                )}
              </View>

              {/* Action Button: Show on Map */}
              <TouchableOpacity
                style={[styles.mapButton, isPrimary ? styles.mapButtonPrimary : styles.mapButtonSecondary]}
                onPress={() => onSelect?.(cand)}
                activeOpacity={0.8}
                accessibilityLabel={`Show ${cand.label || `PFZ ${cand.rank}`} on map`}
              >
                <Map size={14} color={isPrimary ? '#FFFFFF' : COLORS.oceanBlue} />
                <Text style={[styles.mapButtonText, isPrimary ? styles.mapButtonTextPrimary : styles.mapButtonTextSecondary]}>
                  SHOW ON MAP
                </Text>
                <Navigation size={12} color={isPrimary ? '#93C5FD' : COLORS.oceanBlue} />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  headerTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardsList: {
    gap: 10,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardPrimary: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  cardSelected: {
    borderColor: COLORS.oceanBlue,
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  rankMedal: {
    fontSize: 13,
  },
  rankLabel: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
    fontSize: 11,
  },
  distanceBlock: {
    alignItems: 'flex-end',
  },
  distanceValue: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '800',
    color: COLORS.textPrimary,
    fontSize: 15,
  },
  directionValue: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginVertical: 4,
  },
  reasonText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  reasonTextPrimary: {
    color: '#166534',
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  coordText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    fontSize: 11,
  },
  categoryBadge: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    fontWeight: '600',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
  },
  mapButtonPrimary: {
    backgroundColor: COLORS.oceanBlue,
  },
  mapButtonSecondary: {
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  mapButtonText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  mapButtonTextPrimary: {
    color: '#FFFFFF',
  },
  mapButtonTextSecondary: {
    color: COLORS.oceanBlue,
  },
});
