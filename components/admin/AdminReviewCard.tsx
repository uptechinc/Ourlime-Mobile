import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Text, TextInput, View } from 'react-native';
import AdminPressable from '@/components/admin/AdminPressable';
import { Image } from 'expo-image';
import Icon from 'react-native-vector-icons/Feather';
import AdminButton from '@/components/admin/AdminButton';
import AdminOverflowMenu from '@/components/admin/AdminOverflowMenu';
import AdminState from '@/components/admin/AdminState';
import AdminStatusPill from '@/components/admin/AdminStatusPill';
import UserAvatar from '@/components/ui/UserAvatar';
import { getAdminTone, radius, space, type, type AdminIconName, type AdminToneName } from '@/lib/admin/adminTokens';
import type { AdminHeaderAction, AdminOverflowItem } from '@/lib/admin/adminTypes';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type AdminReviewCardDetail = { label: string; value: string };

export type AdminReviewCardMedia =
	/** Up to 3 thumbnails in a strip (pets). */
	| { kind: 'strip'; uris: string[]; label: string }
	/** One 16:9 cover (courses). */
	| { kind: 'cover'; uri: string; label: string };

export type AdminReviewCardLeading = { kind: 'avatar'; uri?: string; name: string } | { kind: 'icon'; name: AdminIconName; tone?: AdminToneName };

export type AdminReviewCardProps = {
	title: string;
	subtitle?: string;
	meta?: string;
	status?: { label: string; tone: AdminToneName };
	leading?: AdminReviewCardLeading;
	media?: AdminReviewCardMedia;
	/** Label / value list; empty values are skipped. */
	details?: AdminReviewCardDetail[];
	/** Extra body content (documents, an outline), rendered after the details. */
	children?: ReactNode;
	/** Header press, usually to the public detail page. A sibling of the actions, never nested. */
	onPress?: () => void;
	accessibilityHint?: string;
	/** The one tone-coded decision, usually "Approve". */
	inlineAction?: AdminHeaderAction;
	/** "⋯" with the other decisions; danger items must open an AdminDialog. */
	overflowActions?: AdminOverflowItem[];
	/** A refused decision, shown on its own card. */
	error?: string;
	style?: StyleProp<ViewStyle>;
};

function CardLeading({ leading }: { leading: AdminReviewCardLeading }) {
	const { colors } = useAppTheme();
	if (leading.kind === 'avatar') return <UserAvatar profileImage={leading.uri ?? null} firstName={leading.name} size={48} />;
	const toneColors = getAdminTone(colors, leading.tone ?? 'neutral');
	return (
		<View style={{ width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: toneColors.border, backgroundColor: toneColors.soft }}>
			<Icon name={leading.name} size={20} color={leading.tone && leading.tone !== 'neutral' ? toneColors.text : colors.icon} />
		</View>
	);
}

function CardMedia({ media }: { media: AdminReviewCardMedia }) {
	const { colors } = useAppTheme();
	if (media.kind === 'cover') {
		return (
			<Image
				source={{ uri: media.uri }}
				style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md, backgroundColor: colors.control }}
				contentFit="cover"
				accessibilityLabel={media.label}
				accessibilityIgnoresInvertColors
			/>
		);
	}
	if (!media.uris.length) return null;
	return (
		<View style={{ flexDirection: 'row', gap: space.sm }}>
			{media.uris.slice(0, 3).map((uri, photoIndex) => (
				<Image
					key={uri}
					source={{ uri }}
					style={{ flex: 1, height: 96, borderRadius: radius.sm, backgroundColor: colors.control }}
					contentFit="cover"
					accessibilityLabel={`${media.label} photo ${photoIndex + 1}`}
					accessibilityIgnoresInvertColors
				/>
			))}
		</View>
	);
}

/**
 * Review-queue card (couriers, pets, e-learning, approvals): a media strip, a pressable header, a label/value
 * details list, then one inline decision plus "⋯". The header, the decision and "⋯" are sibling touchables.
 */
