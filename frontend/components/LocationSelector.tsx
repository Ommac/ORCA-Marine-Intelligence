import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { MapPin, Navigation, Edit3, X, Check } from 'lucide-react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';
import { PRESET_LOCATIONS } from '../constants/locations';
import { PresetLocation } from '../types/orca';
import { validateCoordinates } from '../utils/validation';

interface LocationSelectorProps {
  selectedLocation: PresetLocation | { name: string; latitude: number; longitude: number; state?: string };
  onSelectLocation: (loc: { name: string; latitude: number; longitude: number; state?: string; district?: string }) => void;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
  selectedLocation,
  onSelectLocation,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [latInput, setLatInput] = useState(selectedLocation.latitude.toString());
  const [lonInput, setLonInput] = useState(selectedLocation.longitude.toString());
  const [customName, setCustomName] = useState('Custom Coastal Spot');

  const handleSelectPreset = (preset: PresetLocation) => {
    onSelectLocation(preset);
    setModalVisible(false);
  };

  const handleSaveManualCoords = () => {
    const res = validateCoordinates(latInput, lonInput);
    if (!res.valid || res.lat === undefined || res.lon === undefined) {
      Alert.alert('Invalid Coordinates', res.error || 'Please enter valid numbers.');
      return;
    }

    onSelectLocation({
      name: customName.trim() || `Point (${res.lat.toFixed(2)}, ${res.lon.toFixed(2)})`,
      latitude: res.lat,
      longitude: res.lon,
      state: 'Custom Ocean Point',
    });
    setModalVisible(false);
    setManualMode(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Where do you want to fish?</Text>

      {/* Main Selected Location Card */}
      <TouchableOpacity
        style={styles.locationCard}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Change fishing location"
      >
        <View style={styles.pinIconBox}>
          <MapPin size={22} color={COLORS.oceanBlue} strokeWidth={2.5} />
        </View>

        <View style={styles.locationInfo}>
          <Text style={styles.locationName} numberOfLines={1}>
            {selectedLocation.name}
          </Text>
          <Text style={styles.locationCoords}>
            {selectedLocation.latitude.toFixed(2)}° N, {selectedLocation.longitude.toFixed(2)}° E
            {selectedLocation.state ? ` • ${selectedLocation.state}` : ''}
          </Text>
        </View>

        <View style={styles.changeBadge}>
          <Text style={styles.changeText}>Change</Text>
        </View>
      </TouchableOpacity>

      {/* Fast Preset Chips for one-tap selection */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}
      >
        {PRESET_LOCATIONS.slice(0, 5).map((preset) => {
          const isSelected =
            Math.abs(preset.latitude - selectedLocation.latitude) < 0.01 &&
            Math.abs(preset.longitude - selectedLocation.longitude) < 0.01;

          return (
            <TouchableOpacity
              key={preset.id}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => onSelectLocation(preset)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {preset.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Location Picker / Manual Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Coastal Location</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setModalVisible(false)}
              >
                <X size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Mode Switch Tabs */}
            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, !manualMode && styles.modeTabActive]}
                onPress={() => setManualMode(false)}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    !manualMode && styles.modeTabTextActive,
                  ]}
                >
                  Coastal Presets
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeTab, manualMode && styles.modeTabActive]}
                onPress={() => setManualMode(true)}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    manualMode && styles.modeTabTextActive,
                  ]}
                >
                  Enter Coordinates
                </Text>
              </TouchableOpacity>
            </View>

            {manualMode ? (
              /* Manual Coordinates Form */
              <View style={styles.manualForm}>
                <Text style={styles.manualInstruction}>
                  Enter exact latitude and longitude coordinates for your planned fishing trip.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Spot / Port Name (Optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={customName}
                    onChangeText={setCustomName}
                    placeholder="e.g. Off Dahanu Coast"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.coordsRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Latitude (°N)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={latInput}
                      onChangeText={setLatInput}
                      placeholder="19.72"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Longitude (°E)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={lonInput}
                      onChangeText={setLonInput}
                      placeholder="72.70"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.primaryModalBtn}
                  onPress={handleSaveManualCoords}
                  activeOpacity={0.8}
                >
                  <Check size={20} color={COLORS.textInverse} />
                  <Text style={styles.primaryModalBtnText}>Set Fishing Coordinates</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Presets List */
              <ScrollView style={styles.presetList} showsVerticalScrollIndicator={false}>
                {PRESET_LOCATIONS.map((preset) => {
                  const isSelected =
                    Math.abs(preset.latitude - selectedLocation.latitude) < 0.01 &&
                    Math.abs(preset.longitude - selectedLocation.longitude) < 0.01;

                  return (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.presetItem,
                        isSelected && styles.presetItemSelected,
                      ]}
                      onPress={() => handleSelectPreset(preset)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.presetItemLeft}>
                        <View
                          style={[
                            styles.presetDot,
                            isSelected && styles.presetDotSelected,
                          ]}
                        />
                        <View>
                          <Text
                            style={[
                              styles.presetName,
                              isSelected && styles.presetNameSelected,
                            ]}
                          >
                            {preset.name}
                          </Text>
                          <Text style={styles.presetState}>
                            {preset.district ? `${preset.district}, ` : ''}
                            {preset.state} • {preset.latitude.toFixed(2)}°N, {preset.longitude.toFixed(2)}°E
                          </Text>
                        </View>
                      </View>

                      {isSelected && (
                        <Check size={20} color={COLORS.oceanBlue} strokeWidth={2.5} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
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
  locationCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.skyBlueBorder,
    ...SHADOWS.sm,
  },
  pinIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  locationCoords: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  changeBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  changeText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.oceanBlue,
    fontWeight: '700',
  },
  chipsScroll: {
    paddingTop: SPACING.sm,
    gap: 8,
  },
  chip: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  chipSelected: {
    backgroundColor: COLORS.oceanBlue,
    borderColor: COLORS.oceanBlue,
  },
  chipText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: COLORS.textInverse,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 37, 64, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.md,
    padding: 4,
    marginBottom: SPACING.md,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: RADIUS.sm,
  },
  modeTabActive: {
    backgroundColor: COLORS.cardBg,
    ...SHADOWS.sm,
  },
  modeTabText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: COLORS.oceanBlue,
    fontWeight: '800',
  },
  presetList: {
    maxHeight: 380,
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  presetItemSelected: {
    backgroundColor: '#F0F9FF',
  },
  presetItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  presetDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.divider,
  },
  presetDotSelected: {
    backgroundColor: COLORS.oceanBlue,
  },
  presetName: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textPrimary,
  },
  presetNameSelected: {
    color: COLORS.oceanBlue,
    fontWeight: '800',
  },
  presetState: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  manualForm: {
    paddingVertical: SPACING.sm,
  },
  manualInstruction: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  textInput: {
    height: 50,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surfaceSubtle,
  },
  coordsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryModalBtn: {
    backgroundColor: COLORS.oceanBlue,
    height: 52,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: SPACING.sm,
    ...SHADOWS.md,
  },
  primaryModalBtnText: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textInverse,
    fontWeight: '800',
  },
});
