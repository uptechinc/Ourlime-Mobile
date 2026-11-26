import { useState } from 'react';
import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';

export type AdminPressableStyle = StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);

export type AdminPressableProps = Omit<PressableProps, 'style'> & {
	style?: AdminPressableStyle;
};

/**
 * Pressable whose style may depend on the press state. NativeWind's interop wraps react-native's Pressable and drops a
 * style *function*, so `style={({ pressed }) => …}` lost the whole layout (rows stacked vertically, no padding or
 * border). This tracks the press itself and always hands Pressable a plain style.
 */
export default function AdminPressable({ style, onPressIn, onPressOut, ...rest }: AdminPressableProps) {
	const [isPressed, setIsPressed] = useState(false);
	const handlePressIn = (event: GestureResponderEvent) => {
		setIsPressed(true);
		onPressIn?.(event);
	};
	const handlePressOut = (event: GestureResponderEvent) => {
		setIsPressed(false);
		onPressOut?.(event);
	};
	const resolvedStyle = typeof style === 'function' ? style({ pressed: isPressed }) : style;
	return <Pressable {...rest} onPressIn={handlePressIn} onPressOut={handlePressOut} style={resolvedStyle} />;
}
