import type { StyleProp, ViewStyle } from 'react-native';
import { Text, View } from 'react-native';
import { getAdminTone, radius, space, type, type AdminToneName } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type AdminStatusPillProps = {
	label: string;
	tone: AdminToneName;
	/** Adds a small solid status dot before the label. */
	dot?: boolean;
	style?: StyleProp<ViewStyle>;
};

/** Read-only status label: `label` type on the tone's soft background with a matching border. */
export default function AdminStatusPill({ label, tone, dot = false, style }: AdminStatusPillProps) {
	const { colors } = useAppTheme();
	const toneColors = getAdminTone(colors, tone);

	return (
		<View
			accessible
			accessibilityLabel={label}
			style={[
				{
					alignSelf: 'flex-start',
					flexDirection: 'row',
					alignItems: 'center',
					gap: space.xs,
					minHeight: 22,
					paddingHorizontal: space.sm,
					paddingVertical: 2,
					borderRadius: radius.pill,
					borderWidth: 1,
					borderColor: toneColors.border,
					backgroundColor: toneColors.soft,
				},
				style,
			]}
		>
			{dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: toneColors.solid }} /> : null}
			<Text numberOfLines={1} style={[type.label, { color: toneColors.text }]}>
				{label}
			</Text>
		</View>
	);
}
