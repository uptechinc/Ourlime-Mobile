import type { ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideInLeft,
  SlideOutDown,
  SlideOutLeft,
  useReducedMotion,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ModalMotionVariant = 'dialog' | 'sheet' | 'drawer' | 'fullscreen';

type ModalBackdropProps = Omit<PressableProps, 'style' | 'children'> & {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

type ModalMotionSurfaceProps = {
  children: ReactNode;
  variant: ModalMotionVariant;
  style?: StyleProp<ViewStyle>;
};

export function ModalBackdrop({ children, style, ...pressableProps }: ModalBackdropProps) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatedPressable
      entering={FadeIn.duration(reduceMotion ? 100 : 180)}
      exiting={FadeOut.duration(reduceMotion ? 80 : 150)}
      style={style}
      {...pressableProps}
    >
      {children}
    </AnimatedPressable>
  );
}

export function ModalMotionSurface({ children, variant, style }: ModalMotionSurfaceProps) {
  const reduceMotion = useReducedMotion();
  const entering = reduceMotion
    ? FadeIn.duration(100)
    : variant === 'sheet' || variant === 'fullscreen'
      ? SlideInDown.springify().damping(20).stiffness(220).mass(0.72)
      : variant === 'drawer'
        ? SlideInLeft.springify().damping(20).stiffness(230).mass(0.72)
        : ZoomIn.springify().damping(17).stiffness(240).mass(0.65);
  const exiting = reduceMotion
    ? FadeOut.duration(80)
    : variant === 'sheet' || variant === 'fullscreen'
      ? SlideOutDown.duration(210)
      : variant === 'drawer'
        ? SlideOutLeft.duration(190)
        : ZoomOut.duration(150);

  return (
    <Animated.View entering={entering} exiting={exiting} style={style}>
      {children}
    </Animated.View>
  );
}
