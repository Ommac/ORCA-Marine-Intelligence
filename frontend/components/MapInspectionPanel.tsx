import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Compass, MapPin, ChevronRight, Sparkles, ExternalLink } from 'lucide-react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { SelectedMapObject, OrcaResponse, PFZCandidate } from '../types/orca';
import { formatCoordinates, calculateDistanceKm, calculateBearing, getCardinalDirection } from '../utils/geo';
import { formatDistance } from '../utils/formatting';

interface MapInspectionPanelProps {
  selectedObject: SelectedMapObject | null;
  response: OrcaResponse;
  onSelectCandidate?: (cand: PFZCandidate) => void;
  onViewAssessmentDetails?: (candidate?: PFZCandidate) => void;
}

export const MapInspectionPanel: React.FC<MapInspectionPanelProps> = ({
  selectedObject,
  response,
  onSelectCandidate,
  onViewAssessmentDetails,
}) => {
  const activeTrip = response.request;
  const fisherLat = activeTrip?.latitude ?? 19.72;
  const fisherLon = activeTrip?.longitude ?? 72.70;

  // Extract Top 3 PFZs
  const top3Candidates: PFZCandidate[] = React.useMemo(() => {
    let rawCands: PFZCandidate[] = [];

    if (response?.pfz?.top_candidates && response.pfz.top_candidates.length > 0) {
      rawCands = response.pfz.top_candidates;
    } else if (response?.top_pfz && response.top_pfz.length > 0) {
      rawCands = response.top_pfz;
    } else if (response?.pfz?.nearest) {
      const nr = response.pfz.nearest;
      rawCands = [
        {
          id: 'pfz-cand-1',
          rank: 1,
          label: 'PFZ #1',
          distance_km: nr.distance_km,
          bearing_degrees: nr.bearing_degrees,
          direction: nr.direction,
          coordinates: { latitude: nr.latitude, longitude: nr.longitude },
          recommended: true,
        },
      ];
    }

    const sliced = rawCands.slice(0, 3);

    return sliced.map((cand, idx) => {
      const rank = cand.rank || idx + 1;
      const dist = calculateDistanceKm(fisherLat, fisherLon, cand.coordinates.latitude, cand.coordinates.longitude);
      const bearing = calculateBearing(fisherLat, fisherLon, cand.coordinates.latitude, cand.coordinates.longitude);
      const dir = getCardinalDirection(bearing);

      return {
        ...cand,
        id: cand.id || `pfz-cand-${rank}`,
        rank,
        label: `PFZ #${rank}`,
        distance_km: dist,
        bearing_degrees: bearing,
        direction: dir,
        recommended: rank === 1,
      };
    });
  }, [response?.pfz?.top_candidates, response?.top_pfz, response?.pfz?.nearest, fisherLat, fisherLon]);

  return (
    <View style={styles.card}>
      {/* 1. Selected Fishing Location Header */}
      <View style={styles.spotSection}>
        <View style={styles.spotLeft}>
          <View style={styles.pinCircle}>
            <MapPin size={18} color="#0066CC" />
          </View>
          <View style={styles.spotTextWrap}>
            <Text style={styles.sectionHeaderLabel}>🎣 Fishing Location</Text>
            <Text style={styles.spotCoords}>{formatCoordinates(fisherLat, fisherLon)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      {/* 2. Top 3 Recommended PFZs */}
      <View style={styles.pfzSection}>
        <View style={styles.pfzHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <Compass size={15} color="#15803D" />
            <Text style={styles.pfzSectionTitle}>RECOMMENDED PFZS</Text>
          </View>
          <Text style={styles.pfzInstruction}>Tap to view route</Text>
        </View>

        {top3Candidates.length > 0 ? (
          <View style={styles.candidateList}>
            {top3Candidates.map((cand) => {
              const isSelected = selectedObject?.type === 'pfz' && selectedObject.candidate?.rank === cand.rank;

              return (
                <TouchableOpacity
                  key={`card-cand-${cand.rank}`}
                  style={[
                    styles.candRow,
                    isSelected && styles.candRowSelected,
                  ]}
                  onPress={() => onSelectCandidate?.(cand)}
                  activeOpacity={0.7}
                >
                  <View style={styles.candLeft}>
                    <View
                      style={[
                        styles.rankBadge,
                        cand.rank === 1 ? styles.rankBadgeGold : styles.rankBadgeBlue,
                        isSelected && styles.rankBadgeSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.rankBadgeText,
                          isSelected && styles.rankBadgeTextSelected,
                        ]}
                      >
                        {cand.rank === 1 ? '🥇 #1' : `#${cand.rank}`}
                      </Text>
                    </View>

                    <View style={styles.candInfo}>
                      <Text style={styles.candDistance}>
                        {formatDistance(cand.distance_km)} {cand.direction}
                      </Text>
                      <Text style={styles.candCoords}>
                        {formatCoordinates(cand.coordinates.latitude, cand.coordinates.longitude)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.candRight}>
                    {(cand.rank === 1 || isSelected) && (
                      <View
                        style={[
                          styles.recommendedPill,
                          isSelected && { backgroundColor: '#15803D' },
                        ]}
                      >
                        <Text style={styles.recommendedPillText}>
                          {isSelected ? 'SELECTED' : 'HOTSPOT'}
                        </Text>
                      </View>
                    )}
                    <ChevronRight size={16} color={isSelected ? '#15803D' : '#94A3B8'} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyPfzBox}>
            <Text style={styles.emptyPfzText}>No active PFZ advisory available for this date.</Text>
          </View>
        )}

        {/* Selected PFZ Detail callout if any selected */}
        {selectedObject?.type === 'pfz' && selectedObject.candidate && (
          <View style={styles.selectedDetailBox}>
            <View style={styles.selectedDetailHeader}>
              <Sparkles size={14} color="#15803D" />
              <Text style={styles.selectedDetailTitle}>
                PFZ #{selectedObject.candidate.rank} Details
              </Text>
            </View>

            {selectedObject.candidate.recommendation_reason && (
              <Text style={styles.selectedDetailReason}>
                {selectedObject.candidate.recommendation_reason}
              </Text>
            )}

            {onViewAssessmentDetails && (
              <TouchableOpacity
                style={styles.viewAssessmentBtn}
                onPress={() => onViewAssessmentDetails(selectedObject.candidate)}
                activeOpacity={0.75}
              >
                <Text style={styles.viewAssessmentBtnText}>
                  View Full Assessment for PFZ #{selectedObject.candidate.rank}
                </Text>
                <ExternalLink size={13} color="#15803D" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  spotSection: {
    paddingBottom: 4,
  },
  spotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotTextWrap: {
    flex: 1,
  },
  sectionHeaderLabel: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  spotCoords: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: SPACING.sm,
  },
  pfzSection: {
    paddingTop: 2,
  },
  pfzHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  pfzSectionTitle: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
    fontSize: 11,
  },
  pfzInstruction: {
    ...TYPOGRAPHY.caption,
    fontSize: 10,
    color: '#0284C7',
    fontWeight: '700',
  },
  candidateList: {
    gap: 8,
  },
  candRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  candRowSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  candLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  rankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  rankBadgeGold: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  rankBadgeBlue: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
  },
  rankBadgeSelected: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0F172A',
  },
  rankBadgeTextSelected: {
    color: '#15803D',
  },
  candInfo: {
    flex: 1,
  },
  candDistance: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  candCoords: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  candRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recommendedPill: {
    backgroundColor: '#15803D',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recommendedPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  emptyPfzBox: {
    padding: SPACING.md,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
  },
  emptyPfzText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  selectedDetailBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  selectedDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  selectedDetailTitle: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
    color: '#15803D',
  },
  selectedDetailReason: {
    ...TYPOGRAPHY.caption,
    color: '#334155',
    lineHeight: 16,
  },
  viewAssessmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#DCFCE7',
  },
  viewAssessmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
});

