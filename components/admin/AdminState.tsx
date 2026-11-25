import { Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import AdminButton from '@/components/admin/AdminButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { getAdminTone, radius, space, type, type AdminIconName } from '@/lib/admin/adminTokens';
import type { AdminHeaderAction } from '@/lib/admin/adminTypes';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type AdminStateLoadingVariant = 'list' | 'cards' | 'detail';

export type AdminStateProps =
	| { kind: 'loading'; variant?: AdminStateLoadingVariant; rows?: number }
	| {
			kind: 'empty';
			title: string;
			description?: string;
			icon?: AdminIconName;
			action?: AdminHeaderAction;
			/** Filters caused the empty result: the copy becomes "No results match these filters". */
			filtered?: boolean;
			/** With `filtered`, shows a "Clear filters" button (unless `action` is given). */
			onClearFilters?: () => void;
	  }
	| { kind: 'error'; title?: string; message: string; onRetry?: () => void; retrying?: boolean }
	| { kind: 'inlineError'; message: string; onRetry?: () => void; retrying?: boolean };

const FILTERED_TITLE = 'No results match these filters';
const FILTERED_DESCRIPTION = 'Try a different search, or clear the filters to see everything.';

function LoadingRows({ rows }: { rows: number }) {
	const { colors } = useAppTheme();
	return (
		<View style={{ gap: space.sm }}>
			{Array.from({ length: rows }, (_unused, rowIndex) => (
				<View
					key={rowIndex}
					style={{
						minHeight: 56,
						flexDirection: 'row',
						alignItems: 'center',
						gap: space.md,
						paddingVertical: space.md,
						paddingHorizontal: space.lg,
						borderRadius: radius.md,
						borderWidth: 1,
						borderColor: colors.border,
						backgroundColor: colors.surface,
					}}
				>
					<Skeleton width={40} height={40} borderRadius={radius.pill} />
					<View style={{ flex: 1, gap: space.xs }}>
						<Skeleton width={rowIndex % 2 ? '52%' : '64%'} height={14} />
						<Skeleton width="38%" height={12} />
					</View>
					<Skeleton width={56} height={20} borderRadius={radius.pill} />
				</View>
			))}
		</View>
	);
}

function LoadingCards({ rows }: { rows: number }) {
	const { colors } = useAppTheme();
	return (
		<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
			{Array.from({ length: rows }, (_unused, cardIndex) => (
				<View
					key={cardIndex}
					style={{
						flexBasis: '40%',
						flexGrow: 1,
						gap: space.sm,
						padding: space.lg,
						borderRadius: radius.lg,
						borderWidth: 1,
						borderColor: colors.border,
						backgroundColor: colors.surface,
					}}
				>
					<Skeleton width="50%" height={11} />
					<Skeleton width="36%" height={28} />
				</View>
			))}
		</View>
	);
}

function LoadingDetail({ rows }: { rows: number }) {
	const { colors } = useAppTheme();
	return (
		<View style={{ gap: space.xl }}>
			{Array.from({ length: rows }, (_unused, sectionIndex) => (
				<View
					key={sectionIndex}
					style={{ gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
				>
					<Skeleton width="40%" height={16} />
					<Skeleton width="92%" height={14} />
					<Skeleton width="76%" height={14} />
				</View>
			))}
		</View>
	);
}

/** Admin empty, loading, error and inline-error states. Every admin list and detail body uses one of these. */
export default function AdminState(props: AdminStateProps) {
	const { colors } = useAppTheme();

	if (props.kind === 'loading') {
		const variant = props.variant ?? 'list';
		const rows = props.rows ?? (variant === 'cards' ? 4 : variant === 'detail' ? 3 : 6);
		return (
			<View accessibilityLabel="Loading" accessibilityState={{ busy: true }}>
				{variant === 'cards' ? <LoadingCards rows={rows} /> : variant === 'detail' ? <LoadingDetail rows={rows} /> : <LoadingRows rows={rows} />}
			</View>
		);
	}

	if (props.kind === 'inlineError') {
		const danger = getAdminTone(colors, 'danger');
		return (
			<View
				accessibilityRole="alert"
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					gap: space.md,
					paddingVertical: space.sm,
					paddingLeft: space.lg,
					paddingRight: props.onRetry ? space.sm : space.lg,
					minHeight: 52,
					borderRadius: radius.md,
					borderWidth: 1,
					borderColor: danger.border,
					backgroundColor: danger.soft,
				}}
			>
				<Icon name="alert-circle" size={18} color={danger.text} />
				<Text style={[type.body, { flex: 1, color: danger.text }]}>{props.message}</Text>
				{props.onRetry ? (
					<AdminButton label={props.retrying ? 'Retrying…' : 'Retry'} tone="danger" emphasis="ghost" busy={props.retrying} onPress={props.onRetry} />
				) : null}
			</View>
		);
	}

	if (props.kind === 'error') {
		const danger = getAdminTone(colors, 'danger');
		return (
			<View
				accessibilityRole="alert"
				style={{
					alignItems: 'center',
					gap: space.md,
					marginVertical: space.xl,
					padding: space.xl,
					borderRadius: radius.lg,
					borderWidth: 1,
					borderColor: danger.border,
					backgroundColor: danger.soft,
				}}
			>
				<View style={{ width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: danger.border, backgroundColor: colors.surface }}>
					<Icon name="alert-triangle" size={22} color={danger.text} />
				</View>
				<Text style={[type.section, { color: colors.text, textAlign: 'center' }]}>{props.title ?? 'Something went wrong'}</Text>
				<Text style={[type.body, { color: danger.text, textAlign: 'center' }]}>{props.message}</Text>
				{props.onRetry ? (
					<AdminButton
						label={props.retrying ? 'Retrying…' : 'Retry'}
						icon="refresh-cw"
						tone="neutral"
						busy={props.retrying}
						onPress={props.onRetry}
						style={{ marginTop: space.xs, backgroundColor: colors.surface }}
					/>
				) : null}
			</View>
		);
	}

	const title = props.filtered ? FILTERED_TITLE : props.title;
	const description = props.filtered ? props.description ?? FILTERED_DESCRIPTION : props.description;
	const icon: AdminIconName = props.icon ?? (props.filtered ? 'filter' : 'inbox');
	const neutral = getAdminTone(colors, 'neutral');

	return (
		<View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg }}>
			<View style={{ width: 56, height: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: neutral.border, backgroundColor: neutral.soft }}>
				<Icon name={icon} size={24} color={colors.mutedText} />
			</View>
			<Text style={[type.section, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
			{description ? <Text style={[type.body, { color: colors.mutedText, textAlign: 'center' }]}>{description}</Text> : null}
			{props.action ? (
				<AdminButton
					label={props.action.label}
					icon={props.action.icon}
					tone={props.action.tone ?? 'positive'}
					emphasis="primary"
					busy={props.action.busy}
					disabled={props.action.disabled}
					onPress={props.action.onPress}
					style={{ marginTop: space.xs }}
				/>
			) : props.filtered && props.onClearFilters ? (
				<AdminButton label="Clear filters" icon="x" tone="neutral" onPress={props.onClearFilters} style={{ marginTop: space.xs }} />
			) : null}
		</View>
	);
}
