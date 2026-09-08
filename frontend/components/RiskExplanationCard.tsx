import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  ShieldCheck,
  Waves,
  Wind,
  Zap,
  HelpCircle,
  Anchor,
  Compass,
  ArrowRight,
  Info,
} from 'lucide-react-native';
import { RiskExplanation, RiskFactor, RiskDecision } from '../types/orca';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';

interface RiskExplanationCardProps {
  explanation?: RiskExplanation;
}

export const RiskExplanationCard: React.FC<RiskExplanationCardProps> = ({ explanation }) => {
  if (!explanation) {
    return null;
  }

  const {
    decision,
    decision_label,
    decision_subtitle,
    risk_score,
    dominant_hazard,
    primary_thing_to_watch,
    primary_thing_to_watch_reason,
    factors = [],
    action_guidance,
    vessel_evaluated,
  } = explanation;

  // Decision-based styling
  const getDecisionTheme = (dec: RiskDecision) => {
    switch (dec) {
      case 'GO':
        return {
          bg: COLORS.safeBg,
          border: COLORS.safeBorder,
          text: COLORS.safeText,
          iconBg: COLORS.safe,
          iconColor: '#FFFFFF',
          scoreBadgeBg: '#BBF7D0',
          scoreTextColor: COLORS.safeText,
          Icon: ShieldCheck,
          defaultLabel: 'GO – Marine Conditions Safe',
        };
      case 'CAUTION':
        return {
          bg: COLORS.cautionBg,
          border: COLORS.cautionBorder,
          text: COLORS.cautionText,
          iconBg: COLORS.caution,
          iconColor: '#FFFFFF',
          scoreBadgeBg: '#FED7AA',
          scoreTextColor: COLORS.cautionText,
          Icon: AlertTriangle,
          defaultLabel: 'CAUTION – Marginal Conditions',
        };
      case 'DONT_GO':
      default:
        return {
          bg: COLORS.dangerBg,
          border: COLORS.dangerBorder,
          text: COLORS.dangerText,
          iconBg: COLORS.danger,
          iconColor: '#FFFFFF',
          scoreBadgeBg: '#FECACA',
          scoreTextColor: COLORS.dangerText,
          Icon: AlertOctagon,
          defaultLabel: "DON'T GO – Hazardous Conditions",
        };
    }
  };

  const theme = getDecisionTheme(decision);
  const DecisionIcon = theme.Icon;

  // Factor helper
  const getFactorIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('wave') || lower.includes('swell')) return Waves;
    if (lower.includes('wind') || lower.includes('gust')) return Wind;
    if (lower.includes('lightning') || lower.includes('storm') || lower.includes('thunder') || lower.includes('convective')) return Zap;
    if (lower.includes('current')) return Compass;
    if (lower.includes('svas') || lower.includes('advisory') || lower.includes('incois')) return ShieldAlert;
    return Info;
  };

  const getStatusBadge = (status: RiskFactor['status']) => {
    switch (status) {
      case 'danger':
        return {
          label: 'DANGER',
          bg: COLORS.dangerBg,
          border: COLORS.dangerBorder,
          text: COLORS.dangerText,
          dotColor: COLORS.danger,
        };
      case 'caution':
        return {
          label: 'CAUTION',
          bg: COLORS.cautionBg,
          border: COLORS.cautionBorder,
          text: COLORS.cautionText,
          dotColor: COLORS.caution,
        };
      case 'safe':
        return {
          label: 'SAFE',
          bg: COLORS.safeBg,
          border: COLORS.safeBorder,
          text: COLORS.safeText,
          dotColor: COLORS.safe,
        };
      case 'unavailable':
      default:
        return {
          label: 'NO DATA',
          bg: COLORS.neutralBg,
          border: COLORS.neutralBorder,
          text: COLORS.neutralText,
          dotColor: COLORS.neutral,
        };
    }
  };

  const hasUnavailableFactors = factors.some((f) => f.status === 'unavailable');
  const cautionFactor = factors.find((f) => f.status === 'caution');

  return (
    <View style={styles.container}>
      {/* 1. TOP DECISION HERO BANNER (Single Authoritative Safety Decision) */}
      <View style={[styles.decisionBanner, { backgroundColor: theme.bg, borderColor: theme.border }]}>
        <View style={styles.decisionTopRow}>
          <View style={[styles.iconContainer, { backgroundColor: theme.iconBg }]}>
            <DecisionIcon size={24} color={theme.iconColor} />
          </View>
          <View style={styles.decisionTitles}>
            <Text style={[styles.decisionLabel, { color: theme.text }]}>
              {decision_label || theme.defaultLabel}
            </Text>
            {decision_subtitle && (
              <Text style={[styles.decisionSubtitle, { color: theme.text }]}>
                {decision_subtitle}
              </Text>
            )}
          </View>
        </View>

        {/* Secondary Badges (Score & Vessel) */}
        <View style={styles.badgeRow}>
          {risk_score !== undefined && (
            <View style={[styles.scoreBadge, { backgroundColor: theme.scoreBadgeBg }]}>
              <Text style={[styles.scoreBadgeText, { color: theme.scoreTextColor }]}>
                Risk Index: {Math.round(risk_score)} / 100
              </Text>
            </View>
          )}

          {vessel_evaluated && (
            <View style={styles.vesselBadge}>
              <Anchor size={12} color={COLORS.primaryLight} style={{ marginRight: 4 }} />
              <Text style={styles.vesselBadgeText}>{String(vessel_evaluated)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* 2A. PRIMARY THING TO WATCH (When overall decision is GO and a secondary factor has caution) */}
      {decision === 'GO' && (primary_thing_to_watch || cautionFactor) && (
        <View style={styles.primaryWatchBox}>
          <AlertTriangle size={16} color={COLORS.caution} style={{ marginTop: 2, marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.primaryWatchLabel}>PRIMARY THING TO WATCH</Text>
            <Text style={styles.primaryWatchText}>
              🟡 {primary_thing_to_watch || cautionFactor?.name}
              {primary_thing_to_watch_reason
                ? ` — ${primary_thing_to_watch_reason}`
                : cautionFactor?.interpretation
                ? ` — ${cautionFactor?.interpretation}`
                : ''}
            </Text>
          </View>
        </View>
      )}

      {/* 2B. DOMINANT HAZARD ALERT (When decision is CAUTION or DONT_GO) */}
      {decision !== 'GO' && dominant_hazard && (
        <View style={[styles.dominantHazardBox, decision === 'CAUTION' && styles.dominantHazardBoxCaution]}>
          {decision === 'DONT_GO' ? (
            <AlertOctagon size={16} color={COLORS.danger} style={{ marginTop: 2, marginRight: 8 }} />
          ) : (
            <AlertTriangle size={16} color={COLORS.caution} style={{ marginTop: 2, marginRight: 8 }} />
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.dominantHazardLabel,
                decision === 'CAUTION' && { color: COLORS.cautionText },
              ]}
            >
              {decision === 'DONT_GO' ? 'PRIMARY SAFETY CONCERN' : 'PRIMARY HAZARD TO MONITOR'}
            </Text>
            <Text style={styles.dominantHazardText}>{dominant_hazard}</Text>
          </View>
        </View>
      )}

      {/* 3. "WHY THIS DECISION?" FACTOR BREAKDOWN */}
      <View style={styles.factorsSection}>
        <Text style={styles.sectionHeader}>WHY THIS DECISION?</Text>
        <Text style={styles.sectionSubheader}>
          Key environmental factors evaluated against boat safety limits:
        </Text>

        <View style={styles.factorsList}>
          {factors.map((factor, idx) => {
            const FactorIcon = getFactorIcon(factor.name);
            const statusBadge = getStatusBadge(factor.status);

            return (
              <View
                key={`factor-${idx}-${factor.name}`}
                style={[
                  styles.factorCard,
                  factor.status === 'danger' && styles.factorCardDanger,
                  factor.status === 'caution' && styles.factorCardCaution,
                  factor.status === 'unavailable' && styles.factorCardUnavailable,
                ]}
              >
                {/* Header: Icon + Name + Formatted Value + Status */}
                <View style={styles.factorHeaderRow}>
                  <View style={styles.factorNameGroup}>
                    <View style={styles.factorIconWrapper}>
                      <FactorIcon size={16} color={COLORS.primary} />
                    </View>
                    <View>
                      <Text style={styles.factorName}>{factor.name}</Text>
                      <Text style={styles.factorValue}>{factor.value_formatted}</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusBadge.bg, borderColor: statusBadge.border },
                    ]}
                  >
                    <View style={[styles.statusDot, { backgroundColor: statusBadge.dotColor }]} />
                    <Text style={[styles.statusText, { color: statusBadge.text }]}>
                      {statusBadge.label}
                    </Text>
                  </View>
                </View>

                {/* Practical Fisherman Interpretation */}
                {factor.interpretation && (
                  <Text style={styles.factorInterpretation}>{factor.interpretation}</Text>
                )}

                {/* Optional Threshold Context */}
                {factor.threshold_context && (
                  <View style={styles.thresholdRow}>
                    <Info size={11} color={COLORS.textTertiary} style={{ marginRight: 4 }} />
                    <Text style={styles.thresholdText}>{factor.threshold_context}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* 4. "WHAT SHOULD I DO?" ACTION GUIDANCE */}
      {action_guidance && (
        <View
          style={[
            styles.actionBox,
            action_guidance.urgency === 'critical' && styles.actionBoxCritical,
            action_guidance.urgency === 'moderate' && styles.actionBoxModerate,
          ]}
        >
          <View style={styles.actionHeaderRow}>
            <ArrowRight
              size={16}
              color={
                action_guidance.urgency === 'critical'
                  ? COLORS.danger
                  : action_guidance.urgency === 'moderate'
                  ? COLORS.caution
                  : COLORS.oceanBlue
              }
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.actionHeadline,
                action_guidance.urgency === 'critical' && { color: COLORS.dangerText },
                action_guidance.urgency === 'moderate' && { color: COLORS.cautionText },
              ]}
            >
              {action_guidance.headline || 'RECOMMENDED ACTION'}
            </Text>
          </View>
          <Text style={styles.actionText}>{action_guidance.action_text}</Text>
        </View>
      )}

      {/* 5. DATA FEED NOTICE IF MISSING FACTORS */}
      {hasUnavailableFactors && (
        <View style={styles.noticeBox}>
          <HelpCircle size={13} color={COLORS.neutral} style={{ marginRight: 6, marginTop: 1 }} />
          <Text style={styles.noticeText}>
            Notice: Some real-time ocean data feeds were offline and could not be evaluated. Always exercise caution at sea.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  decisionBanner: {
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  decisionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  decisionTitles: {
    flex: 1,
  },
  decisionLabel: {
    ...TYPOGRAPHY.h2,
    fontSize: 18,
    lineHeight: 22,
  },
  decisionSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: 2,
    opacity: 0.9,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
  },
  scoreBadgeText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
  },
  vesselBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.skyBlue,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    borderColor: COLORS.skyBlueBorder,
  },
  vesselBadgeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primaryDark,
    fontWeight: '600',
  },
  primaryWatchBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  primaryWatchLabel: {
    ...TYPOGRAPHY.caption,
    color: '#B45309',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  primaryWatchText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginTop: 1,
  },
  dominantHazardBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  dominantHazardBoxCaution: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDBA74',
  },
  dominantHazardLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.danger,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dominantHazardText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginTop: 1,
  },
  factorsSection: {
    marginBottom: SPACING.sm,
  },
  sectionHeader: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  sectionSubheader: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 2,
    marginBottom: SPACING.sm,
  },
  factorsList: {
    gap: 8,
  },
  factorCard: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: SPACING.sm,
  },
  factorCardDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: COLORS.dangerBorder,
  },
  factorCardCaution: {
    backgroundColor: '#FFFBEB',
    borderColor: COLORS.cautionBorder,
  },
  factorCardUnavailable: {
    backgroundColor: '#F8FAFC',
    borderColor: COLORS.border,
  },
  factorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factorNameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  factorIconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  factorName: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  factorValue: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    ...TYPOGRAPHY.caption,
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  factorInterpretation: {
    ...TYPOGRAPHY.bodySmall,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  thresholdText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.textTertiary,
    fontStyle: 'italic',
  },
  actionBox: {
    backgroundColor: COLORS.skyBlue,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.skyBlueBorder,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  actionBoxCritical: {
    backgroundColor: COLORS.dangerBg,
    borderColor: COLORS.dangerBorder,
  },
  actionBoxModerate: {
    backgroundColor: COLORS.cautionBg,
    borderColor: COLORS.cautionBorder,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionHeadline: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
    color: COLORS.oceanBlueDark,
    letterSpacing: 0.5,
  },
  actionText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textPrimary,
    fontWeight: '600',
    lineHeight: 19,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.sm,
    padding: SPACING.xs,
  },
  noticeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    color: COLORS.textTertiary,
    flex: 1,
    lineHeight: 15,
  },
});
