import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, TextInput, View, type TextStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { toast } from 'sonner-native';
import AdminButton from '@/components/admin/AdminButton';
import AdminDialog from '@/components/admin/AdminDialog';
import AdminIconButton from '@/components/admin/AdminIconButton';
import AdminListRow from '@/components/admin/AdminListRow';
import AdminScreen, { type AdminScreenState } from '@/components/admin/AdminScreen';
import AdminSection from '@/components/admin/AdminSection';
import AdminState from '@/components/admin/AdminState';
import AdminToolbar from '@/components/admin/AdminToolbar';
import { readSingleFilter, type FilterGroup, type FilterValues } from '@/components/ui/FilterSheet';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import { ADMIN_MIN_TOUCH, getAdminTone, radius, space, type, type AdminToneName } from '@/lib/admin/adminTokens';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { getPageAccessBadge } from '@/lib/pageAccess/PageRegistry';
import { adminPageAccessService, type AdminPageAccessAuditEntry, type PageAccessUpdate } from '@/lib/services/AdminPageAccessService';
import type { PageAccessSetting, PageAccessStatus } from '@/lib/types/pageAccess';

const STATUSES: readonly PageAccessStatus[] = ['enabled', 'coming_soon', 'maintenance', 'beta_only', 'developer_only', 'admin_only', 'disabled'];

const STATUS_DESCRIPTIONS: { [status in PageAccessStatus]: string } = {
	enabled: 'Everyone can open the page',
	coming_soon: 'Shows a coming-soon overlay',
	maintenance: 'Shows a maintenance overlay',
	beta_only: 'Testers and staff only',
	developer_only: 'Developers and staff only',
	admin_only: 'Administrators only',
	disabled: 'Nobody can open the page',
};

