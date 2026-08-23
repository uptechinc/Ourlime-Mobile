import { StyleSheet, View, type ViewStyle } from 'react-native';
import { GestureDetector, GestureHandlerRootView, type PanGesture } from 'react-native-gesture-handler';
import Animated, { FadeInDown, type AnimatedStyle } from 'react-native-reanimated';

type SwipeDismissHandleProps = {
  gesture: PanGesture;
  color: string;
  accessibilityLabel?: string;
  animatedStyle?: AnimatedStyle<ViewStyle>;
};

export default function SwipeDismissHandle({ gesture, color, accessibilityLabel = 'Swipe down to close', animatedStyle }: SwipeDismissHandleProps) {
  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <GestureDetector gesture={gesture}>
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint="Drag downward to close this panel"
          style={styles.touchTarget}
        >
          <Animated.View entering={FadeInDown.duration(180)}>
            <Animated.View style={[styles.handle, { backgroundColor: color }, animatedStyle]} />
          </Animated.View>
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { width: '100%' },
  touchTarget: { width: '100%', minHeight: 28, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 44, height: 5, borderRadius: 3 },
});