export default function AdminReviewCard({
	title,
	subtitle,
	meta,
	status,
	leading,
	media,
	details,
	children,
	onPress,
	accessibilityHint,
	inlineAction,
	overflowActions,
	error,
	style,
}: AdminReviewCardProps) {
	const { colors } = useAppTheme();
	const visibleDetails = (details ?? []).filter((detail) => detail.value.trim());
	const hasActions = Boolean(inlineAction || overflowActions?.length);

	const header = (
		<>
			{leading ? <CardLeading leading={leading} /> : null}
			<View style={{ flex: 1, gap: space.xs }}>
				{status ? <AdminStatusPill label={status.label} tone={status.tone} style={{ marginBottom: space.xs }} /> : null}
				<Text numberOfLines={2} style={[type.section, { color: colors.text }]}>
					{title}
				</Text>
				{subtitle ? <Text style={[type.body, { color: colors.secondaryText }]}>{subtitle}</Text> : null}
				{meta ? <Text style={[type.meta, { color: colors.mutedText }]}>{meta}</Text> : null}
			</View>
			{onPress ? <Icon name="chevron-right" size={18} color={colors.mutedText} /> : null}
		</>
	);
	const headerStyle: ViewStyle = { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.md };

	return (
		<View style={[{ gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, style]}>
			{media ? <CardMedia media={media} /> : null}
			{onPress ? (
				<AdminPressable
					onPress={onPress}
					accessibilityRole="button"
					accessibilityLabel={[title, subtitle, status?.label].filter(Boolean).join(', ')}
					accessibilityHint={accessibilityHint}
					style={({ pressed }) => [headerStyle, { opacity: pressed ? 0.7 : 1 }]}
				>
					{header}
				</AdminPressable>
			) : (
				<View style={headerStyle}>{header}</View>
			)}

			{visibleDetails.length ? (
				<View style={{ gap: space.sm }}>
					{visibleDetails.map((detail) => (
						<View key={detail.label} style={{ gap: space.xs }}>
							<Text style={[type.label, { color: colors.mutedText }]}>{detail.label}</Text>
							<Text style={[type.body, { color: colors.secondaryText }]}>{detail.value}</Text>
						</View>
					))}
				</View>
			) : null}

			{children}

			{error ? <AdminState kind="inlineError" message={error} /> : null}

			{hasActions ? (
				<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
					{inlineAction ? (
						<AdminButton
							label={inlineAction.label}
							icon={inlineAction.icon}
							tone={inlineAction.tone ?? 'positive'}
							emphasis="primary"
							busy={inlineAction.busy}
							disabled={inlineAction.disabled}
							onPress={inlineAction.onPress}
							accessibilityLabel={`${inlineAction.label} ${title}`}
							style={{ flex: 1 }}
						/>
					) : (
						<View style={{ flex: 1 }} />
					)}
					{overflowActions?.length ? <AdminOverflowMenu items={overflowActions} trigger="row" title={title} triggerLabel={`More actions for ${title}`} /> : null}
				</View>
			) : null}
		</View>
	);
}

export type AdminReasonFieldProps = {
	label: string;
	value: string;
	onChangeText: (next: string) => void;
	placeholder?: string;
	/** Shows "n/max" under the field, in danger tone once it is exceeded. */
	maxLength?: number;
	editable?: boolean;
	/** Validation or save error under the field. */
	error?: string | null;
	minHeight?: number;
};

/** Multi-line reason or note field for decision dialogs (label, input, optional counter and error). */
export function AdminReasonField({ label, value, onChangeText, placeholder, maxLength, editable = true, error, minHeight = 96 }: AdminReasonFieldProps) {
	const { colors } = useAppTheme();
	const danger = getAdminTone(colors, 'danger');
	const length = value.trim().length;
	const overLimit = maxLength !== undefined && length > maxLength;
	return (
		<View style={{ gap: space.xs }}>
			<Text style={[type.label, { color: colors.secondaryText }]}>{label}</Text>
			<TextInput
				value={value}
				onChangeText={onChangeText}
				editable={editable}
				multiline
				// Allow some overshoot so the counter can show the limit instead of silently cutting text.
				maxLength={maxLength !== undefined ? maxLength + 200 : 2000}
				placeholder={placeholder}
				placeholderTextColor={colors.mutedText}
				accessibilityLabel={label}
				style={[
					type.body,
					{
						minHeight,
						padding: space.md,
						borderRadius: radius.md,
						borderWidth: 1,
						borderColor: error || overLimit ? danger.border : colors.border,
						backgroundColor: colors.input,
						color: colors.text,
						textAlignVertical: 'top',
					},
				]}
			/>
			{maxLength !== undefined ? (
				<Text style={[type.meta, { textAlign: 'right', color: overLimit ? danger.text : colors.mutedText }]}>
					{length}/{maxLength}
				</Text>
			) : null}
			{error ? (
				<Text accessibilityRole="alert" style={[type.meta, { color: danger.text }]}>
					{error}
				</Text>
			) : null}
		</View>
	);
}

export type AdminChoiceOption<Value extends string | number> = { value: Value; label: string; description?: string };

export type AdminChoiceListProps<Value extends string | number> = {
	label: string;
	options: AdminChoiceOption<Value>[];
	value: Value | null;
	onChange: (next: Value) => void;
	disabled?: boolean;
	/** Marks the record's current value, e.g. "Current". */
	currentValue?: Value;
};

/** Single-choice radio list for dialogs (suspension length, case status). Rows are 44pt. */
export function AdminChoiceList<Value extends string | number>({ label, options, value, onChange, disabled = false, currentValue }: AdminChoiceListProps<Value>) {
	const { colors } = useAppTheme();
	const positive = getAdminTone(colors, 'positive');
	return (
		<View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: space.xs }}>
			<Text style={[type.label, { color: colors.secondaryText }]}>{label}</Text>
			{options.map((option) => {
				const selected = option.value === value;
				return (
					<AdminPressable
						key={String(option.value)}
						onPress={() => onChange(option.value)}
						disabled={disabled}
						accessibilityRole="radio"
						accessibilityLabel={option.label}
						accessibilityState={{ checked: selected, disabled }}
						style={({ pressed }) => ({
							minHeight: 44,
							flexDirection: 'row',
							alignItems: 'center',
							gap: space.md,
							paddingHorizontal: space.md,
							borderRadius: radius.md,
							borderWidth: 1,
							borderColor: selected ? positive.border : colors.border,
							backgroundColor: selected ? positive.soft : colors.surface,
							opacity: disabled ? 0.55 : pressed ? 0.7 : 1,
						})}
					>
						<View style={{ width: 18, height: 18, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: selected ? positive.text : colors.border }}>
							{selected ? <View style={{ width: 8, height: 8, borderRadius: radius.pill, backgroundColor: positive.text }} /> : null}
						</View>
						<View style={{ flex: 1 }}>
							<Text style={[type.bodyStrong, { color: selected ? positive.text : colors.text }]}>{option.label}</Text>
							{option.description ? <Text style={[type.meta, { color: colors.mutedText }]}>{option.description}</Text> : null}
						</View>
						{currentValue !== undefined && option.value === currentValue ? <Text style={[type.meta, { color: colors.mutedText }]}>Current</Text> : null}
					</AdminPressable>
				);
			})}
		</View>
	);
}
