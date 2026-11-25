import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import AdminButton from '@/components/admin/AdminButton';
import AdminListRow from '@/components/admin/AdminListRow';
import AdminScreen, { type AdminScreenState } from '@/components/admin/AdminScreen';
import AdminState from '@/components/admin/AdminState';
import AdminToolbar from '@/components/admin/AdminToolbar';
import { readSingleFilter, type FilterGroup, type FilterValues } from '@/components/ui/FilterSheet';
import { space, type AdminToneName } from '@/lib/admin/adminTokens';
import { childSafetyReportService } from '@/lib/services/ChildSafetyReportService';
import {
	CHILD_SAFETY_CATEGORY_LABELS,
	type ChildSafetyPriority,
	type ChildSafetyReportRecord,
	type ChildSafetyStatus,
} from '@/lib/types/childSafety';

type ChildSafetyCasesScreenProps = { detailRoutePrefix?: string };
type LoadMode = 'initial' | 'refresh' | 'more' | 'silent';

const PRIORITY_OPTIONS: readonly ChildSafetyPriority[] = ['critical', 'high', 'medium', 'standard'];
const STATUS_OPTIONS: readonly ChildSafetyStatus[] = ['submitted', 'under_review', 'escalated', 'action_required', 'resolved', 'reported_to_authority', 'closed'];
const toLabel = (value: string): string => {
	const words = value.replaceAll('_', ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
};
const priorityTone = (priority: ChildSafetyPriority): AdminToneName => (priority === 'critical' ? 'danger' : priority === 'high' ? 'pending' : 'neutral');

/** Restricted child-safety queue; also the reviewer queue at /help/child-safety/review (staff, outside the admin gate). */
export default function ChildSafetyCasesScreen({
	detailRoutePrefix = '/admin/child-safety',
}: ChildSafetyCasesScreenProps) {
	const router = useRouter();
	const isAdminRoute = detailRoutePrefix.startsWith('/admin');
	const [items, setItems] = useState<ChildSafetyReportRecord[]>([]);
	const [priority, setPriority] = useState<ChildSafetyPriority | undefined>();
	const [status, setStatus] = useState<ChildSafetyStatus | undefined>();
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState('');
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [hasMore, setHasMore] = useState(false);
	// Only the newest request may update the list, so a slow answer for an earlier filter can't overwrite it.
	const requestId = useRef(0);

	const loadCases = useCallback(
		async (mode: LoadMode, cursor: string | null = null) => {
			const currentRequest = ++requestId.current;
			if (mode === 'refresh') setRefreshing(true);
			else if (mode === 'more') setLoadingMore(true);
			else if (mode === 'initial') setLoading(true);
			setError('');
			try {
				const page = await childSafetyReportService.listCases({
					priority,
					status,
					cursor: cursor ?? undefined,
				});
				if (currentRequest !== requestId.current) return;
				setItems((current) => (cursor ? [...current, ...page.items] : page.items));
				setNextCursor(page.nextCursor);
				setHasMore(page.hasMore);
			} catch (loadError: unknown) {
				if (currentRequest !== requestId.current) return;
				console.error(
					'[ChildSafetyCasesScreen.loadCases] Error:',
					loadError instanceof Error ? loadError.message : loadError
				);
				setError(loadError instanceof Error ? loadError.message : 'Restricted cases could not be loaded.');
			} finally {
				if (currentRequest === requestId.current) {
					setLoading(false);
					setRefreshing(false);
					setLoadingMore(false);
				}
			}
		},
		[priority, status]
	);

	// Reload on focus (and when filters change) so a case updated or purged on the detail screen isn't shown stale.
	// With cases already listed the reload is silent; the skeleton is only for an empty list.
	const hasItemsRef = useRef(false);
	hasItemsRef.current = items.length > 0;
	useFocusEffect(
		useCallback(() => {
			void loadCases(hasItemsRef.current ? 'silent' : 'initial', null);
		}, [loadCases])
	);

	const filterGroups: FilterGroup[] = [
		{ key: 'priority', label: 'Priority', options: [{ value: 'all', label: 'Any priority' }, ...PRIORITY_OPTIONS.map((option) => ({ value: option, label: toLabel(option) }))], value: priority ?? 'all', defaultValue: 'all' },
		{ key: 'status', label: 'Status', options: [{ value: 'all', label: 'Any status' }, ...STATUS_OPTIONS.map((option) => ({ value: option, label: toLabel(option) }))], value: status ?? 'all', defaultValue: 'all' },
	];
	// A new filter starts from an empty list, so the skeleton shows instead of the previous filter's cases.
	const applyFilters = (nextPriority: ChildSafetyPriority | undefined, nextStatus: ChildSafetyStatus | undefined): void => {
		if (nextPriority === priority && nextStatus === status) return;
		setItems([]);
		setPriority(nextPriority);
		setStatus(nextStatus);
	};
	const handleApplyFilters = (values: FilterValues): void => {
		applyFilters(
			PRIORITY_OPTIONS.find((option) => option === readSingleFilter(values, 'priority')),
			STATUS_OPTIONS.find((option) => option === readSingleFilter(values, 'status'))
		);
	};
	const handleClearFilters = (): void => applyFilters(undefined, undefined);
	const isFiltered = Boolean(priority || status);

	const screenState: AdminScreenState = loading && !items.length
		? { kind: 'loading', variant: 'list' }
		: error && !items.length
			? { kind: 'error', title: 'Cases could not be loaded', message: error }
			: !items.length
				? {
					kind: 'empty',
					icon: 'shield',
					title: 'No cases found',
					description: 'There are no child-safety cases right now.',
					filtered: isFiltered,
					onClearFilters: handleClearFilters,
				}
				: { kind: 'ready' };

	return (
		<AdminScreen
			title="Child Safety cases"
			eyebrow={{ label: 'Restricted workspace', tone: 'danger' }}
			// app/admin/_layout.tsx gates /admin; the /help reviewer route is gated by the server.
			gate="none"
			backFallback={isAdminRoute ? '/admin' : '/help'}
			showHubShortcut={isAdminRoute}
			state={screenState}
			refreshing={refreshing}
			onRefresh={() => loadCases('refresh', null)}
			toolbar={(
				<AdminToolbar
					filters={{ groups: filterGroups, onApply: handleApplyFilters, title: 'Filter cases' }}
					resultSummary={items.length ? `${items.length}${hasMore ? '+' : ''} ${items.length === 1 ? 'case' : 'cases'}` : undefined}
				/>
			)}
		>
			<View style={{ gap: space.sm }}>
				{error ? <AdminState kind="inlineError" message={error} onRetry={() => void loadCases('refresh', null)} /> : null}
				{items.map((report) => (
					<AdminListRow
						key={report.id}
						title={report.reference}
						subtitle={CHILD_SAFETY_CATEGORY_LABELS[report.category]}
						meta={report.description}
						leading={{ kind: 'icon', name: report.legalHold ? 'lock' : 'shield', tone: priorityTone(report.priority) }}
						status={{
							label: `${toLabel(report.priority)} · ${toLabel(report.status)}${report.legalHold ? ' · Legal hold' : ''}`,
							tone: priorityTone(report.priority),
						}}
						onPress={() => router.push(`${detailRoutePrefix}/${encodeURIComponent(report.id)}` as Href)}
						accessibilityHint="Opens the case"
					/>
				))}
				{hasMore && nextCursor ? (
					<AdminButton
						label={loadingMore ? 'Loading…' : 'Load more cases'}
						icon="chevron-down"
						tone="neutral"
						busy={loadingMore}
						disabled={loading || refreshing}
						fullWidth
						onPress={() => void loadCases('more', nextCursor)}
					/>
				) : null}
			</View>
		</AdminScreen>
	);
}
