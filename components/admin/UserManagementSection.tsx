import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Modal, RefreshControl, ScrollView, Share, Text, TextInput, View, type TextStyle } from 'react-native';
import AdminPressable from '@/components/admin/AdminPressable';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { toast } from 'sonner-native';
import AdminButton from '@/components/admin/AdminButton';
import AdminDialog from '@/components/admin/AdminDialog';
import AdminIconButton from '@/components/admin/AdminIconButton';
import AdminListRow from '@/components/admin/AdminListRow';
import AdminOverflowMenu from '@/components/admin/AdminOverflowMenu';
import AdminScreen, { type AdminScreenState } from '@/components/admin/AdminScreen';
import AdminSection from '@/components/admin/AdminSection';
import AdminState from '@/components/admin/AdminState';
import AdminStatusPill from '@/components/admin/AdminStatusPill';
import AdminToolbar from '@/components/admin/AdminToolbar';
import AdminUserContentWorkspace from '@/components/admin/AdminUserContentWorkspace';
import { readSingleFilter, type FilterGroup, type FilterValues } from '@/components/ui/FilterSheet';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import UserAvatar from '@/components/ui/UserAvatar';
import { ADMIN_MIN_TOUCH, getAdminTone, radius, space, type, type AdminIconName, type AdminToneName } from '@/lib/admin/adminTokens';
import type { AdminOverflowItem } from '@/lib/admin/adminTypes';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import {
	AdminUserService,
	type AdminAccountStatus,
	type AdminUserRecord,
	type AdminUserRole,
	type AuthenticationDocumentRecord,
	type UserLifecycleOperation,
} from '@/lib/services/AdminUserService';
import { conversationResourceService } from '@/lib/services/ConversationResourceService';
import { relationshipRequestResourceService } from '@/lib/services/RelationshipRequestResourceService';
import { relationshipResourceService } from '@/lib/services/RelationshipResourceService';

const adminUserService = AdminUserService.getInstance();
const ROLES: readonly AdminUserRole[] = ['user', 'premium', 'moderator', 'tester', 'admin', 'developer'];
const STATUSES = ['all', 'active', 'pending', 'suspended', 'banned', 'archived'] as const;
const ACCOUNT_STATUSES: readonly AdminAccountStatus[] = ['active', 'pending', 'suspended', 'banned'];
const PAGE_SIZE = 20;
type UserStatusFilter = (typeof STATUSES)[number];
type LifecycleAction = 'archive' | 'unarchive' | 'delete_permanently';
type Notice = { tone: 'positive' | 'danger'; message: string };

const ROLE_DESCRIPTIONS: { [role in AdminUserRole]: string } = {
	admin: 'Full administration access',
	moderator: 'Content reports and moderation',
	developer: 'Developer previews and tools',
	tester: 'Development previews without admin access',
	premium: 'Premium product capabilities',
	user: 'Standard member access',
};

const STATUS_DESCRIPTIONS: { [status in AdminAccountStatus]: string } = {
	active: 'Full access to the account',
	pending: 'Waiting for review before full access',
	suspended: 'Temporarily locked for the number of days below',
	banned: 'Permanently locked out of the account',
};

/** Document previews sit on a near-black stage in both themes, so their chrome does not follow the app theme. */
const MEDIA_OVERLAY = { scrim: 'rgba(0,0,0,0.96)', icon: 'white' } as const;

const capitalize = (value: string): string => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);
const getDisplayName = (user: AdminUserRecord): string => `${user.firstName} ${user.lastName}`.trim() || user.userName || user.email;
const getUserStatus = (user: AdminUserRecord): string => (user.archived ? 'archived' : user.accountStatus);

function getUserStatusTone(status: string): AdminToneName {
	if (status === 'active') return 'positive';
	if (status === 'banned') return 'danger';
	if (status === 'pending' || status === 'suspended') return 'pending';
	return 'neutral';
}

function formatDeliveryStatus(operation: UserLifecycleOperation): string {
	if (!operation.delivery) return 'The notification delivery is still being recorded.';
	if (operation.delivery.emailStatus === 'sent') return 'Email sent.';
	if (operation.delivery.emailStatus === 'queued') return 'Email queued for automatic retry.';
	return `Email delivery failed${operation.delivery.errorCode ? ` (${operation.delivery.errorCode})` : ''}.`;
}

const getInputStyle = (colors: AppThemeColors, multiline = false, invalid = false): TextStyle => ({
	...type.body,
	minHeight: multiline ? 88 : ADMIN_MIN_TOUCH,
	paddingHorizontal: space.md,
	paddingVertical: multiline ? space.md : 0,
	textAlignVertical: multiline ? 'top' : 'center',
	borderRadius: radius.md,
	borderWidth: 1,
	borderColor: invalid ? getAdminTone(colors, 'danger').border : colors.border,
	backgroundColor: colors.input,
	color: colors.text,
});

type ChoiceRowProps = {
	label: string;
	description?: string;
	selected: boolean;
	disabled?: boolean;
	onPress: () => void;
};

