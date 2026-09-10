/**
 * Official Indian Coastal Tide Stations Catalog
 * Primary coastal tide gauge and observation stations along the Indian coast
 * (INCOIS / Survey of India / Port Trusts).
 */

export interface TideStation {
  id: string;
  name: string;
  state: string;
  district?: string;
  latitude: number;
  longitude: number;
  zone: 'West Coast' | 'East Coast' | 'Islands';
  authority?: string;
}

export const COASTAL_TIDE_STATIONS: TideStation[] = [
  // Maharashtra & Goa (West Coast North/Central)
  {
    id: 'tide-satpati',
    name: 'Satpati Tide Station',
    state: 'Maharashtra',
    district: 'Palghar',
    latitude: 19.717,
    longitude: 72.700,
    zone: 'West Coast',
    authority: 'INCOIS / Maharashtra Maritime Board',
  },
  {
    id: 'tide-dahanu',
    name: 'Dahanu Port',
    state: 'Maharashtra',
    district: 'Palghar',
    latitude: 19.973,
    longitude: 72.731,
    zone: 'West Coast',
    authority: 'Survey of India',
  },
  {
    id: 'tide-mumbai',
    name: 'Mumbai (Apollo Bunder)',
    state: 'Maharashtra',
    district: 'Mumbai',
    latitude: 18.922,
    longitude: 72.835,
    zone: 'West Coast',
    authority: 'Mumbai Port Authority / SOI',
  },
  {
    id: 'tide-jnpt',
    name: 'Jawaharlal Nehru Port (JNPT)',
    state: 'Maharashtra',
    district: 'Raigad',
    latitude: 18.950,
    longitude: 72.950,
    zone: 'West Coast',
    authority: 'JNPA',
  },
  {
    id: 'tide-alibaug',
    name: 'Alibaug / Revdanda',
    state: 'Maharashtra',
    district: 'Raigad',
    latitude: 18.641,
    longitude: 72.873,
    zone: 'West Coast',
    authority: 'Maharashtra Maritime Board',
  },
  {
    id: 'tide-ratnagiri',
    name: 'Ratnagiri (Mirya Bay)',
    state: 'Maharashtra',
    district: 'Ratnagiri',
    latitude: 16.993,
    longitude: 73.282,
    zone: 'West Coast',
    authority: 'Survey of India / INCOIS',
  },
  {
    id: 'tide-malvan',
    name: 'Malvan Coast',
    state: 'Maharashtra',
    district: 'Sindhudurg',
    latitude: 16.052,
    longitude: 73.467,
    zone: 'West Coast',
    authority: 'Maharashtra Maritime Board',
  },
  {
    id: 'tide-mormugao',
    name: 'Mormugao Port (Goa)',
    state: 'Goa',
    district: 'South Goa',
    latitude: 15.417,
    longitude: 73.800,
    zone: 'West Coast',
    authority: 'Mormugao Port Authority / SOI',
  },

  // Gujarat & Daman (West Coast North)
  {
    id: 'tide-daman',
    name: 'Daman Harbor',
    state: 'Daman & Diu',
    district: 'Daman',
    latitude: 20.407,
    longitude: 72.833,
    zone: 'West Coast',
    authority: 'Survey of India',
  },
  {
    id: 'tide-veraval',
    name: 'Veraval Port',
    state: 'Gujarat',
    district: 'Gir Somnath',
    latitude: 20.902,
    longitude: 70.369,
    zone: 'West Coast',
    authority: 'Gujarat Maritime Board / INCOIS',
  },
  {
    id: 'tide-kandla',
    name: 'Deendayal Port (Kandla)',
    state: 'Gujarat',
    district: 'Kutch',
    latitude: 23.008,
    longitude: 70.219,
    zone: 'West Coast',
    authority: 'Deendayal Port Authority',
  },
  {
    id: 'tide-okha',
    name: 'Okha Point',
    state: 'Gujarat',
    district: 'Devbhumi Dwarka',
    latitude: 22.467,
    longitude: 69.083,
    zone: 'West Coast',
    authority: 'Survey of India',
  },

  // Karnataka & Kerala (West Coast South)
  {
    id: 'tide-karwar',
    name: 'Karwar Port',
    state: 'Karnataka',
    district: 'Uttara Kannada',
    latitude: 14.805,
    longitude: 74.127,
    zone: 'West Coast',
    authority: 'Survey of India / INCOIS',
  },
  {
    id: 'tide-mangalore',
    name: 'New Mangalore Port',
    state: 'Karnataka',
    district: 'Dakshina Kannada',
    latitude: 12.871,
    longitude: 74.842,
    zone: 'West Coast',
    authority: 'NMPA / Survey of India',
  },
  {
    id: 'tide-kochi',
    name: 'Cochin Port (Willingdon Island)',
    state: 'Kerala',
    district: 'Ernakulam',
    latitude: 9.967,
    longitude: 76.267,
    zone: 'West Coast',
    authority: 'Cochin Port Authority / INCOIS',
  },
  {
    id: 'tide-vizhinjam',
    name: 'Vizhinjam International Port',
    state: 'Kerala',
    district: 'Thiruvananthapuram',
    latitude: 8.375,
    longitude: 76.992,
    zone: 'West Coast',
    authority: 'Vizhinjam Port / INCOIS',
  },

  // Tamil Nadu, Andhra Pradesh & Odisha (East Coast)
  {
    id: 'tide-tuticorin',
    name: 'V.O. Chidambaranar (Tuticorin)',
    state: 'Tamil Nadu',
    district: 'Thoothukudi',
    latitude: 8.756,
    longitude: 78.196,
    zone: 'East Coast',
    authority: 'VOCPA / Survey of India',
  },
  {
    id: 'tide-chennai',
    name: 'Chennai Port',
    state: 'Tamil Nadu',
    district: 'Chennai',
    latitude: 13.084,
    longitude: 80.298,
    zone: 'East Coast',
    authority: 'Chennai Port Authority / SOI',
  },
  {
    id: 'tide-vizag',
    name: 'Visakhapatnam Port',
    state: 'Andhra Pradesh',
    district: 'Visakhapatnam',
    latitude: 17.683,
    longitude: 83.283,
    zone: 'East Coast',
    authority: 'VPA / INCOIS',
  },
  {
    id: 'tide-paradip',
    name: 'Paradip Port',
    state: 'Odisha',
    district: 'Jagatsinghpur',
    latitude: 20.260,
    longitude: 86.671,
    zone: 'East Coast',
    authority: 'Paradip Port Authority / SOI',
  },
];

/**
 * Finds the nearest tide station to a given coordinate.
 */
export function findNearestTideStation(
  lat: number,
  lon: number
): { station: TideStation; distanceKm: number } | null {
  if (isNaN(lat) || isNaN(lon) || COASTAL_TIDE_STATIONS.length === 0) {
    return null;
  }

  let nearestStation: TideStation = COASTAL_TIDE_STATIONS[0];
  let minDistance = Number.MAX_VALUE;

  for (const station of COASTAL_TIDE_STATIONS) {
    const dLat = (station.latitude - lat) * (Math.PI / 180);
    const dLon = (station.longitude - lon) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat * (Math.PI / 180)) *
        Math.cos(station.latitude * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = 6371 * c;

    if (dist < minDistance) {
      minDistance = dist;
      nearestStation = station;
    }
  }

  return {
    station: nearestStation,
    distanceKm: Math.round(minDistance * 10) / 10,
  };
}
