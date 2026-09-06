import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MapPin, Compass } from 'lucide-react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/theme';

interface DistanceDirectionRowProps {
  distance?: string;
  direction?: string;
}

export const DistanceDirectionRow: React.FC<DistanceDirectionRowProps> = ({
  distance,
  direction
}) => {
  if (!distance && !direction) {
    return null;
  }

  return (
    <View style={styles.container}>
      {distance && (
        <View style={styles.item}>
          <MapPin size={16} color={COLORS.textSecondary} />
          <Text style={styles.text}>Distance: {distance}</Text>
        </View>
      )}
      {distance && direction && (
        <View style={styles.separator} />
      )}
      {direction && (
        <View style={styles.item}>
          <Compass size={16} color={COLORS.textSecondary} />
          <Text style={styles.text}>Direction: {direction}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
    marginTop: SPACING.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
    fontWeight: '600',
  },
  separator: {
    width: 1,
    height: 12,
    backgroundColor: COLORS.divider,
    marginHorizontal: SPACING.md,
  }
});
