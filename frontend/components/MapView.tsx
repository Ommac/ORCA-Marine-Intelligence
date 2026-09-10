import React from 'react';
import { OrcaResponse, PFZNearest, ActiveMapLayers, SelectedMapObject } from '../types/orca';
import { OrcaMapComponent } from './map/OrcaMapComponent';

export interface MapViewProps {
  response?: OrcaResponse | null;
  activeLayers?: ActiveMapLayers;
  selectedObject?: SelectedMapObject | null;
  onSelectObject?: (obj: SelectedMapObject | null) => void;
  onSelectPFZ?: (nearest?: PFZNearest) => void;
  onViewDetails?: () => void;
}

/**
 * Universal Marine Geographic Satellite Map Component
 * Delegates platform map rendering via Metro platform extension resolution:
 * - OrcaMapComponent.web.tsx on Web (React Leaflet + ArcGIS Satellite Tiles)
 * - OrcaMapComponent.native.tsx on Native Android/iOS (ArcGIS Satellite Map)
 */
export const OrcaMapView: React.FC<MapViewProps> = (props) => {
  return <OrcaMapComponent {...props} />;
};

