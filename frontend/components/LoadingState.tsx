import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Fish, Waves, ShieldAlert, Radio, CheckCircle2 } from 'lucide-react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Checking marine conditions...',
}) => {
  const [stepIndex, setStepIndex] = useState(0);

  const steps = [
    { title: 'Connecting to INCOIS & Ocean Models', icon: Radio },
    { title: 'Locating Nearest Fishing Zones (PFZ)', icon: Fish },
    { title: 'Analyzing Waves, Wind & Sea Temp', icon: Waves },
    { title: 'Evaluating Small Vessel Safety (SVAS)', icon: ShieldAlert },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 280);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={COLORS.oceanBlue} style={styles.spinner} />

        <Text style={styles.heading}>{message}</Text>
        <Text style={styles.subheading}>
          Analyzing multi-source ocean intelligence for your vessel...
        </Text>

        <View style={styles.stepsList}>
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isDone = idx < stepIndex;
            const isCurrent = idx === stepIndex;

            return (
              <View key={step.title} style={styles.stepRow}>
                <View
                  style={[
                    styles.stepIconBox,
                    isDone && styles.stepIconBoxDone,
                    isCurrent && styles.stepIconBoxCurrent,
                  ]}
                >
                  {isDone ? (
                    <CheckCircle2 size={18} color="#16A34A" />
                  ) : (
                    <Icon
                      size={18}
                      color={isCurrent ? COLORS.oceanBlue : COLORS.textTertiary}
                    />
                  )}
                </View>

                <Text
                  style={[
                    styles.stepText,
                    isDone && styles.stepTextDone,
                    isCurrent && styles.stepTextCurrent,
                  ]}
                >
                  {step.title}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.lg,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.skyBlueBorder,
    ...SHADOWS.md,
  },
  spinner: {
    marginBottom: SPACING.md,
  },
  heading: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  subheading: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: SPACING.lg,
  },
  stepsList: {
    width: '100%',
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIconBoxDone: {
    backgroundColor: '#DCFCE7',
  },
  stepIconBoxCurrent: {
    backgroundColor: '#E0F2FE',
  },
  stepText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textTertiary,
  },
  stepTextDone: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  stepTextCurrent: {
    color: COLORS.oceanBlue,
    fontWeight: '800',
  },
});
