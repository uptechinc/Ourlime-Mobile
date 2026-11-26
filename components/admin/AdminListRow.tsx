import type { StyleProp, ViewStyle } from 'react-native';
import { Text, View } from 'react-native';
import AdminPressable from '@/components/admin/AdminPressable';
import Icon from 'react-native-vector-icons/Feather';
import AdminButton from '@/components/admin/AdminButton';
import AdminOverflowMenu from '@/components/admin/AdminOverflowMenu';
import AdminStatusPill from '@/components/admin/AdminStatusPill';
import CachedImage from '@/components/ui/CachedImage';
import UserAvatar from '@/components/ui/UserAvatar';
import { ADMIN_MIN_TOUCH, getAdminTone, radius, space, type, type AdminIconName, type AdminToneName } from '@/lib/admin/adminTokens';
import type { AdminHeaderAction, AdminOverflowItem } from '@/lib/admin/adminTypes';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type AdminListRowLeading =
	| { kind: 'avatar'; uri?: string; name: string; /** Looks up the member's chosen picture when uri is empty or broken. */ userId?: string }
	/** 'large' for listings (products), where the photo should carry the row. */
	| { kind: 'thumb'; uri?: string; size?: 'regular' | 'large' }
	| { kind: 'icon'; name: AdminIconName; tone?: AdminToneName };

export type AdminListRowProps = {
	title: string;
	subtitle?: string;
	/** Timestamp, ID, counts. */
	meta?: string;
	leading?: AdminListRowLeading;
	status?: { label: string; tone: AdminToneName };
	/** At most one, tone-coded. */
	inlineAction?: AdminHeaderAction;
	/** "⋯" (44pt) for the row's secondary actions. */
	overflowActions?: AdminOverflowItem[];
	/** 44pt checkbox box (bulk selection). */
	selectable?: { selected: boolean; onToggle: () => void };
	/** Whole-row press, usually to detail. */
	onPress?: () => void;
	accessibilityHint?: string;
	style?: StyleProp<ViewStyle>;
};

function RowLeading({ leading }: { leading: AdminListRowLeading }) {
	const { colors } = useAppTheme();
	if (leading.kind === 'avatar') {
		return <UserAvatar userId={leading.userId} profileImage={leading.uri ?? null} firstName={leading.name} size={40} />;
	}
	if (leading.kind === 'thumb') {
		const side = leading.size === 'large' ? 88 : 48;
		const corner = leading.size === 'large' ? radius.md : radius.sm;
		return leading.uri ? (
			<CachedImage uri={leading.uri} style={{ width: side, height: side, borderRadius: corner, backgroundColor: colors.control }} />
		) : (
			<View style={{ width: side, height: side, borderRadius: corner, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}>
				<Icon name="image" size={20} color={colors.mutedText} />
			</View>
		);
	}
	const toneColors = getAdminTone(colors, leading.tone ?? 'neutral');
	return (
		<View style={{ width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: toneColors.border, backgroundColor: toneColors.soft }}>
			<Icon name={leading.name} size={18} color={leading.tone && leading.tone !== 'neutral' ? toneColors.text : colors.icon} />
		</View>
	);
}

/**
 * Standard admin row: minHeight 56, surface card with a 1px border. The row body, the checkbox, the inline action
 * and "⋯" are sibling touchables (never nested), so each keeps its own 44pt target.
 */
export default function AdminListRow({
	title,
	subtitle,
	meta,
	leading,
	status,
	inlineAction,
	overflowActions,
	selectable,
	onPress,
	accessibilityHint,
	style,
}: AdminListRowProps) {
	const { colors } = useAppTheme();
	const positive = getAdminTone(colors, 'positive');
	const hasTrailing = Boolean(inlineAction || overflowActions?.length);

	const body = (
		<>
			{leading ? <RowLeading leading={leading} /> : null}
			<View style={{ flex: 1, gap: 2 }}>
				<Text numberOfLines={2} style={[type.bodyStrong, { color: colors.text }]}>
					{title}
				</Text>
				{subtitle ? (
					<Text numberOfLines={2} style={[type.body, { color: colors.secondaryText }]}>
						{subtitle}
					</Text>
				) : null}
				{meta ? (
					<Text numberOfLines={1} style={[type.meta, { color: colors.mutedText }]}>
						{meta}
					</Text>
				) : null}
				{status ? <AdminStatusPill label={status.label} tone={status.tone} style={{ marginTop: space.xs }} /> : null}
			</View>
			{onPress && !hasTrailing ? <Icon name="chevron-right" size={18} color={colors.mutedText} /> : null}
		</>
	);

	const bodyStyle: ViewStyle = {
		flex: 1,
		minHeight: 56,
		flexDirection: 'row',
		alignItems: 'center',
		gap: space.md,
		paddingVertical: space.md,
		paddingLeft: selectable ? 0 : space.lg,
		paddingRight: hasTrailing ? space.sm : space.lg,
	};

	return (
		<View
			style={[
				{ flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
				style,
			]}
		>
			{selectable ? (
				<AdminPressable
					onPress={selectable.onToggle}
					accessibilityRole="checkbox"
					accessibilityLabel={`Select ${title}`}
					accessibilityState={{ checked: selectable.selected }}
					style={({ pressed }) => ({ width: ADMIN_MIN_TOUCH + space.sm, minHeight: 56, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}
				>
					<View
						style={{
							width: 22,
							height: 22,
							borderRadius: 6,
							alignItems: 'center',
							justifyContent: 'center',
							borderWidth: 1.5,
							borderColor: selectable.selected ? positive.border : colors.border,
							backgroundColor: selectable.selected ? positive.soft : colors.surface,
						}}
					>
						{selectable.selected ? <Icon name="check" size={14} color={positive.text} /> : null}
					</View>
				</AdminPressable>
			) : null}

			{onPress ? (
				<AdminPressable
					onPress={onPress}
					accessibilityRole="button"
					accessibilityLabel={[title, subtitle, status?.label].filter(Boolean).join(', ')}
					accessibilityHint={accessibilityHint}
					style={({ pressed }) => [bodyStyle, { opacity: pressed ? 0.7 : 1 }]}
				>
					{body}
				</AdminPressable>
			) : (
				<View style={bodyStyle}>{body}</View>
			)}

			{hasTrailing ? (
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingRight: space.sm }}>
					{inlineAction ? (
						<AdminButton
							label={inlineAction.label}
							icon={inlineAction.icon}
							tone={inlineAction.tone ?? 'positive'}
							busy={inlineAction.busy}
							disabled={inlineAction.disabled}
							onPress={inlineAction.onPress}
						/>
					) : null}
					{overflowActions?.length ? <AdminOverflowMenu items={overflowActions} trigger="row" title={title} triggerLabel={`More actions for ${title}`} /> : null}
				</View>
			) : null}
		</View>
	);
}
