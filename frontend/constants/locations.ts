import { PresetLocation, BoatSizeOption } from '../types/orca';

export const PRESET_LOCATIONS: PresetLocation[] = [
  {
    id: 'palghar',
    name: 'Palghar',
    state: 'Maharashtra',
    district: 'Palghar',
    latitude: 19.72,
    longitude: 72.70,
  },
  {
    id: 'ratnagiri',
    name: 'Ratnagiri',
    state: 'Maharashtra',
    district: 'Ratnagiri',
    latitude: 16.99,
    longitude: 73.29,
  },
  {
    id: 'mumbai',
    name: 'Mumbai Coast',
    state: 'Maharashtra',
    district: 'Mumbai Suburban',
    latitude: 18.92,
    longitude: 72.83,
  },
  {
    id: 'alibaug',
    name: 'Alibaug',
    state: 'Maharashtra',
    district: 'Raigad',
    latitude: 18.64,
    longitude: 72.87,
  },
  {
    id: 'malvan',
    name: 'Malvan',
    state: 'Maharashtra',
    district: 'Sindhudurg',
    latitude: 16.05,
    longitude: 73.47,
  },
  {
    id: 'daman',
    name: 'Daman',
    state: 'Daman & Diu',
    district: 'Daman',
    latitude: 20.39,
    longitude: 72.83,
  },
  {
    id: 'goa',
    name: 'Goa (Panaji)',
    state: 'Goa',
    district: 'North Goa',
    latitude: 15.49,
    longitude: 73.82,
  },
  {
    id: 'veraval',
    name: 'Veraval',
    state: 'Gujarat',
    district: 'Gir Somnath',
    latitude: 20.90,
    longitude: 70.36,
  },
];

export const BOAT_SIZES: BoatSizeOption[] = [
  {
    id: 'under_4m',
    label: 'Under 4 m',
    sublabel: 'Small Canoe / Dinghy',
    boat_width_m: 3.5,
  },
  {
    id: '4_6m',
    label: '4–6 m',
    sublabel: 'FRP / Motorized Craft',
    boat_width_m: 5.0,
  },
  {
    id: '6_7m',
    label: '6–7 m',
    sublabel: 'Medium Trawler / Gillnetter',
    boat_width_m: 6.5,
  },
  {
    id: '7m_plus',
    label: '7 m+',
    sublabel: 'Large Deep-Sea Vessel',
    boat_width_m: 7.5,
  },
];
