import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Calendar, ChevronRight, Check } from 'lucide-react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { formatDateToFisherman } from '../utils/formatting';

interface DateSelectorProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
}

export const DateSelector: React.FC<DateSelectorProps> = ({
  selectedDate,
  onSelectDate,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  // Generate date choices for the next 7 days
  const dateOptions = Array.from({ length: 7 }).map((_, index) => {
    const d = new Date();
    d.setDate(d.getDate() + index);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const iso = `${year}-${month}-${day}`;
    return {
      iso,
      label: formatDateToFisherman(iso),
      isToday: index === 0,
      isTomorrow: index === 1,
    };
  });

  const handleSelect = (iso: string) => {
    onSelectDate(iso);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Fishing date</Text>

      <TouchableOpacity
        style={styles.card}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Select fishing date"
      >
        <View style={styles.iconBox}>
          <Calendar size={22} color={COLORS.oceanBlue} strokeWidth={2.5} />
        </View>

        <View style={styles.dateInfo}>
          <Text style={styles.dateLabel}>{formatDateToFisherman(selectedDate)}</Text>
          <Text style={styles.dateSub}>High tide & weather forecasts updated</Text>
        </View>

        <ChevronRight size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {/* Date Picker Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeading}>Choose Fishing Day</Text>
            <Text style={styles.modalSubheading}>
              Select the day you plan to depart for sea
            </Text>

            <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
              {dateOptions.map((opt) => {
                const isSelected = opt.iso === selectedDate;
                return (
                  <TouchableOpacity
                    key={opt.iso}
                    style={[styles.dateOption, isSelected && styles.dateOptionSelected]}
                    onPress={() => handleSelect(opt.iso)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionTextCol}>
                      <Text
                        style={[
                          styles.optionTitle,
                          isSelected && styles.optionTitleSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.optionIso}>{opt.iso}</Text>
                    </View>

                    {isSelected && (
                      <Check size={20} color={COLORS.oceanBlue} strokeWidth={2.5} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.sm,
  },
  sectionLabel: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.skyBlueBorder,
    ...SHADOWS.sm,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  dateInfo: {
    flex: 1,
  },
  dateLabel: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  dateSub: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 37, 64, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '75%',
  },
  modalHeading: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  modalSubheading: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    marginTop: 2,
  },
  optionsList: {
    maxHeight: 340,
  },
  dateOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  dateOptionSelected: {
    backgroundColor: '#F0F9FF',
  },
  optionTextCol: {
    flex: 1,
  },
  optionTitle: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textPrimary,
  },
  optionTitleSelected: {
    color: COLORS.oceanBlue,
    fontWeight: '800',
  },
  optionIso: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: SPACING.md,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
});
