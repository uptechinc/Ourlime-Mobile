import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';
import AdminButton from '@/components/admin/AdminButton';
import AdminIconButton from '@/components/admin/AdminIconButton';
import AdminOverflowMenu from '@/components/admin/AdminOverflowMenu';
import { AdminWorkspaceBodySkeleton } from '@/components/admin/AdminSkeletons';
import AdminState, { type AdminStateLoadingVariant } from '@/components/admin/AdminState';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { getAdminTone, radius, space, type, type AdminIconName, type AdminToneName } from '@/lib/admin/adminTokens';
import type { AdminHeaderAction, AdminOverflowItem } from '@/lib/admin/adminTypes';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type { AdminHeaderAction, AdminOverflowItem } from '@/lib/admin/adminTypes';

export type AdminScreenState =
	| { kind: 'ready' }
	/** First load only: the skeleton replaces the body; the header and toolbar stay mounted. */
	| { kind: 'loading'; variant?: AdminStateLoadingVariant }
	/** Full-body error; Retry calls onRefresh. */
	| { kind: 'error'; message: string; title?: string }
	| {
			kind: 'empty';
			title: string;
			description?: string;
			icon?: AdminIconName;
			filtered?: boolean;
			onClearFilters?: () => void;
			action?: AdminHeaderAction;
	  };

export type AdminScreenProps = {
	title: string;
	subtitle?: string;
	/** e.g. "Restricted workspace" (child safety). */
	eyebrow?: { label: string; tone: AdminToneName };
	state: AdminScreenState;
	/** Enables pull-to-refresh, Retry on the error state and "Refresh" in the overflow menu. */
	onRefresh?: () => Promise<void> | void;
	refreshing?: boolean;
	/** At most one. Tone defaults to 'positive'. */
	primaryAction?: AdminHeaderAction;
	/** Rendered with AdminOverflowMenu ("⋯"). */
	overflowActions?: AdminOverflowItem[];
	/** Usually an AdminToolbar; stays mounted through loading, error, empty and refresh. */
	toolbar?: ReactNode;
	/** Sticky footer (detail and form screens); shown in the ready state only. */
	footer?: ReactNode;
	/** 'none' when the child is its own FlatList/FlashList (it then owns its padding and refresh control). */
	scroll?: 'scroll' | 'none';
	/** Default 'admin'. app/admin/_layout.tsx remains the stack-wide gate. */
	gate?: 'admin' | 'none';
	/** Header back target when there is no history; default '/admin'. */
	backFallback?: Href;
	/** The grid shortcut to /admin; default true. Pass false on the hub. */
	showHubShortcut?: boolean;
	/** Keeps the body and footer above the keyboard (header stays outside), taps persist. */
	keyboardAware?: boolean;
	/** Replaces the first-load skeleton. */
	skeleton?: ReactNode;
	children?: ReactNode;
};

/**
 * Admin screen frame: 56pt header (44pt back, title, primary action, hub shortcut, "⋯"), the admin access gate,
 * an optional toolbar that stays mounted, and a body with skeleton (first load only), error, empty and
 * pull-to-refresh states.
 */
