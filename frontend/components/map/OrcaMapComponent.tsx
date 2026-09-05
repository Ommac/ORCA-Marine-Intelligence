import React from 'react';
import { OrcaResponse, PFZNearest } from '../../types/orca';

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
 * Fallback / Type declaration export for OrcaMapComponent.
 * Metro resolves platform extension files (.web.tsx or .native.tsx) at runtime.
 */
export const OrcaMapComponent: React.FC<MapViewProps> = () => null;
