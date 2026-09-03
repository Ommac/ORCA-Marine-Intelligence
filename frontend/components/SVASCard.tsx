import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertTriangle, ShieldCheck, ShieldAlert, Anchor } from 'lucide-react-native';
import { SVASData } from '../types/orca';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';

interface SVASCardProps {
  svas?: SVASData;
  dateStr?: string;
}

export const SVASCard: React.FC<SVASCardProps> = ({ svas, dateStr }) => {
  const isAvailable = svas && svas.available;
  const isAlert =
    isAvailable &&
    (svas.severity?.toLowerCase() === 'alert' ||
      svas.severity?.toLowerCase() === 'warning' ||
      svas.severity?.toLowerCase() === 'high');

  return (
    <View
      style={[
        styles.card,
        isAlert ? styles.cardAlert : styles.cardNormal,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          <View
            style={[
              styles.iconBox,
              isAlert ? styles.iconBoxAlert : styles.iconBoxNormal,
            ]}
          >
            {isAlert ? (
              <ShieldAlert size={24} color={COLORS.cautionText} strokeWidth={2.4} />
            ) : (
              <ShieldCheck size={24} color={COLORS.safe} strokeWidth={2.4} />
            )}
          </View>
          <View style={styles.titleCol}>
            <Text style={styles.title}>SMALL VESSEL ADVISORY</Text>
            <Text style={styles.subtitle}>INCOIS Official Sailing Safety</Text>
          </View>
        </View>

        {isAvailable && (
          <View
            style={[
              styles.badge,
              isAlert ? styles.badgeAlert : styles.badgeSafe,
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                isAlert ? styles.badgeTextAlert : styles.badgeTextSafe,
              ]}
            >
              {isAlert ? '⚠ ADVISORY' : '✓ SAFE'}
            </Text>
          </View>
        )}
      </View>

      {isAvailable ? (
        <View style={styles.contentBody}>
          <View
            style={[
              styles.messageBanner,
              isAlert ? styles.messageBannerAlert : styles.messageBannerSafe,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isAlert ? styles.messageTextAlert : styles.messageTextSafe,
              ]}
            >
              {svas.message || (isAlert ? 'Caution advised for small craft operations.' : 'Conditions normal for small fishing vessels.')}
            </Text>
          </View>

          <View style={styles.metadataGrid}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>District / Coastal Zone</Text>
              <Text style={styles.metaValue}>
                {svas.district ? `${svas.district}, ${svas.state || 'India'}` : 'Coastal Waters'}
              </Text>
            </View>

            {svas.boat_category && (
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Vessel Category</Text>
                <Text style={styles.metaValue}>{svas.boat_category.replace('_', ' ').toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.unavailableBox}>
          <Text style={styles.unavailableText}>
            {svas?.reason || 'No specific small vessel advisory available for this zone.'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginVertical: SPACING.sm,
    ...SHADOWS.sm,
  },
  cardNormal: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardAlert: {
    backgroundColor: '#FFF7ED',
    borderWidth: 2,
    borderColor: COLORS.cautionBorder,
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
    flex: 1,
  },
  titleCol: {
    flex: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBoxNormal: {
    backgroundColor: '#DCFCE7',
  },
  iconBoxAlert: {
    backgroundColor: COLORS.cautionBg,
  },
  title: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  badgeSafe: {
    backgroundColor: COLORS.safeBg,
  },
  badgeAlert: {
    backgroundColor: COLORS.cautionBg,
    borderWidth: 1,
    borderColor: COLORS.cautionBorder,
  },
  badgeText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '800',
  },
  badgeTextSafe: {
    color: COLORS.safeText,
  },
  badgeTextAlert: {
    color: COLORS.cautionText,
  },
  contentBody: {
    marginTop: 2,
  },
  messageBanner: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  messageBannerSafe: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.safe,
  },
  messageBannerAlert: {
    backgroundColor: '#FFEDD5',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.caution,
  },
  messageText: {
    ...TYPOGRAPHY.bodyLarge,
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextSafe: {
    color: COLORS.safeText,
    fontWeight: '600',
  },
  messageTextAlert: {
    color: COLORS.cautionText,
    fontWeight: '700',
  },
  metadataGrid: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    paddingTop: SPACING.sm,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  metaValue: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
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
