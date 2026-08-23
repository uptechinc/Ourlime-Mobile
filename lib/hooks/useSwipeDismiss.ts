import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Dimensions, type ViewStyle } from 'react-native';
import { Gesture, type PanGesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';

const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 650;
const CLOSE_DURATION_MS = 220;
const CLOSE_DISTANCE = Dimensions.get('window').height + 120;
const SPRING_CONFIG = {
  damping: 22,
  stiffness: 230,
  mass: 0.72,
  overshootClamping: false,
  reduceMotion: ReduceMotion.System,
} as const;

type UseSwipeDismissOptions = {
  visible: boolean;
  onDismiss: () => void;
  disabled?: boolean;
  animateOnOpen?: boolean;
};

type SwipeDismissResult = {
  animatedStyle: AnimatedStyle<ViewStyle>;
  backdropAnimatedStyle: AnimatedStyle<ViewStyle>;
  handleAnimatedStyle: AnimatedStyle<ViewStyle>;
  gesture: PanGesture;
  dismissWithAnimation: () => void;
};

export function useSwipeDismiss({ visible, onDismiss, disabled = false, animateOnOpen = true }: UseSwipeDismissOptions): SwipeDismissResult {
  const translateY = useSharedValue(0);
  const onDismissRef = useRef(onDismiss);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useLayoutEffect(() => {
    if (!visible) return;
    cancelAnimation(translateY);
    if (animateOnOpen) {
      translateY.value = CLOSE_DISTANCE;
      translateY.value = withSpring(0, SPRING_CONFIG);
      return;
    }
    translateY.value = 0;
  }, [animateOnOpen, translateY, visible]);

  const handleDismissed = useCallback(() => {
    onDismissRef.current();
  }, []);

  const handleDismissFeedback = useCallback(() => {
    void interactionFeedbackService.play('selection');
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, CLOSE_DISTANCE], [1, 0.88], 'clamp'),
    transform: [
      { translateY: translateY.value },
      { scale: interpolate(translateY.value, [0, CLOSE_DISTANCE], [1, 0.985], 'clamp') },
    ],
  }));

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, CLOSE_DISTANCE * 0.72], [1, 0], 'clamp'),
  }));

  const handleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, DISMISS_DISTANCE * 1.5], [0.72, 1], 'clamp'),
    transform: [{ scaleX: interpolate(translateY.value, [0, DISMISS_DISTANCE], [1, 1.42], 'clamp') }],
  }));

  const gesture = useMemo(
    () => Gesture.Pan()
      .enabled(!disabled)
      .minDistance(1)
      .activeOffsetY(1)
      .failOffsetX([-24, 24])
      .onBegin(() => {
        cancelAnimation(translateY);
      })
      .onUpdate((event) => {
        translateY.value = Math.max(0, event.translationY);
      })
      .onEnd((event) => {
        if (event.translationY >= DISMISS_DISTANCE || event.velocityY >= DISMISS_VELOCITY) {
          runOnJS(handleDismissFeedback)();
          translateY.value = withTiming(CLOSE_DISTANCE, {
            duration: CLOSE_DURATION_MS,
            easing: Easing.out(Easing.cubic),
            reduceMotion: ReduceMotion.System,
          }, (finished) => {
            if (finished) runOnJS(handleDismissed)();
          });
          return;
        }
        translateY.value = withSpring(0, SPRING_CONFIG);
      })
      .onFinalize((_event, succeeded) => {
        if (!succeeded) translateY.value = withSpring(0, SPRING_CONFIG);
      }),
    [disabled, handleDismissFeedback, handleDismissed, translateY],
  );

  const dismissWithAnimation = useCallback(() => {
    if (disabledRef.current) {
      translateY.value = withSpring(0, SPRING_CONFIG);
      return;
    }
    cancelAnimation(translateY);
    void interactionFeedbackService.play('selection');
    translateY.value = withTiming(CLOSE_DISTANCE, {
      duration: CLOSE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    }, (finished) => {
      if (finished) runOnJS(handleDismissed)();
    });
  }, [handleDismissed, translateY]);

  return { animatedStyle, backdropAnimatedStyle, handleAnimatedStyle, gesture, dismissWithAnimation };
}
