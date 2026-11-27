import { useCallback, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { toast } from 'sonner-native';
import AdminScreen, { type AdminScreenState } from '@/components/admin/AdminScreen';
import AdminToolbar, { type AdminToolbarProps } from '@/components/admin/AdminToolbar';
import AdminListRow from '@/components/admin/AdminListRow';
import AdminState from '@/components/admin/AdminState';
import AdminDialog from '@/components/admin/AdminDialog';
import AdminDeletedContentPanel, { useDeletedContent } from '@/components/admin/AdminDeletedContentPanel';
import AdminBulkDeletionPanel from '@/components/admin/AdminBulkDeletionPanel';
import AdminRatingsModerationPanel, { useRatingModeration } from '@/components/admin/AdminRatingsModerationPanel';
import { readSingleFilter, type FilterGroup, type FilterValues } from '@/components/ui/FilterSheet';
import { AdminModerationService, type AdminModerationReport, type AdminReportStatus } from '@/lib/services/AdminModerationService';
import { adminContentService } from '@/lib/services/AdminContentService';
import type { ContentAppealRecord } from '@/lib/types/adminContent';
import { getAdminTone, radius, space, type, type AdminToneName } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { settleAll } from '@/lib/utils/settleAll';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';

const moderationService = AdminModerationService.getInstance();

const STATUS_FILTERS: readonly (AdminReportStatus | 'all')[] = ['all', 'pending', 'under_review', 'action_taken', 'resolved', 'dismissed', 'escalated'];
const SEVERITY_FILTERS = ['all', 'low', 'medium', 'high', 'critical'] as const;

type ModerationTab = 'reports' | 'appeals' | 'deleted' | 'ratings';
const MODERATION_TABS: readonly ModerationTab[] = ['reports', 'appeals', 'deleted', 'ratings'];
const isModerationTab = (value: string | undefined): value is ModerationTab => MODERATION_TABS.some((tab) => tab === value);

const toFilterLabel = (value: string, allLabel: string): string => {
	if (value === 'all') return allLabel;
	const words = value.replaceAll('_', ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
};

const severityTone = (severity: AdminModerationReport['severity']): AdminToneName =>
	severity === 'critical' || severity === 'high' ? 'danger' : severity === 'medium' ? 'pending' : 'neutral';

type LoadMode = 'initial' | 'refresh' | 'silent';

/**
 * Moderation screen (/admin/moderation): Reports, Appeals, Deleted and Ratings (E-Hub service ratings and product
 * reviews) as segments; "Bulk delete" in the overflow menu opens /admin/moderation?view=bulk.
 * `?tab=reports|appeals|deleted|ratings` picks the starting segment.
 */
export default function ModerationSection() {
	const { view, tab } = useLocalSearchParams<{ view?: string; tab?: string }>();
	if (view === 'bulk') return <AdminBulkDeletionPanel />;
	return <ModerationQueues initialTab={isModerationTab(tab) ? tab : 'reports'} />;
}

function ModerationQueues({ initialTab }: { initialTab: ModerationTab }) {
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<ModerationTab>(initialTab);
	const [reports, setReports] = useState<AdminModerationReport[]>([]);
	const [appeals, setAppeals] = useState<ContentAppealRecord[]>([]);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<AdminReportStatus | 'all'>('all');
	const [severity, setSeverity] = useState<(typeof SEVERITY_FILTERS)[number]>('all');
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [reportsError, setReportsError] = useState<string | null>(null);
	const [appealsError, setAppealsError] = useState<string | null>(null);
	const [reviewingAppealId, setReviewingAppealId] = useState<string | null>(null);
	const [expandedAppealId, setExpandedAppealId] = useState<string | null>(null);
	const [rejectTarget, setRejectTarget] = useState<ContentAppealRecord | null>(null);
	const [rejectError, setRejectError] = useState<string | null>(null);
	const hasFocusedRef = useRef(false);
	/** Ignores an older load's response so it cannot overwrite a newer one. */
	const loadRequestRef = useRef(0);
	/** Synchronous double-submit guard for appeal decisions (state updates land a frame later). */
	const reviewingRef = useRef(false);
	const deleted = useDeletedContent(activeTab === 'deleted');
	const ratings = useRatingModeration(activeTab === 'ratings');

	const filterGroups: FilterGroup[] = [
		{ key: 'status', label: 'Status', options: STATUS_FILTERS.map((filter) => ({ value: filter, label: toFilterLabel(filter, 'Any status') })), value: status, defaultValue: 'all' },
		{ key: 'severity', label: 'Severity', options: SEVERITY_FILTERS.map((filter) => ({ value: filter, label: toFilterLabel(filter, 'Any severity') })), value: severity, defaultValue: 'all' },
	];
	const handleApplyFilters = (values: FilterValues): void => {
		setStatus(STATUS_FILTERS.find((filter) => filter === readSingleFilter(values, 'status')) ?? 'all');
		setSeverity(SEVERITY_FILTERS.find((filter) => filter === readSingleFilter(values, 'severity')) ?? 'all');
	};
	const handleClearReportFilters = () => {
		setSearch('');
		setStatus('all');
		setSeverity('all');
	};

	/** 'silent' refreshes on return to the screen (e.g. after acting on a report) without the skeleton or new errors. */
	const load = useCallback(async (mode: LoadMode = 'initial') => {
		const requestId = loadRequestRef.current + 1;
		loadRequestRef.current = requestId;
		if (mode === 'initial') setLoading(true);
		if (mode === 'refresh') setRefreshing(true);
		try {
			// One source failing must not hide the other, and must never be swallowed.
			const [reportsResult, appealsResult] = await settleAll([moderationService.fetchReports(), adminContentService.getPendingAppeals()]);
			if (loadRequestRef.current !== requestId) return;
			if (reportsResult.status === 'fulfilled') {
				setReports(reportsResult.value);
				setReportsError(null);
			} else {
				console.error('[ModerationSection.load] Error:', reportsResult.reason instanceof Error ? reportsResult.reason.message : reportsResult.reason);
				// A failed background refresh keeps what is already on screen and says nothing new.
				if (mode !== 'silent') setReportsError(reportsResult.reason instanceof Error ? `Reports: ${reportsResult.reason.message}` : 'Reports could not be loaded.');
			}
			if (appealsResult.status === 'fulfilled') {
				setAppeals(appealsResult.value);
				setAppealsError(null);
			} else {
				console.error('[ModerationSection.load] Error:', appealsResult.reason instanceof Error ? appealsResult.reason.message : appealsResult.reason);
				if (mode !== 'silent') setAppealsError(appealsResult.reason instanceof Error ? `Appeals: ${appealsResult.reason.message}` : 'Appeals could not be loaded.');
			}
		} finally {
			if (loadRequestRef.current === requestId) {
				setLoading(false);
				setRefreshing(false);
			}
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			void load(hasFocusedRef.current ? 'silent' : 'initial');
			hasFocusedRef.current = true;
		}, [load])
	);

	const handleReviewAppeal = async (appeal: ContentAppealRecord, decision: 'approved' | 'rejected'): Promise<boolean> => {
		if (reviewingRef.current) return false;
		reviewingRef.current = true;
		setReviewingAppealId(appeal.id);
		try {
			void interactionFeedbackService.play('post');
			const res = await adminContentService.reviewAppeal(appeal.id, decision);
			if (!res.success) throw new Error(res.error || 'Failed to update appeal');
			void interactionFeedbackService.play('success');
			setAppeals((prev) => prev.filter((item) => item.id !== appeal.id));
			toast.success(decision === 'approved' ? 'Appeal approved and content restored.' : 'Appeal rejected.');
			return true;
		} catch (err: unknown) {
			console.error('[ModerationSection.handleReviewAppeal] Error:', err instanceof Error ? err.message : err);
			void interactionFeedbackService.play('warning');
			const message = err instanceof Error ? err.message : 'Failed to review appeal';
			if (decision === 'rejected') setRejectError(message);
			else toast.error(message);
			return false;
		} finally {
			reviewingRef.current = false;
			setReviewingAppealId(null);
		}
	};

	const handleConfirmReject = async () => {
		if (!rejectTarget) return;
		setRejectError(null);
		const done = await handleReviewAppeal(rejectTarget, 'rejected');
		if (done) setRejectTarget(null);
	};

	const visibleReports = useMemo(() => {
		const normalized = search.trim().toLowerCase();
		return reports.filter(
			(report) =>
				(status === 'all' || report.status === status) &&
				(severity === 'all' || report.severity === severity) &&
				(!normalized || `${report.reason} ${report.contentType} ${report.reporterName} ${report.status} ${report.targetId}`.toLowerCase().includes(normalized))
		);
	}, [reports, search, severity, status]);

	const handleRefresh = (): Promise<void> => (activeTab === 'deleted' ? deleted.reload('refresh') : activeTab === 'ratings' ? ratings.reload('refresh') : load('refresh'));

	const toolbarProps: AdminToolbarProps = {
		segments: {
			value: activeTab,
			options: [
				// Four segments share a phone's width, so the counts live in each tab's result summary instead.
				{ value: 'reports', label: 'Reports' },
				{ value: 'appeals', label: 'Appeals' },
				{ value: 'deleted', label: 'Deleted' },
				{ value: 'ratings', label: 'Ratings' },
			],
			onChange: (next) => {
				if (isModerationTab(next)) setActiveTab(next);
			},
		},
	};
	if (activeTab === 'reports') {
		toolbarProps.search = { value: search, placeholder: 'Search reports, people, content IDs', onChange: setSearch };
		toolbarProps.filters = { groups: filterGroups, onApply: handleApplyFilters, title: 'Filter reports' };
		toolbarProps.resultSummary = loading ? undefined : `${visibleReports.length} of ${reports.length} reports`;
	} else if (activeTab === 'deleted') {
		toolbarProps.search = { value: deleted.searchQuery, placeholder: 'Search title, reason, user, or content ID', onChange: deleted.setSearchQuery };
		toolbarProps.filters = { groups: deleted.filterGroups, onApply: deleted.applyFilters, title: 'Filter deleted content' };
		toolbarProps.resultSummary = deleted.loading ? undefined : `${deleted.filteredRecords.length} of ${deleted.records.length} deletions`;
	} else if (activeTab === 'ratings') {
		toolbarProps.search = { value: ratings.searchQuery, placeholder: 'Search reviewer, comment, provider or product', onChange: ratings.setSearchQuery };
		toolbarProps.filters = { groups: ratings.filterGroups, onApply: ratings.applyFilters, title: 'Filter ratings' };
		toolbarProps.resultSummary = ratings.loading ? undefined : `${ratings.filteredReviews.length} of ${ratings.reviews.length} ratings`;
	} else {
		toolbarProps.resultSummary = loading ? undefined : `${appeals.length} pending ${appeals.length === 1 ? 'appeal' : 'appeals'}`;
	}

	const isTabLoading = activeTab === 'deleted' ? deleted.loading : activeTab === 'ratings' ? ratings.loading : loading;
	const screenState: AdminScreenState = isTabLoading ? { kind: 'loading', variant: 'list' } : { kind: 'ready' };

	const renderReports = () => (
		<View style={{ gap: space.md }}>
			{reportsError ? <AdminState kind="inlineError" message={reportsError} onRetry={() => void load('refresh')} retrying={refreshing} /> : null}
			{visibleReports.length ? (
				<View style={{ gap: space.sm }}>
					{visibleReports.map((report) => (
						<AdminListRow
							key={report.id}
							title={report.reason}
							subtitle={`${report.contentType} · reported by ${report.reporterName}`}
							// The member the report is about; the reported content itself only opens in the report detail.
							leading={report.reportedUserId ? { kind: 'avatar', name: report.contentType, userId: report.reportedUserId } : { kind: 'icon', name: 'flag', tone: severityTone(report.severity) }}
							meta={`${toFilterLabel(report.status, '')}${report.description ? ` · ${report.description}` : ''}`}
							status={{ label: report.severity, tone: severityTone(report.severity) }}
							onPress={() => router.push({ pathname: '/admin/reports/[reportId]', params: { reportId: report.id } })}
							accessibilityHint="Opens the report"
						/>
					))}
				</View>
			) : reports.length && (search.trim() || status !== 'all' || severity !== 'all') ? (
				<AdminState kind="empty" title="" filtered onClearFilters={handleClearReportFilters} />
			) : reportsError ? null : (
				<AdminState kind="empty" icon="shield" title="No reports" description="New member reports appear here." />
			)}
		</View>
	);

	const renderAppeals = () => (
		<View style={{ gap: space.md }}>
			{appealsError ? <AdminState kind="inlineError" message={appealsError} onRetry={() => void load('refresh')} retrying={refreshing} /> : null}
			{appeals.length ? (
				<View style={{ gap: space.sm }}>
					{appeals.map((appeal) => {
						const isExpanded = expandedAppealId === appeal.id;
						const isReviewing = reviewingAppealId === appeal.id;
						return (
							<View key={appeal.id} style={{ gap: space.xs }}>
								<AdminListRow
									title={`${toFilterLabel(appeal.contentType, '')} appeal`}
									subtitle={`By ${appeal.authorName || appeal.authorId}`}
									meta={`Deleted for: ${appeal.deletionReason}`}
									leading={appeal.authorId ? { kind: 'avatar', name: appeal.authorName || 'Member', userId: appeal.authorId } : { kind: 'icon', name: 'rotate-ccw', tone: 'pending' }}
									onPress={() => setExpandedAppealId(isExpanded ? null : appeal.id)}
									accessibilityHint={isExpanded ? 'Hides the appeal text' : 'Shows the appeal text'}
									inlineAction={{
										key: 'approve',
										label: 'Approve & restore',
										icon: 'check',
										tone: 'positive',
										busy: isReviewing && !rejectTarget,
										disabled: Boolean(reviewingAppealId),
										onPress: () => void handleReviewAppeal(appeal, 'approved'),
									}}
									overflowActions={[
										{
											key: 'reject',
											label: 'Reject appeal',
											icon: 'x-circle',
											tone: 'danger',
											disabled: Boolean(reviewingAppealId),
											onPress: () => {
												setRejectError(null);
												setRejectTarget(appeal);
											},
										},
									]}
								/>
								{isExpanded ? <AppealDetail appeal={appeal} /> : null}
							</View>
						);
					})}
				</View>
			) : appealsError ? null : (
				<AdminState kind="empty" icon="check-circle" title="No pending appeals" description="All content restoration appeals have been reviewed." />
			)}
		</View>
	);

	return (
		<AdminScreen
			title="Moderation"
			subtitle="Reports, appeals and ratings"
			state={screenState}
			onRefresh={handleRefresh}
			refreshing={activeTab === 'deleted' ? deleted.refreshing : activeTab === 'ratings' ? ratings.refreshing : refreshing}
			toolbar={<AdminToolbar {...toolbarProps} />}
			overflowActions={[
				{
					key: 'bulk',
					label: 'Bulk delete',
					icon: 'trash-2',
					description: 'Delete many items of one type',
					onPress: () => router.push({ pathname: '/admin/moderation', params: { view: 'bulk' } } as Href),
				},
			]}
		>
			{activeTab === 'deleted' ? (
				<AdminDeletedContentPanel controller={deleted} />
			) : activeTab === 'ratings' ? (
				<AdminRatingsModerationPanel controller={ratings} />
			) : activeTab === 'appeals' ? renderAppeals() : renderReports()}

			<AdminDialog
				visible={Boolean(rejectTarget)}
				tone="danger"
				icon="x-circle"
				title="Reject this appeal?"
				description={rejectTarget ? `The ${rejectTarget.contentType} stays deleted and ${rejectTarget.authorName || 'the author'} is told the appeal was rejected.` : ''}
				confirmLabel="Reject"
				busy={Boolean(reviewingAppealId)}
				onConfirm={() => void handleConfirmReject()}
				onClose={() => setRejectTarget(null)}
			>
				{rejectError ? <AdminState kind="inlineError" message={rejectError} /> : null}
			</AdminDialog>
		</AdminScreen>
	);
}

/** The expanded part of an appeal row: the user's explanation and the original deletion reason. */
function AppealDetail({ appeal }: { appeal: ContentAppealRecord }) {
	const { colors } = useAppTheme();
	const danger = getAdminTone(colors, 'danger');
	return (
		<View
			style={{ gap: space.sm, padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
		>
			<View style={{ gap: space.xs }}>
				<Text style={[type.label, { color: colors.mutedText }]}>Appeal explanation</Text>
				<Text selectable style={[type.body, { color: colors.text }]}>
					“{appeal.appealReason}”
				</Text>
			</View>
			<View style={{ gap: space.xs }}>
				<Text style={[type.label, { color: colors.mutedText }]}>Original deletion reason</Text>
				<Text selectable style={[type.body, { color: danger.text }]}>
					{appeal.deletionReason}
				</Text>
			</View>
			<Text selectable style={[type.meta, { color: colors.mutedText }]}>
				Author {appeal.authorName ? `${appeal.authorName} · ` : ''}
				{appeal.authorId} · Content {appeal.contentId}
			</Text>
		</View>
	);
}
