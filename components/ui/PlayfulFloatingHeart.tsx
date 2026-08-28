import { useState, useCallback, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';

export type PlayfulFloatingHeartRef = {
  trigger: (x?: number, y?: number) => void;
};

type HeartInstance = {
  id: number;
  x?: number;
  y?: number;
  angle: number;
};

type PlayfulFloatingHeartProps = {
  heartColor?: string;
  size?: number;
};

function SingleHeartItem({
  angle,
  size,
  color,
  onFinish,
}: {
  angle: number;
  size: number;
  color: string;
  onFinish: () => void;
}) {
  const scale = useSharedValue(0.1);
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);

  // Spark particle animations
  const sparkScale1 = useSharedValue(0);
  const sparkScale2 = useSharedValue(0);
  const sparkScale3 = useSharedValue(0);

  useEffect(() => {
    // Main Heart bouncy entrance
    scale.value = withSequence(
      withSpring(1.35, { damping: 6, stiffness: 220 }),
      withSpring(1.0, { damping: 8, stiffness: 180 })
    );

    // Floating upward + playful tilt
    translateY.value = withTiming(-65, { duration: 750 });
    rotate.value = withTiming(angle, { duration: 700 });

    // Sparks bursting outward
    sparkScale1.value = withSequence(
      withDelay(80, withSpring(1.2, { damping: 5 })),
      withTiming(0, { duration: 400 })
    );
    sparkScale2.value = withSequence(
      withDelay(120, withSpring(1.0, { damping: 5 })),
      withTiming(0, { duration: 400 })
    );
    sparkScale3.value = withSequence(
      withDelay(100, withSpring(1.1, { damping: 5 })),
      withTiming(0, { duration: 400 })
    );

    // Smooth fade-out after delay
    opacity.value = withDelay(
      380,
      withTiming(0, { duration: 370 }, (finished) => {
        if (finished) {
          runOnJS(onFinish)();
        }
      })
    );
  }, [angle, onFinish, opacity, rotate, scale, sparkScale1, sparkScale2, sparkScale3, translateY]);

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  const spark1Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: -36 },
      { translateY: -28 + translateY.value * 0.4 },
      { scale: sparkScale1.value },
    ],
    opacity: opacity.value,
  }));

  const spark2Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: 34 },
      { translateY: -32 + translateY.value * 0.4 },
      { scale: sparkScale2.value },
    ],
    opacity: opacity.value,
  }));

  const spark3Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: 0 },
      { translateY: -50 + translateY.value * 0.5 },
      { scale: sparkScale3.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <View style={styles.centerAbsolute} pointerEvents="none">
      {/* Mini Spark Particles */}
      <Animated.View style={[styles.spark, spark1Style]}>
        <Ionicons name="sparkles" size={20} color="#fbbf24" />
      </Animated.View>
      <Animated.View style={[styles.spark, spark2Style]}>
        <Ionicons name="sparkles" size={16} color="#fb7185" />
      </Animated.View>
      <Animated.View style={[styles.spark, spark3Style]}>
        <Ionicons name="heart" size={18} color="#f43f5e" />
      </Animated.View>

      {/* Main Big Heart */}
      <Animated.View style={[styles.mainHeartContainer, heartAnimatedStyle]}>
        <Ionicons name="heart" size={size} color={color} />
      </Animated.View>
    </View>
  );
}

export const PlayfulFloatingHeart = forwardRef<PlayfulFloatingHeartRef, PlayfulFloatingHeartProps>(
  function PlayfulFloatingHeart({ heartColor = '#ef4444', size = 96 }, ref) {
    const [hearts, setHearts] = useState<HeartInstance[]>([]);
    const nextIdRef = useRef(1);

    const trigger = useCallback((x?: number, y?: number) => {
      void interactionFeedbackService.play('like');
      const id = nextIdRef.current++;
      const randomAngle = (Math.random() - 0.5) * 26; // -13deg to +13deg tilt
      setHearts((current) => [...current, { id, x, y, angle: randomAngle }]);
    }, []);

    useImperativeHandle(ref, () => ({ trigger }), [trigger]);

    const removeHeart = useCallback((id: number) => {
      setHearts((current) => current.filter((h) => h.id !== id));
    }, []);

    if (hearts.length === 0) return null;

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {hearts.map((heart) => (
          <SingleHeartItem
            key={heart.id}
            angle={heart.angle}
            size={size}
            color={heartColor}
            onFinish={() => removeHeart(heart.id)}
          />
        ))}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  centerAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
  mainHeartContainer: {
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  spark: {
    position: 'absolute',
  },
});
