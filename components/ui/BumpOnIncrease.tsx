import { useEffect, useRef, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

type BumpOnIncreaseProps = { value: number; style?: StyleProp<ViewStyle>; children?: ReactNode };

/**
 * Wraps a count badge (cart, saved) and gives it a quick scale "bump" whenever the count goes up, so an add that
 * happened off to the side is noticed. Stays still on first render and when the count goes down.
 */
export default function BumpOnIncrease({ value, style, children }: BumpOnIncreaseProps) {
  const scale = useSharedValue(1);
  const previous = useRef(value);
  useEffect(() => {
    if (value > previous.current) scale.value = withSequence(withTiming(1.4, { duration: 110 }), withSpring(1, { damping: 7, stiffness: 260 }));
    previous.current = value;
  }, [scale, value]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View pointerEvents="none" style={[style, animatedStyle]}>{children}</Animated.View>;
}
