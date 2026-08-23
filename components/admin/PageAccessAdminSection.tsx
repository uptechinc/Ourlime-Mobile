import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Modal,
	ScrollView,
	Switch,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import CustomModal, { type CustomModalType } from '@/components/ui/CustomModal';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import {
	adminPageAccessService,
	type AdminPageAccessAuditEntry,
	type PageAccessUpdate,
} from '@/lib/services/AdminPageAccessService';
import { getPageAccessBadge } from '@/lib/pageAccess/PageRegistry';
import type {
	PageAccessSetting,
	PageAccessStatus,
} from '@/lib/types/pageAccess';

const STATUSES: readonly PageAccessStatus[] = [
	'enabled',
	'coming_soon',
	'maintenance',
	'beta_only',
	'developer_only',
	'admin_only',
	'disabled',
];

function getStatusLabel(status: PageAccessStatus): string {
	if (status === 'coming_soon') return 'Coming Soon';
	if (status === 'beta_only') return 'Beta Only';
	if (status === 'developer_only') return 'Developer Only';
	if (status === 'admin_only') return 'Admin Only';
	return status.charAt(0).toUpperCase() + status.slice(1);
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

type FeedbackState = {
	visible: boolean;
	type: CustomModalType;
	title: string;
	message: string;
};
type ConfirmationState = {
	action: 'initialize' | 'reset' | null;
	title: string;
	message: string;
};

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

export default function PageAccessAdminSection() {
	const [settings, setSettings] = useState<PageAccessSetting[]>([]);
	const [auditLogs, setAuditLogs] = useState<AdminPageAccessAuditEntry[]>([]);
	const [activeTab, setActiveTab] = useState<'pages' | 'audit'>('pages');
	const [loading, setLoading] = useState(true);
	const [query, setQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState<PageAccessStatus | 'all'>(
		'all'
	);
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [editing, setEditing] = useState<PageAccessSetting | null>(null);
	const [editor, setEditor] = useState<EditorState | null>(null);
	const [saving, setSaving] = useState(false);
	const [feedback, setFeedback] = useState<FeedbackState>({
		visible: false,
		type: 'info',
		title: '',
		message: '',
	});
	const [confirmation, setConfirmation] = useState<ConfirmationState>({
		action: null,
		title: '',
		message: '',
	});

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [nextSettings, nextLogs] = await Promise.all([
				adminPageAccessService.fetchSettings(),
				adminPageAccessService.fetchAuditLogs().catch(() => []),
			]);
			setSettings(nextSettings);
			setAuditLogs(nextLogs);
		} catch (error: unknown) {
			setFeedback({
				visible: true,
				type: 'danger',
				title: 'Page settings unavailable',
				message:
					error instanceof Error
						? error.message
						: 'Could not load page settings.',
			});
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const filtered = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		return settings.filter(
			(setting) =>
				(statusFilter === 'all' || setting.status === statusFilter) &&
				(!normalized ||
					`${setting.pageName} ${setting.route} ${setting.description ?? ''}`
						.toLowerCase()
						.includes(normalized))
		);
	}, [query, settings, statusFilter]);

	const openEditor = (setting: PageAccessSetting) => {
		setEditing(setting);
		setEditor(createEditorState(setting));
	};
	const toggleSelected = (id: string) =>
		setSelectedIds((current) =>
			current.includes(id)
				? current.filter((selectedId) => selectedId !== id)
				: [...current, id]
		);

	const handleSave = async () => {
		if (!editing || !editor || saving) return;
		setSaving(true);
		const updates: PageAccessUpdate = { ...editor };
		try {
			await adminPageAccessService.updateSetting(editing.id, updates);
			setSettings((current) =>
				current.map((setting) =>
					setting.id === editing.id ? { ...setting, ...editor } : setting
				)
			);
			setEditing(null);
			setEditor(null);
			setFeedback({
				visible: true,
				type: 'success',
				title: 'Page access updated',
				message: `${editing.pageName} now uses the saved access, navigation, preview, overlay, badge, and action settings.`,
			});
		} catch (error: unknown) {
			setFeedback({
				visible: true,
				type: 'danger',
				title: 'Update failed',
				message:
					error instanceof Error
						? error.message
						: 'Could not update this page.',
			});
		} finally {
			setSaving(false);
		}
	};

	const handleBulkStatus = async (status: PageAccessStatus) => {
		if (!selectedIds.length || saving) return;
		setSaving(true);
		const updates: PageAccessUpdate = {
			status,
			badgeText: getPageAccessBadge(status),
			showPagePreview: status !== 'disabled',
		};
		try {
			await adminPageAccessService.bulkUpdate(selectedIds, updates);
			setSettings((current) =>
				current.map((setting) =>
					selectedIds.includes(setting.id)
						? {
								...setting,
								status,
								badgeText: getPageAccessBadge(status),
								showPagePreview: status !== 'disabled',
							}
						: setting
				)
			);
			setSelectedIds([]);
			setFeedback({
				visible: true,
				type: 'success',
				title: 'Bulk update complete',
				message: `Selected pages are now ${getStatusLabel(status).toLowerCase()}.`,
			});
		} catch (error: unknown) {
			setFeedback({
				visible: true,
				type: 'danger',
				title: 'Bulk update failed',
				message:
					error instanceof Error
						? error.message
						: 'Could not update selected pages.',
			});
		} finally {
			setSaving(false);
		}
	};

	const handleConfirmedAction = async () => {
		const action = confirmation.action;
		if (!action || saving) return;
		setConfirmation({ action: null, title: '', message: '' });
		setSaving(true);
		try {
			if (action === 'initialize')
				await adminPageAccessService.initializeDefaults();
			else await adminPageAccessService.resetDefaults();
			await load();
			setFeedback({
				visible: true,
				type: 'success',
				title:
					action === 'initialize'
						? 'Defaults initialized'
						: 'Defaults restored',
				message:
					action === 'initialize'
						? 'Missing canonical pages were added.'
						: 'Every canonical page was restored to its default access state.',
			});
		} catch (error: unknown) {
			setFeedback({
				visible: true,
				type: 'danger',
				title: 'Page access action failed',
				message:
					error instanceof Error
						? error.message
						: 'The action could not be completed.',
			});
		} finally {
			setSaving(false);
		}
	};

	if (loading)
		return (
			<View style={{ paddingVertical: 70, alignItems: 'center' }}>
				<ActivityIndicator color="#10b981" />
				<Text style={{ marginTop: 10, color: '#64748b' }}>
					Loading page access settings…
				</Text>
			</View>
		);

	return (
		<View style={{ flex: 1 }}>
			<View
				style={{
					padding: 16,
					backgroundColor: '#fff',
					borderRadius: 18,
					borderWidth: 1,
					borderColor: '#e2e8f0',
				}}
			>
				<Text style={{ color: '#0f172a', fontSize: 18, fontWeight: '900' }}>
					Page Availability
				</Text>
				<Text style={{ marginTop: 5, color: '#64748b' }}>
					Manage mobile and web navigation, access overlays, page previews, and
					action routes.
				</Text>
				<View style={{ marginTop: 14, flexDirection: 'row' }}>
					{(['pages', 'audit'] as const).map((tab) => (
						<TouchableOpacity
							key={tab}
							onPress={() => setActiveTab(tab)}
							style={{
								marginRight: 8,
								borderRadius: 12,
								paddingHorizontal: 14,
								paddingVertical: 9,
								backgroundColor: activeTab === tab ? '#d1fae5' : '#f1f5f9',
							}}
						>
							<Text
								style={{
									color: activeTab === tab ? '#047857' : '#64748b',
									fontWeight: '800',
								}}
							>
								{tab === 'pages' ? 'Pages' : 'Activity Log'}
							</Text>
						</TouchableOpacity>
					))}
				</View>
				{activeTab === 'pages' ? (
					<>
						<View
							style={{
								marginTop: 13,
								flexDirection: 'row',
								alignItems: 'center',
								borderRadius: 14,
								backgroundColor: '#f8fafc',
								borderWidth: 1,
								borderColor: '#e2e8f0',
								paddingHorizontal: 12,
							}}
						>
							<Icon name="search" size={17} color="#94a3b8" />
							<TextInput
								value={query}
								onChangeText={setQuery}
								placeholder="Search pages or routes"
								style={{ flex: 1, paddingHorizontal: 9, paddingVertical: 11 }}
							/>
						</View>
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							style={{ marginTop: 10 }}
						>
							{(['all', ...STATUSES] as const).map((status) => (
								<TouchableOpacity
									key={status}
									onPress={() => setStatusFilter(status)}
									style={{
										marginRight: 7,
										borderRadius: 999,
										paddingHorizontal: 11,
										paddingVertical: 7,
										backgroundColor:
											statusFilter === status ? '#10b981' : '#f1f5f9',
									}}
								>
									<Text
										style={{
											color: statusFilter === status ? '#fff' : '#475569',
											fontSize: 11,
											fontWeight: '800',
										}}
									>
										{status === 'all' ? 'All' : getStatusLabel(status)}
									</Text>
								</TouchableOpacity>
							))}
						</ScrollView>
					</>
				) : null}
			</View>

			{activeTab === 'pages' ? (
				<>
					<View
						style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap' }}
					>
						<TouchableOpacity
							onPress={() =>
								setConfirmation({
									action: 'initialize',
									title: 'Initialize defaults?',
									message:
										'Missing canonical page settings will be added without overwriting existing values.',
								})
							}
							style={{
								marginRight: 8,
								marginBottom: 8,
								borderRadius: 11,
								backgroundColor: '#ecfdf5',
								padding: 10,
							}}
						>
							<Text style={{ color: '#047857', fontWeight: '800' }}>
								Initialize Defaults
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							onPress={() =>
								setConfirmation({
									action: 'reset',
									title: 'Reset every page?',
									message:
										'This replaces canonical page settings with their default status and visibility values.',
								})
							}
							style={{
								marginBottom: 8,
								borderRadius: 11,
								backgroundColor: '#fff1f2',
								padding: 10,
							}}
						>
							<Text style={{ color: '#be123c', fontWeight: '800' }}>
								Reset Defaults
							</Text>
						</TouchableOpacity>
					</View>
					{selectedIds.length ? (
						<View
							style={{
								marginBottom: 10,
								padding: 12,
								borderRadius: 14,
								backgroundColor: '#ecfdf5',
							}}
						>
							<Text style={{ color: '#047857', fontWeight: '900' }}>
								{selectedIds.length} selected
							</Text>
							<ScrollView
								horizontal
								showsHorizontalScrollIndicator={false}
								style={{ marginTop: 8 }}
							>
								{STATUSES.map((status) => (
									<TouchableOpacity
										key={status}
										onPress={() => void handleBulkStatus(status)}
										style={{
											marginRight: 7,
											borderRadius: 999,
											backgroundColor: '#fff',
											paddingHorizontal: 10,
											paddingVertical: 7,
										}}
									>
										<Text
											style={{
												color: '#334155',
												fontSize: 11,
												fontWeight: '800',
											}}
										>
											{getStatusLabel(status)}
										</Text>
									</TouchableOpacity>
								))}
							</ScrollView>
						</View>
					) : null}
					{filtered.map((setting) => (
						<View
							key={setting.id}
							style={{
								marginBottom: 9,
								flexDirection: 'row',
								alignItems: 'center',
								padding: 13,
								borderRadius: 16,
								backgroundColor: '#fff',
								borderWidth: 1,
								borderColor: selectedIds.includes(setting.id)
									? '#10b981'
									: '#e2e8f0',
							}}
						>
							<TouchableOpacity
								onPress={() => toggleSelected(setting.id)}
								style={{ padding: 4 }}
							>
								<Icon
									name={
										selectedIds.includes(setting.id) ? 'check-square' : 'square'
									}
									size={20}
									color={
										selectedIds.includes(setting.id) ? '#10b981' : '#94a3b8'
									}
								/>
							</TouchableOpacity>
							<TouchableOpacity
								onPress={() => openEditor(setting)}
								style={{ flex: 1, marginLeft: 8 }}
							>
								<Text style={{ color: '#0f172a', fontWeight: '900' }}>
									{setting.pageName}
								</Text>
								<Text style={{ marginTop: 2, color: '#64748b', fontSize: 11 }}>
									{setting.route}
								</Text>
								<Text
									style={{
										marginTop: 4,
										color: setting.showInNavigation ? '#047857' : '#94a3b8',
										fontSize: 10,
										fontWeight: '800',
									}}
								>
									{setting.showInNavigation
										? 'VISIBLE IN NAVIGATION'
										: 'HIDDEN FROM NAVIGATION'}
								</Text>
							</TouchableOpacity>
							<TouchableOpacity onPress={() => openEditor(setting)}>
								<Text
									style={{ color: '#475569', fontSize: 10, fontWeight: '900' }}
								>
									{getStatusLabel(setting.status)}
								</Text>
							</TouchableOpacity>
						</View>
					))}
					{!filtered.length ? (
						<Text
							style={{
								paddingVertical: 45,
								textAlign: 'center',
								color: '#64748b',
							}}
						>
							No matching pages.
						</Text>
					) : null}
				</>
			) : (
				<View style={{ marginTop: 10 }}>
					{auditLogs.map((entry) => (
						<View
							key={entry.id}
							style={{
								marginBottom: 9,
								padding: 14,
								borderRadius: 15,
								backgroundColor: '#fff',
								borderWidth: 1,
								borderColor: '#e2e8f0',
							}}
						>
							<Text style={{ color: '#0f172a', fontWeight: '900' }}>
								{entry.pageName}
							</Text>
							<Text style={{ marginTop: 4, color: '#475569' }}>
								{entry.action}: {entry.previousStatus} → {entry.newStatus}
							</Text>
							<Text style={{ marginTop: 5, color: '#94a3b8', fontSize: 11 }}>
								{entry.administratorName}
								{entry.createdAtMs
									? ` · ${new Date(entry.createdAtMs).toLocaleString()}`
									: ''}
							</Text>
						</View>
					))}
					{!auditLogs.length ? (
						<Text
							style={{
								paddingVertical: 45,
								textAlign: 'center',
								color: '#64748b',
							}}
						>
							No page-access activity recorded yet.
						</Text>
					) : null}
				</View>
			)}

			<TouchableOpacity
				onPress={() => void load()}
				style={{ alignSelf: 'center', marginVertical: 12, padding: 10 }}
			>
				<Text style={{ color: '#047857', fontWeight: '800' }}>
					Refresh workspace
				</Text>
			</TouchableOpacity>

			<Modal
				visible={Boolean(editing && editor)}
				transparent
				statusBarTranslucent
				navigationBarTranslucent
				animationType="none"
				presentationStyle="overFullScreen"
				onRequestClose={() => {
					setEditing(null);
					setEditor(null);
				}}
			>
				<SwipeDismissSurface visible={Boolean(editing && editor)} onDismiss={() => { setEditing(null); setEditor(null); }} handleColor="#cbd5e1" disabled={saving} accessibilityLabel="Swipe down to close page access editor" style={{ flex: 1, backgroundColor: '#f8fafc' }}>
				<SafeAreaView
					edges={['top', 'left', 'right']}
					style={{ flex: 1, backgroundColor: '#f8fafc' }}
				>
					<View
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							padding: 16,
							backgroundColor: '#fff',
						}}
					>
						<TouchableOpacity
							onPress={() => {
								setEditing(null);
								setEditor(null);
							}}
						>
							<Icon name="x" size={23} color="#334155" />
						</TouchableOpacity>
						<Text
							style={{
								flex: 1,
								marginLeft: 12,
								fontSize: 18,
								fontWeight: '900',
							}}
						>
							Edit {editing?.pageName}
						</Text>
					</View>
					{editor ? (
						<ScrollView
							contentContainerStyle={{ padding: 18, paddingBottom: 45 }}
						>
							<Text style={{ color: '#64748b' }}>{editing?.route}</Text>
							<Text
								style={{ marginTop: 18, marginBottom: 9, fontWeight: '900' }}
							>
								Availability status
							</Text>
							<ScrollView horizontal showsHorizontalScrollIndicator={false}>
								{STATUSES.map((status) => (
									<TouchableOpacity
										key={status}
										onPress={() =>
											setEditor((current) =>
												current
													? {
															...current,
															status,
															badgeText: getPageAccessBadge(status),
														}
													: current
											)
										}
										style={{
											marginRight: 7,
											borderRadius: 999,
											paddingHorizontal: 12,
											paddingVertical: 8,
											backgroundColor:
												editor.status === status ? '#10b981' : '#fff',
										}}
									>
										<Text
											style={{
												color: editor.status === status ? '#fff' : '#475569',
												fontSize: 11,
												fontWeight: '800',
											}}
										>
											{getStatusLabel(status)}
										</Text>
									</TouchableOpacity>
								))}
							</ScrollView>
							{[
								[
									'Show in navigation',
									'Allow this route to appear in menus.',
									'showInNavigation',
								],
								[
									'Show page preview',
									'Keep the destination visible behind its access overlay.',
									'showPagePreview',
								],
							].map(([title, subtitle, key]) => {
								const switchKey =
									key === 'showInNavigation'
										? 'showInNavigation'
										: 'showPagePreview';
								return (
									<View
										key={key}
										style={{
											marginTop: 14,
											flexDirection: 'row',
											alignItems: 'center',
											padding: 13,
											borderRadius: 14,
											backgroundColor: '#fff',
										}}
									>
										<View style={{ flex: 1 }}>
											<Text style={{ fontWeight: '900' }}>{title}</Text>
											<Text
												style={{ marginTop: 2, color: '#64748b', fontSize: 11 }}
											>
												{subtitle}
											</Text>
										</View>
										<Switch
											value={editor[switchKey]}
											onValueChange={(value) =>
												setEditor((current) =>
													current ? { ...current, [switchKey]: value } : current
												)
											}
											trackColor={{ true: '#10b981' }}
										/>
									</View>
								);
							})}
							<Text style={{ marginTop: 18, fontWeight: '900' }}>
								Overlay content
							</Text>
							{(
								[
									['Overlay title', 'overlayTitle', false],
									['Overlay description', 'overlayDescription', true],
									['Badge text', 'badgeText', false],
									['Primary button label', 'primaryButtonLabel', false],
									['Primary button route', 'primaryButtonRoute', false],
									['Secondary button label', 'secondaryButtonLabel', false],
									['Secondary button route', 'secondaryButtonRoute', false],
								] as const
							).map(([label, key, multiline]) => (
								<View key={key} style={{ marginTop: 11 }}>
									<Text
										style={{
											marginBottom: 5,
											color: '#475569',
											fontSize: 11,
											fontWeight: '800',
										}}
									>
										{label}
									</Text>
									<TextInput
										value={editor[key]}
										onChangeText={(value) =>
											setEditor((current) =>
												current ? { ...current, [key]: value } : current
											)
										}
										multiline={multiline}
										style={{
											minHeight: multiline ? 82 : undefined,
											textAlignVertical: multiline ? 'top' : 'center',
											borderRadius: 13,
											borderWidth: 1,
											borderColor: '#e2e8f0',
											backgroundColor: '#fff',
											padding: 11,
										}}
									/>
								</View>
							))}
							<TouchableOpacity
								disabled={saving}
								onPress={() => void handleSave()}
								style={{
									marginTop: 18,
									alignItems: 'center',
									borderRadius: 15,
									backgroundColor: '#10b981',
									padding: 14,
								}}
							>
								{saving ? (
									<ActivityIndicator color="#fff" />
								) : (
									<Text style={{ color: '#fff', fontWeight: '900' }}>
										Save Changes
									</Text>
								)}
							</TouchableOpacity>
						</ScrollView>
					) : null}
				</SafeAreaView>
				</SwipeDismissSurface>
			</Modal>
			<CustomModal
				visible={feedback.visible}
				type={feedback.type}
				title={feedback.title}
				message={feedback.message}
				onClose={() =>
					setFeedback((current) => ({ ...current, visible: false }))
				}
			/>
			<CustomModal
				visible={Boolean(confirmation.action)}
				type="warning"
				title={confirmation.title}
				message={confirmation.message}
				confirmText="Continue"
				cancelText="Cancel"
				onConfirm={() => void handleConfirmedAction()}
				onCancel={() =>
					setConfirmation({ action: null, title: '', message: '' })
				}
				onClose={() =>
					setConfirmation({ action: null, title: '', message: '' })
				}
			/>
		</View>
	);
}
