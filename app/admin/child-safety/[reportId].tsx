import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { toast } from 'sonner-native';
import AdminButton from '@/components/admin/AdminButton';
import AdminDialog from '@/components/admin/AdminDialog';
import AdminListRow from '@/components/admin/AdminListRow';
import AdminOverflowMenu from '@/components/admin/AdminOverflowMenu';
import { AdminChoiceList, AdminReasonField } from '@/components/admin/AdminReviewCard';
import AdminScreen, { type AdminScreenState } from '@/components/admin/AdminScreen';
import AdminSection from '@/components/admin/AdminSection';
import AdminStatusPill from '@/components/admin/AdminStatusPill';
import { ADMIN_MIN_TOUCH, radius, space, type, type AdminIconName, type AdminToneName } from '@/lib/admin/adminTokens';
import type { AdminOverflowItem } from '@/lib/admin/adminTypes';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { childSafetyReportService } from '@/lib/services/ChildSafetyReportService';
import {
	CHILD_SAFETY_CATEGORY_LABELS,
	type ChildSafetyAction,
	type ChildSafetyCaseActionInput,
	type ChildSafetyPriority,
	type ChildSafetyReportRecord,
	type ChildSafetyStatus,
} from '@/lib/types/childSafety';

type ChildSafetyCaseDetailScreenProps = { queueRoute?: Href };

/** One reviewer action waiting for its note (and, for status/priority, its new value) in the action dialog. */
type PendingCaseAction =
	| { kind: 'simple'; action: Exclude<ChildSafetyAction, 'set_status' | 'set_priority' | 'authority_referral'>; title: string; description: string; confirmLabel: string; tone: 'positive' | 'pending' | 'danger'; icon: AdminIconName }
	| { kind: 'status' }
	| { kind: 'priority' }
	| { kind: 'referral' };

const STATUS_OPTIONS: readonly ChildSafetyStatus[] = ['submitted', 'under_review', 'escalated', 'action_required', 'resolved', 'reported_to_authority', 'closed'];
const PRIORITY_OPTIONS: readonly ChildSafetyPriority[] = ['critical', 'high', 'medium', 'standard'];
const PURGE_CONFIRM_TEXT = 'PURGE';
const NOTE_REQUIRED_MESSAGE = 'Enter the reason for this action first (at least 3 characters).';

