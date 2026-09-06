import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Anchor, Construction, Navigation } from 'lucide-react-native';
import { OrcaHeader } from '../../components/OrcaHeader';
import { AlertContextHeader } from '../../components/alerts/AlertContextHeader';
import { AlertSummaryBanner } from '../../components/alerts/AlertSummaryBanner';
import { PersonalizedBoatAlert } from '../../components/alerts/PersonalizedBoatAlert';
import { ActiveAlertCard } from '../../components/alerts/ActiveAlertCard';
import { ForecastRiskSection } from '../../components/alerts/ForecastRiskSection';
import { FutureFeaturePlaceholder } from '../../components/alerts/FutureFeaturePlaceholder';
import { EmptyState } from '../../components/EmptyState';
import {
  getCurrentAssessment,
  subscribeToAssessment,
} from '../../services/api';
import {
  getActiveTrip,
  subscribeToTrip,
  ActiveTripState,
} from '../../services/tripStore';
import { OrcaResponse } from '../../types/orca';
import { generateAlerts, categorizeAlerts, countAlertsBySeverity } from '../../utils/alertEngine';
import { COLORS, TYPOGRAPHY, SPACING } from '../../constants/theme';

/**
 * Validates that the assessment response matches the current active trip context
 * (location coordinates, date, and boat size).
 */
function isAssessmentValidForTrip(data: OrcaResponse | null, trip: ActiveTripState): boolean {
  if (!data || !data.request) return false;

  const reqLat = data.request.latitude;
  const reqLon = data.request.longitude;

  if (typeof reqLat !== 'number' || typeof reqLon !== 'number') return false;

  // Check coordinates match selected location (tolerance 0.05 degrees ~ 5.5 km)
  const isLocMatch =
    Math.abs(reqLat - trip.location.latitude) < 0.05 &&
    Math.abs(reqLon - trip.location.longitude) < 0.05;

  // Check date match
  const isDateMatch = !data.request.date || data.request.date === trip.date;

  // Check boat width match
  const isBoatMatch =
    !data.request.boat_width_m ||
    Math.abs(data.request.boat_width_m - trip.boatWidthM) < 0.1;

  return isLocMatch && isDateMatch && isBoatMatch;
}

export default function AlertsScreen() {
  const [data, setData] = useState<OrcaResponse | null>(getCurrentAssessment());
  const [trip, setTrip] = useState<ActiveTripState>(getActiveTrip());

  useEffect(() => {
    const unsubAssessment = subscribeToAssessment((updated) => {
      setData(updated);
    });
    const unsubTrip = subscribeToTrip((updatedTrip) => {
      setTrip(updatedTrip);
    });
    return () => {
      unsubAssessment();
      unsubTrip();
    };
  }, []);

  const hasValidAssessment = isAssessmentValidForTrip(data, trip);
  const validData = hasValidAssessment ? data : null;

  // Generate alerts only when a valid assessment exists for the current trip selection
  const allAlerts = validData ? generateAlerts(validData, trip) : [];
  const categorized = categorizeAlerts(allAlerts);
  const alertCounts = countAlertsBySeverity(allAlerts);
  const totalActiveAlerts = categorized.active.length;

  // Find the personalized boat alert (SVAS)
  const boatAlert = allAlerts.find(a => a.type === 'svas_boat');
  const activeAlertsWithoutBoat = categorized.active.filter(a => a.type !== 'svas_boat');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <OrcaHeader
        title="Alerts & Warnings"
        subtitle="Marine Safety Decision Support"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Selected Location Context Header */}
        <AlertContextHeader
          locationName={trip.location.name}
          date={trip.date}
          boatWidthM={trip.boatWidthM}
          district={trip.location.district}
          state={trip.location.state}
        />

        {!hasValidAssessment || !validData ? (
          /* Empty / Unavailable state when backend is offline or no assessment exists for selection */
          <EmptyState
            title="Current Marine Assessment Unavailable"
            message="No active marine assessment found for your selected fishing location and date. Please tap 'Check Conditions' from the Home screen."
          />
        ) : (
          /* Render current live assessment alerts */
          <>
            {/* 2. Alert Summary Banner */}
            <AlertSummaryBanner
              assessmentStatus={validData.assessment.status}
              riskScore={validData.assessment.risk_score}
              alertCounts={alertCounts}
              totalActiveAlerts={totalActiveAlerts}
            />

            {/* 3. Personalized Boat Status */}
            {boatAlert && (
              <View>
                <Text style={styles.sectionHeader}>🚤  Your Boat Status</Text>
                <PersonalizedBoatAlert
                  alert={boatAlert}
                  boatWidthM={trip.boatWidthM}
                />
              </View>
            )}

            {/* 4. Active Alerts Section */}
            {activeAlertsWithoutBoat.length > 0 && (
              <View>
                <Text style={styles.sectionHeader}>🚨  Active Alerts</Text>
                {activeAlertsWithoutBoat.map((alert) => (
                  <ActiveAlertCard key={alert.id} alert={alert} />
                ))}
              </View>
            )}

            {/* 5. Forecast Risks Section */}
            {categorized.forecast.length > 0 && (
              <ForecastRiskSection alerts={categorized.forecast} />
            )}

            {/* 6. Status Updates */}
            {categorized.informational.length > 0 && (
              <View>
                <Text style={[styles.sectionHeader, { marginTop: SPACING.md }]}>
                  📋  Status Updates
                </Text>
                {categorized.informational.map((alert) => (
                  <ActiveAlertCard key={alert.id} alert={alert} />
                ))}
              </View>
            )}

            {/* 7. Safe confirmations */}
            {categorized.safe.length > 0 && totalActiveAlerts === 0 && categorized.forecast.length === 0 && (
              <View>
                <Text style={[styles.sectionHeader, { marginTop: SPACING.md }]}>
                  ✅  All Clear
                </Text>
                {categorized.safe.map((alert) => (
                  <ActiveAlertCard key={alert.id} alert={alert} />
                ))}
              </View>
            )}

            {/* 8. Empty State — no alerts for this valid assessment */}
            {allAlerts.length === 0 && (
              <EmptyState
                title="No Active Alerts"
                message="No severe weather or marine alerts reported for this location and date."
              />
            )}
          </>
        )}

        {/* 9. Future Navigation Safety Placeholders */}
        <View>
          <Text style={[styles.sectionHeader, { marginTop: SPACING.lg }]}>
            🗺  Navigation Safety
          </Text>
          <Text style={styles.sectionSubtitle}>
            Future features — will activate when data sources are available
          </Text>
          <FutureFeaturePlaceholder
            title="Geofence Monitoring"
            description="Maritime boundary and restricted zone alerts will be available when boundary data and navigation tracking are enabled."
            icon={<Construction size={18} color={COLORS.neutral} />}
          />
          <FutureFeaturePlaceholder
            title="Tide Information"
            description="High/low tide times and tidal current warnings will be available when tide data integration is completed."
            icon={<Anchor size={18} color={COLORS.neutral} />}
          />
          <FutureFeaturePlaceholder
            title="Route Safety"
            description="Route hazard analysis along your path to fishing zones will be available when route optimization is implemented."
            icon={<Navigation size={18} color={COLORS.neutral} />}
          />
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  sectionHeader: {
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.textPrimary,
    fontWeight: '800',
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  sectionSubtitle: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textTertiary,
    marginBottom: SPACING.sm,
  },
});
