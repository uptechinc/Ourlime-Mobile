import { useState, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { ADMIN_MIN_TOUCH, getAdminTone, radius, space, type, type AdminToneName } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type AdminSectionAction = { label: string; onPress: () => void };

export type AdminSectionProps = {
	title: string;
	description?: string;
	/** Right-aligned 44pt text link, e.g. "See all". */
	action?: AdminSectionAction;
	/** Only for warning or restricted sections; default 'neutral'. */
	tone?: AdminToneName;
	/** Long detail screens: the header toggles the body. */
	collapsible?: { initiallyOpen: boolean };
	children?: ReactNode;
	style?: StyleProp<ViewStyle>;
};

/** A titled admin card: surface, 1px border, radius lg, padding lg, `section` title. */
export default function AdminSection({ title, description, action, tone = 'neutral', collapsible, children, style }: AdminSectionProps) {
	const { colors } = useAppTheme();
	const [open, setOpen] = useState(collapsible ? collapsible.initiallyOpen : true);
	const toneColors = getAdminTone(colors, tone);
	const isToned = tone !== 'neutral';
	const showBody = !collapsible || open;

	const heading = (
		<View style={{ flex: 1, gap: space.xs }}>
			<Text style={[type.section, { color: isToned ? toneColors.text : colors.text }]}>{title}</Text>
			{description ? <Text style={[type.body, { color: isToned ? toneColors.text : colors.secondaryText }]}>{description}</Text> : null}
		</View>
	);

	return (
		<View
			style={[
				{
					padding: space.lg,
					gap: space.md,
					borderRadius: radius.lg,
					borderWidth: 1,
					borderColor: isToned ? toneColors.border : colors.border,
					backgroundColor: isToned ? toneColors.soft : colors.surface,
				},
				style,
			]}
		>
			<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
				{collapsible ? (
					<Pressable
						onPress={() => setOpen((current) => !current)}
						accessibilityRole="button"
						accessibilityLabel={title}
						accessibilityState={{ expanded: open }}
						style={({ pressed }) => ({ flex: 1, minHeight: ADMIN_MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.7 : 1 })}
					>
						{heading}
						<Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.icon} />
					</Pressable>
				) : (
					heading
				)}
				{action ? (
					<Pressable
						onPress={action.onPress}
						accessibilityRole="button"
						accessibilityLabel={action.label}
						hitSlop={{ left: space.sm, right: space.sm }}
						style={({ pressed }) => ({ minHeight: ADMIN_MIN_TOUCH, justifyContent: 'center', paddingHorizontal: space.xs, opacity: pressed ? 0.7 : 1 })}
					>
						<Text style={[type.bodyStrong, { color: colors.accentText }]}>{action.label}</Text>
					</Pressable>
				) : null}
			</View>
			{showBody && children ? <View style={{ gap: space.md }}>{children}</View> : null}
		</View>
	);
}
