import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, View, type KeyboardEvent, type LayoutChangeEvent, type ViewProps } from 'react-native';

const RE_MEASURE_DELAYS_MS = [120, 350, 800];

type MeasurableView = {
  measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

type KeyboardSafeViewProps = ViewProps & {
  /** Called when the keyboard opens or closes over this view (e.g. to let a sheet grow while typing). */
  onKeyboardChange?: (isCovering: boolean) => void;
};

/**
 * Keeps its content above the software keyboard on Android and iOS, inside Modals too. The app is edge-to-edge, so
 * Android doesn't resize the window for the keyboard (and Modals never were), and KeyboardAvoidingView with no
 * behavior does nothing. This view measures where it ends on screen and pads its bottom by exactly the part the
 * keyboard covers, so it is right whether or not the window was also resized. Use it as the root of a screen or the
 * backdrop of a sheet in place of a plain View or KeyboardAvoidingView.
 */
export default function KeyboardSafeView({ style, onLayout, onKeyboardChange, children, ...rest }: KeyboardSafeViewProps) {
  const viewRef = useRef<MeasurableView | null>(null);
  const keyboardTopRef = useRef<number | null>(null);
  const onKeyboardChangeRef = useRef(onKeyboardChange);
  onKeyboardChangeRef.current = onKeyboardChange;
  const [bottomInset, setBottomInset] = useState(0);

  const updateInset = useCallback(() => {
    const keyboardTop = keyboardTopRef.current;
    const view = viewRef.current;
    if (keyboardTop === null || !view) {
      setBottomInset(0);
      onKeyboardChangeRef.current?.(false);
      return;
    }
    view.measureInWindow((_x, y, _width, height) => {
      const overlap = Math.max(0, Math.round(y + height - keyboardTop));
      setBottomInset(overlap);
      onKeyboardChangeRef.current?.(overlap > 0);
    });
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    let timers: ReturnType<typeof setTimeout>[] = [];
    const clearTimers = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };
    const handleShow = (event: KeyboardEvent) => {
      keyboardTopRef.current = event.endCoordinates.screenY;
      updateInset();
      // Android may also slide a Modal's window up to reveal the focused field (no layout event): measure again once
      // that settles, so the window's slide and this padding are never added together.
      clearTimers();
      timers = RE_MEASURE_DELAYS_MS.map((delay) => setTimeout(updateInset, delay));
    };
    const handleHide = () => {
      clearTimers();
      keyboardTopRef.current = null;
      updateInset();
    };
    const showSubscription = Keyboard.addListener(showEvent, handleShow);
    const hideSubscription = Keyboard.addListener(hideEvent, handleHide);
    return () => {
      clearTimers();
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [updateInset]);

  const handleLayout = (event: LayoutChangeEvent) => {
    viewRef.current = event.currentTarget as unknown as MeasurableView;
    // The window may resize after the keyboard opens; re-measure so the padding never counts the keyboard twice.
    if (keyboardTopRef.current !== null) updateInset();
    onLayout?.(event);
  };

  return (
    <View {...rest} style={style} onLayout={handleLayout}>
      {children}
      {/* A spacer rather than padding: its height is exactly the covered part, whatever the content's own padding. */}
      {bottomInset > 0 ? <View pointerEvents="none" style={{ height: bottomInset, flexShrink: 0 }} /> : null}
    </View>
  );
}