function getStatusLabel(status: PageAccessStatus): string {
	if (status === 'coming_soon') return 'Coming Soon';
	if (status === 'beta_only') return 'Beta Only';
	if (status === 'developer_only') return 'Developer Only';
	if (status === 'admin_only') return 'Admin Only';
	return status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusTone(status: PageAccessStatus): AdminToneName {
	if (status === 'enabled') return 'positive';
	if (status === 'disabled') return 'danger';
	if (status === 'admin_only') return 'neutral';
	return 'pending';
}

type EditorState = {
	status: PageAccessStatus;
	showInNavigation: boolean;
	showPagePreview: boolean;
	overlayTitle: string;
	overlayDescription: string;
	badgeText: string;
	primaryButtonLabel: string;
	primaryButtonRoute: string;
	secondaryButtonLabel: string;
	secondaryButtonRoute: string;
};

type ConfirmAction = 'initialize' | 'reset';
type PageTab = 'pages' | 'audit';

const OVERLAY_FIELDS: readonly (readonly [string, Exclude<keyof EditorState, 'status' | 'showInNavigation' | 'showPagePreview'>, boolean])[] = [
	['Overlay title', 'overlayTitle', false],
	['Overlay description', 'overlayDescription', true],
	['Badge text', 'badgeText', false],
	['Primary button label', 'primaryButtonLabel', false],
	['Primary button route', 'primaryButtonRoute', false],
	['Secondary button label', 'secondaryButtonLabel', false],
	['Secondary button route', 'secondaryButtonRoute', false],
];

function createEditorState(setting: PageAccessSetting): EditorState {
	return {
		status: setting.status,
		showInNavigation: setting.showInNavigation,
		showPagePreview: setting.showPagePreview,
		overlayTitle: setting.overlayTitle ?? '',
		overlayDescription: setting.overlayDescription ?? '',
		badgeText: setting.badgeText ?? getPageAccessBadge(setting.status),
		primaryButtonLabel: setting.primaryButtonLabel ?? 'Go Back',
		primaryButtonRoute: setting.primaryButtonRoute ?? '/(tabs)',
		secondaryButtonLabel: setting.secondaryButtonLabel ?? '',
		secondaryButtonRoute: setting.secondaryButtonRoute ?? '',
	};
}

const getInputStyle = (colors: AppThemeColors, multiline = false): TextStyle => ({
	...type.body,
	minHeight: multiline ? 88 : ADMIN_MIN_TOUCH,
	paddingHorizontal: space.md,
	paddingVertical: multiline ? space.md : 0,
	textAlignVertical: multiline ? 'top' : 'center',
	borderRadius: radius.md,
	borderWidth: 1,
	borderColor: colors.border,
	backgroundColor: colors.input,
	color: colors.text,
});

type StatusChoiceProps = { status: PageAccessStatus; selected: boolean; disabled?: boolean; onPress: () => void };

/** 56pt radio row for a page-access status. */
function StatusChoice({ status, selected, disabled = false, onPress }: StatusChoiceProps) {
	const { colors } = useAppTheme();
	const positive = getAdminTone(colors, 'positive');
	const label = getStatusLabel(status);
	return (
		<Pressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="radio"
			accessibilityLabel={label}
			accessibilityHint={STATUS_DESCRIPTIONS[status]}
			accessibilityState={{ checked: selected, disabled }}
			style={({ pressed }) => ({
				minHeight: 56,
				flexDirection: 'row',
				alignItems: 'center',
				gap: space.md,
				paddingHorizontal: space.md,
				paddingVertical: space.sm,
				borderRadius: radius.md,
				borderWidth: 1,
				borderColor: selected ? positive.border : colors.border,
				backgroundColor: selected ? positive.soft : colors.surface,
				opacity: pressed ? 0.7 : 1,
			})}
		>
			<Icon name={selected ? 'check-circle' : 'circle'} size={20} color={selected ? positive.text : colors.mutedText} />
			<View style={{ flex: 1 }}>
				<Text style={[type.bodyStrong, { color: colors.text }]}>{label}</Text>
				<Text style={[type.meta, { color: colors.mutedText }]}>{STATUS_DESCRIPTIONS[status]}</Text>
			</View>
		</Pressable>
	);
}

export default function PageAccessAdminSection() {
	const { colors } = useAppTheme();
	const insets = useSafeAreaInsets();
	const [settings, setSettings] = useState<PageAccessSetting[]>([]);
	const [auditLogs, setAuditLogs] = useState<AdminPageAccessAuditEntry[]>([]);
	const [activeTab, setActiveTab] = useState<PageTab>('pages');
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState<PageAccessStatus | 'all'>('all');
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [editing, setEditing] = useState<PageAccessSetting | null>(null);
	const [editor, setEditor] = useState<EditorState | null>(null);
	const [editorError, setEditorError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [bulkOpen, setBulkOpen] = useState(false);
	const [bulkStatus, setBulkStatus] = useState<PageAccessStatus>('enabled');
	const [bulkError, setBulkError] = useState<string | null>(null);
	const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
	const [confirmError, setConfirmError] = useState<string | null>(null);

	const load = useCallback(async (isRefresh = false) => {
		if (isRefresh) setRefreshing(true);
		else setLoading(true);
		setLoadError(null);
		try {
			const [nextSettings, nextLogs] = await Promise.all([adminPageAccessService.fetchSettings(), adminPageAccessService.fetchAuditLogs().catch(() => [])]);
			setSettings(nextSettings);
			setAuditLogs(nextLogs);
		} catch (error: unknown) {
			console.error('[PageAccessAdminSection.load] Error:', error);
			const errorMessage = error instanceof Error ? error.message : 'Could not load page settings.';
			setLoadError(errorMessage);
			if (isRefresh) toast.error(errorMessage);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	// After a write, pull the audit log again so the Activity log tab shows the new entries.
	const refreshAuditLogs = useCallback(() => {
		adminPageAccessService
			.fetchAuditLogs()
			.then(setAuditLogs)
			.catch((error: unknown) => console.warn('[PageAccessAdminSection.refreshAuditLogs] Error:', error));
	}, []);

	const filtered = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		return settings.filter(
			(setting) =>
				(statusFilter === 'all' || setting.status === statusFilter) &&
				(!normalized || `${setting.pageName} ${setting.route} ${setting.description ?? ''}`.toLowerCase().includes(normalized))
		);
	}, [query, settings, statusFilter]);

	const openEditor = (setting: PageAccessSetting) => {
		setEditing(setting);
		setEditor(createEditorState(setting));
		setEditorError(null);
	};
	const closeEditor = () => {
		if (saving) return;
		setEditing(null);
		setEditor(null);
	};
	const toggleSelected = (id: string) => setSelectedIds((current) => (current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id]));

	const handleSave = async () => {
		if (!editing || !editor || saving) return;
		setSaving(true);
		setEditorError(null);
		const updates: PageAccessUpdate = { ...editor };
		try {
			// The previous values go into the audit entry (no more "unknown" previous status).
			await adminPageAccessService.updateSetting(editing.id, updates, { pageName: editing.pageName, status: editing.status });
			refreshAuditLogs();
			setSettings((current) => current.map((setting) => (setting.id === editing.id ? { ...setting, ...editor } : setting)));
			setEditing(null);
			setEditor(null);
			toast.success(`${editing.pageName} updated.`);
		} catch (error: unknown) {
			console.error('[PageAccessAdminSection.handleSave] Error:', error);
			setEditorError(error instanceof Error ? error.message : 'Could not update this page.');
		} finally {
			setSaving(false);
		}
	};

	const handleBulkStatus = async () => {
		const status = bulkStatus;
		if (!selectedIds.length || saving) return;
		setSaving(true);
		setBulkError(null);
		const updates: PageAccessUpdate = { status, badgeText: getPageAccessBadge(status), showPagePreview: status !== 'disabled' };
		try {
			await adminPageAccessService.bulkUpdate(
				selectedIds,
				updates,
				new Map(settings.filter((setting) => selectedIds.includes(setting.id)).map((setting) => [setting.id, { pageName: setting.pageName, status: setting.status }]))
			);
			refreshAuditLogs();
			setSettings((current) =>
				current.map((setting) => (selectedIds.includes(setting.id) ? { ...setting, status, badgeText: getPageAccessBadge(status), showPagePreview: status !== 'disabled' } : setting))
			);
			toast.success(`${selectedIds.length} page${selectedIds.length === 1 ? '' : 's'} now ${getStatusLabel(status).toLowerCase()}.`);
			setSelectedIds([]);
			setBulkOpen(false);
		} catch (error: unknown) {
			console.error('[PageAccessAdminSection.handleBulkStatus] Error:', error);
			setBulkError(error instanceof Error ? error.message : 'Could not update selected pages.');
		} finally {
			setSaving(false);
		}
	};

	const handleConfirmedAction = async () => {
		const action = confirmAction;
		if (!action || saving) return;
		setSaving(true);
		setConfirmError(null);
		try {
			if (action === 'initialize') await adminPageAccessService.initializeDefaults();
			else await adminPageAccessService.resetDefaults();
			setConfirmAction(null);
			toast.success(action === 'initialize' ? 'Missing canonical pages were added.' : 'Every canonical page was restored to its default access state.');
			await load(true);
		} catch (error: unknown) {
			console.error('[PageAccessAdminSection.handleConfirmedAction] Error:', error);
			setConfirmError(error instanceof Error ? error.message : 'The action could not be completed.');
		} finally {
			setSaving(false);
		}
	};

	const filterGroups: FilterGroup[] = [
		{
			key: 'status',
			label: 'Status',
			options: [{ value: 'all', label: 'Any status' }, ...STATUSES.map((status) => ({ value: status, label: getStatusLabel(status) }))],
			value: statusFilter,
			defaultValue: 'all',
		},
	];
	const handleApplyFilters = (values: FilterValues) => {
		const nextStatus = STATUSES.find((status) => status === readSingleFilter(values, 'status'));
		setStatusFilter(nextStatus ?? 'all');
	};
	const handleClearFilters = () => {
		setStatusFilter('all');
		setQuery('');
	};

	// Without stored settings the list would show registry defaults, and edits made from that
	// baseline would overwrite the real values: show the error state with Retry instead.
	const screenState: AdminScreenState = loading
		? { kind: 'loading', variant: 'list' }
		: loadError && settings.length === 0
			? { kind: 'error', title: 'Page settings unavailable', message: loadError }
			: activeTab === 'pages' && filtered.length === 0
				? settings.length
					? { kind: 'empty', title: 'No matching pages.', filtered: true, onClearFilters: handleClearFilters }
					: { kind: 'empty', title: 'No page settings yet.', description: 'Initialize defaults from the ⋯ menu to add the canonical pages.', icon: 'layout' }
				: activeTab === 'audit' && auditLogs.length === 0
					? { kind: 'empty', title: 'No page-access activity recorded yet.', icon: 'clock' }
					: { kind: 'ready' };

	const selectionFooter =
		activeTab === 'pages' && selectedIds.length ? (
			<>
				<AdminButton label="Clear" tone="neutral" disabled={saving} onPress={() => setSelectedIds([])} />
				<AdminButton
					label={`${selectedIds.length} selected · Change status`}
					icon="edit-2"
					tone="positive"
					emphasis="primary"
					disabled={saving}
					onPress={() => {
						setBulkError(null);
						setBulkOpen(true);
					}}
					style={{ flex: 1 }}
				/>
			</>
		) : undefined;

	return (
		<>
			<AdminScreen
				title="Page access"
				subtitle="Navigation, overlays, previews and action routes"
				state={screenState}
				onRefresh={() => load(true)}
				refreshing={refreshing}
				footer={selectionFooter}
				overflowActions={[
					{
						key: 'initialize',
						label: 'Initialize defaults',
						icon: 'plus-square',
						description: 'Adds missing canonical pages; keeps existing values',
						onPress: () => {
							setConfirmError(null);
							setConfirmAction('initialize');
						},
					},
					{
						key: 'reset',
						label: 'Reset defaults',
						icon: 'rotate-ccw',
						tone: 'danger',
						description: `Overwrites all ${settings.length} pages`,
						onPress: () => {
							setConfirmError(null);
							setConfirmAction('reset');
						},
					},
				]}
				toolbar={
					<AdminToolbar
						segments={{
							value: activeTab,
							options: [
								{ value: 'pages', label: 'Pages', count: settings.length },
								{ value: 'audit', label: 'Activity log' },
							],
							onChange: (next) => setActiveTab(next === 'audit' ? 'audit' : 'pages'),
						}}
						search={activeTab === 'pages' ? { value: query, placeholder: 'Search pages or routes', onChange: setQuery } : undefined}
						filters={activeTab === 'pages' ? { title: 'Filter pages', groups: filterGroups, onApply: handleApplyFilters } : undefined}
						resultSummary={activeTab === 'pages' && settings.length ? `${filtered.length} of ${settings.length} pages` : undefined}
					/>
				}
			>
				<View style={{ gap: space.sm }}>
					{loadError ? <AdminState kind="inlineError" message={loadError} onRetry={() => void load(true)} retrying={refreshing} /> : null}
					{activeTab === 'pages'
						? filtered.map((setting) => (
								<AdminListRow
									key={setting.id}
									title={setting.pageName}
									subtitle={setting.route}
									meta={setting.showInNavigation ? 'Visible in navigation' : 'Hidden from navigation'}
									status={{ label: getStatusLabel(setting.status), tone: getStatusTone(setting.status) }}
									selectable={{ selected: selectedIds.includes(setting.id), onToggle: () => toggleSelected(setting.id) }}
									accessibilityHint="Opens the page access editor"
									onPress={() => openEditor(setting)}
								/>
							))
						: auditLogs.map((entry) => (
								<AdminListRow
									key={entry.id}
									title={entry.pageName}
									subtitle={`${entry.action}: ${entry.previousStatus} → ${entry.newStatus}`}
									meta={`${entry.administratorName}${entry.createdAtMs ? ` · ${new Date(entry.createdAtMs).toLocaleString()}` : ''}`}
									leading={{ kind: 'icon', name: 'clock' }}
								/>
							))}
				</View>
			</AdminScreen>

			<Modal visible={Boolean(editing && editor)} transparent statusBarTranslucent navigationBarTranslucent animationType="none" presentationStyle="overFullScreen" onRequestClose={closeEditor}>
				<SwipeDismissSurface
					visible={Boolean(editing && editor)}
					onDismiss={closeEditor}
					handleColor={colors.border}
					disabled={saving}
					accessibilityLabel="Swipe down to close page access editor"
					style={{ flex: 1, backgroundColor: colors.canvas }}
				>
					<SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
						<View
							style={{
								minHeight: 56,
								flexDirection: 'row',
								alignItems: 'center',
								gap: space.sm,
								paddingLeft: space.lg,
								paddingRight: space.xs,
								borderBottomWidth: 1,
								borderBottomColor: colors.border,
								backgroundColor: colors.navigation,
							}}
						>
							<View style={{ flex: 1 }}>
								<Text numberOfLines={1} accessibilityRole="header" style={[type.title, { color: colors.text }]}>
									Edit {editing?.pageName}
								</Text>
								<Text numberOfLines={1} style={[type.meta, { color: colors.mutedText }]}>
									{editing?.route}
								</Text>
							</View>
							<AdminIconButton icon="x" label="Close page access editor" iconSize={22} disabled={saving} onPress={closeEditor} />
						</View>
						{/* Full-screen Modal: Android doesn't resize for the keyboard, so shrink the form (and footer) above it. */}
						<KeyboardSafeView style={{ flex: 1 }}>
							{editor ? (
								<>
									<ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ gap: space.md, padding: space.lg, paddingBottom: space.xxl }}>
										{editorError ? <AdminState kind="inlineError" message={editorError} /> : null}
										<AdminSection title="Availability status">
											<View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
												{STATUSES.map((status) => (
													<StatusChoice
														key={status}
														status={status}
														selected={editor.status === status}
														disabled={saving}
														onPress={() => setEditor((current) => (current ? { ...current, status, badgeText: getPageAccessBadge(status) } : current))}
													/>
												))}
											</View>
										</AdminSection>
										<AdminSection title="Visibility">
											{(
												[
													['Show in navigation', 'Allow this route to appear in menus.', 'showInNavigation'],
													['Show page preview', 'Keep the destination visible behind its access overlay.', 'showPagePreview'],
												] as const
											).map(([title, subtitle, switchKey]) => (
												<View key={switchKey} style={{ minHeight: ADMIN_MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
													<View style={{ flex: 1 }}>
														<Text style={[type.bodyStrong, { color: colors.text }]}>{title}</Text>
														<Text style={[type.meta, { color: colors.mutedText }]}>{subtitle}</Text>
													</View>
													<Switch
														value={editor[switchKey]}
														accessibilityLabel={title}
														disabled={saving}
														onValueChange={(value) => setEditor((current) => (current ? { ...current, [switchKey]: value } : current))}
														trackColor={{ false: colors.border, true: colors.accent }}
													/>
												</View>
											))}
										</AdminSection>
										<AdminSection title="Overlay content">
											{OVERLAY_FIELDS.map(([label, key, multiline]) => (
												<View key={key} style={{ gap: space.xs }}>
													<Text style={[type.label, { color: colors.mutedText }]}>{label}</Text>
													<TextInput
														value={editor[key]}
														onChangeText={(value) => setEditor((current) => (current ? { ...current, [key]: value } : current))}
														multiline={multiline}
														editable={!saving}
														accessibilityLabel={label}
														placeholderTextColor={colors.mutedText}
														style={getInputStyle(colors, multiline)}
													/>
												</View>
											))}
										</AdminSection>
									</ScrollView>
									<View
										style={{
											paddingHorizontal: space.lg,
											paddingTop: space.md,
											paddingBottom: space.md + insets.bottom,
											borderTopWidth: 1,
											borderTopColor: colors.border,
											backgroundColor: colors.navigation,
										}}
									>
										<AdminButton label="Save changes" icon="check" tone="positive" emphasis="primary" fullWidth busy={saving} onPress={() => void handleSave()} />
									</View>
								</>
							) : null}
						</KeyboardSafeView>
					</SafeAreaView>
				</SwipeDismissSurface>
			</Modal>

			<AdminDialog
				visible={bulkOpen}
				title={`Change status of ${selectedIds.length} page${selectedIds.length === 1 ? '' : 's'}?`}
				description={`Every selected page gets the status below, its default badge, and ${bulkStatus === 'disabled' ? 'no page preview' : 'a page preview'}. This applies straight away.`}
				tone="pending"
				icon="edit-2"
				confirmLabel={`Apply ${getStatusLabel(bulkStatus)}`}
				busy={saving}
				onConfirm={() => void handleBulkStatus()}
				onClose={() => {
					if (!saving) setBulkOpen(false);
				}}
			>
				<View style={{ gap: space.sm }}>
					<View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
						{STATUSES.map((status) => (
							<StatusChoice key={status} status={status} selected={bulkStatus === status} disabled={saving} onPress={() => setBulkStatus(status)} />
						))}
					</View>
					{bulkError ? <AdminState kind="inlineError" message={bulkError} /> : null}
				</View>
			</AdminDialog>

			<AdminDialog
				visible={confirmAction !== null}
				title={confirmAction === 'reset' ? 'Reset every page?' : 'Initialize defaults?'}
				description={
					confirmAction === 'reset'
						? 'This replaces canonical page settings with their default status and visibility values. Custom overlays and statuses are overwritten.'
						: 'Missing canonical page settings will be added without overwriting existing values.'
				}
				tone={confirmAction === 'reset' ? 'danger' : 'pending'}
				icon={confirmAction === 'reset' ? 'rotate-ccw' : 'plus-square'}
				confirmLabel={confirmAction === 'reset' ? 'Reset defaults' : 'Initialize'}
				requireText={confirmAction === 'reset' ? 'RESET' : undefined}
				busy={saving}
				onConfirm={() => void handleConfirmedAction()}
				onClose={() => {
					if (!saving) setConfirmAction(null);
				}}
			>
				{confirmError ? <AdminState kind="inlineError" message={confirmError} /> : null}
			</AdminDialog>
		</>
	);
}
