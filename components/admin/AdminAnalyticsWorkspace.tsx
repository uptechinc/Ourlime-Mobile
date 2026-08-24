import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import AdminWorkspaceShell from './AdminWorkspaceShell';
import {
	AdminWorkspaceService,
	type AdminAnalyticsSnapshot,
} from '@/lib/services/AdminWorkspaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const workspaceService = AdminWorkspaceService.getInstance();
const DOMAINS: readonly (
	AdminAnalyticsSnapshot['metrics'][number]['domain'] | 'all'
)[] = [
	'all',
	'audience',
	'social',
	'communities',
	'events',
	'marketplace',
	'administration',
];

export default function AdminAnalyticsWorkspace() {
	const { colors } = useAppTheme();
	const [snapshot, setSnapshot] = useState<AdminAnalyticsSnapshot>({
		metrics: [],
		unavailableCollections: [],
	});
	const [domain, setDomain] = useState<(typeof DOMAINS)[number]>('all');
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async (isRefresh = false) => {
		if (isRefresh) setRefreshing(true);
		else setLoading(true);
		setError(null);
		try {
			setSnapshot(await workspaceService.fetchAnalytics());
		} catch (loadError: unknown) {
			setError(
				loadError instanceof Error
					? loadError.message
					: 'Analytics could not be loaded.'
			);
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);
	const metrics = useMemo(
		() =>
			domain === 'all'
				? snapshot.metrics
				: snapshot.metrics.filter((metric) => metric.domain === domain),
		[domain, snapshot.metrics]
	);
	const totalActivity = snapshot.metrics.reduce(
		(sum, metric) => sum + metric.count,
		0
	);

	return (
		<AdminWorkspaceShell
			title="Admin Analytics"
			subtitle="Live platform collection and engagement signals"
			loading={loading}
			refreshing={refreshing}
			error={error}
			onRefresh={() => void load(true)}
		>
			<View
				style={{ padding: 17, borderRadius: 18, backgroundColor: '#0f172a' }}
			>
				<Text
					style={{
						color: '#94a3b8',
						fontSize: 11,
						fontWeight: '800',
						textTransform: 'uppercase',
					}}
				>
					Tracked platform activity
				</Text>
				<Text
					style={{
						marginTop: 5,
						color: '#ffffff',
						fontSize: 30,
						fontWeight: '900',
					}}
				>
					{totalActivity.toLocaleString()}
				</Text>
				<Text style={{ marginTop: 4, color: '#cbd5e1', fontSize: 12 }}>
					Live canonical collection totals. Pull down to refresh.
				</Text>
			</View>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={{ marginVertical: 14 }}
			>
				{DOMAINS.map((domainOption) => (
					<TouchableOpacity
						key={domainOption}
						onPress={() => setDomain(domainOption)}
						style={{
							marginRight: 8,
							borderRadius: 999,
							paddingHorizontal: 12,
							paddingVertical: 8,
							backgroundColor:
								domain === domainOption ? colors.accent : colors.control,
						}}
					>
						<Text
							style={{
								color:
									domain === domainOption
										? colors.onAccent
										: colors.secondaryText,
								textTransform: 'capitalize',
								fontSize: 12,
								fontWeight: '800',
							}}
						>
							{domainOption}
						</Text>
					</TouchableOpacity>
				))}
			</ScrollView>
			<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
				{metrics.map((metric) => (
					<View
						key={metric.id}
						style={{
							width: '48%',
							minHeight: 112,
							padding: 15,
							borderRadius: 17,
							backgroundColor: colors.surface,
							borderWidth: 1,
							borderColor: colors.border,
						}}
					>
						<Icon
							name={
								metric.domain === 'audience'
									? 'users'
									: metric.domain === 'administration'
										? 'shield'
										: metric.domain === 'marketplace'
											? 'shopping-bag'
											: 'activity'
							}
							size={20}
							color={colors.accent}
						/>
						<Text
							style={{
								marginTop: 9,
								fontSize: 23,
								fontWeight: '900',
								color: colors.text,
							}}
						>
							{metric.count.toLocaleString()}
						</Text>
						<Text
							style={{
								marginTop: 3,
								color: colors.mutedText,
								fontSize: 12,
								fontWeight: '700',
							}}
						>
							{metric.label}
						</Text>
					</View>
				))}
			</View>
			{snapshot.unavailableCollections.length ? (
				<View
					style={{
						marginTop: 14,
						padding: 13,
						borderRadius: 14,
						backgroundColor: colors.warningSurface,
					}}
				>
					<Text
						style={{ color: colors.warningText, fontSize: 12, lineHeight: 18 }}
					>
						Some collections could not be counted:{' '}
						{snapshot.unavailableCollections.join(', ')}.
					</Text>
				</View>
			) : null}
		</AdminWorkspaceShell>
	);
}