const toLabel = (value: string): string => {
	const words = value.replaceAll('_', ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
};
const priorityTone = (priority: ChildSafetyPriority): AdminToneName => (priority === 'critical' ? 'danger' : priority === 'high' ? 'pending' : 'neutral');
const statusTone = (status: ChildSafetyStatus): AdminToneName => {
	if (status === 'resolved' || status === 'closed' || status === 'reported_to_authority') return 'positive';
	if (status === 'escalated' || status === 'action_required') return 'danger';
	return 'pending';
};

export default function ChildSafetyCaseDetailScreen({
	queueRoute = '/admin/child-safety' as Href,
}: ChildSafetyCaseDetailScreenProps) {
	const { reportId } = useLocalSearchParams<{ reportId: string }>();
	const router = useRouter();
	const { colors } = useAppTheme();
	const isAdminRoute = String(queueRoute).startsWith('/admin');
	const [report, setReport] = useState<ChildSafetyReportRecord | null>(null);
	const [note, setNote] = useState('');
	const [busy, setBusy] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [authorityName, setAuthorityName] = useState('');
	const [authorityReference, setAuthorityReference] = useState('');
	const [loadError, setLoadError] = useState<string | null>(null);
	const [noteError, setNoteError] = useState<string | null>(null);
	const [pending, setPending] = useState<PendingCaseAction | null>(null);
	const [confirmPurge, setConfirmPurge] = useState(false);
	const [nextStatus, setNextStatus] = useState<ChildSafetyStatus | null>(null);
	const [nextPriority, setNextPriority] = useState<ChildSafetyPriority | null>(null);
	// Synchronous guard against a second tap before `busy` re-renders the buttons as disabled.
	const busyRef = useRef(false);

	const loadCase = useCallback(async () => {
		setLoadError(null);
		try {
			setReport(await childSafetyReportService.getCase(reportId));
		} catch (error: unknown) {
			console.error(
				'[ChildSafetyCaseDetailScreen.loadCase] Error:',
				error instanceof Error ? error.message : error
			);
			setLoadError(
				error instanceof Error && error.message
					? error.message
					: 'This case could not be loaded. Please try again.'
			);
		}
	}, [reportId]);
	useEffect(() => {
		void loadCase();
	}, [loadCase]);

	// Pull-to-refresh / Retry. A failed refresh of a case that is already shown keeps it and says so.
	const handleRefresh = async () => {
		if (!report) {
			await loadCase();
			return;
		}
		setRefreshing(true);
		try {
			setReport(await childSafetyReportService.getCase(reportId));
		} catch (error: unknown) {
			console.error('[ChildSafetyCaseDetailScreen.handleRefresh] Error:', error instanceof Error ? error.message : error);
			toast.error(`Case not refreshed: ${error instanceof Error && error.message ? error.message : 'Please try again.'}`);
		} finally {
			setRefreshing(false);
		}
	};

	const handleAction = async (
		action: ChildSafetyAction,
		extra: Partial<ChildSafetyCaseActionInput> = {}
	) => {
		if (busyRef.current) return;
		if (note.trim().length < 3) {
			setNoteError(NOTE_REQUIRED_MESSAGE);
			return;
		}
		setNoteError(null);
		busyRef.current = true;
		setBusy(true);
		try {
			const updated = await childSafetyReportService.applyAction(reportId, {
				action,
				note,
				...extra,
			});
			setPending(null);
			setConfirmPurge(false);
			if (!updated) {
				toast.success('Case purged.');
				// Go back to the existing queue (it reloads on focus) instead of stacking a second copy on top of it.
				if (router.canGoBack()) router.back();
				else router.replace(queueRoute);
				return;
			}
			setReport(updated);
			setNote('');
			toast.success('Case updated.');
		} catch (error: unknown) {
			console.error(
				'[ChildSafetyCaseDetailScreen.handleAction] Error:',
				error instanceof Error ? error.message : error
			);
			toast.error(
				`Action not saved: ${error instanceof Error && error.message ? error.message : 'Please try again.'}`
			);
		} finally {
			busyRef.current = false;
			setBusy(false);
		}
	};

	const openAction = (next: PendingCaseAction) => {
		setNoteError(null);
		if (next.kind === 'status') setNextStatus(report?.status ?? null);
		if (next.kind === 'priority') setNextPriority(report?.priority ?? null);
		setPending(next);
	};

	const closeAction = () => {
		if (busy) return;
		setPending(null);
	};

	const handleConfirmPending = () => {
		if (!pending) return;
		if (pending.kind === 'status') {
			if (nextStatus) void handleAction('set_status', { status: nextStatus });
			return;
		}
		if (pending.kind === 'priority') {
			if (nextPriority) void handleAction('set_priority', { priority: nextPriority });
			return;
		}
		if (pending.kind === 'referral') {
			void handleAction('authority_referral', { authorityName, authorityReference });
			return;
		}
		void handleAction(pending.action);
	};

	const handleOpenPurge = () => {
		setNoteError(null);
		setConfirmPurge(true);
	};

	const screenState: AdminScreenState = report
		? { kind: 'ready' }
		: loadError
			? { kind: 'error', title: 'This case could not be loaded', message: loadError }
			: { kind: 'loading', variant: 'detail' };

	const simpleAction = (
		action: Extract<PendingCaseAction, { kind: 'simple' }>['action'],
		label: string,
		icon: AdminIconName,
		description: string,
		tone: 'positive' | 'pending' | 'danger' = 'pending'
	): AdminOverflowItem => ({
		key: action,
		label: `${label}…`,
		icon,
		disabled: busy,
		onPress: () => openAction({ kind: 'simple', action, title: `${label}?`, description, confirmLabel: label, tone, icon }),
	});

	const actionItems: AdminOverflowItem[] = report
		? [
			simpleAction('note', 'Add note', 'edit-3', 'Adds your note to the case history.', 'positive'),
			simpleAction('assign', 'Assign to me', 'user-check', 'You become the reviewer for this case.', 'positive'),
			simpleAction('escalate', 'Escalate', 'trending-up', 'Raises the case for senior review.'),
			simpleAction('moderation_action', 'Hide & preserve', 'eye-off', 'Hides the reported content and preserves it as evidence.'),
			report.legalHold
				? simpleAction('release_legal_hold', 'Release legal hold', 'unlock', 'Removes the legal hold. The case can then be purged.')
				: simpleAction('preserve', 'Legal hold', 'lock', 'Places the case on legal hold. Purge is blocked while it is on.'),
			simpleAction('resolve', 'Resolve', 'check-circle', 'Marks the case resolved.', 'positive'),
			{
				key: 'purge',
				label: 'Purge (administrator only)…',
				icon: 'trash-2',
				tone: 'danger',
				disabled: busy || report.legalHold,
				description: report.legalHold ? 'Purge is blocked while legal hold is active.' : 'Permanently purges the case record.',
				onPress: handleOpenPurge,
			},
		]
		: [];

	const pendingCopy = !pending
		? null
		: pending.kind === 'status'
			? { title: 'Change status?', description: 'Choose the new status and give the reason.', confirmLabel: 'Apply status', tone: 'pending' as const, icon: 'flag' as const }
			: pending.kind === 'priority'
				? { title: 'Change priority?', description: 'Choose the new priority and give the reason.', confirmLabel: 'Apply priority', tone: 'pending' as const, icon: 'alert-circle' as const }
				: pending.kind === 'referral'
					? { title: 'Record authority referral?', description: `Records a referral to ${authorityName.trim() || 'the authority'}${authorityReference.trim() ? ` (reference ${authorityReference.trim()})` : ''}.`, confirmLabel: 'Record referral', tone: 'pending' as const, icon: 'send' as const }
					: pending;

	const choiceUnchanged = (pending?.kind === 'status' && (!nextStatus || nextStatus === report?.status))
		|| (pending?.kind === 'priority' && (!nextPriority || nextPriority === report?.priority));

	const inputStyle = [
		type.body,
		{ minHeight: ADMIN_MIN_TOUCH, paddingHorizontal: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text },
	];

	const noteField = (
		<AdminReasonField
			label="Reviewer note (required)"
			value={note}
			onChangeText={(value) => {
				setNote(value);
				if (noteError) setNoteError(null);
			}}
			editable={!busy}
			placeholder="Required reviewer note or reason"
			error={noteError}
			minHeight={90}
		/>
	);

	return (
		<AdminScreen
			title={report?.reference ?? (loadError ? 'Case unavailable' : 'Child Safety case')}
			subtitle={report ? CHILD_SAFETY_CATEGORY_LABELS[report.category] : undefined}
			eyebrow={{ label: report?.legalHold ? 'Restricted · Legal hold' : 'Restricted workspace', tone: 'danger' }}
			// app/admin/_layout.tsx gates /admin; the /help reviewer route is gated by the server.
			gate="none"
			backFallback={queueRoute}
			showHubShortcut={isAdminRoute}
			state={screenState}
			refreshing={refreshing}
			onRefresh={handleRefresh}
			keyboardAware
			footer={report ? (
				<>
					<AdminButton
						label="Open secure conversation"
						icon="message-square"
						tone="danger"
						emphasis="primary"
						onPress={() =>
							router.push({
								pathname: '/help/child-safety/reports/[reportId]',
								params: { reportId, reviewerMode: '1' },
							})
						}
						style={{ flex: 1 }}
					/>
					<AdminOverflowMenu items={actionItems} trigger="row" title="Reviewer actions" triggerLabel="Reviewer actions" disabled={busy} />
				</>
			) : undefined}
		>
			{report ? (
				<View style={{ gap: space.lg }}>
					<AdminSection title="Summary" tone={report.priority === 'critical' ? 'danger' : 'neutral'}>
						<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
							<AdminStatusPill label={toLabel(report.priority)} tone={priorityTone(report.priority)} />
							<AdminStatusPill label={toLabel(report.status)} tone={statusTone(report.status)} />
							{report.legalHold ? <AdminStatusPill label="Legal hold" tone="pending" /> : null}
						</View>
						<Text style={[type.section, { color: colors.text }]}>{CHILD_SAFETY_CATEGORY_LABELS[report.category]}</Text>
						<Text selectable style={[type.meta, { color: colors.mutedText }]}>
							Target: {report.target.type} · {report.target.id}
						</Text>
						<Text selectable style={[type.body, { color: colors.secondaryText }]}>{report.description}</Text>
					</AdminSection>

					<AdminSection title="Status & priority" description="Every change needs a reviewer note.">
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
							<View style={{ flex: 1, gap: space.xs }}>
								<Text style={[type.label, { color: colors.mutedText }]}>Status</Text>
								<AdminStatusPill label={toLabel(report.status)} tone={statusTone(report.status)} />
							</View>
							<AdminButton label="Change" icon="edit-2" tone="neutral" disabled={busy} accessibilityLabel="Change status" onPress={() => openAction({ kind: 'status' })} />
						</View>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
							<View style={{ flex: 1, gap: space.xs }}>
								<Text style={[type.label, { color: colors.mutedText }]}>Priority</Text>
								<AdminStatusPill label={toLabel(report.priority)} tone={priorityTone(report.priority)} />
							</View>
							<AdminButton label="Change" icon="edit-2" tone="neutral" disabled={busy} accessibilityLabel="Change priority" onPress={() => openAction({ kind: 'priority' })} />
						</View>
					</AdminSection>

					<AdminSection title="Authority referral" collapsible={{ initiallyOpen: false }}>
						<TextInput
							value={authorityName}
							onChangeText={setAuthorityName}
							placeholder="Authority name for referral"
							placeholderTextColor={colors.mutedText}
							accessibilityLabel="Authority name for referral"
							style={inputStyle}
						/>
						<TextInput
							value={authorityReference}
							onChangeText={setAuthorityReference}
							placeholder="Authority reference (optional)"
							placeholderTextColor={colors.mutedText}
							accessibilityLabel="Authority reference (optional)"
							style={inputStyle}
						/>
						<AdminButton
							label="Record authority referral"
							icon="send"
							tone="pending"
							disabled={busy || !authorityName.trim()}
							onPress={() => openAction({ kind: 'referral' })}
						/>
					</AdminSection>

					<AdminSection title="Case history">
						{report.audit?.length ? (
							report.audit.map((entry) => (
								<AdminListRow
									key={entry.id}
									title={toLabel(entry.action)}
									subtitle={entry.note || undefined}
									meta={new Date(entry.createdAt).toLocaleString()}
									leading={{ kind: 'icon', name: 'clock' }}
								/>
							))
						) : (
							<Text style={[type.meta, { color: colors.mutedText }]}>No history yet. Actions taken on this case appear here.</Text>
						)}
					</AdminSection>
				</View>
			) : null}

			<AdminDialog
				visible={Boolean(pending)}
				title={pendingCopy?.title ?? ''}
				description={pendingCopy?.description}
				confirmLabel={pendingCopy?.confirmLabel}
				tone={pendingCopy?.tone ?? 'pending'}
				icon={pendingCopy?.icon}
				busy={busy}
				confirmDisabled={choiceUnchanged}
				onConfirm={handleConfirmPending}
				onClose={closeAction}
			>
				<View style={{ gap: space.lg }}>
					{pending?.kind === 'status' ? (
						<AdminChoiceList
							label="New status"
							value={nextStatus}
							currentValue={report?.status}
							disabled={busy}
							onChange={setNextStatus}
							options={STATUS_OPTIONS.map((option) => ({ value: option, label: toLabel(option) }))}
						/>
					) : null}
					{pending?.kind === 'priority' ? (
						<AdminChoiceList
							label="New priority"
							value={nextPriority}
							currentValue={report?.priority}
							disabled={busy}
							onChange={setNextPriority}
							options={PRIORITY_OPTIONS.map((option) => ({ value: option, label: toLabel(option) }))}
						/>
					) : null}
					{noteField}
				</View>
			</AdminDialog>

			<AdminDialog
				visible={confirmPurge}
				title="Purge this case?"
				description="This permanently purges the case record. It cannot be undone."
				confirmLabel="Purge case"
				tone="danger"
				icon="trash-2"
				busy={busy}
				requireText={PURGE_CONFIRM_TEXT}
				confirmDisabled={Boolean(report?.legalHold)}
				onConfirm={() => void handleAction('purge')}
				onClose={() => {
					if (!busy) setConfirmPurge(false);
				}}
			>
				{noteField}
			</AdminDialog>
		</AdminScreen>
	);
}
