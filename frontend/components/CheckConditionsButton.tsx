import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from 'react-native';
import { ArrowRight, Waves } from 'lucide-react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';

interface CheckConditionsButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
}

export const CheckConditionsButton: React.FC<CheckConditionsButtonProps> = ({
  onPress,
  loading = false,
  disabled = false,
  label = 'CHECK CONDITIONS',
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        (disabled || loading) && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      accessibilityLabel={label}
    >
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={COLORS.textInverse} size="small" />
          <Text style={styles.loadingText}>Checking Sea Conditions...</Text>
        </View>
      ) : (
        <View style={styles.contentRow}>
          <Waves size={24} color={COLORS.textInverse} strokeWidth={2.2} />
          <Text style={styles.buttonText}>{label}</Text>
          <ArrowRight size={22} color={COLORS.textInverse} strokeWidth={2.5} />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.oceanBlue,
    height: 58,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    marginVertical: SPACING.md,
    ...SHADOWS.md,
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
    elevation: 0,
    shadowOpacity: 0,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonText: {
    ...TYPOGRAPHY.bodyLarge,
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textInverse,
    letterSpacing: 0.5,
  },
  loadingText: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textInverse,
    fontWeight: '700',
  },
});
