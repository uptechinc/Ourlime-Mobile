// Declaration file for SVG imports (handled by react-native-svg-transformer via metro.config.js)
declare module '*.svg' {
  import React from 'react';
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

// Declaration for PNG/image assets
declare module '*.png' {
  const value: number;
  export default value;
}
