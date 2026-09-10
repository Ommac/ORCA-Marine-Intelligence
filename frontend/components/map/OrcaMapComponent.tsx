import React from 'react';
import {
  OrcaResponse,
  PFZNearest,
  ActiveMapLayers,
  SelectedMapObject,
} from '../../types/orca';

export interface MapViewProps {
  response?: OrcaResponse | null;
  activeLayers?: ActiveMapLayers;
  selectedObject?: SelectedMapObject | null;
  onSelectObject?: (obj: SelectedMapObject | null) => void;
  onSelectPFZ?: (nearest?: PFZNearest) => void;
  onViewDetails?: () => void;
}

/**
 * Fallback / Type declaration export for OrcaMapComponent.
 * Metro resolves platform extension files (.web.tsx or .native.tsx) at runtime.
 */
export const OrcaMapComponent: React.FC<MapViewProps> = () => null;

