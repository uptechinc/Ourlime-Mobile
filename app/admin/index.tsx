import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import AdminListRow from '@/components/admin/AdminListRow';
import AdminScreen, { type AdminOverflowItem } from '@/components/admin/AdminScreen';
import AdminSection from '@/components/admin/AdminSection';
import AdminStatCard, { AdminStatGrid } from '@/components/admin/AdminStatCard';
import AdminState from '@/components/admin/AdminState';
import { AdminOverviewSkeleton } from '@/components/admin/AdminSkeletons';
import { space, type AdminIconName, type AdminToneName } from '@/lib/admin/adminTokens';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { usePendingApprovalsCount } from '@/lib/hooks/usePendingApprovalsCount';
import { AdminMetricsService, type AdminMetrics } from '@/lib/services/AdminMetricsService';
import { formatPendingCount } from '@/lib/services/PendingApprovalsRules';
import { pendingApprovalsService } from '@/lib/services/PendingApprovalsService';
import type { PendingApprovalCategoryKey, PendingApprovalsSnapshot } from '@/lib/types/pendingApprovals';

const adminMetricsService = AdminMetricsService.getInstance();

/**
 * Old `/admin?section=<x>` links (profile tab, notifications, bookmarks) open the standalone screens that replaced
 * the hub's tab bar. `overview` (and no section) stays on the hub.
 */
const SECTION_ROUTES: { readonly [section: string]: Href } = {
	users: '/admin/user-management',
	'user-management': '/admin/user-management',
	moderation: '/admin/moderation',
	reports: '/admin/moderation',
	page_access: '/admin/page-access',
	'page-access': '/admin/page-access',
	security: '/admin/security',
	seller_review: '/admin/seller-review' as Href,
	'seller-review': '/admin/seller-review' as Href,
};

type WorkspaceLink = {
	id: string;
	title: string;
	description: string;
	icon: AdminIconName;
	route: Href;
	/** Only for beta or restricted entries. */
	badge?: { label: string; tone: AdminToneName };
};

type WorkspaceGroup = { id: string; title: string; links: readonly WorkspaceLink[] };

const WORKSPACE_GROUPS: readonly WorkspaceGroup[] = [
	{
		id: 'people',
		title: 'People',
		links: [
			{ id: 'user-management', title: 'User management', description: 'Roles, account status, archive and restore', icon: 'users', route: '/admin/user-management' },
			{ id: 'testers', title: 'Testers', description: 'Beta applications and registration mode', icon: 'user-check', route: '/admin/testers' },
		],
	},
	{
		id: 'content',
		title: 'Content',
		links: [
			{ id: 'moderation', title: 'Moderation', description: 'Reports, appeals and deleted content', icon: 'flag', route: '/admin/moderation' },
			{ id: 'communities', title: 'Communities', description: 'Community records and status', icon: 'users', route: '/admin/communities' },
			{ id: 'community-categories', title: 'Community categories', description: 'Categories shown in the directory', icon: 'layers', route: '/admin/community-categories' },
			{ id: 'stickers', title: 'Stickers', description: 'Sticker packs and review', icon: 'smile', route: '/admin/stickers' },
			{ id: 'elearning-review', title: 'E-Learning review', description: 'Instructor applications and courses', icon: 'book-open', route: '/admin/elearning-review' },
			{ id: 'game-content', title: 'Game content', description: 'Locations and words for games', icon: 'map-pin', route: '/admin/game-content' },
		],
	},
	{
		id: 'commerce',
		title: 'Commerce',
		links: [
			{ id: 'seller-review', title: 'Seller review', description: 'Seller verification applications', icon: 'shopping-cart', route: '/admin/seller-review' as Href },
			{ id: 'products', title: 'Products', description: 'Market listings and status', icon: 'shopping-bag', route: '/admin/products' },
			{ id: 'categories', title: 'Categories', description: 'Market categories', icon: 'tag', route: '/admin/categories' },
			{ id: 'couriers', title: 'Couriers', description: 'Courier registrations', icon: 'truck', route: '/admin/couriers' },
			{ id: 'pet-adoption', title: 'Pet adoption', description: 'Adoption listings', icon: 'heart', route: '/admin/pet-adoption' },
			{ id: 'jobs', title: 'Jobs', description: 'Job listings and approvals', icon: 'briefcase', route: '/admin/jobs' },
		],
	},
	{
		id: 'safety',
		title: 'Safety and support',
		links: [
			{ id: 'child-safety', title: 'Child safety', description: 'Restricted case review', icon: 'shield', route: '/admin/child-safety', badge: { label: 'Restricted', tone: 'pending' } },
			{ id: 'support', title: 'Support tickets', description: 'Member help requests', icon: 'life-buoy', route: '/admin/support' },
		],
	},
	{
		id: 'system',
		title: 'System',
		links: [
			{ id: 'page-access', title: 'Page access', description: 'Availability, maintenance and Coming Soon', icon: 'layers', route: '/admin/page-access' },
			{ id: 'security', title: 'Security', description: 'IP rules, whitelist and access settings', icon: 'lock', route: '/admin/security' },
			{ id: 'analytics', title: 'Analytics', description: 'Platform collection totals', icon: 'bar-chart-2', route: '/admin/analytics' },
			{ id: 'activity-logs', title: 'Activity logs', description: 'Audit trail and restores', icon: 'clock', route: '/admin/activity-logs' },
		],
	},
];

