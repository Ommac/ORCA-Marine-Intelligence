import React from 'react';
import { OrcaResponse, PFZNearest, PFZCandidate } from '../types/orca';
import { OrcaMapComponent } from './map/OrcaMapComponent';

export interface MapViewProps {
  response?: OrcaResponse | null;
  activeLayers?: {
    pfz?: boolean;
    myLocation?: boolean;
    distance?: boolean;
    geofences?: boolean;
    route?: boolean;
  };
  selectedPFZId?: string | null;
  optimizedRoute?: [number, number][];
  onSelectPFZ?: (nearest?: PFZNearest) => void;
  onSelectCandidate?: (candidate: PFZCandidate) => void;
  onViewDetails?: () => void;
}

/**
 * Universal Geographic Satellite Map Component
 * Delegates platform map rendering via Metro platform extension resolution:
 * - OrcaMapComponent.web.tsx on Web (React Leaflet)
 * - OrcaMapComponent.native.tsx on Native Android/iOS (react-native-maps)
 * Both platforms use online ArcGIS World Imagery Satellite tiles.
 */
export const OrcaMapView: React.FC<MapViewProps> = (props) => {
  return <OrcaMapComponent {...props as any} />;
};
