import { Children, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { Skeleton } from '@/components/ui/Skeleton';
import { getAdminTone, radius, space, type, type AdminIconName, type AdminToneName } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type AdminStatCardProps = {
	label: string;
	value: string | number;
	/** e.g. "+12 this week". */
	hint?: string;
	icon?: AdminIconName;
	/** Default 'neutral'; 'pending' for "needs review" counts. */
	tone?: AdminToneName;
	/** Deep-links into the filtered list. */
	onPress?: () => void;
	/** Inline placeholder for the value, not a full skeleton. */
	loading?: boolean;
	/** Use the smaller `title` type for the value when space is tight. */
	compact?: boolean;
	style?: StyleProp<ViewStyle>;
};

/** A metric tile. Lay several out with AdminStatGrid (two columns, gap md). */
export default function AdminStatCard({ label, value, hint, icon, tone = 'neutral', onPress, loading = false, compact = false, style }: AdminStatCardProps) {
	const { colors } = useAppTheme();
	const toneColors = getAdminTone(colors, tone);
	const isToned = tone !== 'neutral';
	const cardStyle: ViewStyle = {
		flexGrow: 1,
		gap: space.xs,
		padding: space.lg,
		borderRadius: radius.lg,
		borderWidth: 1,
		borderColor: isToned ? toneColors.border : colors.border,
		backgroundColor: isToned ? toneColors.soft : colors.surface,
	};

	const content = (
		<>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
				<Text numberOfLines={1} style={[type.label, { flex: 1, color: isToned ? toneColors.text : colors.mutedText }]}>
					{label}
				</Text>
				{icon ? <Icon name={icon} size={16} color={isToned ? toneColors.text : colors.icon} /> : null}
				{onPress ? <Icon name="chevron-right" size={16} color={colors.mutedText} /> : null}
			</View>
			{loading ? (
				<Skeleton width="45%" height={compact ? 26 : 34} borderRadius={radius.sm} />
			) : (
				<Text numberOfLines={1} adjustsFontSizeToFit style={[compact ? type.title : type.display, { color: colors.text }]}>
					{value}
				</Text>
			)}
			{hint ? <Text numberOfLines={2} style={[type.meta, { color: colors.mutedText }]}>{hint}</Text> : null}
		</>
	);

	if (!onPress) {
		return (
			<View accessible accessibilityLabel={`${label}: ${loading ? 'loading' : value}`} style={[cardStyle, style]}>
				{content}
			</View>
		);
	}

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${label}: ${loading ? 'loading' : value}`}
			accessibilityHint={hint}
			style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.7 : 1 }, style]}
		>
			{content}
		</Pressable>
	);
}

export type AdminStatGridProps = { children: ReactNode; style?: StyleProp<ViewStyle> };

/** Two-column grid for AdminStatCards (an odd last card spans the full width). */
export function AdminStatGrid({ children, style }: AdminStatGridProps) {
	return (
		<View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }, style]}>
			{Children.toArray(children).map((child, childIndex) => (
				<View key={childIndex} style={{ flexBasis: '40%', flexGrow: 1 }}>
					{child}
				</View>
			))}
		</View>
	);
}
