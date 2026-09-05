import React from 'react';
import { OrcaResponse, PFZNearest } from '../types/orca';
import { OrcaMapComponent } from './map/OrcaMapComponent';

export interface MapViewProps {
  response: OrcaResponse;
  activeLayers?: {
    pfz: boolean;
    myLocation: boolean;
    distance: boolean;
  };
  onSelectPFZ?: (nearest?: PFZNearest) => void;
  onViewDetails?: () => void;
}

/**
 * Universal Geographic Satellite Map Component
 * Delegates platform map rendering via Metro platform extension resolution:
 * - OrcaMapComponent.web.tsx on Web (MapLibre GL JS)
 * - OrcaMapComponent.native.tsx on Native Android/iOS (@maplibre/maplibre-react-native)
 * Both platforms use online ArcGIS World Imagery Satellite tiles.
 */
export const OrcaMapView: React.FC<MapViewProps> = (props) => {
  return <OrcaMapComponent {...props} />;
};
