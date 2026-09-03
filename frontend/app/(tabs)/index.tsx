import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Fish,
  Waves,
  ShieldAlert,
  MessageSquareQuote,
  Sparkles,
} from 'lucide-react-native';
import { OrcaHeader } from '../../components/OrcaHeader';
import { LocationSelector } from '../../components/LocationSelector';
import { DateSelector } from '../../components/DateSelector';
import { BoatSizeSelector } from '../../components/BoatSizeSelector';
import { CheckConditionsButton } from '../../components/CheckConditionsButton';
import { LoadingState } from '../../components/LoadingState';
import { PRESET_LOCATIONS, BOAT_SIZES } from '../../constants/locations';
import { getOrcaAssessment } from '../../services/api';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';

export default function HomeScreen() {
  const router = useRouter();

  // Primary Trip State
  const [selectedLocation, setSelectedLocation] = useState(PRESET_LOCATIONS[0]); // Default to Palghar
  const [selectedDate, setSelectedDate] = useState('2026-09-03');
  const [selectedBoatWidth, setSelectedBoatWidth] = useState(5.0); // Default to 4–6m (5.0m)
  const [loading, setLoading] = useState(false);

  const handleCheckConditions = async () => {
    setLoading(true);
    try {
      await getOrcaAssessment({
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        date: selectedDate,
        boat_width_m: selectedBoatWidth,
        query: `Check conditions for ${selectedLocation.name}`,
      });

      // Navigate to detailed Assessment Screen
      router.push({
        pathname: '/assessment',
        params: {
          locationName: selectedLocation.name,
          date: selectedDate,
          boatWidth: selectedBoatWidth.toString(),
        },
      });
    } catch (err: any) {
      Alert.alert(
        'Assessment Notice',
        err?.message || 'ORCA could not fetch the latest conditions. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <OrcaHeader />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Tagline */}
        <View style={styles.heroBanner}>
          <Text style={styles.heroTitle}>Smart Advice. Safe Fishing.</Text>
          <Text style={styles.heroSubtitle}>
            Plan your fishing trip with real-time ocean intelligence from INCOIS and Marine Weather models.
          </Text>
        </View>

        {/* Form Container Card */}
        <View style={styles.formCard}>
          {/* 1. Location Selection */}
          <LocationSelector
            selectedLocation={selectedLocation}
            onSelectLocation={(loc) =>
              setSelectedLocation({
                id: (loc as any).id || 'custom',
                name: loc.name,
                state: loc.state || 'Coastal Zone',
                district: (loc as any).district,
                latitude: loc.latitude,
                longitude: loc.longitude,
              })
            }
          />

          {/* 2. Date Selection */}
          <DateSelector
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />

          {/* 3. Boat Size Selection */}
          <BoatSizeSelector
            selectedBoatWidth={selectedBoatWidth}
            onSelectBoat={(opt) => setSelectedBoatWidth(opt.boat_width_m)}
          />

          {/* Primary CTA */}
          <CheckConditionsButton
            onPress={handleCheckConditions}
            loading={loading}
          />
        </View>

        {/* Loading Step Animation when checking conditions */}
        {loading && <LoadingState />}

        {/* Quick Action Shortcuts */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.quickActionsTitle}>Quick Shortcuts</Text>

          <View style={styles.quickActionsGrid}>
            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/map')}
              activeOpacity={0.8}
            >
              <View style={[styles.quickIconBox, { backgroundColor: '#DCFCE7' }]}>
                <Fish size={22} color="#15803D" strokeWidth={2.4} />
              </View>
              <Text style={styles.quickActionLabel}>Fishing Zones</Text>
              <Text style={styles.quickActionSub}>Locate PFZ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={handleCheckConditions}
              activeOpacity={0.8}
            >
              <View style={[styles.quickIconBox, { backgroundColor: '#E0F2FE' }]}>
                <Waves size={22} color={COLORS.oceanBlue} strokeWidth={2.4} />
              </View>
              <Text style={styles.quickActionLabel}>Sea Weather</Text>
              <Text style={styles.quickActionSub}>Waves & Wind</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/alerts')}
              activeOpacity={0.8}
            >
              <View style={[styles.quickIconBox, { backgroundColor: '#FEE2E2' }]}>
                <ShieldAlert size={22} color="#DC2626" strokeWidth={2.4} />
              </View>
              <Text style={styles.quickActionLabel}>Check Hazards</Text>
              <Text style={styles.quickActionSub}>Alerts & SVAS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionCard}
              onPress={() => router.push('/(tabs)/ask')}
              activeOpacity={0.8}
            >
              <View style={[styles.quickIconBox, { backgroundColor: '#F3E8FF' }]}>
                <MessageSquareQuote size={22} color="#7E22CE" strokeWidth={2.4} />
              </View>
              <Text style={styles.quickActionLabel}>Ask ORCA</Text>
              <Text style={styles.quickActionSub}>Trip Advice</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Safety Tips Banner */}
        <View style={styles.infoBanner}>
          <Sparkles size={20} color={COLORS.oceanBlue} />
          <Text style={styles.infoBannerText}>
            Always check Small Vessel Advisories (SVAS) before sailing out in motorized craft under 6m.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scrollView: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  heroBanner: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  heroTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.primary,
    fontSize: 24,
  },
  heroSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.md,
  },
  quickActionsSection: {
    marginTop: SPACING.xl,
  },
  quickActionsTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  quickIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    ...TYPOGRAPHY.bodyLarge,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  quickActionSub: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.lg,
    gap: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoBannerText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
});
