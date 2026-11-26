import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View, type TextStyle } from 'react-native';
import AdminPressable from '@/components/admin/AdminPressable';
import Icon from 'react-native-vector-icons/Feather';
import { toast } from 'sonner-native';
import AdminButton from '@/components/admin/AdminButton';
import AdminDialog, { type AdminDialogStage } from '@/components/admin/AdminDialog';
import AdminListRow from '@/components/admin/AdminListRow';
import AdminScreen, { type AdminScreenState } from '@/components/admin/AdminScreen';
import AdminSection from '@/components/admin/AdminSection';
import AdminState from '@/components/admin/AdminState';
import AdminStatusPill from '@/components/admin/AdminStatusPill';
import AdminToolbar from '@/components/admin/AdminToolbar';
import { readSingleFilter, type FilterGroup, type FilterValues } from '@/components/ui/FilterSheet';
import { ADMIN_MIN_TOUCH, getAdminTone, radius, space, type, type AdminToneName } from '@/lib/admin/adminTokens';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { AdminWorkspaceService, type AdminBetaOverview, type AdminBetaRecord } from '@/lib/services/AdminWorkspaceService';

const workspaceService = AdminWorkspaceService.getInstance();
const TABS = ['all', 'applications', 'invited', 'registered', 'approved', 'rejected', 'expired', 'revoked', 'suspended', 'removed'] as const;
type TesterTab = (typeof TABS)[number];
type RegistrationMode = AdminBetaOverview['registrationMode'];

const REGISTRATION_MODES: { mode: RegistrationMode; label: string; description: string; tone: AdminToneName }[] = [
	{ mode: 'open', label: 'Open', description: 'Anyone can use the public registration wizard.', tone: 'positive' },
	{ mode: 'invite_only', label: 'Invite only', description: 'Only people with a tester invitation can register.', tone: 'pending' },
	{ mode: 'closed', label: 'Closed', description: 'Public registration is turned off.', tone: 'danger' },
];

const capitalize = (value: string): string => (value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value);
const formatModeLabel = (mode: RegistrationMode): string => REGISTRATION_MODES.find((option) => option.mode === mode)?.label ?? mode;

