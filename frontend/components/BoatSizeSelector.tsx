import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ship, Anchor } from 'lucide-react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { BOAT_SIZES } from '../constants/locations';
import { BoatSizeOption } from '../types/orca';

interface BoatSizeSelectorProps {
  selectedBoatWidth: number;
  onSelectBoat: (option: BoatSizeOption) => void;
}

export const BoatSizeSelector: React.FC<BoatSizeSelectorProps> = ({
  selectedBoatWidth,
  onSelectBoat,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.sectionLabel}>Boat size</Text>
        <Text style={styles.helperText}>Used for Small Vessel Advisories</Text>
      </View>

      <View style={styles.grid}>
        {BOAT_SIZES.map((option) => {
          const isSelected = option.boat_width_m === selectedBoatWidth;

          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.button,
                isSelected && styles.buttonSelected,
              ]}
              onPress={() => onSelectBoat(option)}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Select boat size ${option.label}`}
            >
              <View style={styles.buttonTop}>
                {isSelected ? (
                  <Anchor size={20} color={COLORS.oceanBlue} strokeWidth={2.5} />
                ) : (
                  <Ship size={20} color={COLORS.textSecondary} />
                )}
                <Text
                  style={[
                    styles.sizeLabel,
                    isSelected && styles.sizeLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </View>

              <Text
                style={[
                  styles.sizeSublabel,
                  isSelected && styles.sizeSublabelSelected,
                ]}
                numberOfLines={1}
              >
                {option.sublabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: SPACING.sm,
  },
  sectionLabel: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textPrimary,
  },
  helperText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  button: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 68,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  buttonSelected: {
    borderColor: COLORS.oceanBlue,
    backgroundColor: '#F0F9FF',
    borderWidth: 2,
  },
  buttonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sizeLabel: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  sizeLabelSelected: {
    color: COLORS.oceanBlue,
    fontWeight: '900',
  },
  sizeSublabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontSize: 11,
  },
  sizeSublabelSelected: {
    color: COLORS.oceanBlueDark,
    fontWeight: '600',
  },
});
