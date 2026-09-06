import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ship, ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { OrcaAlert } from '../../types/orca';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatBoatCategory } from '../../utils/formatting';

interface PersonalizedBoatAlertProps {
  alert: OrcaAlert;
  boatWidthM: number;
}

export const PersonalizedBoatAlert: React.FC<PersonalizedBoatAlertProps> = ({
  alert,
  boatWidthM
}) => {
  const isCritical = alert.severity === 'CRITICAL';
  const isHigh = alert.severity === 'HIGH';
  const isSafe = alert.severity === 'SAFE' || alert.severity === 'INFORMATION';

  let bgColor = COLORS.cautionBg;
  let borderColor = COLORS.cautionBorder;
  let textColor = COLORS.cautionText;
  let IconComponent = ShieldAlert;
  let headerText = 'CAUTION ADVISED';

  if (isCritical) {
    bgColor = '#991B1B';
    borderColor = '#7F1D1D';
    textColor = '#FFFFFF';
    headerText = 'DO NOT SAIL';
  } else if (isHigh) {
    bgColor = COLORS.dangerBg;
    borderColor = COLORS.dangerBorder;
    textColor = COLORS.dangerText;
    headerText = 'YOUR BOAT IS AFFECTED';
  } else if (isSafe) {
    bgColor = COLORS.safeBg;
    borderColor = COLORS.safeBorder;
    textColor = COLORS.safeText;
    IconComponent = ShieldCheck;
    headerText = 'SAFE FOR YOUR BOAT';
  }

  const boatCategoryText = formatBoatCategory(boatWidthM);

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderColor }]}>
      <View style={styles.header}>
        <IconComponent size={28} color={textColor} />
        <Text style={[styles.headerTitle, { color: textColor }]}>{headerText}</Text>
      </View>
      
      <View style={styles.evidenceContainer}>
        <View style={styles.evidenceRow}>
          <Ship size={16} color={textColor} style={{ opacity: 0.8 }} />
          <Text style={[styles.evidenceText, { color: textColor }]}>
            {boatCategoryText} ({boatWidthM}m)
          </Text>
        </View>
        {alert.evidence && alert.evidence.map((ev, idx) => (
          <View key={idx} style={styles.evidenceRow}>
            <View style={[styles.bullet, { backgroundColor: textColor }]} />
            <Text style={[styles.evidenceText, { color: textColor }]}>
              {ev.label}: {ev.value} {ev.unit || ''}
            </Text>
          </View>
        ))}
      </View>
      
      <View style={[styles.adviceContainer, { backgroundColor: isCritical ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)' }]}>
        <Text style={[styles.adviceText, { color: textColor }]}>
          {alert.advice}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerTitle: {
    ...TYPOGRAPHY.h3,
    marginLeft: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  evidenceContainer: {
    marginBottom: SPACING.md,
  },
  evidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  evidenceText: {
    ...TYPOGRAPHY.bodyMedium,
    marginLeft: SPACING.sm,
    fontWeight: '600',
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 5,
    marginRight: 5,
    opacity: 0.7,
  },
  adviceContainer: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  adviceText: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '700',
  }
});