type AttentionCard = { key: PendingApprovalCategoryKey; label: string; icon: AdminIconName; route: Href };

const ATTENTION_CARDS: readonly AttentionCard[] = [
	{ key: 'reports', label: 'Open reports', icon: 'flag', route: '/admin/moderation' },
	{ key: 'childSafety', label: 'Child safety', icon: 'shield', route: '/admin/child-safety' },
	{ key: 'support', label: 'Support tickets', icon: 'life-buoy', route: '/admin/support' },
];

/** Short nouns for the "what's waiting" breakdown: [one, many]. */
const QUEUE_NOUNS: { [key in PendingApprovalCategoryKey]: [string, string] } = {
	couriers: ['courier', 'couriers'],
	sellers: ['seller', 'sellers'],
	products: ['listing', 'listings'],
	pets: ['pet listing', 'pet listings'],
	jobs: ['job', 'jobs'],
	courses: ['course', 'courses'],
	instructors: ['instructor', 'instructors'],
	identity: ['ID check', 'ID checks'],
	beta: ['tester application', 'tester applications'],
	reports: ['report', 'reports'],
	appeals: ['appeal', 'appeals'],
	childSafety: ['child-safety case', 'child-safety cases'],
	support: ['support ticket', 'support tickets'],
};

/**
 * "13 reports · 9 jobs · 3 more": the biggest queues behind the pending total, so the total is not read as a
 * separate number from the report and ticket cards (those queues are part of it).
 */
function describePendingBreakdown(snapshot: PendingApprovalsSnapshot | null): string | null {
	if (!snapshot) return null;
	const waiting = snapshot.queues
		.flatMap((queue) => (queue.status === 'ready' && queue.count > 0 ? [{ key: queue.key, count: queue.count }] : []))
		.sort((first, second) => second.count - first.count);
	if (waiting.length === 0) return null;
	const shown = waiting.slice(0, 2).map(({ key, count }) => `${count} ${QUEUE_NOUNS[key][count === 1 ? 0 : 1]}`);
	const rest = waiting.slice(2).reduce((sum, queue) => sum + queue.count, 0);
	return [...shown, ...(rest > 0 ? [`${rest} more`] : [])].join(' · ');
}

/** Per-queue counts from the snapshot the pending-approvals badge already loads (no extra fetch). */
function usePendingSnapshot(): PendingApprovalsSnapshot | null {
	const [snapshot, setSnapshot] = useState<PendingApprovalsSnapshot | null>(() => pendingApprovalsService.peek());
	useEffect(() => {
		const unsubscribe = pendingApprovalsService.subscribe(setSnapshot);
		const cached = pendingApprovalsService.peek();
		if (cached) setSnapshot(cached);
		return unsubscribe;
	}, []);
	return snapshot;
}

