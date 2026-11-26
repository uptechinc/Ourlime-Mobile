import type { StyleProp, ViewStyle } from 'react-native';
import { ActivityIndicator, Text, View } from 'react-native';
import AdminPressable from '@/components/admin/AdminPressable';
import Icon from 'react-native-vector-icons/Feather';
import { ADMIN_MIN_TOUCH, getAdminTone, radius, space, type, type AdminIconName, type AdminToneName } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type AdminButtonEmphasis = 'primary' | 'secondary' | 'ghost';

export type AdminButtonProps = {
	label: string;
	onPress: () => void;
	/** Soft background, matching border and tone text; never a solid fill. Default 'neutral'. */
	tone?: AdminToneName;
	/** primary = 1.5px tone border; secondary = 1px border (default); ghost = text only. */
	emphasis?: AdminButtonEmphasis;
	icon?: AdminIconName;
	busy?: boolean;
	disabled?: boolean;
	fullWidth?: boolean;
	accessibilityLabel?: string;
	accessibilityHint?: string;
	style?: StyleProp<ViewStyle>;
	testID?: string;
};

/** The one admin button: soft-tinted, at least 44pt tall, with a busy spinner in the tone text colour. */
export default function AdminButton({
	label,
	onPress,
	tone = 'neutral',
	emphasis = 'secondary',
	icon,
	busy = false,
	disabled = false,
	fullWidth = false,
	accessibilityLabel,
	accessibilityHint,
	style,
	testID,
}: AdminButtonProps) {
	const { colors } = useAppTheme();
	const toneColors = getAdminTone(colors, tone);
	const isDisabled = disabled || busy;
	const isGhost = emphasis === 'ghost';
	const textColor = tone === 'neutral' && !isGhost ? colors.text : toneColors.text;

	return (
		<AdminPressable
			onPress={onPress}
			disabled={isDisabled}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? label}
			accessibilityHint={accessibilityHint}
			accessibilityState={{ disabled: isDisabled, busy }}
			testID={testID}
			style={({ pressed }) => [
				{
					minHeight: ADMIN_MIN_TOUCH,
					minWidth: ADMIN_MIN_TOUCH,
					flexDirection: 'row',
					alignItems: 'center',
					justifyContent: 'center',
					paddingHorizontal: isGhost ? space.md : space.lg,
					borderRadius: radius.md,
					backgroundColor: isGhost ? 'transparent' : toneColors.soft,
					borderWidth: isGhost ? 0 : emphasis === 'primary' ? 1.5 : 1,
					borderColor: toneColors.border,
					opacity: isDisabled ? 0.55 : pressed ? 0.7 : 1,
				},
				fullWidth ? { alignSelf: 'stretch' } : null,
				style,
			]}
		>
			{busy ? (
				<ActivityIndicator size="small" color={toneColors.text} />
			) : (
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
					{icon ? <Icon name={icon} size={16} color={textColor} /> : null}
					<Text numberOfLines={1} style={[type.bodyStrong, { color: textColor }]}>
						{label}
					</Text>
				</View>
			)}
		</AdminPressable>
	);
}
