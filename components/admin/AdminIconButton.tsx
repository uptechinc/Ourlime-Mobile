import type { StyleProp, ViewStyle } from 'react-native';
import { ActivityIndicator } from 'react-native';
import AdminPressable from '@/components/admin/AdminPressable';
import Icon from 'react-native-vector-icons/Feather';
import { ADMIN_MIN_TOUCH, getAdminTone, radius, type AdminIconName, type AdminToneName } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type AdminIconButtonProps = {
	icon: AdminIconName;
	/** Required: the accessibilityLabel of an icon-only control. */
	label: string;
	onPress: () => void;
	/** 'neutral' (default) uses the theme icon colour. */
	tone?: AdminToneName;
	/** 'plain' (default) has no background; 'soft' adds the tone's soft background and border. */
	variant?: 'plain' | 'soft';
	/** Box size in pt; never below 44. */
	size?: number;
	iconSize?: number;
	/** Overrides the icon colour (e.g. colors.accent for the hub shortcut). */
	iconColor?: string;
	disabled?: boolean;
	busy?: boolean;
	accessibilityHint?: string;
	style?: StyleProp<ViewStyle>;
	testID?: string;
};

/** Icon-only admin control in a 44pt (minimum) box; replaces bare icons with padding 4–7. */
export default function AdminIconButton({
	icon,
	label,
	onPress,
	tone = 'neutral',
	variant = 'plain',
	size = ADMIN_MIN_TOUCH,
	iconSize = 20,
	iconColor,
	disabled = false,
	busy = false,
	accessibilityHint,
	style,
	testID,
}: AdminIconButtonProps) {
	const { colors } = useAppTheme();
	const toneColors = getAdminTone(colors, tone);
	const boxSize = Math.max(ADMIN_MIN_TOUCH, size);
	const isDisabled = disabled || busy;
	const color = iconColor ?? (tone === 'neutral' ? colors.icon : toneColors.text);

	return (
		<AdminPressable
			onPress={onPress}
			disabled={isDisabled}
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityHint={accessibilityHint}
			accessibilityState={{ disabled: isDisabled, busy }}
			testID={testID}
			style={({ pressed }) => [
				{
					width: boxSize,
					height: boxSize,
					alignItems: 'center',
					justifyContent: 'center',
					borderRadius: radius.md,
					backgroundColor: variant === 'soft' ? toneColors.soft : 'transparent',
					borderWidth: variant === 'soft' ? 1 : 0,
					borderColor: toneColors.border,
					opacity: isDisabled ? 0.55 : pressed ? 0.7 : 1,
				},
				style,
			]}
		>
			{busy ? <ActivityIndicator size="small" color={color} /> : <Icon name={icon} size={iconSize} color={color} />}
		</AdminPressable>
	);
}