/** Only healthy states read positive; declined or ended states are danger, waiting ones pending. */
function getStatusTone(status: string): AdminToneName {
	if (status === 'rejected' || status === 'revoked' || status === 'suspended' || status === 'removed' || status === 'expired') return 'danger';
	if (status === 'pending' || status === 'invited') return 'pending';
	return 'positive';
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

export default function AdminTestersWorkspace() {
	const { colors } = useAppTheme();
	const positive = getAdminTone(colors, 'positive');
	const [overview, setOverview] = useState<AdminBetaOverview>({ records: [], registrationMode: 'invite_only' });
	const [tab, setTab] = useState<TesterTab>('all');
	const [query, setQuery] = useState('');
	const [selected, setSelected] = useState<AdminBetaRecord | null>(null);
	const [notes, setNotes] = useState('');
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [savingStatus, setSavingStatus] = useState<string | null>(null);
	const [modeSaving, setModeSaving] = useState(false);
	const [modeDialogOpen, setModeDialogOpen] = useState(false);
	const [draftMode, setDraftMode] = useState<RegistrationMode>('invite_only');
	const [error, setError] = useState<string | null>(null);
	const [inviteOpen, setInviteOpen] = useState(false);
	const [inviteStage, setInviteStage] = useState<AdminDialogStage>('idle');
	const [inviteResult, setInviteResult] = useState('');
	const [inviteError, setInviteError] = useState<string | null>(null);
	const [inviteName, setInviteName] = useState('');
	const [inviteEmail, setInviteEmail] = useState('');
	const [inviteNotes, setInviteNotes] = useState('');

	const load = useCallback(async (isRefresh = false) => {
		if (isRefresh) setRefreshing(true);
		else setLoading(true);
		setError(null);
		try {
			setOverview(await workspaceService.fetchBetaOverview());
		} catch (loadError: unknown) {
			console.error('[AdminTestersWorkspace.load] Error:', loadError);
			setError(loadError instanceof Error ? loadError.message : 'Tester records could not be loaded.');
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, []);
	useEffect(() => {
		void load();
	}, [load]);

	const visible = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		return overview.records.filter((record) => {
			const matchesTab =
				tab === 'all' ||
				(tab === 'applications' && record.kind === 'application') ||
				(tab === 'registered' && record.kind === 'tester' && record.status === 'active') ||
				record.status === tab;
			return matchesTab && (!normalized || `${record.name} ${record.email} ${record.status} ${record.source}`.toLowerCase().includes(normalized));
		});
	}, [overview.records, query, tab]);

	const handleMode = async () => {
		const mode = draftMode;
		if (modeSaving) return;
		if (mode === overview.registrationMode) {
			setModeDialogOpen(false);
			return;
		}
		setModeSaving(true);
		try {
			await workspaceService.setRegistrationMode(mode);
			setOverview((current) => ({ ...current, registrationMode: mode }));
			setModeDialogOpen(false);
			toast.success(`Registration is now ${formatModeLabel(mode).toLowerCase()}.`);
		} catch (modeError: unknown) {
			console.error('[AdminTestersWorkspace.handleMode] Error:', modeError);
			toast.error(modeError instanceof Error ? modeError.message : 'Registration mode could not be updated.');
		} finally {
			setModeSaving(false);
		}
	};

	const handleStatus = async (status: string) => {
		if (!selected || saving) return;
		setSaving(true);
		setSavingStatus(status);
		try {
			await workspaceService.updateBetaRecord(selected, status, notes);
			setOverview((current) => ({
				...current,
				records: current.records.map((record) => (record.id === selected.id && record.kind === selected.kind ? { ...record, status, notes } : record)),
			}));
			setSelected((current) => (current ? { ...current, status, notes } : null));
			toast.success('Beta record updated.');
			// Approving an application creates an invitation (and other side effects on the server):
			// reload so the list and filter counts reflect them instead of only the patched row.
			void workspaceService.fetchBetaOverview().then(setOverview).catch((refreshError: unknown) => {
				console.warn('[AdminTestersWorkspace.handleStatus] Refresh failed:', refreshError);
			});
		} catch (statusError: unknown) {
			console.error('[AdminTestersWorkspace.handleStatus] Error:', statusError);
			toast.error(statusError instanceof Error ? statusError.message : 'Beta record could not be updated.');
		} finally {
			setSaving(false);
			setSavingStatus(null);
		}
	};

	const handleOpenInvite = () => {
		setInviteStage('idle');
		setInviteResult('');
		setInviteError(null);
		setInviteOpen(true);
	};

	const handleInvite = async () => {
		if (!inviteEmail.trim() || saving) return;
		setSaving(true);
		setInviteError(null);
		setInviteStage('busy');
		try {
			const result = await workspaceService.inviteBetaTester(inviteName, inviteEmail, inviteNotes);
			setInviteName('');
			setInviteEmail('');
			setInviteNotes('');
			setInviteResult(
				result.emailDelivery === 'sent'
					? 'The invitation was created and emailed.'
					: result.inviteUrl
						? `The invitation was created. Registration link: ${result.inviteUrl}`
						: 'The invitation was created.'
			);
			setInviteStage('success');
			await load(true);
		} catch (inviteFailure: unknown) {
			console.error('[AdminTestersWorkspace.handleInvite] Error:', inviteFailure);
			setInviteError(inviteFailure instanceof Error ? inviteFailure.message : 'Invitation could not be created.');
			setInviteStage('idle');
		} finally {
			setSaving(false);
		}
	};

	const filterGroups: FilterGroup[] = [
		{
			key: 'status',
			label: 'Status',
			options: TABS.map((tabOption) => ({ value: tabOption, label: tabOption === 'all' ? 'Any status' : capitalize(tabOption) })),
			value: tab,
			defaultValue: 'all',
		},
	];
	const handleApplyFilters = (values: FilterValues) => {
		const nextTab = TABS.find((tabOption) => tabOption === readSingleFilter(values, 'status'));
		setTab(nextTab ?? 'all');
	};
	const handleClearFilters = () => {
		setTab('all');
		setQuery('');
	};

	const currentMode = REGISTRATION_MODES.find((option) => option.mode === overview.registrationMode) ?? REGISTRATION_MODES[1];
	const isFiltered = tab !== 'all' || Boolean(query.trim());

	const screenState: AdminScreenState = loading
		? { kind: 'loading', variant: 'list' }
		: error && overview.records.length === 0
			? { kind: 'error', message: error }
			: { kind: 'ready' };

	const statusOptions = selected
		? selected.kind === 'application'
			? ['approved', 'rejected', 'pending']
			: selected.kind === 'invitation'
				? ['invited', 'revoked', 'expired']
				: ['active', 'suspended', 'removed']
		: [];

	return (
		<>
			<AdminScreen
				title="Testers"
				subtitle="Applications, invitations and registration access"
				state={screenState}
				onRefresh={() => load(true)}
				refreshing={refreshing}
				primaryAction={{ key: 'invite', label: 'Invite', icon: 'user-plus', onPress: handleOpenInvite }}
				overflowActions={[
					{
						key: 'mode',
						label: 'Change registration mode',
						icon: 'sliders',
						description: `Currently ${currentMode.label.toLowerCase()}`,
						onPress: () => {
							setDraftMode(overview.registrationMode);
							setModeDialogOpen(true);
						},
					},
				]}
				toolbar={
					<AdminToolbar
						search={{ value: query, placeholder: 'Search testers', onChange: setQuery }}
						filters={{ title: 'Filter testers', groups: filterGroups, onApply: handleApplyFilters }}
						resultSummary={overview.records.length ? `${visible.length} of ${overview.records.length} records` : undefined}
					/>
				}
			>
				<View style={{ gap: space.md }}>
					{error ? <AdminState kind="inlineError" message={error} onRetry={() => void load(true)} retrying={refreshing} /> : null}
					<AdminSection
						title="Registration mode"
						description="Controls access to the public registration wizard."
						action={{
							label: 'Change',
							onPress: () => {
								setDraftMode(overview.registrationMode);
								setModeDialogOpen(true);
							},
						}}
					>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
							<AdminStatusPill label={currentMode.label} tone={currentMode.tone} dot />
							<Text style={[type.meta, { flex: 1, color: colors.mutedText }]}>{currentMode.description}</Text>
						</View>
					</AdminSection>

					{visible.length ? (
						<View style={{ gap: space.sm }}>
							{visible.map((record) => (
								<AdminListRow
									key={`${record.kind}-${record.id}`}
									title={record.name || record.email || 'Unnamed record'}
									subtitle={`${record.email || 'No email'} · ${record.kind}`}
									meta={record.source || undefined}
									status={{ label: record.status, tone: getStatusTone(record.status) }}
									accessibilityHint="Opens notes and status actions"
									onPress={() => {
										setSelected(record);
										setNotes(record.notes);
									}}
								/>
							))}
						</View>
					) : (
						<AdminState
							kind="empty"
							title={overview.records.length ? 'No records in this view.' : 'No tester records yet.'}
							icon="user-check"
							filtered={isFiltered}
							onClearFilters={handleClearFilters}
						/>
					)}
				</View>
			</AdminScreen>

			<AdminDialog
				visible={Boolean(selected)}
				title={selected?.name || selected?.email || 'Tester record'}
				description={selected ? `${selected.email || 'No email'} · ${selected.kind}` : undefined}
				onClose={() => {
					if (!saving) setSelected(null);
				}}
			>
				{selected ? (
					<View style={{ gap: space.md }}>
						<AdminStatusPill label={selected.status} tone={getStatusTone(selected.status)} />
						<View style={{ gap: space.xs }}>
							<Text style={[type.label, { color: colors.mutedText }]}>Internal admin notes</Text>
							<TextInput
								value={notes}
								onChangeText={setNotes}
								multiline
								editable={!saving}
								accessibilityLabel="Internal admin notes"
								placeholder="Visible to administrators only"
								placeholderTextColor={colors.mutedText}
								style={getInputStyle(colors, true)}
							/>
						</View>
						<View style={{ gap: space.sm }}>
							<Text style={[type.label, { color: colors.mutedText }]}>Set status</Text>
							{statusOptions.map((statusOption) => (
								<AdminButton
									key={statusOption}
									label={selected.status === statusOption ? `${capitalize(statusOption)} (current)` : capitalize(statusOption)}
									icon={selected.status === statusOption ? 'check' : undefined}
									tone={getStatusTone(statusOption)}
									emphasis={selected.status === statusOption ? 'primary' : 'secondary'}
									busy={savingStatus === statusOption}
									disabled={saving}
									fullWidth
									onPress={() => void handleStatus(statusOption)}
								/>
							))}
						</View>
					</View>
				) : null}
			</AdminDialog>

			<AdminDialog
				visible={modeDialogOpen}
				title="Change registration mode?"
				description="This changes who can register straight away."
				tone="pending"
				icon="sliders"
				confirmLabel="Change mode"
				confirmDisabled={draftMode === overview.registrationMode}
				busy={modeSaving}
				onConfirm={() => void handleMode()}
				onClose={() => {
					if (!modeSaving) setModeDialogOpen(false);
				}}
			>
				<View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
					{REGISTRATION_MODES.map((option) => {
						const isSelected = draftMode === option.mode;
						return (
							<AdminPressable
								key={option.mode}
								onPress={() => setDraftMode(option.mode)}
								disabled={modeSaving}
								accessibilityRole="radio"
								accessibilityLabel={option.label}
								accessibilityHint={option.description}
								accessibilityState={{ checked: isSelected, disabled: modeSaving }}
								style={({ pressed }) => ({
									minHeight: 56,
									flexDirection: 'row',
									alignItems: 'center',
									gap: space.md,
									paddingHorizontal: space.md,
									paddingVertical: space.sm,
									borderRadius: radius.md,
									borderWidth: 1,
									borderColor: isSelected ? positive.border : colors.border,
									backgroundColor: isSelected ? positive.soft : colors.surface,
									opacity: pressed ? 0.7 : 1,
								})}
							>
								<Icon name={isSelected ? 'check-circle' : 'circle'} size={20} color={isSelected ? positive.text : colors.mutedText} />
								<View style={{ flex: 1 }}>
									<Text style={[type.bodyStrong, { color: colors.text }]}>{option.label}</Text>
									<Text style={[type.meta, { color: colors.mutedText }]}>{option.description}</Text>
								</View>
							</AdminPressable>
						);
					})}
				</View>
			</AdminDialog>

			<AdminDialog
				visible={inviteOpen}
				title="Invite tester"
				description="Creates an invitation and emails a registration link when email delivery is available."
				icon="user-plus"
				confirmLabel="Create invitation"
				confirmDisabled={!inviteEmail.trim()}
				stage={inviteStage}
				busyTitle="Creating invitation…"
				busyMessage="Please wait while the invitation is created."
				successTitle="Invitation created"
				successMessage={inviteResult}
				onConfirm={() => void handleInvite()}
				onClose={() => {
					if (!saving) setInviteOpen(false);
				}}
			>
				<View style={{ gap: space.md }}>
					<View style={{ gap: space.xs }}>
						<Text style={[type.label, { color: colors.mutedText }]}>Full name</Text>
						<TextInput value={inviteName} onChangeText={setInviteName} accessibilityLabel="Full name" placeholderTextColor={colors.mutedText} style={getInputStyle(colors)} />
					</View>
					<View style={{ gap: space.xs }}>
						<Text style={[type.label, { color: colors.mutedText }]}>Email address</Text>
						<TextInput
							value={inviteEmail}
							onChangeText={setInviteEmail}
							accessibilityLabel="Email address"
							autoCapitalize="none"
							keyboardType="email-address"
							placeholderTextColor={colors.mutedText}
							style={getInputStyle(colors)}
						/>
					</View>
					<View style={{ gap: space.xs }}>
						<Text style={[type.label, { color: colors.mutedText }]}>Admin notes</Text>
						<TextInput value={inviteNotes} onChangeText={setInviteNotes} multiline accessibilityLabel="Admin notes" placeholderTextColor={colors.mutedText} style={getInputStyle(colors, true)} />
					</View>
					{inviteError ? <AdminState kind="inlineError" message={inviteError} /> : null}
				</View>
			</AdminDialog>
		</>
	);
}
