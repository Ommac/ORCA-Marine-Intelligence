/**
 * Normalized ORCA Marine Intelligence Frontend Data Contract
 * Strictly adheres to normalized backend responses.
 */

export type AssessmentStatus = "SAFE" | "CAUTION" | "HIGH_RISK" | "NOT_RECOMMENDED";
export type SeverityLevel = "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type SVASSeverity = "alert" | "safe" | "warning" | "advisory";

export interface OrcaRequest {
  query?: string;
  latitude: number;
  longitude: number;
  date: string; // YYYY-MM-DD
  boat_width_m: number;
  request_id?: string;
  mode?: 'trip_assessment' | 'chat_query' | string;
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
  type: "MultiLineString" | "LineString" | "Polygon" | "MultiPolygon" | string;
  coordinates: any;
}

export interface PFZData {
  available: boolean;
  nearest?: PFZNearest;
  geometry?: PFZGeometry;
  message?: string;
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

export interface Meta {
  generated_at?: string;
  sources?: string[];
  version?: string;
  request_id?: string;
}

export interface OrcaResponse {
  request_id?: string;
  request?: OrcaRequest;
  assessment: Assessment;
  pfz: PFZData;
  marine: MarineData;
  svas: SVASData;
  hazards: Hazard[];
  meta: Meta;
  recommendation?: string;
  // Extended fields for alert system (additive)
  explanation?: OrcaExplanation;
  riskFactors?: RiskFactor[];
  riskReasons?: string[];
  lightning?: LightningData;
  hardOverride?: boolean;
  overrideReason?: string;
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

export interface RiskFactor {
  factor: string;
  value: any;
  unit: string;
  risk: number;
  weight: number;
  base_weight: number;
  contribution: number;
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
