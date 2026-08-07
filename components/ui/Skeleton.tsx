import { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonBox({ width = '100%', height = 20, borderRadius = 8, style }: SkeletonProps) {
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.7,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacityAnim]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: '#e2e8f0',
          opacity: opacityAnim,
        },
        style,
      ]}
    />
  );
}

export function SkeletonCircle({ size = 48, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  return <SkeletonBox width={size} height={size} borderRadius={size / 2} style={style} />;
}

export function SkeletonText({ width = '80%', height = 14, borderRadius = 6, style }: SkeletonProps) {
  return <SkeletonBox width={width} height={height} borderRadius={borderRadius} style={style} />;
}
