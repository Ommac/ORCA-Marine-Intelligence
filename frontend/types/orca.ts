/**
 * Normalized ORCA Marine Intelligence Frontend Data Contract
 * Strictly adheres to normalized backend responses.
 */

export type AssessmentStatus = "SAFE" | "CAUTION" | "HIGH_RISK" | "NOT_RECOMMENDED";
export type SeverityLevel = "CRITICAL" | "HIGH" | "MODERATE" | "MEDIUM" | "LOW" | "INFO" | "NONE";
export type SVASSeverity = "alert" | "safe" | "warning" | "advisory";

export interface PFZCandidate {
  id: string;
  rank: number;
  label: string;
  name?: string;
  distance_km: number;
  bearing_degrees?: number;
  direction?: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  nearest_point?: PFZNearest;
  geometry?: any;
  category?: string;
  uid?: string | number;
  sno?: string | number;
  data_year?: number;
  julian_day?: number;
  valid_until?: string | null;
  recommended: boolean;
  recommendation_reason?: string;
}

export interface UIAction {
  type: "show_on_map" | "navigate_tab" | "highlight_hazard" | string;
  target?: string;
  rank?: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  label?: string;
  zoom?: number;
  geometry?: any;
  top_candidates?: PFZCandidate[];
}

export type SupportedLanguage = 'en' | 'mr' | 'hi' | 'ta' | 'te' | 'gu' | 'kn' | 'ml' | 'bn' | 'or';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
}

export interface OrcaRequest {
  query?: string;
  latitude: number;
  longitude: number;
  date: string; // YYYY-MM-DD
  boat_width_m: number;
  request_id?: string;
  session_id?: string;
  conversation_history?: Array<{ role: string; content: string }>;
  language?: SupportedLanguage | string;
  generate_audio?: boolean;
}

export interface Assessment {
  status: AssessmentStatus;
  risk_score: number;
  summary: string;
}

export interface PFZNearest {
  latitude: number;
  longitude: number;
  distance_km: number;
  bearing_degrees?: number;
  direction?: string;
}

export interface PFZGeometry {
  type: "Point" | "MultiPoint" | "MultiLineString" | "LineString" | "Polygon" | "MultiPolygon" | string;
  coordinates: any;
}

export interface PFZData {
  available: boolean;
  nearest?: PFZNearest;
  geometry?: PFZGeometry;
  metadata?: Record<string, unknown>;
  message?: string;
  top_candidates?: PFZCandidate[];
  selected_rank?: number;
  total_candidates?: number;
}

export interface MarineData {
  available: boolean;
  temperature_c?: number;
  wind_speed_knots?: number;
  wind_gusts_knots?: number;
  wave_height_m?: number;
  wave_period_seconds?: number;
  sea_surface_temperature_c?: number;
  ocean_current_velocity_kmh?: number;
  wind_direction_degrees?: number;
  wave_direction_degrees?: number;
  ocean_current_direction_degrees?: number;
}

export interface SVASData {
  available: boolean;
  district?: string;
  state?: string;
  severity?: SVASSeverity | string;
  message?: string;
  reason?: string;
  boat_category?: string;
}

export interface Hazard {
  id?: string;
  type: string; // e.g., "Cyclone" | "Tsunami" | "Storm Surge" | "High Waves"
  severity: SeverityLevel;
  title: string;
  description: string;
  updated_at?: string;
  source?: string;
  distance_km?: number;
  direction?: string;
}

export type AlertType = "weather" | "ocean" | "vessel" | "geofence" | "risk";
export type AlertSeverity = "critical" | "high" | "moderate" | "low" | "info";

export interface Alert {
  id: string;
  request_id?: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  source: string;
  timestamp?: string;
  action?: string;
}

export interface Meta {
  generated_at?: string;
  sources?: string[];
  version?: string;
  request_id?: string;
}

export type RiskDecision = 'GO' | 'CAUTION' | 'DONT_GO';

export interface RiskFactor {
  id: string;
  name: string;
  value?: number | string | null;
  unit?: string;
  value_formatted: string;
  status: 'safe' | 'caution' | 'danger' | 'unavailable';
  status_label: string;
  impact: 'low' | 'moderate' | 'high' | 'critical' | 'unknown';
  reason: string;
  interpretation?: string;
  threshold_context?: string;
  icon?: string;
  is_critical?: boolean;
}

export interface ActionGuidance {
  headline: string;
  action_text: string;
  urgency: 'normal' | 'caution' | 'immediate' | 'critical' | 'moderate' | 'routine';
}

export interface RiskExplanation {
  decision: RiskDecision;
  decision_label: string;
  decision_subtitle: string;
  risk_score: number;
  status: AssessmentStatus;
  dominant_hazard?: string | null;
  primary_thing_to_watch?: string | null;
  primary_thing_to_watch_reason?: string | null;
  factors: RiskFactor[];
  action_guidance: ActionGuidance;
  vessel_evaluated?: string | boolean;
  boat_width_m?: number;
  data_quality?: string;
  missing_factors?: string[];
  language?: string;
}

