import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import AdminListRow from '@/components/admin/AdminListRow';
import AdminScreen, { type AdminScreenState } from '@/components/admin/AdminScreen';
import AdminState from '@/components/admin/AdminState';
import AdminToolbar from '@/components/admin/AdminToolbar';
import { readSingleFilter, type FilterGroup, type FilterValues } from '@/components/ui/FilterSheet';
import { space, type AdminToneName } from '@/lib/admin/adminTokens';
import { supportTicketService } from '@/lib/services/SupportTicketService';
import {
	SUPPORT_TICKET_CATEGORY_LABELS,
	type SupportTicket,
	type SupportTicketCategory,
	type SupportTicketFilter,
	type SupportTicketStatus,
} from '@/lib/types/support';

const FILTERS: readonly { value: SupportTicketFilter; label: string }[] = [
	{ value: 'unassigned', label: 'Unassigned' },
	{ value: 'mine', label: 'Mine' },
	{ value: 'waiting', label: 'Waiting' },
	{ value: 'urgent', label: 'Urgent' },
	{ value: 'resolved', label: 'Resolved' },
	{ value: 'all', label: 'All' },
];
const ANY_CATEGORY = 'any';
const CATEGORY_KEYS = Object.keys(SUPPORT_TICKET_CATEGORY_LABELS) as SupportTicketCategory[];

const STATUS_LABELS: { [status in SupportTicketStatus]: string } = {
	submitted: 'Submitted',
	assigned: 'Assigned',
	waiting_for_user: 'Waiting for user',
	waiting_for_staff: 'Waiting for staff',
	resolved: 'Resolved',
	closed: 'Closed',
};
const STATUS_TONES: { [status in SupportTicketStatus]: AdminToneName } = {
	submitted: 'pending',
	assigned: 'neutral',
	waiting_for_user: 'neutral',
	waiting_for_staff: 'pending',
	resolved: 'positive',
	closed: 'neutral',
};

const isTicketFilter = (value: string | undefined): value is SupportTicketFilter => FILTERS.some((option) => option.value === value);
const isCategory = (value: string | undefined): value is SupportTicketCategory => CATEGORY_KEYS.some((category) => category === value);

type AdminSupportTicketsScreenProps = { detailRoutePrefix?: string };
type LoadMode = 'initial' | 'refresh' | 'silent';

