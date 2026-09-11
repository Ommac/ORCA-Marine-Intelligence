declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
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

