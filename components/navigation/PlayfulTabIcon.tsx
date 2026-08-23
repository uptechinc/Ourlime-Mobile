import { useEffect, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type PlayfulTabIconProps = {
  children: ReactNode;
  focused: boolean;
};

export default function PlayfulTabIcon({ children, focused }: PlayfulTabIconProps) {
  const progress = useSharedValue(focused ? 1 : 0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    progress.value = reduceMotion
      ? withTiming(focused ? 1 : 0, { duration: 100 })
      : withSpring(focused ? 1 : 0, { damping: 14, stiffness: 260, mass: 0.55 });
  }, [focused, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['rgba(16,185,129,0)', 'rgba(16,185,129,0.14)']),
    transform: [
      { translateY: progress.value * -2 },
      { scale: 1 + progress.value * 0.1 },
    ],
  }));

  return <Animated.View style={[styles.container, animatedStyle]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  container: {
    width: 46,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