/** 44pt+ single-choice row with a radio mark (role and status lists). */
function ChoiceRow({ label, description, selected, disabled = false, onPress }: ChoiceRowProps) {
	const { colors } = useAppTheme();
	const positive = getAdminTone(colors, 'positive');
	return (
		<AdminPressable
			onPress={onPress}
			disabled={disabled}
			accessibilityRole="radio"
			accessibilityLabel={label}
			accessibilityHint={description}
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
				opacity: disabled && !selected ? 0.55 : pressed ? 0.7 : 1,
			})}
		>
			<Icon name={selected ? 'check-circle' : 'circle'} size={20} color={selected ? positive.text : colors.mutedText} />
			<View style={{ flex: 1 }}>
				<Text style={[type.bodyStrong, { color: colors.text }]}>{label}</Text>
				{description ? <Text style={[type.meta, { color: colors.mutedText }]}>{description}</Text> : null}
			</View>
		</AdminPressable>
	);
}

function NoticeBanner({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
	const { colors } = useAppTheme();
	const tone = getAdminTone(colors, notice.tone);
	const icon: AdminIconName = notice.tone === 'danger' ? 'alert-circle' : 'check-circle';
	return (
		<View
			accessibilityRole="alert"
			style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg, paddingRight: space.xs, paddingVertical: space.xs, borderRadius: radius.md, borderWidth: 1, borderColor: tone.border, backgroundColor: tone.soft }}
		>
			<Icon name={icon} size={18} color={tone.text} />
			<Text style={[type.body, { flex: 1, color: tone.text }]}>{notice.message}</Text>
			<AdminIconButton icon="x" label="Dismiss message" tone={notice.tone} onPress={onDismiss} />
		</View>
	);
}

type IdentityDocumentsProps = {
	userId: string;
	refreshSignal: number;
	onPreview: (url: string) => void;
};

/** Loads the identity documents when the Verification section opens (it mounts only while open). */
function IdentityDocuments({ userId, refreshSignal, onPreview }: IdentityDocumentsProps) {
	const { colors } = useAppTheme();
	const [documents, setDocuments] = useState<AuthenticationDocumentRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const loadDocuments = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			setDocuments(await adminUserService.getAuthenticationDocuments(userId));
		} catch (loadError: unknown) {
			console.error('[IdentityDocuments.loadDocuments] Error:', loadError);
			setError(loadError instanceof Error ? loadError.message : 'Unable to load identity documents.');
		} finally {
			setLoading(false);
		}
	}, [userId]);

	useEffect(() => {
		void loadDocuments();
	}, [loadDocuments, refreshSignal]);

	if (loading) return <ActivityIndicator color={colors.accent} style={{ marginVertical: space.lg }} />;
	if (error) return <AdminState kind="inlineError" message={error} onRetry={() => void loadDocuments()} />;
	return (
		<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
			{(['faceID', 'frontID', 'backID'] as const).map((documentType) => {
				const identityDocument = documents.find((document) => document.type === documentType);
				const label = documentType === 'faceID' ? 'Selfie' : documentType === 'frontID' ? 'Front ID' : 'Back ID';
				return (
					<View key={documentType} style={{ width: 176, gap: space.xs }}>
						<Text style={[type.label, { color: colors.mutedText }]}>{label}</Text>
						{identityDocument?.imageUrl ? (
							<AdminPressable
								onPress={() => onPreview(identityDocument.imageUrl)}
								accessibilityRole="imagebutton"
								accessibilityLabel={`Open ${label}`}
								style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
							>
								<Image source={{ uri: identityDocument.imageUrl }} resizeMode="contain" style={{ width: 176, height: 128, borderRadius: radius.md, backgroundColor: colors.input }} />
							</AdminPressable>
						) : (
							<View style={{ width: 176, height: 128, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input }}>
								<Text style={[type.meta, { color: colors.mutedText }]}>Not provided</Text>
							</View>
						)}
					</View>
				);
			})}
		</ScrollView>
	);
}

