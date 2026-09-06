import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react-native';
import { AlertEvidence } from '../../types/orca';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/theme';

interface WhyThisAlertProps {
  evidence: AlertEvidence[];
  advice: string;
  source?: string;
}

export const WhyThisAlert: React.FC<WhyThisAlertProps> = ({ evidence, advice, source }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.header} 
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <HelpCircle size={18} color={COLORS.textSecondary} />
          <Text style={styles.headerText}>Why This Alert?</Text>
        </View>
        {isExpanded ? (
          <ChevronUp size={20} color={COLORS.textSecondary} />
        ) : (
          <ChevronDown size={20} color={COLORS.textSecondary} />
        )}
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>WHY ORCA ISSUED THIS ALERT</Text>
          
          <View style={styles.evidenceList}>
            {evidence.map((item, index) => (
              <View key={index} style={styles.evidenceItem}>
                <View style={styles.bullet} />
                <Text style={styles.evidenceLabel}>{item.label}: </Text>
                <Text style={styles.evidenceValue}>
                  {item.value} {item.unit ? item.unit : ''}
                </Text>
              </View>
            ))}
          </View>
          
          {source && (
            <Text style={styles.sourceText}>Data Source: {source}</Text>
          )}
          
          <View style={styles.adviceContainer}>
            <Text style={styles.adviceLabel}>Recommendation</Text>
            <Text style={styles.adviceText}>{advice}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.sm,
    marginTop: SPACING.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    minHeight: SPACING.touchTarget,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
  },
  content: {
    padding: SPACING.md,
    paddingTop: 0,
  },
  sectionTitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    marginBottom: SPACING.sm,
    letterSpacing: 0.5,
  },
  evidenceList: {
    marginBottom: SPACING.md,
  },
  evidenceItem: {
    flexDirection: 'row',
    marginBottom: SPACING.xs,
    paddingLeft: SPACING.xs,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textTertiary,
    marginTop: 8,
    marginRight: SPACING.sm,
  },
  evidenceLabel: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
  evidenceValue: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textPrimary,
    fontWeight: '700',
    flexShrink: 1,
  },
  sourceText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    marginBottom: SPACING.md,
    fontStyle: 'italic',
  },
  adviceContainer: {
    backgroundColor: COLORS.cardBg,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  adviceLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  adviceText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
  },
});