export default function AdminScreen({
	title,
	subtitle,
	eyebrow,
	state,
	onRefresh,
	refreshing = false,
	primaryAction,
	overflowActions,
	toolbar,
	footer,
	scroll = 'scroll',
	gate = 'admin',
	backFallback = '/admin',
	showHubShortcut = true,
	keyboardAware = false,
	skeleton,
	children,
}: AdminScreenProps) {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const { colors } = useAppTheme();
	const { authorization, loading: accessLoading } = usePageAccess();
	const danger = getAdminTone(colors, 'danger');

	// Lock screen: nowhere useful inside admin, so leave to the tabs when there is no history.
	const handleLockBack = () => {
		if (router.canGoBack()) {
			router.back();
			return;
		}
		router.replace('/(tabs)');
	};
	// Header back: a workspace opened from a deep link or notification has no history, so fall back
	// to the admin hub (or the given route) instead of doing nothing.
	const handleHeaderBack = () => {
		if (router.canGoBack()) {
			router.back();
			return;
		}
		router.replace(backFallback);
	};

	const handleRefresh = () => {
		if (!onRefresh) return;
		Promise.resolve(onRefresh()).catch((error: unknown) => console.error('[AdminScreen] Error:', error));
	};

	const menuItems: AdminOverflowItem[] = overflowActions?.length
		? [...(onRefresh ? [{ key: '__refresh', label: 'Refresh', icon: 'refresh-cw' as const, onPress: handleRefresh, disabled: refreshing }] : []), ...overflowActions]
		: [];

	const isLocked = gate === 'admin' && !accessLoading && !authorization.isAdmin;
	const isCheckingAccess = gate === 'admin' && accessLoading;
	const isReady = !isLocked && !isCheckingAccess;

	const header = (
		<View
			style={{
				minHeight: 56,
				flexDirection: 'row',
				alignItems: 'center',
				gap: space.xs,
				paddingHorizontal: space.xs,
				paddingVertical: space.xs,
				backgroundColor: colors.navigation,
				borderBottomWidth: 1,
				borderBottomColor: colors.border,
			}}
		>
			<AdminIconButton icon="arrow-left" label="Go back" iconSize={22} onPress={handleHeaderBack} />
			<View style={{ flex: 1, marginLeft: space.xs }}>
				{eyebrow ? (
					<Text numberOfLines={1} style={[type.label, { color: getAdminTone(colors, eyebrow.tone).text }]}>
						{eyebrow.label}
					</Text>
				) : null}
				<Text numberOfLines={1} accessibilityRole="header" style={[type.title, { color: colors.text }]}>
					{title}
				</Text>
				{subtitle ? (
					<Text numberOfLines={1} style={[type.meta, { color: colors.mutedText }]}>
						{subtitle}
					</Text>
				) : null}
			</View>
			{primaryAction && isReady ? (
				<AdminButton
					label={primaryAction.label}
					icon={primaryAction.icon}
					tone={primaryAction.tone ?? 'positive'}
					emphasis="primary"
					busy={primaryAction.busy}
					disabled={primaryAction.disabled}
					onPress={primaryAction.onPress}
					style={{ paddingHorizontal: space.md }}
				/>
			) : null}
			{showHubShortcut ? <AdminIconButton icon="grid" label="Admin overview" iconColor={colors.accent} onPress={() => router.push('/admin')} /> : null}
			{menuItems.length && isReady ? <AdminOverflowMenu items={menuItems} trigger="header" title={title} /> : null}
		</View>
	);

	const refreshControl = onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} colors={[colors.accent]} /> : undefined;
	const hasFooter = Boolean(footer) && state.kind === 'ready';
	// The sticky footer already sits above the home indicator; otherwise the scroll content clears it.
	const contentPadding = { padding: space.lg, paddingBottom: space.xxl + (hasFooter ? 0 : insets.bottom) };

	const renderStateBody = (stateBody: ReactNode) => (
		<ScrollView style={{ flex: 1 }} contentContainerStyle={[contentPadding, { flexGrow: 1 }]} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
			{stateBody}
		</ScrollView>
	);

	const renderBody = (): ReactNode => {
		if (state.kind === 'loading') {
			if (skeleton) return <View style={{ flex: 1, overflow: 'hidden' }}>{skeleton}</View>;
			// Without a toolbar, keep the shell's original skeleton (it draws its own search row).
			if (!toolbar && !state.variant) return <AdminWorkspaceBodySkeleton />;
			return (
				<View style={[{ flex: 1, overflow: 'hidden' }, contentPadding]}>
					<AdminState kind="loading" variant={state.variant ?? 'list'} />
				</View>
			);
		}
		if (state.kind === 'error') {
			return renderStateBody(<AdminState kind="error" title={state.title} message={state.message} onRetry={onRefresh ? handleRefresh : undefined} retrying={refreshing} />);
		}
		if (state.kind === 'empty') {
			return renderStateBody(
				<AdminState
					kind="empty"
					title={state.title}
					description={state.description}
					icon={state.icon}
					filtered={state.filtered}
					onClearFilters={state.onClearFilters}
					action={state.action}
				/>,
			);
		}
		if (scroll === 'none') return <View style={{ flex: 1 }}>{children}</View>;
		return (
			<ScrollView style={{ flex: 1 }} contentContainerStyle={contentPadding} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
				{children}
			</ScrollView>
		);
	};

	const renderGateOrBody = (): ReactNode => {
		if (isCheckingAccess) return <AdminWorkspaceBodySkeleton />;
		if (isLocked) {
			return (
				<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xxl }}>
					<View style={{ width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: danger.border, backgroundColor: danger.soft }}>
						<Icon name="lock" size={28} color={danger.text} />
					</View>
					<Text style={[type.title, { color: colors.text, textAlign: 'center' }]}>Admin access required</Text>
					<AdminButton label="Go Back" icon="arrow-left" tone="neutral" onPress={handleLockBack} style={{ marginTop: space.sm }} />
				</View>
			);
		}
		const body = (
			<>
				{toolbar ? (
					<View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, backgroundColor: colors.canvas }}>{toolbar}</View>
				) : null}
				{renderBody()}
				{hasFooter ? (
					<View
						style={{
							flexDirection: 'row',
							gap: space.md,
							paddingHorizontal: space.lg,
							paddingTop: space.md,
							paddingBottom: space.md + insets.bottom,
							borderTopWidth: 1,
							borderTopColor: colors.border,
							backgroundColor: colors.navigation,
						}}
					>
						{footer}
					</View>
				) : null}
			</>
		);
		return keyboardAware ? <KeyboardSafeView style={{ flex: 1 }}>{body}</KeyboardSafeView> : <View style={{ flex: 1 }}>{body}</View>;
	};

	return (
		<SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
			{header}
			{renderGateOrBody()}
		</SafeAreaView>
	);
}