export default function UserManagementSection() {
	const { colors } = useAppTheme();
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [users, setUsers] = useState<AdminUserRecord[]>([]);
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');
	const [roleFilter, setRoleFilter] = useState<AdminUserRole | 'all'>('all');
	const [accountFilter, setAccountFilter] = useState<'all' | 'regular' | 'student'>('all');
	const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
	const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);
	const [draftRole, setDraftRole] = useState<AdminUserRole>('user');
	const [newStatus, setNewStatus] = useState<AdminAccountStatus>('active');
	const [statusReason, setStatusReason] = useState('');
	const [suspensionDays, setSuspensionDays] = useState('7');
	const [lifecycleReason, setLifecycleReason] = useState('');
	const [lifecycleDialog, setLifecycleDialog] = useState<LifecycleAction | null>(null);
	const [lifecycleError, setLifecycleError] = useState<string | null>(null);
	const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [hasMoreUsers, setHasMoreUsers] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [busy, setBusy] = useState(false);
	const [notice, setNotice] = useState<Notice | null>(null);
	const [lifecycleOperation, setLifecycleOperation] = useState<UserLifecycleOperation | null>(null);
	const [pendingRole, setPendingRole] = useState<AdminUserRole | null>(null);
	const [previewDocumentUrl, setPreviewDocumentUrl] = useState<string | null>(null);
	const [detailRefreshSignal, setDetailRefreshSignal] = useState(0);
	const busyRef = useRef(false);

	const currentAdminId = adminUserService.getCurrentUserId();
	const isSelf = Boolean(selectedUser && selectedUser.id === currentAdminId);

	const loadUsers = useCallback(async (isRefresh = false) => {
		if (isRefresh) setRefreshing(true);
		else setLoading(true);
		setLoadError(null);
		try {
			const firstPage = await adminUserService.fetchUsers();
			setUsers(firstPage.items);
			setNextCursor(firstPage.nextCursor);
			setHasMoreUsers(firstPage.hasMore && Boolean(firstPage.nextCursor));
			setVisibleCount(PAGE_SIZE);
		} catch (error: unknown) {
			console.error('[UserManagementSection.loadUsers] Error:', error);
			setLoadError(error instanceof Error ? error.message : 'Users could not be loaded');
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, []);
	useEffect(() => {
		void loadUsers();
	}, [loadUsers]);

	const filteredUsers = useMemo(() => {
		const normalizedQuery = search.trim().toLowerCase();
		return users.filter((user) => {
			const userStatus = getUserStatus(user);
			return (
				(!normalizedQuery || `${user.firstName} ${user.lastName} ${user.userName} ${user.email}`.toLowerCase().includes(normalizedQuery)) &&
				(statusFilter === 'all' || userStatus === statusFilter) &&
				(roleFilter === 'all' || user.role === roleFilter) &&
				(accountFilter === 'all' || user.accountType === accountFilter)
			);
		});
	}, [accountFilter, roleFilter, search, statusFilter, users]);
	const visibleUsers = filteredUsers.slice(0, visibleCount);

	useEffect(() => {
		setVisibleCount(PAGE_SIZE);
	}, [accountFilter, roleFilter, search, statusFilter]);

	// The service pages 50 users at a time; search and filters only cover loaded users, so "Load more" first
	// reveals more of the loaded matches, then fetches the next page (de-duplicated) instead of stopping at 50.
	const handleLoadMoreUsers = async () => {
		if (visibleCount < filteredUsers.length) {
			setVisibleCount((current) => current + PAGE_SIZE);
			return;
		}
		if (loadingMore || !hasMoreUsers || !nextCursor) return;
		setLoadingMore(true);
		try {
			const nextPage = await adminUserService.fetchUsers(nextCursor);
			setUsers((current) => {
				const knownIds = new Set(current.map((user) => user.id));
				return [...current, ...nextPage.items.filter((user) => !knownIds.has(user.id))];
			});
			setNextCursor(nextPage.nextCursor);
			setHasMoreUsers(nextPage.hasMore && Boolean(nextPage.nextCursor));
			setVisibleCount((current) => current + PAGE_SIZE);
		} catch (error: unknown) {
			console.error('[UserManagementSection.handleLoadMoreUsers] Error:', error);
			toast.error(error instanceof Error ? error.message : 'More users could not be loaded.');
		} finally {
			setLoadingMore(false);
		}
	};

	const patchSelected = (update: Partial<AdminUserRecord>) => {
		if (!selectedUser) return;
		setUsers((current) => current.map((user) => (user.id === selectedUser.id ? { ...user, ...update } : user)));
		setSelectedUser((current) => (current ? { ...current, ...update } : null));
	};

	/** Runs one admin write at a time; resolves true on success. Feedback shows inside the user modal (toasts sit behind it on iOS). */
	const runMutation = async (mutation: () => Promise<void>, successMessage: string | (() => string)): Promise<boolean> => {
		if (busyRef.current) return false;
		busyRef.current = true;
		setBusy(true);
		setNotice(null);
		try {
			await mutation();
			setNotice({ tone: 'positive', message: typeof successMessage === 'function' ? successMessage() : successMessage });
			return true;
		} catch (mutationError: unknown) {
			console.error('[UserManagementSection.runMutation] Error:', mutationError);
			setNotice({ tone: 'danger', message: mutationError instanceof Error ? mutationError.message : 'The admin action failed.' });
			return false;
		} finally {
			busyRef.current = false;
			setBusy(false);
		}
	};

	const handleOpenUser = (user: AdminUserRecord) => {
		setSelectedUser(user);
		setDraftRole(user.role);
		setNewStatus(ACCOUNT_STATUSES.find((status) => status === user.accountStatus) ?? 'active');
		setStatusReason(user.statusReason);
		setLifecycleReason('');
		setLifecycleError(null);
		setLifecycleOperation(null);
		setNotice(null);
	};

	const handleCloseUser = () => {
		if (busy) return;
		setSelectedUser(null);
	};

	const handleRole = async (role: AdminUserRole) => {
		if (!selectedUser || selectedUser.id === currentAdminId) return;
		await runMutation(async () => {
			await adminUserService.updateRole(selectedUser.id, role);
			patchSelected({ role, isAdmin: role === 'admin' });
		}, `@${selectedUser.userName || selectedUser.email}'s role is now ${role}.`);
	};

	const handleStatus = async () => {
		if (!selectedUser || selectedUser.id === currentAdminId) return;
		const duration = Number(suspensionDays);
		const suspendedUntil = newStatus === 'suspended' && Number.isFinite(duration) ? new Date(Date.now() + Math.max(1, duration) * 86_400_000) : null;
		let completionMessage = `Account status changed to ${newStatus}.`;
		await runMutation(async () => {
			const operation = await adminUserService.updateAccountStatus(selectedUser.id, newStatus, statusReason, suspendedUntil, setLifecycleOperation);
			completionMessage = `${completionMessage} ${formatDeliveryStatus(operation)}`;
			patchSelected({ accountStatus: newStatus, statusReason, banned: newStatus === 'banned', archived: false });
		}, () => completionMessage);
		setStatusConfirmOpen(false);
	};

	const handleRequestStatus = () => {
		// Locking an account out is confirmed first; restoring access applies straight away.
		if (newStatus === 'banned' || newStatus === 'suspended') {
			setStatusConfirmOpen(true);
			return;
		}
		void handleStatus();
	};

	const handleLifecycle = async (action: LifecycleAction) => {
		if (!selectedUser || selectedUser.id === currentAdminId) return;
		const normalizedReason = lifecycleReason.trim();
		if (!normalizedReason) {
			setLifecycleError('Enter a lifecycle reason before continuing.');
			return;
		}
		setLifecycleError(null);
		const targetUser = selectedUser;
		let completionMessage = action === 'archive' ? 'Account archived.' : action === 'unarchive' ? 'Account restored and activated.' : 'Account permanently deleted.';
		let failure: string | null = null;
		const succeeded = await runMutation(async () => {
			try {
				const operation = await adminUserService.updateLifecycle(targetUser.id, action, normalizedReason, setLifecycleOperation);
				completionMessage = `${completionMessage} ${formatDeliveryStatus(operation)}`;
			} catch (lifecycleFailure: unknown) {
				failure = lifecycleFailure instanceof Error ? lifecycleFailure.message : 'The admin action failed.';
				throw lifecycleFailure;
			}
			if (action === 'delete_permanently') {
				setUsers((current) => current.filter((user) => user.id !== targetUser.id));
				if (currentAdminId) {
					relationshipResourceService.removeUserFromCachedRelationships(currentAdminId, targetUser.id);
					relationshipRequestResourceService.removeUserFromCachedRequests(targetUser.id);
					void conversationResourceService.removeConversation(currentAdminId, targetUser.id);
				}
			} else patchSelected({ archived: action === 'archive' });
			setLifecycleReason('');
		}, () => completionMessage);
		if (!succeeded) {
			// Keep the dialog open with the reason so the admin can retry.
			setLifecycleError(failure ?? 'The admin action failed.');
			return;
		}
		setLifecycleDialog(null);
		if (action === 'delete_permanently') {
			setSelectedUser(null);
			toast.success(completionMessage);
		}
	};

	const handleLifecycleRetry = async () => {
		if (!selectedUser || !lifecycleOperation || lifecycleOperation.phase !== 'failed') return;
		await runMutation(async () => {
			const operation = await adminUserService.retryLifecycleOperation(selectedUser.id, lifecycleOperation.id);
			setLifecycleOperation(operation);
		}, 'Lifecycle job completed after retry.');
	};

	const handleDeliveryRetry = async () => {
		const eventId = lifecycleOperation?.delivery?.eventId;
		if (!eventId) return;
		await runMutation(async () => {
			const delivery = await adminUserService.retryModerationDelivery(eventId);
			setLifecycleOperation((current) => (current ? { ...current, delivery } : current));
		}, 'Email delivery retry completed.');
	};

	const handleEmailVerification = async () => {
		if (!selectedUser) return;
		// verifyEmail writes the user flag and the audit entry in one batch.
		await runMutation(async () => {
			await adminUserService.verifyEmail(selectedUser.id);
			patchSelected({ emailVerified: true });
		}, 'Email marked as verified.');
	};

	const handleIdentity = async (verificationStatus: 'verified' | 'rejected') => {
		if (!selectedUser) return;
		await runMutation(async () => {
			await adminUserService.updateIdentityVerification(selectedUser.id, verificationStatus, statusReason);
			patchSelected({ verificationStatus, isAuthenticated: verificationStatus === 'verified' });
		}, verificationStatus === 'verified' ? 'Identity approved.' : 'Identity verification rejected.');
	};

	const handleExport = async () => {
		try {
			await Share.share({ title: 'Ourlime user export', message: adminUserService.createCsv(filteredUsers) });
		} catch (error: unknown) {
			console.error('[UserManagementSection.handleExport] Error:', error);
			toast.error(error instanceof Error ? error.message : 'The export could not be shared.');
		}
	};

	const filterGroups: FilterGroup[] = [
		{ key: 'status', label: 'Status', options: STATUSES.map((status) => ({ value: status, label: status === 'all' ? 'Any status' : capitalize(status) })), value: statusFilter, defaultValue: 'all' },
		{ key: 'role', label: 'Role', options: [{ value: 'all', label: 'Any role' }, ...ROLES.map((role) => ({ value: role, label: capitalize(role) }))], value: roleFilter, defaultValue: 'all' },
		{ key: 'account', label: 'Account type', options: [{ value: 'all', label: 'Any account' }, { value: 'regular', label: 'Regular' }, { value: 'student', label: 'Student' }], value: accountFilter, defaultValue: 'all' },
	];
	const handleApplyFilters = (values: FilterValues): void => {
		const nextStatus = STATUSES.find((status) => status === readSingleFilter(values, 'status'));
		setStatusFilter(nextStatus ?? 'all');
		const nextRole = ROLES.find((role) => role === readSingleFilter(values, 'role'));
		setRoleFilter(nextRole ?? 'all');
		const nextAccount = readSingleFilter(values, 'account');
		setAccountFilter(nextAccount === 'regular' || nextAccount === 'student' ? nextAccount : 'all');
	};
	const handleClearFilters = () => {
		setStatusFilter('all');
		setRoleFilter('all');
		setAccountFilter('all');
		setSearch('');
	};

	const canLoadMore = visibleCount < filteredUsers.length || hasMoreUsers;
	const loadMoreAction = { key: 'load-more', label: 'Load more users', icon: 'chevron-down' as const, tone: 'neutral' as const, busy: loadingMore, onPress: () => void handleLoadMoreUsers() };

	const screenState: AdminScreenState = loading
		? { kind: 'loading', variant: 'list' }
		: loadError && users.length === 0
			? { kind: 'error', message: loadError, title: 'Users could not be loaded' }
			: users.length === 0
				? { kind: 'empty', title: 'No users found.', icon: 'users' }
				: filteredUsers.length === 0
					? hasMoreUsers
						? { kind: 'empty', title: 'No loaded users match', description: 'Load more users to keep searching.', icon: 'search', action: loadMoreAction }
						: { kind: 'empty', title: 'No users match these filters.', filtered: true, onClearFilters: handleClearFilters }
					: { kind: 'ready' };

	const userOverflowItems: AdminOverflowItem[] = selectedUser && !isSelf
		? [
				selectedUser.archived
					? { key: 'unarchive', label: 'Restore account', icon: 'rotate-ccw', description: 'Reactivates the archived account', onPress: () => { setLifecycleError(null); setLifecycleDialog('unarchive'); } }
					: { key: 'archive', label: 'Archive account', icon: 'archive', description: 'Reversible; hides the account', onPress: () => { setLifecycleError(null); setLifecycleDialog('archive'); } },
				{ key: 'delete', label: 'Delete permanently', icon: 'trash-2', tone: 'danger', description: 'Cannot be undone', onPress: () => { setLifecycleError(null); setLifecycleDialog('delete_permanently'); } },
			]
		: [];

	const selectedName = selectedUser ? getDisplayName(selectedUser) : '';
	const selectedHandle = selectedUser ? `@${selectedUser.userName || selectedUser.email || 'this user'}` : '';
	const lifecycleCopy: { [action in LifecycleAction]: { title: string; description: string; confirm: string; tone: 'pending' | 'positive' | 'danger'; icon: AdminIconName } } = {
		archive: { title: 'Archive this account?', description: `${selectedHandle} loses access until the account is restored. This is reversible.`, confirm: 'Archive account', tone: 'pending', icon: 'archive' },
		unarchive: { title: 'Restore this account?', description: `${selectedHandle} gets access again and the account is activated.`, confirm: 'Restore account', tone: 'positive', icon: 'rotate-ccw' },
		delete_permanently: { title: 'Delete this account permanently?', description: `${selectedHandle} is removed through the secure server lifecycle workflow. This cannot be undone.`, confirm: 'Delete permanently', tone: 'danger', icon: 'trash-2' },
	};
	const activeLifecycle = lifecycleDialog ? lifecycleCopy[lifecycleDialog] : null;

	const renderDetail = (user: AdminUserRecord) => {
		const userStatus = getUserStatus(user);
		const overviewRows: [string, string][] = [
			['Username', `@${user.userName || 'unknown'}`],
			['Email', user.email || 'None'],
			['Account', capitalize(user.accountType)],
			['Role', capitalize(user.role)],
			['Status', capitalize(userStatus)],
			['Email verified', user.emailVerified ? 'Yes' : 'No'],
			['Identity verified', user.isAuthenticated ? 'Yes' : capitalize(user.verificationStatus)],
			['Online status', capitalize(user.onlineStatus)],
		];
		return (
			<View style={{ gap: space.md }}>
				{notice ? <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} /> : null}
				{isSelf ? <AdminState kind="inlineError" message="This is your own account. Role, status and lifecycle changes are disabled." /> : null}

				<AdminSection title="Overview" collapsible={{ initiallyOpen: true }}>
					<View style={{ gap: space.sm }}>
						{overviewRows.map(([label, value]) => (
							<View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 32 }}>
								<Text style={[type.label, { width: 120, color: colors.mutedText }]}>{label}</Text>
								<Text selectable numberOfLines={2} style={[type.bodyStrong, { flex: 1, color: colors.text }]}>
									{value}
								</Text>
							</View>
						))}
					</View>
				</AdminSection>

				<AdminSection title="Content" description="Posts and Limes, with administrator removals" collapsible={{ initiallyOpen: false }}>
					<AdminUserContentWorkspace
						userId={user.id}
						userDisplayName={getDisplayName(user)}
						refreshSignal={detailRefreshSignal}
						onOpenContent={(content) => {
							setSelectedUser(null);
							if (content.contentType === 'lime') {
								router.push({ pathname: '/limes/viewer', params: { limeId: content.id, viewer: '1' } });
								return;
							}
							router.push({ pathname: '/post/[id]', params: { id: content.id } });
						}}
					/>
				</AdminSection>

				<AdminSection title="Role" description={`Current role: ${capitalize(user.role)}`} collapsible={{ initiallyOpen: false }}>
					<View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
						{ROLES.map((role) => (
							<ChoiceRow key={role} label={capitalize(role)} description={ROLE_DESCRIPTIONS[role]} selected={draftRole === role} disabled={busy || isSelf} onPress={() => setDraftRole(role)} />
						))}
					</View>
					<AdminButton
						label="Change role"
						icon="shield"
						tone={draftRole === 'admin' ? 'danger' : 'positive'}
						emphasis="primary"
						fullWidth
						disabled={busy || isSelf || draftRole === user.role}
						onPress={() => setPendingRole(draftRole)}
					/>
				</AdminSection>

				<AdminSection title="Account status" description={`Current status: ${capitalize(userStatus)}`} collapsible={{ initiallyOpen: false }}>
					<View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
						{ACCOUNT_STATUSES.map((status) => (
							<ChoiceRow key={status} label={capitalize(status)} description={STATUS_DESCRIPTIONS[status]} selected={newStatus === status} disabled={busy || isSelf} onPress={() => setNewStatus(status)} />
						))}
					</View>
					{newStatus === 'suspended' ? (
						<View style={{ gap: space.xs }}>
							<Text style={[type.label, { color: colors.mutedText }]}>Suspension days</Text>
							<TextInput
								value={suspensionDays}
								onChangeText={setSuspensionDays}
								keyboardType="number-pad"
								accessibilityLabel="Suspension days"
								placeholder="Suspension days"
								placeholderTextColor={colors.mutedText}
								style={getInputStyle(colors)}
							/>
						</View>
					) : null}
					<View style={{ gap: space.xs }}>
						<Text style={[type.label, { color: colors.mutedText }]}>Reason shown to the user</Text>
						<TextInput
							value={statusReason}
							onChangeText={setStatusReason}
							multiline
							accessibilityLabel="Administrative reason shown to the user"
							placeholder="Administrative reason shown to the user"
							placeholderTextColor={colors.mutedText}
							style={getInputStyle(colors, true)}
						/>
					</View>
					<AdminButton
						label="Apply status"
						icon="check"
						tone={newStatus === 'banned' ? 'danger' : newStatus === 'suspended' ? 'pending' : 'positive'}
						emphasis="primary"
						fullWidth
						busy={busy && !statusConfirmOpen}
						disabled={busy || isSelf}
						onPress={handleRequestStatus}
					/>
				</AdminSection>

				<AdminSection title="Verification" collapsible={{ initiallyOpen: false }}>
					<View style={{ gap: space.sm }}>
						<Text style={[type.bodyStrong, { color: colors.text }]}>Email verification</Text>
						<AdminStatusPill label={user.emailVerified ? 'Verified' : 'Not verified'} tone={user.emailVerified ? 'positive' : 'pending'} />
						{!user.emailVerified ? (
							<AdminButton label="Verify email manually" icon="mail" tone="positive" fullWidth disabled={busy} onPress={() => void handleEmailVerification()} />
						) : null}
					</View>
					<View style={{ height: 1, backgroundColor: colors.border }} />
					<View style={{ gap: space.sm }}>
						<Text style={[type.bodyStrong, { color: colors.text }]}>Identity authentication</Text>
						<AdminStatusPill
							label={user.verificationStatus}
							tone={user.verificationStatus === 'verified' ? 'positive' : user.verificationStatus === 'rejected' ? 'danger' : user.verificationStatus === 'pending' ? 'pending' : 'neutral'}
						/>
						<IdentityDocuments userId={user.id} refreshSignal={detailRefreshSignal} onPreview={setPreviewDocumentUrl} />
						<TextInput
							value={statusReason}
							onChangeText={setStatusReason}
							multiline
							accessibilityLabel="Review notes or rejection reason"
							placeholder="Review notes or rejection reason"
							placeholderTextColor={colors.mutedText}
							style={getInputStyle(colors, true)}
						/>
						<View style={{ flexDirection: 'row', gap: space.sm }}>
							<AdminButton label="Approve" icon="check" tone="positive" disabled={busy} onPress={() => void handleIdentity('verified')} style={{ flex: 1 }} />
							<AdminButton label="Reject" icon="x" tone="danger" disabled={busy} onPress={() => void handleIdentity('rejected')} style={{ flex: 1 }} />
						</View>
					</View>
				</AdminSection>

				<AdminSection
					title="Lifecycle"
					description="Archive is reversible. Permanent deletion removes the user through the secure server lifecycle workflow and cannot be undone. Both are in the ⋯ menu."
					collapsible={{ initiallyOpen: Boolean(lifecycleOperation) }}
				>
					{lifecycleOperation ? (
						<View style={{ gap: space.sm }}>
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
								<Text style={[type.bodyStrong, { color: colors.text }]}>Lifecycle job</Text>
								<AdminStatusPill
									label={lifecycleOperation.phase}
									tone={lifecycleOperation.phase === 'failed' ? 'danger' : lifecycleOperation.phase === 'completed' ? 'positive' : 'pending'}
								/>
							</View>
							<Text style={[type.meta, { color: colors.mutedText }]}>
								{lifecycleOperation.processedDocuments}/{lifecycleOperation.totalDocuments || '?'} records · Email {lifecycleOperation.delivery?.emailStatus ?? 'pending'}
							</Text>
							{lifecycleOperation.phase === 'failed' ? (
								<AdminButton label="Retry safely" icon="refresh-cw" tone="pending" disabled={busy} onPress={() => void handleLifecycleRetry()} style={{ alignSelf: 'flex-start' }} />
							) : null}
							{lifecycleOperation.delivery?.emailStatus === 'failed' ? (
								<AdminButton label="Retry email" icon="mail" tone="neutral" disabled={busy} onPress={() => void handleDeliveryRetry()} style={{ alignSelf: 'flex-start' }} />
							) : null}
						</View>
					) : (
						<Text style={[type.meta, { color: colors.mutedText }]}>No lifecycle job has run in this session.</Text>
					)}
				</AdminSection>
			</View>
		);
	};

	return (
		<>
			<AdminScreen
				title="Users"
				subtitle="Accounts, roles, status and verification"
				state={screenState}
				onRefresh={() => loadUsers(true)}
				refreshing={refreshing}
				overflowActions={[
					{ key: 'export', label: 'Export CSV', icon: 'download', description: `${filteredUsers.length} users in the current view`, onPress: () => void handleExport() },
					{
						key: 'import',
						label: 'Import CSV',
						icon: 'upload',
						description: 'Needs the secure provisioning endpoint',
						onPress: () => toast('CSV import requires the secure server user-provisioning endpoint so Firebase Auth and Firestore stay consistent.'),
					},
				]}
				toolbar={
					<AdminToolbar
						search={{ value: search, placeholder: 'Search name, username or email', onChange: setSearch }}
						filters={{ title: 'Filter users', groups: filterGroups, onApply: handleApplyFilters }}
						resultSummary={users.length ? `Showing ${visibleUsers.length} of ${filteredUsers.length} ${hasMoreUsers ? 'loaded ' : ''}users` : undefined}
					/>
				}
			>
				<View style={{ gap: space.sm }}>
					{loadError ? <AdminState kind="inlineError" message={loadError} onRetry={() => void loadUsers(true)} retrying={refreshing} /> : null}
					{visibleUsers.map((user) => {
						const userStatus = getUserStatus(user);
						return (
							<AdminListRow
								key={user.id}
								title={getDisplayName(user)}
								subtitle={`@${user.userName || 'unknown'} · ${user.role} · ${user.accountType}`}
								leading={{ kind: 'avatar', uri: user.profilePicture ?? undefined, name: user.firstName || user.userName || user.email, userId: user.id }}
								status={{ label: userStatus, tone: getUserStatusTone(userStatus) }}
								accessibilityHint="Opens user management"
								onPress={() => handleOpenUser(user)}
							/>
						);
					})}
					{canLoadMore ? (
						<AdminButton label="Load more users" icon="chevron-down" tone="neutral" fullWidth busy={loadingMore} onPress={() => void handleLoadMoreUsers()} style={{ marginTop: space.sm }} />
					) : null}
				</View>
			</AdminScreen>

			<Modal
				visible={Boolean(selectedUser)}
				transparent
				statusBarTranslucent
				navigationBarTranslucent
				animationType="none"
				presentationStyle="overFullScreen"
				onRequestClose={handleCloseUser}
			>
				<SwipeDismissSurface
					visible={Boolean(selectedUser)}
					onDismiss={handleCloseUser}
					handleColor={colors.border}
					disabled={busy}
					accessibilityLabel="Swipe down to close user management"
					style={{ flex: 1, backgroundColor: colors.canvas }}
				>
					<SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
						{selectedUser ? (
							<View
								style={{
									minHeight: 64,
									flexDirection: 'row',
									alignItems: 'center',
									gap: space.md,
									paddingLeft: space.lg,
									paddingRight: space.xs,
									paddingVertical: space.sm,
									borderBottomWidth: 1,
									borderBottomColor: colors.border,
									backgroundColor: colors.navigation,
								}}
							>
								<UserAvatar userId={selectedUser.id} profileImage={selectedUser.profilePicture} firstName={selectedUser.firstName || selectedUser.userName} size={40} />
								<View style={{ flex: 1, gap: space.xs }}>
									<Text numberOfLines={1} accessibilityRole="header" style={[type.section, { color: colors.text }]}>
										{selectedName}
									</Text>
									<AdminStatusPill label={getUserStatus(selectedUser)} tone={getUserStatusTone(getUserStatus(selectedUser))} />
								</View>
								{userOverflowItems.length ? <AdminOverflowMenu items={userOverflowItems} trigger="header" title={selectedName} triggerLabel="More account actions" disabled={busy} /> : null}
								<AdminIconButton icon="x" label="Close user management" iconSize={22} disabled={busy} onPress={handleCloseUser} />
							</View>
						) : null}
						{/* Full-screen Modal: Android doesn't resize for the keyboard, so shrink the form above it. */}
						<KeyboardSafeView style={{ flex: 1 }}>
							{selectedUser ? (
								<ScrollView
									keyboardShouldPersistTaps="handled"
									contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl + insets.bottom }}
									refreshControl={
										<RefreshControl refreshing={false} onRefresh={() => setDetailRefreshSignal((current) => current + 1)} tintColor={colors.accent} colors={[colors.accent]} />
									}
								>
									{renderDetail(selectedUser)}
								</ScrollView>
							) : null}
						</KeyboardSafeView>
					</SafeAreaView>
				</SwipeDismissSurface>

				{/* Dialogs render inside the user modal so they stack above it on iOS. */}
				<AdminDialog
					visible={pendingRole !== null}
					title={pendingRole === 'admin' ? 'Confirm administrator role' : 'Confirm role change'}
					description={
						pendingRole === 'tester'
							? `Give ${selectedHandle} access to coming-soon, maintenance, beta, developer-only, and disabled pages? Tester access does not include administration or moderation permissions.`
							: pendingRole === 'admin'
								? `Give ${selectedHandle} full administrator access? Only trusted users should receive this role.`
								: `Change ${selectedHandle} from ${selectedUser?.role || 'user'} to ${pendingRole || 'user'}? This removes the permissions of the current role.`
					}
					tone={pendingRole === 'admin' ? 'danger' : 'pending'}
					icon="shield"
					confirmLabel="Change role"
					busy={busy}
					onConfirm={() => {
						if (!pendingRole) return;
						void handleRole(pendingRole).then(() => setPendingRole(null));
					}}
					onClose={() => setPendingRole(null)}
				/>
				<AdminDialog
					visible={statusConfirmOpen}
					title={newStatus === 'banned' ? 'Ban this account?' : 'Suspend this account?'}
					description={
						newStatus === 'banned'
							? `${selectedHandle} is locked out of the account until an administrator changes the status again.`
							: `${selectedHandle} is locked out for ${Math.max(1, Number(suspensionDays) || 1)} day(s).`
					}
					tone={newStatus === 'banned' ? 'danger' : 'pending'}
					icon={newStatus === 'banned' ? 'slash' : 'pause-circle'}
					confirmLabel={newStatus === 'banned' ? 'Ban account' : 'Suspend account'}
					busy={busy}
					onConfirm={() => void handleStatus()}
					onClose={() => setStatusConfirmOpen(false)}
				/>
				<AdminDialog
					visible={Boolean(activeLifecycle)}
					title={activeLifecycle?.title ?? ''}
					description={activeLifecycle?.description}
					tone={activeLifecycle?.tone ?? 'pending'}
					icon={activeLifecycle?.icon}
					confirmLabel={activeLifecycle?.confirm}
					requireText={lifecycleDialog === 'delete_permanently' ? 'DELETE' : undefined}
					confirmDisabled={!lifecycleReason.trim()}
					busy={busy}
					onConfirm={() => {
						if (lifecycleDialog) void handleLifecycle(lifecycleDialog);
					}}
					onClose={() => setLifecycleDialog(null)}
				>
					<View style={{ gap: space.xs }}>
						<Text style={[type.label, { color: colors.mutedText }]}>Reason (required)</Text>
						<Text style={[type.meta, { color: colors.mutedText }]}>Recorded in the audit history and included in the email sent to the user.</Text>
						<TextInput
							value={lifecycleReason}
							onChangeText={setLifecycleReason}
							multiline
							maxLength={500}
							editable={!busy}
							accessibilityLabel="Lifecycle reason"
							placeholder={lifecycleDialog === 'unarchive' ? 'Explain why this account is being restored' : 'Explain why this account is being archived or deleted'}
							placeholderTextColor={colors.mutedText}
							style={getInputStyle(colors, true, !lifecycleReason.trim())}
						/>
						<Text style={[type.meta, { color: colors.mutedText, textAlign: 'right' }]}>{lifecycleReason.length}/500</Text>
						{lifecycleError ? <AdminState kind="inlineError" message={lifecycleError} /> : null}
					</View>
				</AdminDialog>
				<Modal visible={Boolean(previewDocumentUrl)} transparent animationType="fade" onRequestClose={() => setPreviewDocumentUrl(null)}>
					<SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: MEDIA_OVERLAY.scrim }}>
						<AdminIconButton
							icon="x"
							label="Close identity document preview"
							iconSize={24}
							iconColor={MEDIA_OVERLAY.icon}
							onPress={() => setPreviewDocumentUrl(null)}
							style={{ alignSelf: 'flex-end', margin: space.lg }}
						/>
						{previewDocumentUrl ? <Image source={{ uri: previewDocumentUrl }} resizeMode="contain" style={{ flex: 1, width: '100%' }} /> : null}
					</SafeAreaView>
				</Modal>
			</Modal>
		</>
	);
}
