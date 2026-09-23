import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Layers, Check, ShieldAlert } from 'lucide-react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../constants/theme';

export interface ActiveMapLayers {
  pfz: boolean;
  myLocation: boolean;
  distance: boolean;
  geofences?: boolean;
  route?: boolean;
}

interface MapLegendProps {
  activeLayers: ActiveMapLayers;
  onToggleLayer: (key: keyof ActiveMapLayers) => void;
}

export const MapLegend: React.FC<MapLegendProps> = ({
  activeLayers,
  onToggleLayer,
}) => {
  const isGeofencesActive = activeLayers.geofences ?? true;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Layers size={18} color={COLORS.oceanBlue} />
        <Text style={styles.headerTitle}>Map Overlays & Geofencing</Text>
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

        <TouchableOpacity
          style={styles.layerItem}
          onPress={() => onToggleLayer('geofences')}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, isGeofencesActive && styles.checkboxActive]}>
            {isGeofencesActive && <Check size={13} color="#FFF" strokeWidth={3} />}
          </View>
          <View style={[styles.legendIndicator, { backgroundColor: '#EF4444', borderColor: '#991B1B' }]} />
          <Text style={styles.layerText}>Dummy Geofences (Phase 1)</Text>
        </TouchableOpacity>
      </View>

      {/* Geofence Category Legend Details */}
      {isGeofencesActive && (
        <View style={styles.geofenceLegendSection}>
          <Text style={styles.geofenceLegendHeader}>GEOFENCE CATEGORIES (DUMMY)</Text>
          <View style={styles.geofenceGrid}>
            <View style={styles.geofenceBadgeItem}>
              <View style={[styles.colorBox, { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#EF4444' }]} />
              <Text style={styles.geofenceBadgeText}>EEZ Boundary</Text>
            </View>
            <View style={styles.geofenceBadgeItem}>
              <View style={[styles.colorBox, { backgroundColor: 'rgba(249, 115, 22, 0.35)', borderColor: '#F97316' }]} />
              <Text style={styles.geofenceBadgeText}>Restricted Waters</Text>
            </View>
            <View style={styles.geofenceBadgeItem}>
              <View style={[styles.colorBox, { backgroundColor: 'rgba(16, 185, 129, 0.35)', borderColor: '#10B981' }]} />
              <Text style={styles.geofenceBadgeText}>Marine Protected Area</Text>
            </View>
            <View style={styles.geofenceBadgeItem}>
              <View style={[styles.colorBox, { backgroundColor: 'rgba(139, 92, 246, 0.35)', borderColor: '#8B5CF6' }]} />
              <Text style={styles.geofenceBadgeText}>Ecologically Sensitive</Text>
            </View>
          </View>
        </View>
      )}
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
  geofenceLegendSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  geofenceLegendHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  geofenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  geofenceBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginRight: 8,
  },
  colorBox: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1.5,
  },
  geofenceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
});