/** Support queue for staff; also the staff queue at /help/tickets/staff (outside the admin gate; the server decides). */
export default function AdminSupportTicketsScreen({
	detailRoutePrefix = '/admin/support',
}: AdminSupportTicketsScreenProps) {
	const router = useRouter();
	const isAdminRoute = detailRoutePrefix.startsWith('/admin');
	const [filter, setFilter] = useState<SupportTicketFilter>('unassigned');
	const [category, setCategory] = useState<SupportTicketCategory | null>(null);
	const [query, setQuery] = useState('');
	const [items, setItems] = useState<SupportTicket[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState('');
	// Only the newest request may update the list, so a slow response for an earlier filter can't overwrite it.
	const requestId = useRef(0);
	const load = useCallback(async (mode: LoadMode) => {
		const currentRequest = ++requestId.current;
		if (mode === 'refresh') setRefreshing(true);
		else if (mode === 'initial') setLoading(true);
		setError('');
		try {
			const page = await supportTicketService.listStaff(filter);
			if (currentRequest === requestId.current) setItems(page.items);
		} catch (loadError: unknown) {
			if (currentRequest !== requestId.current) return;
			console.error(
				'[AdminSupportTicketsScreen.load] Error:',
				loadError instanceof Error ? loadError.message : loadError
			);
			setError(loadError instanceof Error ? loadError.message : 'Support queue could not be loaded.');
		} finally {
			if (currentRequest === requestId.current) {
				setLoading(false);
				setRefreshing(false);
			}
		}
	}, [filter]);

	// Reload on focus (and on filter change) so a ticket claimed, answered or resolved on its detail screen isn't shown stale.
	// With tickets already listed the reload is silent; the skeleton is only for an empty list.
	const hasItemsRef = useRef(false);
	hasItemsRef.current = items.length > 0;
	useFocusEffect(
		useCallback(() => {
			void load(hasItemsRef.current ? 'silent' : 'initial');
		}, [load])
	);

	// Search and category apply to the loaded queue (the staff list API takes only the queue filter).
	const visibleItems = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		return items.filter((ticket) => {
			if (category && ticket.category !== category) return false;
			if (!normalizedQuery) return true;
			return ticket.reference.toLowerCase().includes(normalizedQuery)
				|| ticket.subject.toLowerCase().includes(normalizedQuery)
				|| ticket.requesterDisplayName.toLowerCase().includes(normalizedQuery);
		});
	}, [items, query, category]);

	const filterGroups: FilterGroup[] = [
		{ key: 'queue', label: 'Queue', options: FILTERS.map((option) => ({ value: option.value, label: option.label })), value: filter, defaultValue: 'unassigned' },
		{ key: 'category', label: 'Category', options: [{ value: ANY_CATEGORY, label: 'Any category' }, ...CATEGORY_KEYS.map((key) => ({ value: key, label: SUPPORT_TICKET_CATEGORY_LABELS[key] }))], value: category ?? ANY_CATEGORY, defaultValue: ANY_CATEGORY },
	];
	const handleApplyFilters = (values: FilterValues): void => {
		const nextQueue = readSingleFilter(values, 'queue');
		const nextFilter = isTicketFilter(nextQueue) ? nextQueue : 'unassigned';
		const nextCategory = readSingleFilter(values, 'category');
		// A new queue starts from an empty list, so the skeleton shows instead of the previous queue's tickets.
		if (nextFilter !== filter) {
			setItems([]);
			setFilter(nextFilter);
		}
		setCategory(isCategory(nextCategory) ? nextCategory : null);
	};
	const isNarrowed = Boolean(query.trim() || category);
	const handleClearNarrowing = (): void => {
		setQuery('');
		setCategory(null);
	};

	const queueLabel = FILTERS.find((option) => option.value === filter)?.label ?? 'Unassigned';
	const screenState: AdminScreenState = loading && !items.length
		? { kind: 'loading', variant: 'list' }
		: error && !items.length
			? { kind: 'error', title: 'Support queue could not be loaded', message: error }
			: !visibleItems.length
				? {
					kind: 'empty',
					icon: 'life-buoy',
					title: 'No tickets match this queue.',
					description: filter === 'unassigned' ? 'New tickets appear here until someone claims them.' : undefined,
					filtered: isNarrowed,
					onClearFilters: handleClearNarrowing,
				}
				: { kind: 'ready' };

	return (
		<AdminScreen
			title="Support tickets"
			subtitle="Administrator & developer queue"
			// app/admin/_layout.tsx gates /admin; the /help staff route is gated by the server.
			gate="none"
			backFallback={isAdminRoute ? '/admin' : '/help'}
			showHubShortcut={isAdminRoute}
			state={screenState}
			refreshing={refreshing}
			onRefresh={() => load('refresh')}
			toolbar={(
				<AdminToolbar
					search={{ value: query, placeholder: 'Search reference, subject, requester', onChange: setQuery }}
					filters={{ groups: filterGroups, onApply: handleApplyFilters, title: 'Filter tickets' }}
					resultSummary={loading && !items.length ? queueLabel : `${queueLabel} · ${visibleItems.length}${isNarrowed ? ` of ${items.length}` : ''}`}
				/>
			)}
		>
			<View style={{ gap: space.sm }}>
				{error ? <AdminState kind="inlineError" message={error} onRetry={() => void load('refresh')} /> : null}
				{visibleItems.map((ticket) => (
					<AdminListRow
						key={ticket.id}
						title={ticket.subject}
						subtitle={`${ticket.reference} · ${ticket.requesterDisplayName} · ${SUPPORT_TICKET_CATEGORY_LABELS[ticket.category]}`}
						meta={ticket.assignedStaff ? `Assigned to ${ticket.assignedStaff.displayName}` : 'Waiting for claim'}
						leading={{ kind: 'icon', name: ticket.priority === 'urgent' ? 'alert-triangle' : 'life-buoy', tone: ticket.priority === 'urgent' ? 'danger' : ticket.assignedStaff ? 'neutral' : 'pending' }}
						status={{ label: `${STATUS_LABELS[ticket.status]}${ticket.priority === 'urgent' ? ' · Urgent' : ''}`, tone: ticket.priority === 'urgent' ? 'danger' : STATUS_TONES[ticket.status] }}
						onPress={() => router.push(`${detailRoutePrefix}/${ticket.id}` as Href)}
						accessibilityHint="Opens the ticket"
					/>
				))}
			</View>
		</AdminScreen>
	);
}
