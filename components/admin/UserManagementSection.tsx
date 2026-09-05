import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
	ActivityIndicator,
	Modal,
	ScrollView,
	Share,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import AdminUserContentWorkspace from '@/components/admin/AdminUserContentWorkspace';
import UserAvatar from '@/components/ui/UserAvatar';
import CustomModal from '@/components/ui/CustomModal';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import {
	AdminUserService,
	type AdminAccountStatus,
	type AdminUserRecord,
	type AdminUserRole,
	type UserLifecycleOperation,
} from '@/lib/services/AdminUserService';
import { relationshipResourceService } from '@/lib/services/RelationshipResourceService';
import { relationshipRequestResourceService } from '@/lib/services/RelationshipRequestResourceService';
import { conversationResourceService } from '@/lib/services/ConversationResourceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const adminUserService = AdminUserService.getInstance();
const ROLES: readonly AdminUserRole[] = [
	'user',
	'premium',
	'moderator',
	'tester',
	'admin',
	'developer',
];
const STATUSES = [
	'all',
	'active',
	'pending',
	'suspended',
	'banned',
	'archived',
] as const;
const PAGE_SIZE = 20;
type UserStatusFilter = (typeof STATUSES)[number];
type UserDetailTab =
	'overview' | 'content' | 'role' | 'status' | 'verification' | 'lifecycle';

function formatDeliveryStatus(operation: UserLifecycleOperation): string {
	if (!operation.delivery) return 'The notification delivery is still being recorded.';
	if (operation.delivery.emailStatus === 'sent') return 'Email sent.';
	if (operation.delivery.emailStatus === 'queued') return 'Email queued for automatic retry.';
	return `Email delivery failed${operation.delivery.errorCode ? ` (${operation.delivery.errorCode})` : ''}.`;
}

