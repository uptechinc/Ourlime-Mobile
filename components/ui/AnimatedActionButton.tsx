import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  interactionFeedbackService,
  type InteractionFeedbackKind,
} from '@/lib/services/InteractionFeedbackService';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type AnimatedActionButtonProps = {
  children: ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  feedback?: InteractionFeedbackKind;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  pressScale?: number;
  playful?: boolean;
};

export default function AnimatedActionButton({
  children,
  onPress,
  style,
  disabled = false,
  feedback = 'selection',
  accessibilityLabel,
  accessibilityHint,
  testID,
  pressScale = 0.9,
  playful = true,
}: AnimatedActionButtonProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { scale: scale.value },
      { rotate: `${playful ? (1 - scale.value) * -9 : 0}deg` },
    ],
  }));

  const handlePressIn = () => {
    if (disabled) return;
    if (!reduceMotion) {
      const targetScale = feedback === 'like' ? 0.8 : pressScale;
      scale.value = withTiming(targetScale, { duration: 60 });
      opacity.value = withTiming(0.85, { duration: 60 });
    }
    void interactionFeedbackService.play(feedback);
  };

  const handlePressOut = () => {
    if (reduceMotion) return;
    if (feedback === 'like') {
      scale.value = withSequence(
        withSpring(1.3, { damping: 5, stiffness: 280 }),
        withSpring(1.0, { damping: 8, stiffness: 220 })
      );
    } else if (feedback === 'comment') {
      scale.value = withSequence(
        withSpring(1.18, { damping: 6, stiffness: 260 }),
        withSpring(1.0, { damping: 9, stiffness: 200 })
      );
    } else {
      scale.value = withSpring(1, { damping: 13, stiffness: 310, mass: 0.55 });
    }
    opacity.value = withTiming(1, { duration: 120 });
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
      testID={testID}
    >
      {children}
    </AnimatedPressable>
  );
}
