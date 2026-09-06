import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { OrcaAlert } from '../../types/orca';
import { ActiveAlertCard } from './ActiveAlertCard';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/theme';

interface ForecastRiskSectionProps {
  alerts: OrcaAlert[];
}

export const ForecastRiskSection: React.FC<ForecastRiskSectionProps> = ({ alerts }) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Calendar size={20} color={COLORS.caution} />
          <Text style={styles.title}>FORECAST RISKS</Text>
        </View>
        <Text style={styles.subtitle}>Conditions approaching thresholds</Text>
      </View>
      
      <View style={styles.alertsContainer}>
        {alerts.map(alert => (
          <ActiveAlertCard key={alert.id} alert={alert} showEvidence={true} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.xl,
  },
  header: {
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  title: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
  },
  alertsContainer: {
    gap: SPACING.md,
  },
});