export default function AdminPortalScreen() {
	const router = useRouter();
	const { section } = useLocalSearchParams<{ section?: string }>();
	const { authorization, loading: accessLoading } = usePageAccess();
	const pendingApprovals = usePendingApprovalsCount();
	const pendingSnapshot = usePendingSnapshot();
	const [loading, setLoading] = useState(true);
	const [stats, setStats] = useState<AdminMetrics>({
		usersCount: 0,
		postsCount: 0,
		reelsCount: 0,
		eventsCount: 0,
		reportsCount: 0,
	});
	const [error, setError] = useState<string | null>(null);
	const [refreshing, setRefreshing] = useState(false);
	const hasStatsRef = useRef(false);
	const [hasStats, setHasStats] = useState(false);
	const { refresh: refreshPendingApprovals } = pendingApprovals;
	const redirectTarget = section ? SECTION_ROUTES[section] : undefined;

	// `force` bypasses the service's 5-minute cache (pull-to-refresh, Retry). The skeleton only shows
	// before the first successful load, so refetching on focus does not blank the overview.
	const fetchAdminStats = useCallback(async (force = false) => {
		try {
			if (!hasStatsRef.current) setLoading(true);
			setError(null);
			setStats(await adminMetricsService.fetchMetrics(force));
			hasStatsRef.current = true;
			setHasStats(true);
		} catch (err: unknown) {
			console.error('[AdminPortal.fetchAdminStats] Error:', err);
			setError(err instanceof Error ? err.message : 'Could not load admin metrics.');
		} finally {
			setLoading(false);
		}
	}, []);

	// Refetch when returning from a workspace (deleting users, resolving reports, approvals) so the
	// counts and the pending-approvals badge do not stay stale.
	useFocusEffect(
		useCallback(() => {
			if (redirectTarget || accessLoading || !authorization.isAdmin) return;
			void fetchAdminStats();
			refreshPendingApprovals();
		}, [redirectTarget, accessLoading, authorization.isAdmin, fetchAdminStats, refreshPendingApprovals])
	);

	const handleRefresh = async () => {
		setRefreshing(true);
		// The badge and the attention cards follow this snapshot through the service's subscribers.
		pendingApprovalsService.fetchSummary(true).catch((refreshError: unknown) => {
			console.warn(`[AdminPortal.handleRefresh] Error: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`);
		});
		await fetchAdminStats(true);
		setRefreshing(false);
	};

	if (redirectTarget) return <Redirect href={redirectTarget} />;

	const overflowActions: AdminOverflowItem[] = [
		{ key: 'activity-logs', label: 'Activity logs', icon: 'clock', onPress: () => router.push('/admin/activity-logs' as Href) },
		{ key: 'seed-stickers', label: 'Seed stickers', icon: 'download-cloud', description: 'Developer tool: import the default sticker packs', onPress: () => router.push('/admin/seed-stickers' as Href) },
	];

	const pendingLabel = formatPendingCount(pendingApprovals.total, pendingApprovals.totalIsLowerBound);
	const pendingBreakdown = describePendingBreakdown(pendingSnapshot);
	const showFullError = Boolean(error) && !hasStats;

	const renderAttentionCard = (card: AttentionCard) => {
		const queue = pendingSnapshot?.queues.find((entry) => entry.key === card.key);
		const isReady = queue?.status === 'ready';
		const count = isReady ? queue.count : 0;
		return (
			<AdminStatCard
				key={card.key}
				label={card.label}
				icon={card.icon}
				value={isReady ? formatPendingCount(queue.count, queue.countIsLowerBound) : '—'}
				hint={queue?.status === 'error' ? "Couldn't load" : undefined}
				tone={count > 0 ? 'pending' : 'neutral'}
				loading={!pendingSnapshot}
				compact
				onPress={() => router.push(card.route)}
			/>
		);
	};

	return (
		<AdminScreen
			title="Admin"
			subtitle="Platform overview and workspaces"
			showHubShortcut={false}
			backFallback="/(tabs)"
			state={
				loading && !hasStats
					? { kind: 'loading' }
					: showFullError
						? { kind: 'error', message: error ?? 'Could not load admin metrics.' }
						: { kind: 'ready' }
			}
			skeleton={<AdminOverviewSkeleton />}
			onRefresh={handleRefresh}
			refreshing={refreshing}
			overflowActions={overflowActions}
		>
			<View style={{ gap: space.xl }}>
				{error && hasStats ? <AdminState kind="inlineError" message={error} onRetry={() => void fetchAdminStats(true)} /> : null}

				<AdminSection title="Needs attention" description="The total counts every queue, including the reports, child-safety cases and tickets below.">
					<AdminListRow
						title="Everything waiting"
						subtitle={pendingApprovals.total > 0 ? pendingBreakdown ?? 'Listings, applications, reports and more' : 'Nothing waiting for review'}
						leading={{ kind: 'icon', name: 'check-square', tone: pendingApprovals.total > 0 ? 'pending' : 'neutral' }}
						status={pendingApprovals.total > 0 ? { label: `${pendingLabel} in total`, tone: 'pending' } : undefined}
						accessibilityHint="Opens the pending approvals queue"
						onPress={() => router.push('/admin/approvals' as Href)}
					/>
					<AdminStatGrid>{ATTENTION_CARDS.map(renderAttentionCard)}</AdminStatGrid>
				</AdminSection>

				<AdminSection title="Metrics" description="Live platform totals. Pull down to refresh.">
					<AdminStatGrid>
						<AdminStatCard label="Users" icon="users" value={stats.usersCount.toLocaleString()} />
						<AdminStatCard label="Posts" icon="file-text" value={stats.postsCount.toLocaleString()} />
						<AdminStatCard label="Limes" icon="video" value={stats.reelsCount.toLocaleString()} />
						<AdminStatCard label="Events" icon="calendar" value={stats.eventsCount.toLocaleString()} />
						<AdminStatCard label="All reports" hint="Ever filed, including resolved" icon="flag" value={stats.reportsCount.toLocaleString()} onPress={() => router.push('/admin/moderation' as Href)} />
					</AdminStatGrid>
				</AdminSection>

				{WORKSPACE_GROUPS.map((group) => (
					<AdminSection key={group.id} title={group.title}>
						<View style={{ gap: space.sm }}>
							{group.links.map((link) => (
								<AdminListRow
									key={link.id}
									title={link.title}
									subtitle={link.description}
									leading={{ kind: 'icon', name: link.icon }}
									status={link.badge}
									onPress={() => router.push(link.route)}
								/>
							))}
						</View>
					</AdminSection>
				))}
			</View>
		</AdminScreen>
	);
}
