import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OrcaHeader } from '../../components/OrcaHeader';
import { OrcaMapView } from '../../components/MapView';
import { MapLegend, ActiveMapLayers } from '../../components/MapLegend';
import { PFZCard } from '../../components/PFZCard';
import {
  getCurrentAssessment,
  subscribeToAssessment,
} from '../../services/api';
import { OrcaResponse } from '../../types/orca';
import { COLORS, SPACING } from '../../constants/theme';

export default function MapScreen() {
  const router = useRouter();
  const [data, setData] = useState<OrcaResponse>(getCurrentAssessment());
  const [activeLayers, setActiveLayers] = useState<ActiveMapLayers>({
    pfz: true,
    myLocation: true,
    distance: true,
  });

  useEffect(() => {
    const unsubscribe = subscribeToAssessment((updated) => {
      setData(updated);
    });
    return () => unsubscribe();
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <OrcaHeader
        title="Potential Fishing Zones"
        subtitle="ArcGIS Live Geographic Basemap & PFZ Geometry"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
    paddingBottom: 40,
  },
  legendWrapper: {
    marginTop: SPACING.md,
  },
});
