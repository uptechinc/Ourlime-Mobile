import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import AdminScreen, { type AdminScreenState } from '@/components/admin/AdminScreen';
import AdminSection from '@/components/admin/AdminSection';
import AdminStatCard, { AdminStatGrid } from '@/components/admin/AdminStatCard';
import AdminState from '@/components/admin/AdminState';
import AdminToolbar from '@/components/admin/AdminToolbar';
import type { AnyFilterGroup, FilterValues } from '@/components/ui/FilterSheet';
import { readSingleFilter } from '@/components/ui/FilterSheet';
import { getAdminTone, space, type, type AdminIconName } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { AdminWorkspaceService, type AdminAnalyticsSnapshot } from '@/lib/services/AdminWorkspaceService';

const workspaceService = AdminWorkspaceService.getInstance();

type AnalyticsDomain = AdminAnalyticsSnapshot['metrics'][number]['domain'];
type DomainFilter = AnalyticsDomain | 'all';

const DOMAIN_LABELS: { readonly [domain in DomainFilter]: string } = {
	all: 'All domains',
	audience: 'Audience',
	social: 'Social',
	communities: 'Communities',
	events: 'Events',
	marketplace: 'Marketplace',
	administration: 'Administration',
};

const DOMAIN_ICONS: { readonly [domain in AnalyticsDomain]: AdminIconName } = {
	audience: 'users',
	social: 'message-circle',
	communities: 'layers',
	events: 'calendar',
	marketplace: 'shopping-bag',
	administration: 'shield',
};

const DOMAIN_OPTIONS = (Object.keys(DOMAIN_LABELS) as DomainFilter[]).map((value) => ({ value, label: DOMAIN_LABELS[value] }));

const isDomainFilter = (value: string | undefined): value is DomainFilter => value !== undefined && value in DOMAIN_LABELS;

export default function AdminAnalyticsWorkspace() {
	const { colors } = useAppTheme();
	const pending = getAdminTone(colors, 'pending');
	const [snapshot, setSnapshot] = useState<AdminAnalyticsSnapshot>({
		metrics: [],
		unavailableCollections: [],
	});
	const [hasLoaded, setHasLoaded] = useState(false);
	const [domain, setDomain] = useState<DomainFilter>('all');
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async (isRefresh = false) => {
		if (isRefresh) setRefreshing(true);
		else setLoading(true);
		setError(null);
		try {
			setSnapshot(await workspaceService.fetchAnalytics());
			setHasLoaded(true);
		} catch (loadError: unknown) {
			console.error('[AdminAnalyticsWorkspace.load] Error:', loadError);
			setError(loadError instanceof Error ? loadError.message : 'Analytics could not be loaded.');
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const metrics = useMemo(
		() => (domain === 'all' ? snapshot.metrics : snapshot.metrics.filter((metric) => metric.domain === domain)),
		[domain, snapshot.metrics]
	);
	const totalActivity = metrics.reduce((sum, metric) => sum + metric.count, 0);

	const filterGroups: AnyFilterGroup[] = [
		{ key: 'domain', label: 'Domain', options: DOMAIN_OPTIONS, value: domain, defaultValue: 'all' },
	];
	const handleApplyFilters = (next: FilterValues) => {
		const nextDomain = readSingleFilter(next, 'domain');
		setDomain(isDomainFilter(nextDomain) ? nextDomain : 'all');
	};

	const screenState: AdminScreenState =
		loading && !hasLoaded
			? { kind: 'loading', variant: 'cards' }
			: error && !hasLoaded
				? { kind: 'error', message: error }
				: metrics.length === 0
					? domain === 'all'
						? { kind: 'empty', title: 'No analytics yet', description: 'No collection totals were returned. Pull down to refresh.', icon: 'bar-chart-2' }
						: {
								kind: 'empty',
								title: `No data for ${DOMAIN_LABELS[domain]} yet`,
								description: 'Try another domain, or show every domain.',
								icon: 'bar-chart-2',
								filtered: true,
								onClearFilters: () => setDomain('all'),
							}
					: { kind: 'ready' };

	return (
		<AdminScreen
			title="Analytics"
			subtitle="Live platform collection totals"
			state={screenState}
			onRefresh={() => load(true)}
			refreshing={refreshing}
			toolbar={
				<AdminToolbar
					filters={{ groups: filterGroups, onApply: handleApplyFilters, title: 'Analytics filters' }}
					resultSummary={hasLoaded ? `${metrics.length} of ${snapshot.metrics.length} metrics` : undefined}
				/>
			}
		>
			<View style={{ gap: space.xl }}>
				{error ? <AdminState kind="inlineError" message={error} onRetry={() => void load(true)} retrying={refreshing} /> : null}
				<AdminStatCard
					label="Tracked platform activity"
					value={totalActivity.toLocaleString()}
					hint={domain === 'all' ? 'Every domain. Pull down to refresh.' : `${DOMAIN_LABELS[domain]} only`}
					icon="activity"
				/>
				<AdminStatGrid>
					{metrics.map((metric) => (
						<AdminStatCard
							key={metric.id}
							label={metric.label}
							value={metric.count.toLocaleString()}
							hint={DOMAIN_LABELS[metric.domain]}
							icon={DOMAIN_ICONS[metric.domain]}
						/>
					))}
				</AdminStatGrid>
				{snapshot.unavailableCollections.length ? (
					<AdminSection tone="pending" title="Some totals are missing">
						<Text style={[type.body, { color: pending.text }]}>
							These collections could not be counted: {snapshot.unavailableCollections.join(', ')}.
						</Text>
					</AdminSection>
				) : null}
			</View>
		</AdminScreen>
	);
}
