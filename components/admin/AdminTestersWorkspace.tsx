import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	Modal,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import CustomModal from '@/components/ui/CustomModal';
import AdminWorkspaceShell from './AdminWorkspaceShell';
import {
	AdminWorkspaceService,
	type AdminBetaOverview,
	type AdminBetaRecord,
} from '@/lib/services/AdminWorkspaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const workspaceService = AdminWorkspaceService.getInstance();
const TABS = [
	'all',
	'applications',
	'invited',
	'registered',
	'approved',
	'rejected',
	'expired',
	'revoked',
	'suspended',
	'removed',
] as const;
type TesterTab = (typeof TABS)[number];

export default function AdminTestersWorkspace() {
	const { colors } = useAppTheme();
	const [overview, setOverview] = useState<AdminBetaOverview>({
		records: [],
		registrationMode: 'invite_only',
	});
	const [tab, setTab] = useState<TesterTab>('all');
	const [query, setQuery] = useState('');
	const [selected, setSelected] = useState<AdminBetaRecord | null>(null);
	const [notes, setNotes] = useState('');
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [inviteOpen, setInviteOpen] = useState(false);
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
			setError(
				loadError instanceof Error
					? loadError.message
					: 'Tester records could not be loaded.'
			);
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
				(tab === 'registered' &&
					record.kind === 'tester' &&
					record.status === 'active') ||
				record.status === tab;
			return (
				matchesTab &&
				(!normalized ||
					`${record.name} ${record.email} ${record.status} ${record.source}`
						.toLowerCase()
						.includes(normalized))
			);
		});
	}, [overview.records, query, tab]);

	const handleMode = async (mode: AdminBetaOverview['registrationMode']) => {
		try {
			await workspaceService.setRegistrationMode(mode);
			setOverview((current) => ({ ...current, registrationMode: mode }));
			setMessage(`Registration is now ${mode.replace('_', ' ')}.`);
		} catch (modeError: unknown) {
			setMessage(
				modeError instanceof Error
					? modeError.message
					: 'Registration mode could not be updated.'
			);
		}
	};
	const handleStatus = async (status: string) => {
		if (!selected || saving) return;
		setSaving(true);
		try {
			await workspaceService.updateBetaRecord(selected, status, notes);
			setOverview((current) => ({
				...current,
				records: current.records.map((record) =>
					record.id === selected.id && record.kind === selected.kind
						? { ...record, status, notes }
						: record
				),
			}));
			setSelected((current) =>
				current ? { ...current, status, notes } : null
			);
			setMessage('Beta record updated.');
		} catch (statusError: unknown) {
			setMessage(
				statusError instanceof Error
					? statusError.message
					: 'Beta record could not be updated.'
			);
		} finally {
			setSaving(false);
		}
	};
	const handleInvite = async () => {
		if (!inviteEmail.trim() || saving) return;
		setSaving(true);
		try {
			const result = await workspaceService.inviteBetaTester(
				inviteName,
				inviteEmail,
				inviteNotes
			);
			setInviteOpen(false);
			setInviteName('');
			setInviteEmail('');
			setInviteNotes('');
			setMessage(
				result.emailDelivery === 'sent'
					? 'Invitation created and emailed.'
					: result.inviteUrl
						? `Invitation created. Registration link: ${result.inviteUrl}`
						: 'Invitation created.'
			);
			await load(true);
		} catch (inviteError: unknown) {
			setMessage(
				inviteError instanceof Error
					? inviteError.message
					: 'Invitation could not be created.'
			);
		} finally {
			setSaving(false);
		}
	};

	return (
		<AdminWorkspaceShell
			title="Tester Management"
			subtitle="Applications, invitations, cohorts, and registration access"
			loading={loading}
			refreshing={refreshing}
			error={error}
			onRefresh={() => void load(true)}
		>
			<View
				style={{
					padding: 15,
					borderRadius: 17,
					backgroundColor: colors.surface,
					borderWidth: 1,
					borderColor: colors.border,
				}}
			>
				<Text style={{ color: colors.text, fontWeight: '900' }}>
					Registration Mode
				</Text>
				<Text style={{ marginTop: 3, color: colors.mutedText, fontSize: 12 }}>
					Controls access to the public registration wizard.
				</Text>
				<View style={{ flexDirection: 'row', marginTop: 12 }}>
					{(['open', 'invite_only', 'closed'] as const).map((mode) => (
						<TouchableOpacity
							key={mode}
							onPress={() => void handleMode(mode)}
							style={{
								flex: 1,
								marginRight: mode === 'closed' ? 0 : 7,
								alignItems: 'center',
								borderRadius: 12,
								paddingVertical: 9,
								backgroundColor:
									overview.registrationMode === mode
										? colors.accent
										: colors.control,
							}}
						>
							<Text
								style={{
									color:
										overview.registrationMode === mode
											? colors.onAccent
											: colors.secondaryText,
									fontSize: 11,
									fontWeight: '800',
									textTransform: 'capitalize',
								}}
							>
								{mode.replace('_', ' ')}
							</Text>
						</TouchableOpacity>
					))}
				</View>
			</View>
			<View style={{ marginTop: 13, flexDirection: 'row' }}>
				<View
					style={{
						flex: 1,
						flexDirection: 'row',
						alignItems: 'center',
						borderRadius: 14,
						backgroundColor: colors.input,
						borderWidth: 1,
						borderColor: colors.border,
						paddingHorizontal: 12,
					}}
				>
					<Icon name="search" size={17} color={colors.mutedText} />
					<TextInput
						value={query}
						onChangeText={setQuery}
						placeholder="Search testers"
						placeholderTextColor={colors.mutedText}
						style={{ flex: 1, padding: 11, color: colors.text }}
					/>
				</View>
				<TouchableOpacity
					onPress={() => setInviteOpen(true)}
					style={{
						marginLeft: 8,
						borderRadius: 14,
						backgroundColor: colors.accent,
						padding: 13,
					}}
				>
					<Icon name="mail" size={19} color={colors.onAccent} />
				</TouchableOpacity>
			</View>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={{ marginVertical: 13 }}
			>
				{TABS.map((tabOption) => (
					<TouchableOpacity
						key={tabOption}
						onPress={() => setTab(tabOption)}
						style={{
							marginRight: 8,
							borderRadius: 999,
							paddingHorizontal: 12,
							paddingVertical: 8,
							backgroundColor:
								tab === tabOption ? colors.accent : colors.control,
						}}
					>
						<Text
							style={{
								color:
									tab === tabOption ? colors.onAccent : colors.secondaryText,
								textTransform: 'capitalize',
								fontSize: 12,
								fontWeight: '800',
							}}
						>
							{tabOption}
						</Text>
					</TouchableOpacity>
				))}
			</ScrollView>
			{visible.map((record) => (
				<TouchableOpacity
					key={`${record.kind}-${record.id}`}
					onPress={() => {
						setSelected(record);
						setNotes(record.notes);
					}}
					style={{
						marginBottom: 9,
						padding: 14,
						borderRadius: 16,
						backgroundColor: colors.surface,
						borderWidth: 1,
						borderColor: colors.border,
					}}
				>
					<View style={{ flexDirection: 'row' }}>
						<Text style={{ flex: 1, color: colors.text, fontWeight: '900' }}>
							{record.name}
						</Text>
						<Text
							style={{
								color: colors.successText,
								fontSize: 10,
								fontWeight: '900',
								textTransform: 'uppercase',
							}}
						>
							{record.status}
						</Text>
					</View>
					<Text style={{ marginTop: 3, color: colors.mutedText, fontSize: 12 }}>
						{record.email || 'No email'} · {record.kind}
					</Text>
					<Text
						style={{ marginTop: 5, color: colors.disabledText, fontSize: 11 }}
					>
						{record.source}
					</Text>
				</TouchableOpacity>
			))}
			{!visible.length ? (
				<View style={{ paddingVertical: 50, alignItems: 'center' }}>
					<Icon name="user-check" size={36} color={colors.mutedText} />
					<Text style={{ marginTop: 10, color: colors.mutedText }}>
						No records in this view.
					</Text>
				</View>
			) : null}
			<Modal
				visible={Boolean(selected)}
				transparent
				animationType="fade"
				onRequestClose={() => setSelected(null)}
			>
				<SafeAreaView
					edges={['top', 'left', 'right']}
					style={{
						flex: 1,
						justifyContent: 'center',
						padding: 20,
						backgroundColor: 'rgba(15,23,42,0.72)',
					}}
				>
					<View
						style={{
							borderRadius: 22,
							backgroundColor: colors.elevated,
							padding: 18,
						}}
					>
						<View style={{ flexDirection: 'row' }}>
							<Text
								style={{
									flex: 1,
									fontSize: 19,
									fontWeight: '900',
									color: colors.text,
								}}
							>
								{selected?.name}
							</Text>
							<TouchableOpacity onPress={() => setSelected(null)}>
								<Icon name="x" size={22} color={colors.icon} />
							</TouchableOpacity>
						</View>
						<Text style={{ marginTop: 5, color: colors.mutedText }}>
							{selected?.email}
						</Text>
						<Text
							style={{
								marginTop: 16,
								marginBottom: 6,
								color: colors.secondaryText,
								fontWeight: '800',
							}}
						>
							Internal admin notes
						</Text>
						<TextInput
							value={notes}
							onChangeText={setNotes}
							multiline
							style={{
								minHeight: 80,
								textAlignVertical: 'top',
								borderWidth: 1,
								borderColor: colors.border,
								backgroundColor: colors.input,
								color: colors.text,
								borderRadius: 13,
								padding: 11,
							}}
						/>
						{selected ? (
							<View style={{ marginTop: 14 }}>
								{(selected.kind === 'application'
									? ['approved', 'rejected', 'pending']
									: selected.kind === 'invitation'
										? ['invited', 'revoked', 'expired']
										: ['active', 'suspended', 'removed']
								).map((statusOption) => (
									<TouchableOpacity
										key={statusOption}
										disabled={saving}
										onPress={() => void handleStatus(statusOption)}
										style={{
											marginBottom: 7,
											alignItems: 'center',
											borderRadius: 13,
											padding: 11,
											backgroundColor:
												selected.status === statusOption
													? colors.successSurface
													: colors.control,
										}}
									>
										<Text
											style={{
												color:
													selected.status === statusOption
														? colors.successText
														: colors.secondaryText,
												textTransform: 'capitalize',
												fontWeight: '800',
											}}
										>
											{statusOption}
										</Text>
									</TouchableOpacity>
								))}
							</View>
						) : null}
					</View>
				</SafeAreaView>
			</Modal>
			<Modal
				visible={inviteOpen}
				transparent
				animationType="fade"
				onRequestClose={() => setInviteOpen(false)}
			>
				<SafeAreaView
					edges={['top', 'left', 'right']}
					style={{
						flex: 1,
						justifyContent: 'center',
						padding: 20,
						backgroundColor: 'rgba(15,23,42,0.72)',
					}}
				>
					<View
						style={{
							borderRadius: 22,
							backgroundColor: colors.elevated,
							padding: 18,
						}}
					>
						<View style={{ flexDirection: 'row' }}>
							<Text
								style={{
									flex: 1,
									fontSize: 19,
									fontWeight: '900',
									color: colors.text,
								}}
							>
								Invite Tester
							</Text>
							<TouchableOpacity onPress={() => setInviteOpen(false)}>
								<Icon name="x" size={22} color={colors.icon} />
							</TouchableOpacity>
						</View>
						{(
							[
								['Full name', inviteName, setInviteName, false],
								['Email address', inviteEmail, setInviteEmail, false],
								['Admin notes', inviteNotes, setInviteNotes, true],
							] as const
						).map(([label, value, setter, multiline]) => (
							<View key={label} style={{ marginTop: 12 }}>
								<Text
									style={{
										marginBottom: 5,
										color: colors.secondaryText,
										fontSize: 11,
										fontWeight: '800',
									}}
								>
									{label}
								</Text>
								<TextInput
									value={value}
									onChangeText={setter}
									multiline={multiline}
									placeholderTextColor={colors.mutedText}
									autoCapitalize={
										label === 'Email address' ? 'none' : 'sentences'
									}
									keyboardType={
										label === 'Email address' ? 'email-address' : 'default'
									}
									style={{
										minHeight: multiline ? 75 : undefined,
										textAlignVertical: multiline ? 'top' : 'center',
										borderRadius: 13,
										borderWidth: 1,
										borderColor: colors.border,
										backgroundColor: colors.input,
										color: colors.text,
										padding: 11,
									}}
								/>
							</View>
						))}
						<TouchableOpacity
							disabled={!inviteEmail.trim() || saving}
							onPress={() => void handleInvite()}
							style={{
								marginTop: 15,
								alignItems: 'center',
								borderRadius: 14,
								backgroundColor: colors.accent,
								padding: 13,
							}}
						>
							<Text style={{ color: colors.onAccent, fontWeight: '900' }}>
								{saving ? 'Creating…' : 'Create Invitation'}
							</Text>
						</TouchableOpacity>
					</View>
				</SafeAreaView>
			</Modal>
			<CustomModal
				visible={Boolean(message)}
				type="info"
				title="Tester Management"
				message={message ?? ''}
				onClose={() => setMessage(null)}
			/>
		</AdminWorkspaceShell>
	);
}
