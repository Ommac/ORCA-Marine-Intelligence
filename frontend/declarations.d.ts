declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module 'leaflet' {
  const content: any;
  export default content;
  export const divIcon: any;
  export const Map: any;
}

declare module 'react-leaflet' {
  export const MapContainer: any;
  export const TileLayer: any;
  export const Marker: any;
  export const CircleMarker: any;
  export const Polygon: any;
  export const Polyline: any;
  export const Popup: any;
  export const useMap: any;
}

declare module 'react-native-maps' {
  const content: any;
  export default content;
  export const Callout: any;
  export const Circle: any;
  export const Marker: any;
  export const Polygon: any;
  export const Polyline: any;
  export type Region = any;
}
