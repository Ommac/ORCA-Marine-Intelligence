import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDateToFisherman, formatBoatCategory } from '../../utils/formatting';

interface AlertContextHeaderProps {
  locationName: string;
  date: string;
  boatWidthM: number;
  district?: string;
  state?: string;
}

export const AlertContextHeader: React.FC<AlertContextHeaderProps> = ({
  locationName,
  date,
  boatWidthM,
  district,
  state
}) => {
  const formattedDate = formatDateToFisherman(date);
  const boatCategory = formatBoatCategory(boatWidthM);
  
  const displayLocation = district && state && locationName !== district
    ? `${locationName}, ${district}`
    : locationName;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <MapPin size={20} color={COLORS.oceanBlueDark} />
        <Text style={styles.headerText}>Alerts for Your Selected Fishing Location</Text>
      </View>
      <View style={styles.contentRow}>
        <Text style={styles.detailText}>{displayLocation}</Text>
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.detailText}>{formattedDate}</Text>
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.detailText}>{boatCategory}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.skyBlue,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.skyBlueBorder,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.oceanBlueDark,
    marginLeft: SPACING.sm,
    fontWeight: '700',
  },
  contentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  detailText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textPrimary,
  },
  bullet: {
    marginHorizontal: SPACING.sm,
    color: COLORS.oceanBlue,
    fontSize: 16,
  }
});
