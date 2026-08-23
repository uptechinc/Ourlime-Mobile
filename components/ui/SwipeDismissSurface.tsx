import type { ReactNode } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';
import SwipeDismissHandle from './SwipeDismissHandle';

type SwipeDismissSurfaceProps = {
  visible: boolean;
  onDismiss: () => void;
  handleColor: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export default function SwipeDismissSurface({
  visible,
  onDismiss,
  handleColor,
  children,
  style,
  disabled = false,
  accessibilityLabel,
}: SwipeDismissSurfaceProps) {
  const swipeDismiss = useSwipeDismiss({ visible, onDismiss, disabled });
  return (
    <Animated.View style={[style, swipeDismiss.animatedStyle]}>
      <SwipeDismissHandle
        gesture={swipeDismiss.gesture}
        color={handleColor}
        animatedStyle={swipeDismiss.handleAnimatedStyle}
        accessibilityLabel={accessibilityLabel}
      />
      {children}
    </Animated.View>
  );
}
