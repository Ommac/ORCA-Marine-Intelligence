/**
 * Normalized ORCA Marine Intelligence Frontend Data Contract
 * Strictly adheres to normalized backend responses.
 */

export type AssessmentStatus = "SAFE" | "CAUTION" | "NOT_RECOMMENDED";
export type SeverityLevel = "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type SVASSeverity = "alert" | "safe" | "warning" | "advisory";

export interface OrcaRequest {
  query?: string;
  latitude: number;
  longitude: number;
  date: string; // YYYY-MM-DD
  boat_width_m: number;
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
}

export interface OrcaResponse {
  request?: OrcaRequest;
  assessment: Assessment;
  pfz: PFZData;
  marine: MarineData;
  svas: SVASData;
  hazards: Hazard[];
  meta: Meta;
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