export default function UserManagementSection() {
	const { colors } = useAppTheme();
	const router = useRouter();
	const [users, setUsers] = useState<AdminUserRecord[]>([]);
	const [search, setSearch] = useState('');
	const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');
	const [roleFilter, setRoleFilter] = useState<AdminUserRole | 'all'>('all');
	const [accountFilter, setAccountFilter] = useState<
		'all' | 'regular' | 'student'
	>('all');
	const [page, setPage] = useState(1);
	const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(
		null
	);
	const [detailTab, setDetailTab] = useState<UserDetailTab>('overview');
	const [newStatus, setNewStatus] = useState<AdminAccountStatus>('active');
	const [statusReason, setStatusReason] = useState('');
	const [suspensionDays, setSuspensionDays] = useState('7');
	const [deleteConfirmation, setDeleteConfirmation] = useState('');
	const [lifecycleReason, setLifecycleReason] = useState('');
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [lifecycleOperation, setLifecycleOperation] = useState<UserLifecycleOperation | null>(null);
	const [pendingRole, setPendingRole] = useState<AdminUserRole | null>(null);

	const loadUsers = useCallback(async () => {
		setLoading(true);
		try {
			setUsers((await adminUserService.fetchUsers()).items);
		} catch (loadError: unknown) {
			setMessage(
				loadError instanceof Error
					? loadError.message
					: 'Users could not be loaded'
			);
		} finally {
			setLoading(false);
		}
	}, []);
	useEffect(() => {
		void loadUsers();
	}, [loadUsers]);

	const filteredUsers = useMemo(() => {
		const normalizedQuery = search.trim().toLowerCase();
		return users.filter((user) => {
			const userStatus = user.archived ? 'archived' : user.accountStatus;
			return (
				(!normalizedQuery ||
					`${user.firstName} ${user.lastName} ${user.userName} ${user.email}`
						.toLowerCase()
						.includes(normalizedQuery)) &&
				(statusFilter === 'all' || userStatus === statusFilter) &&
				(roleFilter === 'all' || user.role === roleFilter) &&
				(accountFilter === 'all' || user.accountType === accountFilter)
			);
		});
	}, [accountFilter, roleFilter, search, statusFilter, users]);
	const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
	const visibleUsers = filteredUsers.slice(
		(Math.min(page, pageCount) - 1) * PAGE_SIZE,
		Math.min(page, pageCount) * PAGE_SIZE
	);

	useEffect(() => {
		setPage(1);
	}, [accountFilter, roleFilter, search, statusFilter]);
	const patchSelected = (update: Partial<AdminUserRecord>) => {
		if (!selectedUser) return;
		setUsers((current) =>
			current.map((user) =>
				user.id === selectedUser.id ? { ...user, ...update } : user
			)
		);
		setSelectedUser((current) => (current ? { ...current, ...update } : null));
	};
	const runMutation = async (
		mutation: () => Promise<void>,
		successMessage: string | (() => string)
	) => {
		if (busy) return;
		setBusy(true);
		try {
			await mutation();
			setMessage(typeof successMessage === 'function' ? successMessage() : successMessage);
		} catch (mutationError: unknown) {
			setMessage(
				mutationError instanceof Error
					? mutationError.message
					: 'The admin action failed.'
			);
		} finally {
			setBusy(false);
		}
	};
	const handleRole = async (role: AdminUserRole) => {
		if (
			!selectedUser ||
			selectedUser.id === adminUserService.getCurrentUserId()
		)
			return;
		await runMutation(
			async () => {
				await adminUserService.updateRole(selectedUser.id, role);
				patchSelected({ role, isAdmin: role === 'admin' });
			},
			`@${selectedUser.userName || selectedUser.email}'s role is now ${role}.`
		);
	};
	const handleStatus = async () => {
		if (
			!selectedUser ||
			selectedUser.id === adminUserService.getCurrentUserId()
		)
			return;
		const duration = Number(suspensionDays);
		const suspendedUntil =
			newStatus === 'suspended' && Number.isFinite(duration)
				? new Date(Date.now() + Math.max(1, duration) * 86_400_000)
				: null;
		let completionMessage = `Account status changed to ${newStatus}.`;
		await runMutation(async () => {
			const operation = await adminUserService.updateAccountStatus(
				selectedUser.id,
				newStatus,
				statusReason,
				suspendedUntil,
				setLifecycleOperation,
			);
			completionMessage = `${completionMessage} ${formatDeliveryStatus(operation)}`;
			patchSelected({
				accountStatus: newStatus,
				statusReason,
				banned: newStatus === 'banned',
				archived: false,
			});
		}, () => completionMessage);
	};
	const handleLifecycle = async (
		action: 'archive' | 'unarchive' | 'delete_permanently'
	) => {
		if (
			!selectedUser ||
			selectedUser.id === adminUserService.getCurrentUserId()
		)
			return;
		if (action === 'delete_permanently' && deleteConfirmation !== 'DELETE') {
			setMessage('Type DELETE to confirm permanent account deletion.');
			return;
		}
		const normalizedReason = lifecycleReason.trim();
		if (!normalizedReason) {
			setMessage('Enter a lifecycle reason before continuing.');
			return;
		}
		let completionMessage = action === 'archive'
			? 'Account archived.'
			: action === 'unarchive'
				? 'Account restored and activated.'
				: 'Account permanently deleted.';
		await runMutation(
			async () => {
				const operation = await adminUserService.updateLifecycle(
					selectedUser.id,
					action,
					normalizedReason,
					setLifecycleOperation,
				);
				completionMessage = `${completionMessage} ${formatDeliveryStatus(operation)}`;
				if (action === 'delete_permanently') {
					setUsers((current) =>
						current.filter((user) => user.id !== selectedUser.id)
					);
					const currentAdminId = adminUserService.getCurrentUserId();
					if (currentAdminId) {
						relationshipResourceService.removeUserFromCachedRelationships(currentAdminId, selectedUser.id);
						relationshipRequestResourceService.removeUserFromCachedRequests(selectedUser.id);
						void conversationResourceService.removeConversation(currentAdminId, selectedUser.id);
					}
					setSelectedUser(null);
				} else patchSelected({ archived: action === 'archive' });
				setLifecycleReason('');
				setDeleteConfirmation('');
			},
			() => completionMessage,
		);
	};
	const handleLifecycleRetry = async () => {
		if (!selectedUser || !lifecycleOperation || lifecycleOperation.phase !== 'failed') return;
		await runMutation(async () => {
			const operation = await adminUserService.retryLifecycleOperation(selectedUser.id, lifecycleOperation.id);
			setLifecycleOperation(operation);
		}, 'Lifecycle job completed after retry.');
	};
	const handleDeliveryRetry = async () => {
		if (!lifecycleOperation?.delivery) return;
		await runMutation(async () => {
			const delivery = await adminUserService.retryModerationDelivery(lifecycleOperation.delivery!.eventId);
			setLifecycleOperation((current) => current ? { ...current, delivery } : current);
		}, 'Email delivery retry completed.');
	};
	const handleEmailVerification = async () => {
		if (!selectedUser) return;
		await runMutation(async () => {
			await adminUserService.verifyEmail(selectedUser.id);
			patchSelected({ emailVerified: true });
		}, 'Email marked as verified.');
	};
	const handleIdentity = async (
		verificationStatus: 'verified' | 'rejected'
	) => {
		if (!selectedUser) return;
		await runMutation(
			async () => {
				await adminUserService.updateIdentityVerification(
					selectedUser.id,
					verificationStatus,
					statusReason
				);
				patchSelected({
					verificationStatus,
					isAuthenticated: verificationStatus === 'verified',
				});
			},
			verificationStatus === 'verified'
				? 'Identity approved.'
				: 'Identity verification rejected.'
		);
	};
	const handleExport = async () => {
		await Share.share({
			title: 'Ourlime user export',
			message: adminUserService.createCsv(filteredUsers),
		});
	};

	if (loading)
		return (
			<View style={{ paddingVertical: 50, alignItems: 'center' }}>
				<ActivityIndicator color={colors.accent} />
				<Text style={{ marginTop: 8, color: colors.mutedText }}>
					Loading users...
				</Text>
			</View>
		);
	return (
		<>
			<View style={{ flexDirection: 'row', marginBottom: 10 }}>
				<View
					style={{
						flex: 1,
						flexDirection: 'row',
						alignItems: 'center',
						borderRadius: 14,
						backgroundColor: colors.control,
						borderWidth: 1,
						borderColor: colors.border,
						paddingHorizontal: 12,
					}}
				>
					<Icon name="search" size={18} color={colors.icon} />
					<TextInput
						value={search}
						onChangeText={setSearch}
						placeholder="Search name, username, or email"
						placeholderTextColor={colors.mutedText}
						style={{ flex: 1, padding: 11, color: colors.text }}
					/>
				</View>
				<TouchableOpacity
					onPress={() => void handleExport()}
					style={{
						marginLeft: 8,
						width: 45,
						alignItems: 'center',
						justifyContent: 'center',
						borderRadius: 14,
						backgroundColor: '#10b981',
					}}
				>
					<Icon name="download" size={19} color="#ffffff" />
				</TouchableOpacity>
				<TouchableOpacity
					onPress={() =>
						setMessage(
							'CSV import requires the secure server user-provisioning endpoint so Firebase Auth and Firestore stay consistent.'
						)
					}
					style={{
						marginLeft: 7,
						width: 45,
						alignItems: 'center',
						justifyContent: 'center',
						borderRadius: 14,
						backgroundColor: colors.control,
						borderWidth: 1,
						borderColor: colors.border,
					}}
				>
					<Icon name="upload" size={19} color={colors.icon} />
				</TouchableOpacity>
			</View>
			<Text
				style={{
					marginBottom: 5,
					color: colors.text,
					fontSize: 11,
					fontWeight: '900',
				}}
			>
				STATUS
			</Text>
			<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				{STATUSES.map((status) => (
					<TouchableOpacity
						key={status}
						onPress={() => setStatusFilter(status)}
						style={{
							marginRight: 7,
							borderRadius: 999,
							paddingHorizontal: 11,
							paddingVertical: 7,
							backgroundColor:
								statusFilter === status ? '#10b981' : colors.control,
							borderWidth: 1,
							borderColor: statusFilter === status ? '#10b981' : colors.border,
						}}
					>
						<Text
							style={{
								textTransform: 'capitalize',
								color: statusFilter === status ? '#ffffff' : colors.text,
								fontSize: 11,
								fontWeight: '800',
							}}
						>
							{status}
						</Text>
					</TouchableOpacity>
				))}
			</ScrollView>
			<Text
				style={{
					marginTop: 11,
					marginBottom: 5,
					color: colors.text,
					fontSize: 11,
					fontWeight: '900',
				}}
			>
				ROLE & ACCOUNT
			</Text>
			<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				{(['all', ...ROLES] as const).map((role) => (
					<TouchableOpacity
						key={role}
						onPress={() => setRoleFilter(role)}
						style={{
							marginRight: 7,
							borderRadius: 999,
							paddingHorizontal: 11,
							paddingVertical: 7,
							backgroundColor: roleFilter === role ? '#10b981' : colors.control,
							borderWidth: 1,
							borderColor: roleFilter === role ? '#10b981' : colors.border,
						}}
					>
						<Text
							style={{
								textTransform: 'capitalize',
								color: roleFilter === role ? '#ffffff' : colors.text,
								fontSize: 11,
								fontWeight: '800',
							}}
						>
							{role}
						</Text>
					</TouchableOpacity>
				))}
				{(['all', 'regular', 'student'] as const).map((accountType) => (
					<TouchableOpacity
						key={`account-${accountType}`}
						onPress={() => setAccountFilter(accountType)}
						style={{
							marginRight: 7,
							borderRadius: 999,
							paddingHorizontal: 11,
							paddingVertical: 7,
							backgroundColor:
								accountFilter === accountType ? '#2563eb' : colors.control,
							borderWidth: 1,
							borderColor:
								accountFilter === accountType ? '#2563eb' : colors.border,
						}}
					>
						<Text
							style={{
								textTransform: 'capitalize',
								color: accountFilter === accountType ? '#ffffff' : colors.text,
								fontSize: 11,
								fontWeight: '800',
							}}
						>
							{accountType}
						</Text>
					</TouchableOpacity>
				))}
			</ScrollView>
			<Text
				style={{ marginVertical: 10, color: colors.mutedText, fontSize: 12 }}
			>
				Showing {visibleUsers.length} of {filteredUsers.length} users
			</Text>
			{visibleUsers.map((user) => (
				<TouchableOpacity
					key={user.id}
					onPress={() => {
						setSelectedUser(user);
						setDetailTab('overview');
						setNewStatus(
							user.accountStatus === 'active' ||
								user.accountStatus === 'pending' ||
								user.accountStatus === 'suspended' ||
								user.accountStatus === 'banned'
								? user.accountStatus
								: 'active'
						);
						setStatusReason(user.statusReason);
						setDeleteConfirmation('');
						setLifecycleReason('');
					}}
					style={{
						flexDirection: 'row',
						alignItems: 'center',
						padding: 13,
						marginBottom: 9,
						borderRadius: 15,
						backgroundColor: colors.elevated,
						borderWidth: 1,
						borderColor: colors.border,
					}}
				>
					<UserAvatar
						profileImage={user.profilePicture}
						firstName={user.firstName || user.userName || user.email}
						size={44}
					/>
					<View style={{ flex: 1, marginLeft: 11 }}>
						<Text
							numberOfLines={1}
							style={{ fontWeight: '900', color: colors.text }}
						>
							{`${user.firstName} ${user.lastName}`.trim() ||
								user.userName ||
								user.email}
						</Text>
						<Text
							numberOfLines={1}
							style={{ marginTop: 2, color: colors.mutedText, fontSize: 12 }}
						>
							@{user.userName || 'unknown'} · {user.role} · {user.accountType}
						</Text>
						<Text
							style={{
								marginTop: 4,
								color:
									user.archived || user.banned
										? colors.destructiveText
										: colors.successText,
								fontSize: 10,
								fontWeight: '900',
								textTransform: 'uppercase',
							}}
						>
							{user.archived ? 'archived' : user.accountStatus}
						</Text>
					</View>
					<Icon name="chevron-right" size={18} color={colors.icon} />
				</TouchableOpacity>
			))}
			{pageCount > 1 ? (
				<View
					style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}
				>
					<TouchableOpacity
						disabled={page <= 1}
						onPress={() => setPage((current) => Math.max(1, current - 1))}
						style={{ padding: 10 }}
					>
						<Icon
							name="chevron-left"
							size={20}
							color={page <= 1 ? colors.disabledText : colors.accentText}
						/>
					</TouchableOpacity>
					<Text
						style={{ flex: 1, textAlign: 'center', color: colors.mutedText }}
					>
						Page {Math.min(page, pageCount)} of {pageCount}
					</Text>
					<TouchableOpacity
						disabled={page >= pageCount}
						onPress={() =>
							setPage((current) => Math.min(pageCount, current + 1))
						}
						style={{ padding: 10 }}
					>
						<Icon
							name="chevron-right"
							size={20}
							color={
								page >= pageCount ? colors.disabledText : colors.accentText
							}
						/>
					</TouchableOpacity>
				</View>
			) : null}
			<Modal
				visible={Boolean(selectedUser)}
				transparent
				statusBarTranslucent
				navigationBarTranslucent
				animationType="none"
				presentationStyle="overFullScreen"
				onRequestClose={() => setSelectedUser(null)}
			>
				<SwipeDismissSurface
					visible={Boolean(selectedUser)}
					onDismiss={() => setSelectedUser(null)}
					handleColor={colors.border}
					disabled={busy}
					accessibilityLabel="Swipe down to close user management"
					style={{ flex: 1, backgroundColor: colors.canvas }}
				>
					<SafeAreaView
						edges={['top', 'left', 'right']}
						style={{ flex: 1, backgroundColor: colors.canvas }}
					>
						<View
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								padding: 16,
								backgroundColor: colors.surface,
							}}
						>
							<Text
								style={{
									flex: 1,
									fontSize: 19,
									fontWeight: '900',
									color: colors.text,
								}}
							>
								Manage user
							</Text>
							<TouchableOpacity onPress={() => setSelectedUser(null)}>
								<Icon name="x" size={24} color={colors.icon} />
							</TouchableOpacity>
						</View>
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							style={{
								flexGrow: 0,
								backgroundColor: colors.surface,
								paddingHorizontal: 12,
							}}
						>
							{(
								[
									'overview',
									'content',
									'role',
									'status',
									'verification',
									'lifecycle',
								] as const
							).map((tab) => (
								<TouchableOpacity
									key={tab}
									onPress={() => setDetailTab(tab)}
									style={{
										marginRight: 7,
										marginBottom: 10,
										borderRadius: 999,
										paddingHorizontal: 12,
										paddingVertical: 8,
										backgroundColor:
											detailTab === tab
												? colors.selectedControl
												: colors.control,
									}}
								>
									<Text
										style={{
											textTransform: 'capitalize',
											color:
												detailTab === tab
													? colors.selectedText
													: colors.secondaryText,
											fontSize: 12,
											fontWeight: '800',
										}}
									>
										{tab}
									</Text>
								</TouchableOpacity>
							))}
						</ScrollView>
						{selectedUser ? (
							<ScrollView
								contentContainerStyle={{ padding: 18, paddingBottom: 55 }}
							>
								{detailTab === 'overview' ? (
									<>
										<View style={{ alignItems: 'center' }}>
											<UserAvatar
												profileImage={selectedUser.profilePicture}
												firstName={
													selectedUser.firstName || selectedUser.userName
												}
												size={72}
											/>
											<Text
												style={{
													marginTop: 10,
													fontSize: 20,
													fontWeight: '900',
													color: colors.text,
												}}
											>
												{`${selectedUser.firstName} ${selectedUser.lastName}`.trim()}
											</Text>
											<Text style={{ color: colors.mutedText }}>
												{selectedUser.email}
											</Text>
										</View>
										{[
											['Username', `@${selectedUser.userName || 'unknown'}`],
											['Account', selectedUser.accountType],
											['Role', selectedUser.role],
											[
												'Status',
												selectedUser.archived
													? 'archived'
													: selectedUser.accountStatus,
											],
											[
												'Email verified',
												selectedUser.emailVerified ? 'Yes' : 'No',
											],
											[
												'Identity verified',
												selectedUser.isAuthenticated
													? 'Yes'
													: selectedUser.verificationStatus,
											],
											['Online status', selectedUser.onlineStatus],
										].map(([label, value]) => (
											<View
												key={label}
												style={{
													marginTop: 11,
													padding: 13,
													borderRadius: 13,
													backgroundColor: colors.elevated,
													borderWidth: 1,
													borderColor: colors.border,
												}}
											>
												<Text
													style={{
														color: colors.mutedText,
														fontSize: 11,
														fontWeight: '800',
													}}
												>
													{label}
												</Text>
												<Text
													style={{
														marginTop: 3,
														color: colors.text,
														fontWeight: '800',
														textTransform: 'capitalize',
													}}
												>
													{value}
												</Text>
											</View>
										))}
									</>
								) : null}
								{detailTab === 'content' ? (
									<AdminUserContentWorkspace
										userId={selectedUser.id}
										userDisplayName={
											`${selectedUser.firstName} ${selectedUser.lastName}`.trim()
											|| selectedUser.userName
											|| selectedUser.email
										}
										onOpenContent={(content) => {
											setSelectedUser(null);
											if (content.contentType === 'lime') {
												router.push({
													pathname: '/limes/viewer',
													params: { limeId: content.id, viewer: '1' },
												});
												return;
											}
											router.push({
												pathname: '/post/[id]',
												params: { id: content.id },
											});
										}}
									/>
								) : null}
								{detailTab === 'role' ? (
									<>
										<Text
											style={{
												marginBottom: 10,
												color: colors.text,
												fontWeight: '900',
											}}
										>
											Platform role
										</Text>
										{ROLES.map((role) => (
											<TouchableOpacity
												key={role}
												disabled={
													busy ||
													selectedUser.role === role ||
													selectedUser.id ===
														adminUserService.getCurrentUserId()
												}
												onPress={() => setPendingRole(role)}
												style={{
													flexDirection: 'row',
													alignItems: 'center',
													padding: 14,
													marginBottom: 7,
													borderRadius: 13,
													backgroundColor:
														selectedUser.role === role
															? colors.successSurface
															: colors.elevated,
												}}
											>
												<View style={{ flex: 1 }}>
													<Text
														style={{
															textTransform: 'capitalize',
															color:
																selectedUser.role === role
																	? colors.successText
																	: colors.secondaryText,
															fontWeight: '900',
														}}
													>
														{role}
													</Text>
													<Text
														style={{
															marginTop: 2,
															color: colors.mutedText,
															fontSize: 11,
														}}
													>
														{role === 'admin'
															? 'Full administration access'
															: role === 'moderator'
																? 'Content reports and moderation'
																: role === 'developer'
																	? 'Developer previews and tools'
																	: role === 'tester'
																		? 'Development previews without admin access'
																		: role === 'premium'
																			? 'Premium product capabilities'
																			: 'Standard member access'}
													</Text>
												</View>
												{selectedUser.role === role ? (
													<Icon
														name="check"
														size={18}
														color={colors.successText}
													/>
												) : null}
											</TouchableOpacity>
										))}
									</>
								) : null}
								{detailTab === 'status' ? (
									<>
										<Text
											style={{
												marginBottom: 10,
												color: colors.text,
												fontWeight: '900',
											}}
										>
											Account access status
										</Text>
										{(
											['active', 'pending', 'suspended', 'banned'] as const
										).map((status) => (
											<TouchableOpacity
												key={status}
												onPress={() => setNewStatus(status)}
												style={{
													marginBottom: 7,
													padding: 13,
													borderRadius: 13,
													backgroundColor:
														newStatus === status
															? colors.successSurface
															: colors.elevated,
												}}
											>
												<Text
													style={{
														color:
															newStatus === status
																? colors.successText
																: colors.secondaryText,
														textTransform: 'capitalize',
														fontWeight: '900',
													}}
												>
													{status}
												</Text>
											</TouchableOpacity>
										))}
										{newStatus === 'suspended' ? (
											<TextInput
												value={suspensionDays}
												onChangeText={setSuspensionDays}
												keyboardType="number-pad"
												placeholder="Suspension days"
												placeholderTextColor={colors.mutedText}
												style={{
													marginTop: 7,
													borderRadius: 13,
													borderWidth: 1,
													borderColor: colors.border,
													padding: 12,
													backgroundColor: colors.input,
													color: colors.text,
												}}
											/>
										) : null}
										<TextInput
											value={statusReason}
											onChangeText={setStatusReason}
											multiline
											placeholder="Administrative reason shown to the user"
											placeholderTextColor={colors.mutedText}
											style={{
												minHeight: 86,
												marginTop: 9,
												textAlignVertical: 'top',
												borderRadius: 13,
												borderWidth: 1,
												borderColor: colors.border,
												padding: 12,
												backgroundColor: colors.input,
												color: colors.text,
											}}
										/>
										<TouchableOpacity
											disabled={
												busy ||
												selectedUser.id === adminUserService.getCurrentUserId()
											}
											onPress={() => void handleStatus()}
											style={{
												marginTop: 12,
												alignItems: 'center',
												borderRadius: 14,
												backgroundColor:
													newStatus === 'banned'
														? colors.destructive
														: colors.accent,
												padding: 13,
											}}
										>
											<Text
												style={{ color: colors.onAccent, fontWeight: '900' }}
											>
												Apply status
											</Text>
										</TouchableOpacity>
									</>
								) : null}
								{detailTab === 'verification' ? (
									<>
										<View
											style={{
												padding: 14,
												borderRadius: 14,
												backgroundColor: colors.surface,
											}}
										>
											<Text style={{ color: colors.text, fontWeight: '900' }}>
												Email verification
											</Text>
											<Text style={{ marginTop: 4, color: colors.mutedText }}>
												{selectedUser.emailVerified
													? 'Verified'
													: 'Not verified'}
											</Text>
											{!selectedUser.emailVerified ? (
												<TouchableOpacity
													disabled={busy}
													onPress={() => void handleEmailVerification()}
													style={{
														marginTop: 11,
														alignItems: 'center',
														borderRadius: 13,
														backgroundColor: '#10b981',
														padding: 11,
													}}
												>
													<Text style={{ color: '#fff', fontWeight: '900' }}>
														Verify email manually
													</Text>
												</TouchableOpacity>
											) : null}
										</View>
										<View
											style={{
												marginTop: 11,
												padding: 14,
												borderRadius: 14,
												backgroundColor: colors.surface,
											}}
										>
											<Text style={{ color: colors.text, fontWeight: '900' }}>
												Identity authentication
											</Text>
											<Text
												style={{
													marginTop: 4,
													color: colors.mutedText,
													textTransform: 'capitalize',
												}}
											>
												{selectedUser.verificationStatus}
											</Text>
											<TextInput
												value={statusReason}
												onChangeText={setStatusReason}
												multiline
												placeholder="Review notes or rejection reason"
												placeholderTextColor={colors.mutedText}
												style={{
													minHeight: 75,
													marginTop: 10,
													textAlignVertical: 'top',
													borderRadius: 12,
													borderWidth: 1,
													borderColor: colors.border,
													backgroundColor: colors.input,
													color: colors.text,
													padding: 10,
												}}
											/>
											<View style={{ flexDirection: 'row', marginTop: 10 }}>
												<TouchableOpacity
													disabled={busy}
													onPress={() => void handleIdentity('verified')}
													style={{
														flex: 1,
														alignItems: 'center',
														borderRadius: 12,
														backgroundColor: '#10b981',
														padding: 11,
													}}
												>
													<Text style={{ color: '#fff', fontWeight: '900' }}>
														Approve
													</Text>
												</TouchableOpacity>
												<TouchableOpacity
													disabled={busy}
													onPress={() => void handleIdentity('rejected')}
													style={{
														flex: 1,
														marginLeft: 8,
														alignItems: 'center',
														borderRadius: 12,
														backgroundColor: colors.destructiveSurface,
														padding: 11,
													}}
												>
													<Text
														style={{
															color: colors.destructiveText,
															fontWeight: '900',
														}}
													>
														Reject
													</Text>
												</TouchableOpacity>
											</View>
										</View>
									</>
								) : null}
								{detailTab === 'lifecycle' ? (
									<>
										<Text style={{ color: colors.text, fontWeight: '900' }}>
											Account lifecycle
										</Text>
										<Text
											style={{
												marginTop: 5,
												color: colors.mutedText,
												lineHeight: 19,
											}}
						>
							Archive is reversible. Permanent deletion removes the user
							through the secure server lifecycle workflow and cannot be
							undone.
										</Text>
										{lifecycleOperation ? (
											<View style={{ marginTop: 12, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 12 }}>
												<Text style={{ color: colors.text, fontWeight: '800' }}>
													Lifecycle job: {lifecycleOperation.phase}
												</Text>
												<Text style={{ marginTop: 4, color: colors.mutedText }}>
													{lifecycleOperation.processedDocuments}/{lifecycleOperation.totalDocuments || '?'} records · Email {lifecycleOperation.delivery?.emailStatus ?? 'pending'}
												</Text>
												{lifecycleOperation.phase === 'failed' ? (
													<TouchableOpacity onPress={() => void handleLifecycleRetry()} style={{ marginTop: 10, alignSelf: 'flex-start', borderRadius: 10, backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 9 }}>
														<Text style={{ color: '#fff', fontWeight: '800' }}>Retry safely</Text>
													</TouchableOpacity>
												) : null}
												{lifecycleOperation.delivery?.emailStatus === 'failed' ? (
													<TouchableOpacity onPress={() => void handleDeliveryRetry()} style={{ marginTop: 10, alignSelf: 'flex-start', borderRadius: 10, backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 9 }}>
														<Text style={{ color: '#fff', fontWeight: '800' }}>Retry email</Text>
													</TouchableOpacity>
												) : null}
											</View>
										) : null}
						<Text style={{ marginTop: 16, color: colors.text, fontWeight: '900' }}>
							Reason <Text style={{ color: colors.destructiveText }}>*</Text>
						</Text>
						<Text style={{ marginTop: 4, color: colors.mutedText, fontSize: 12, lineHeight: 17 }}>
							This reason is recorded in the audit history and included in the email sent to the user.
						</Text>
						<TextInput
							value={lifecycleReason}
							onChangeText={setLifecycleReason}
							multiline
							maxLength={500}
							textAlignVertical="top"
							placeholder={selectedUser.archived
								? 'Explain why this account is being restored'
								: 'Explain why this account is being archived or deleted'}
							placeholderTextColor={colors.mutedText}
							style={{
								marginTop: 9,
								minHeight: 96,
								borderRadius: 13,
								borderWidth: 1,
								borderColor: lifecycleReason.trim()
									? colors.border
									: colors.destructiveText,
								padding: 12,
								backgroundColor: colors.input,
								color: colors.text,
							}}
						/>
						<Text style={{ marginTop: 4, color: colors.mutedText, fontSize: 10, textAlign: 'right' }}>
							{lifecycleReason.length}/500
						</Text>
						<TouchableOpacity
							disabled={
								busy ||
								!lifecycleReason.trim() ||
								selectedUser.id === adminUserService.getCurrentUserId()
							}
											onPress={() =>
												void handleLifecycle(
													selectedUser.archived ? 'unarchive' : 'archive'
												)
											}
											style={{
												marginTop: 16,
												alignItems: 'center',
												borderRadius: 14,
								backgroundColor: selectedUser.archived
									? '#10b981'
									: '#f59e0b',
								opacity: lifecycleReason.trim() ? 1 : 0.55,
												padding: 13,
											}}
										>
											<Text style={{ color: '#fff', fontWeight: '900' }}>
												{selectedUser.archived
													? 'Restore account'
													: 'Archive account'}
											</Text>
										</TouchableOpacity>
										<TextInput
											value={deleteConfirmation}
											onChangeText={setDeleteConfirmation}
											autoCapitalize="characters"
											placeholder="Type DELETE"
											placeholderTextColor={colors.mutedText}
											style={{
												marginTop: 20,
												borderRadius: 13,
												borderWidth: 1,
												borderColor: '#fecaca',
												padding: 12,
												backgroundColor: colors.input,
												color: colors.text,
											}}
										/>
										<TouchableOpacity
											disabled={
								busy ||
								!lifecycleReason.trim() ||
								deleteConfirmation !== 'DELETE' ||
												selectedUser.id === adminUserService.getCurrentUserId()
											}
											onPress={() => void handleLifecycle('delete_permanently')}
											style={{
												marginTop: 9,
												alignItems: 'center',
												borderRadius: 14,
												backgroundColor:
								deleteConfirmation === 'DELETE' && lifecycleReason.trim()
														? colors.destructive
														: colors.disabled,
												padding: 13,
											}}
										>
											<Text style={{ color: '#fff', fontWeight: '900' }}>
												Delete permanently
											</Text>
										</TouchableOpacity>
									</>
								) : null}
							</ScrollView>
						) : null}
					</SafeAreaView>
				</SwipeDismissSurface>
			</Modal>
			<CustomModal
				visible={pendingRole !== null}
				title={pendingRole === 'admin' ? 'Confirm administrator role' : 'Confirm role change'}
				message={
					pendingRole === 'tester'
						? `Give @${selectedUser?.userName || selectedUser?.email || 'this user'} access to coming-soon, maintenance, beta, developer-only, and disabled pages? Tester access does not include administration or moderation permissions.`
						: pendingRole === 'admin'
							? `Give @${selectedUser?.userName || selectedUser?.email || 'this user'} full administrator access? Only trusted users should receive this role.`
							: `Change @${selectedUser?.userName || selectedUser?.email || 'this user'} from ${selectedUser?.role || 'user'} to ${pendingRole || 'user'}? This removes the permissions of the current role.`
				}
				type={pendingRole === 'admin' ? 'danger' : 'warning'}
				confirmText="Change role"
				cancelText="Cancel"
				isLoading={busy}
				onConfirm={() => {
					if (!pendingRole) return;
					void handleRole(pendingRole).then(() => setPendingRole(null));
				}}
				onCancel={() => setPendingRole(null)}
				onClose={() => setPendingRole(null)}
			/>
			<CustomModal
				visible={Boolean(message)}
				title="User management"
				message={message ?? ''}
				type="info"
				onClose={() => setMessage(null)}
			/>
		</>
	);
}
