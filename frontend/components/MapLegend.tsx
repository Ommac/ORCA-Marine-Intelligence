import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Layers, Check } from 'lucide-react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export interface ActiveMapLayers {
  pfz: boolean;
  myLocation: boolean;
  distance: boolean;
}

interface MapLegendProps {
  activeLayers: ActiveMapLayers;
  onToggleLayer: (key: keyof ActiveMapLayers) => void;
}

export const MapLegend: React.FC<MapLegendProps> = ({
  activeLayers,
  onToggleLayer,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Layers size={18} color={COLORS.oceanBlue} />
        <Text style={styles.headerTitle}>PFZ Map Overlays</Text>
      </View>

      <View style={styles.layerList}>
        <TouchableOpacity
          style={styles.layerItem}
          onPress={() => onToggleLayer('pfz')}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, activeLayers.pfz && styles.checkboxActive]}>
            {activeLayers.pfz && <Check size={13} color="#FFF" strokeWidth={3} />}
          </View>
          <View style={[styles.legendIndicator, { backgroundColor: '#10B981', borderColor: '#064E3B' }]} />
          <Text style={styles.layerText}>PFZ Fishing Zone</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.layerItem}
          onPress={() => onToggleLayer('myLocation')}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, activeLayers.myLocation && styles.checkboxActive]}>
            {activeLayers.myLocation && <Check size={13} color="#FFF" strokeWidth={3} />}
          </View>
          <View style={[styles.legendIndicator, { backgroundColor: '#0A2540', borderColor: '#38BDF8' }]} />
          <Text style={styles.layerText}>Fishing Location</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.layerItem}
          onPress={() => onToggleLayer('distance')}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, activeLayers.distance && styles.checkboxActive]}>
            {activeLayers.distance && <Check size={13} color="#FFF" strokeWidth={3} />}
          </View>
          <View style={[styles.legendIndicator, { backgroundColor: '#0066CC', borderColor: '#BAE6FD' }]} />
          <Text style={styles.layerText}>Distance Line</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.skyBlueBorder,
    ...SHADOWS.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  headerTitle: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  layerList: {
    gap: 8,
  },
  layerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxActive: {
    backgroundColor: COLORS.oceanBlue,
    borderColor: COLORS.oceanBlue,
  },
  legendIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  layerText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
});
