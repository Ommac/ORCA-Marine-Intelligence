import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Compass, Radio, Share2 } from 'lucide-react-native';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/theme';

interface OrcaHeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  showStatusDot?: boolean;
  rightAction?: React.ReactNode;
}

export const OrcaHeader: React.FC<OrcaHeaderProps> = ({
  title = 'ORCA',
  subtitle = 'Marine Intelligence for Fishermen',
  showBack = false,
  showStatusDot = true,
  rightAction,
}) => {
  const router = useRouter();

  return (
    <View style={styles.headerContainer}>
      <View style={styles.contentRow}>
        {showBack ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            activeOpacity={0.7}
          >
            <ChevronLeft size={28} color={COLORS.textInverse} />
          </TouchableOpacity>
        ) : (
          <View style={styles.logoBadge}>
            <Compass size={24} color="#38BDF8" strokeWidth={2.5} />
          </View>
        )}

        <View style={styles.titleColumn}>
          <View style={styles.titleRow}>
            <Text style={styles.titleText}>{title}</Text>
            {showStatusDot && (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>
          {subtitle ? <Text style={styles.subtitleText}>{subtitle}</Text> : null}
        </View>

        <View style={styles.rightActionContainer}>
          {rightAction ? (
            rightAction
          ) : (
            <View style={styles.networkStatus}>
              <Radio size={16} color="#38BDF8" />
              <Text style={styles.networkText}>INCOIS</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: COLORS.primary,
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#1E3A5F',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  titleColumn: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleText: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textInverse,
    fontWeight: '800',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 163, 74, 0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4ADE80',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#86EFAC',
    letterSpacing: 0.5,
  },
  subtitleText: {
    ...TYPOGRAPHY.caption,
    color: '#94A3B8',
    marginTop: 2,
  },
  rightActionContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  networkStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14, 58, 100, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  networkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#BAE6FD',
  },
});
