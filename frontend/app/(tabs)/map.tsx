import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Compass, Navigation, ArrowUpRight, Radio } from 'lucide-react-native';
import { OrcaHeader } from '../../components/OrcaHeader';
import { OrcaMapView } from '../../components/MapView';
import { MapLegend, ActiveMapLayers } from '../../components/MapLegend';
import { PFZCard } from '../../components/PFZCard';
import { ResponsiveContainer } from '../../components/ResponsiveContainer';
import {
  getCurrentAssessment,
  subscribeToAssessment,
} from '../../services/api';
import { getActiveTrip, subscribeToTrip } from '../../services/tripStore';
import { OrcaResponse } from '../../types/orca';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { formatDistance } from '../../utils/formatting';

export default function MapScreen() {
  const router = useRouter();
  const [activeTrip, setActiveTrip] = useState(getActiveTrip());
  const [data, setData] = useState<OrcaResponse>(getCurrentAssessment());
  const [activeLayers, setActiveLayers] = useState<ActiveMapLayers>({
    pfz: true,
    myLocation: true,
    distance: true,
  });

  useEffect(() => {
    const unsubTrip = subscribeToTrip((trip) => {
      setActiveTrip(trip);
    });
    const unsubAssessment = subscribeToAssessment((updated) => {
      setData(updated);
    });
    return () => {
      unsubTrip();
      unsubAssessment();
    };
  }, []);

  const handleToggleLayer = (key: keyof ActiveMapLayers) => {
    setActiveLayers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleViewAssessment = () => {
    router.push('/assessment');
  };

  const hasPfz = data.pfz && data.pfz.available && data.pfz.nearest;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <OrcaHeader
        title="Interactive Fishing Map"
        subtitle="ArcGIS Topo Basemap & INCOIS PFZ Geometry"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContainer>
          {/* Active Spot Header Chip */}
        <View style={styles.tripSpotBanner}>
          <View style={styles.spotLeft}>
            <View style={styles.pinCircle}>
              <MapPin size={18} color={COLORS.oceanBlue} />
            </View>
            <View style={styles.spotTextCol}>
              <Text style={styles.spotName}>{activeTrip.location.name}</Text>
              <Text style={styles.spotCoords}>
                {activeTrip.location.latitude.toFixed(2)}°N, {activeTrip.location.longitude.toFixed(2)}°E
              </Text>
            </View>
          </View>

          {hasPfz ? (
            <View style={styles.pfzBadge}>
              <Compass size={14} color="#15803D" />
              <Text style={styles.pfzBadgeText}>
                PFZ: {formatDistance(data.pfz.nearest?.distance_km)} ({data.pfz.nearest?.direction || 'W'})
              </Text>
            </View>
          ) : (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveIndicatorText}>Live GIS</Text>
            </View>
          )}
        </View>

        {/* Real Interactive Map with Dynamic ArcGIS World Street Map Tiles */}
        <OrcaMapView
          response={data}
          activeLayers={activeLayers}
          onViewDetails={handleViewAssessment}
        />

        {/* SAMUDRA-style Layer Toggles & Legend */}
        <View style={styles.legendWrapper}>
          <MapLegend
            activeLayers={activeLayers}
            onToggleLayer={handleToggleLayer}
          />
        </View>

        {/* Nearest PFZ Summary Card with Action */}
        <PFZCard pfz={data.pfz} onViewOnMap={handleViewAssessment} />
        </ResponsiveContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 48,
  },
  tripSpotBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  spotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pinCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotTextCol: {
    flex: 1,
  },
  spotName: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  spotCoords: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  pfzBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  pfzBadgeText: {
    ...TYPOGRAPHY.caption,
    color: '#15803D',
    fontWeight: '800',
    fontSize: 11,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.oceanBlue,
  },
  liveIndicatorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  legendWrapper: {
    marginTop: SPACING.md,
  },
});
