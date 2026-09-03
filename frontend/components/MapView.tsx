import React from 'react';
import { Platform } from 'react-native';
import { OrcaResponse, PFZNearest } from '../types/orca';
import { WebMap } from './map/WebMap';
import { NativeMap } from './map/NativeMap';

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
 * Universal Geographic Map Component
 * Renders MapLibre GL JS on Web and @maplibre/maplibre-react-native on Native
 * with ArcGIS World Street Map MapServer as the live dynamic geographic basemap.
 */
export const OrcaMapView: React.FC<MapViewProps> = (props) => {
  if (Platform.OS === 'web') {
    return <WebMap {...props} />;
  }

  return <NativeMap {...props} />;
};