export interface DisplayFlags {
  pfz: boolean;
  pfz_mode?: 'pfz_list' | 'single_pfz' | 'none';
  risk_explanation?: boolean;
  marine?: boolean;
  svas?: boolean;
  ocean_hazards?: boolean;
  risk_assessment?: boolean;
  map_action?: boolean;
}

export interface OrcaResponse {
  request_id?: string;
  request?: OrcaRequest;
  assessment: Assessment;
  pfz: PFZData;
  marine: MarineData;
  svas: SVASData;
  hazards: Hazard[];
  alerts: Alert[];
  meta: Meta;
  recommendation?: string;
  ui_action?: UIAction;
  display?: DisplayFlags;
  risk_explanation?: RiskExplanation;
  top_pfz?: PFZCandidate[];
  lightning?: any;
  language?: string;
  original_recommendation?: string;
  audio_base64?: string;
}


export interface PresetLocation {
  id: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  district?: string;
}

export interface BoatSizeOption {
  id: string;
  label: string;
  sublabel: string;
  boat_width_m: number;
}

// ===========================================================================
// Alert System Types
// ===========================================================================

export type AlertSeverityLevel = 'CRITICAL' | 'HIGH' | 'CAUTION' | 'INFORMATION' | 'SAFE';

export type AlertStatus = 'active' | 'forecast' | 'informational' | 'unavailable';

export type AlertCategory =
  | 'boat_safety'
  | 'weather'
  | 'ocean_hazard'
  | 'pfz_safety'
  | 'forecast'
  | 'lightning'
  | 'geofence'
  | 'route'
  | 'tide';

export interface AlertEvidence {
  label: string;
  value: string;
  source?: string;
  unit?: string;
}

export interface OrcaAlert {
  id: string;
  type: string;
  severity: AlertSeverityLevel;
  priority: number; // 0-100, higher = more important
  title: string;
  subtitle?: string;
  location?: string;
  distance?: string;
  direction?: string;
  validFrom?: string;
  validUntil?: string;
  evidence: AlertEvidence[];
  advice: string;
  source?: string;
  status: AlertStatus;
  category: AlertCategory;
  icon?: string; // emoji icon
  updatedAt?: string;
}

export interface OrcaExplanation {
  summary?: string;
  why?: string[];
  key_conditions?: string[];
  official_warnings?: string[];
  data_limitations?: string[];
  final_advice?: string;
}

export interface LightningData {
  available: boolean;
  source?: string;
  fallback_used?: boolean;
  data?: {
    thunderstorm_active?: boolean;
    elevated_convective_risk?: boolean;
    thunderstorm_forecast_today?: boolean;
    weather_description?: string;
    weather_code?: number;
    convective_available_potential_energy_j_kg?: {
      max_cape?: number;
      instability_level?: string;
    };
  };
  reason?: string;
}

export type GeofenceCategory = "eez" | "restricted_waters" | "mpa" | "ecologically_sensitive";
export type GeofenceRestrictionLevel = "BOUNDARY" | "RESTRICTED" | "PROTECTED" | "SENSITIVE";

export interface GeofenceProperties {
  id: string;
  name: string;
  category: GeofenceCategory | string;
  category_label: string;
  restriction_level: GeofenceRestrictionLevel | string;
  description?: string;
  dataset_type?: string;
  [key: string]: any;
}

export interface GeofenceFeature {
  type: "Feature";
  id?: string;
  properties: GeofenceProperties;
  geometry: {
    type: "Polygon" | "MultiPolygon" | string;
    coordinates: any;
  };
}

export interface GeofenceCollection {
  type: "FeatureCollection";
  name?: string;
  features: GeofenceFeature[];
  metadata?: {
    total_features: number;
    dataset_type: string;
    categories?: string[];
    category_filter?: string;
  };
}

export type GeofenceSpatialStatus = "SAFE" | "WARNING" | "RESTRICTED";

export interface GeofencePointDetail {
  id: string;
  name: string;
  category: GeofenceCategory | string;
  category_label: string;
  restriction_level: GeofenceRestrictionLevel | string;
  is_inside: boolean;
  is_restricted: boolean;
  distance_to_boundary_km: number;
}

export interface GeofencePointCheckResult {
  status: GeofenceSpatialStatus;
  latitude: number;
  longitude: number;
  warning_distance_km: number;
  nearest_boundary_distance_km: number;
  nearest_category: string;
  details: GeofencePointDetail[];
}

export interface GeofenceRouteIntersection {
  id: string;
  category: GeofenceCategory | string;
  name: string;
  restriction_level: GeofenceRestrictionLevel | string;
  restricted: boolean;
}

export interface GeofenceRouteCheckResult {
  intersects: boolean;
  blocked: boolean;
  start: {
    latitude: number;
    longitude: number;
  };
  end: {
    latitude: number;
    longitude: number;
  };
  intersections: GeofenceRouteIntersection[];
}

export interface RouteOptimizeRequest {
  start: [number, number]; // [latitude, longitude]
  destination: [number, number]; // [latitude, longitude]
  grid_spacing_km?: number;
  search_margin_km?: number;
}

export interface RouteOptimizeResult {
  success: boolean;
  route: [number, number][]; // Array of [latitude, longitude]
  total_distance_km: number | null;
  nodes_explored: number;
  algorithm: string;
  reason?: string;
}




