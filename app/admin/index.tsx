import { useEffect, useState } from 'react';
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	ActivityIndicator,
	StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
	AdminMetricsService,
	type AdminMetrics,
} from '@/lib/services/AdminMetricsService';
import PageAccessAdminSection from '@/components/admin/PageAccessAdminSection';
import UserManagementSection from '@/components/admin/UserManagementSection';
import ModerationSection from '@/components/admin/ModerationSection';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const adminMetricsService = AdminMetricsService.getInstance();

const REMAINING_ADMIN_WORKSPACES = [
	{
		id: 'support',
		title: 'Support Tickets',
		icon: 'help-circle' as const,
		route: '/admin/support' as Href,
	},
	{
		id: 'child-safety',
		title: 'Child Safety',
		icon: 'shield' as const,
		route: '/admin/child-safety' as Href,
	},
	{
		id: 'analytics',
		title: 'Analytics',
		icon: 'bar-chart-2' as const,
		route: '/admin/analytics' as Href,
	},
	{
		id: 'testers',
		title: 'Testers',
		icon: 'user-check' as const,
		route: '/admin/testers' as Href,
	},
	{
		id: 'stickers',
		title: 'Stickers',
		icon: 'smile' as const,
		route: '/admin/stickers' as Href,
	},
	{
		id: 'products',
		title: 'Products',
		icon: 'shopping-bag' as const,
		route: '/admin/products' as Href,
	},
	{
		id: 'categories',
		title: 'Categories',
		icon: 'tag' as const,
		route: '/admin/categories' as Href,
	},
	{
		id: 'community-categories',
		title: 'Community Categories',
		icon: 'layers' as const,
		route: '/admin/community-categories' as Href,
	},
	{
		id: 'communities',
		title: 'Communities',
		icon: 'users' as const,
		route: '/admin/communities' as Href,
	},
] as const;

export default function AdminPortalScreen() {
	const router = useRouter();
	const { section } = useLocalSearchParams<{ section?: string }>();
	const { authorization, loading: accessLoading } = usePageAccess();
	const { colors } = useAppTheme();
	const [activeSection, setActiveSection] = useState<
		'overview' | 'users' | 'moderation' | 'page_access'
	>('overview');
	const [loading, setLoading] = useState(true);
	const [stats, setStats] = useState<AdminMetrics>({
		usersCount: 0,
		postsCount: 0,
		reelsCount: 0,
		eventsCount: 0,
		reportsCount: 0,
	});
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (
			section === 'users' ||
			section === 'moderation' ||
			section === 'page_access' ||
			section === 'overview'
		)
			setActiveSection(section);
	}, [section]);

	const fetchAdminStats = async () => {
		try {
			setLoading(true);
			setError(null);
			setStats(await adminMetricsService.fetchMetrics());
		} catch (err: unknown) {
			console.error('[AdminPortal] Error loading stats:', err);
			setError(
				err instanceof Error ? err.message : 'Could not load admin metrics.'
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!accessLoading && authorization.isAdmin) void fetchAdminStats();
	}, [accessLoading, authorization.isAdmin]);

	const handleBack = () => {
		if (router.canGoBack()) {
			router.back();
			return;
		}
		router.replace('/(tabs)');
	};

	return (
		<SafeAreaView
			edges={['top', 'left', 'right']}
			style={[styles.container, { backgroundColor: colors.canvas }]}
		>
			{/* Header */}
			<View
				style={[
					styles.header,
					{ backgroundColor: colors.surface, borderBottomColor: colors.border },
				]}
			>
				<TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
					<Icon name="arrow-left" size={24} color={colors.icon} />
				</TouchableOpacity>
				<Text style={[styles.headerTitle, { color: colors.text }]}>
					Admin Portal
				</Text>
				<View style={{ width: 32 }} />
			</View>

			{accessLoading ? (
				<View style={styles.center}>
					<ActivityIndicator size="large" color="#10b981" />
				</View>
			) : !authorization.isAdmin ? (
				<View style={styles.center}>
					<Icon name="lock" size={38} color="#c64d53" />
					<Text style={[styles.deniedTitle, { color: colors.text }]}>
						Admin access required
					</Text>
					<Text style={[styles.deniedText, { color: colors.mutedText }]}>
						Your account does not have permission to open the administration
						workspace.
					</Text>
					<TouchableOpacity onPress={handleBack} style={styles.deniedButton}>
						<Text style={styles.deniedButtonText}>Go Back</Text>
					</TouchableOpacity>
				</View>
			) : (
				<>
					<View
						style={{
							flexDirection: 'row',
							paddingHorizontal: 10,
							paddingVertical: 10,
							backgroundColor: colors.surface,
							borderBottomWidth: 1,
							borderBottomColor: colors.border,
						}}
					>
						{(
							[
								{ key: 'overview', label: 'Overview', icon: 'grid' },
								{ key: 'users', label: 'Users', icon: 'users' },
								{ key: 'moderation', label: 'Reports', icon: 'flag' },
								{ key: 'page_access', label: 'Access', icon: 'shield' },
							] as const
						).map((section) => (
							<TouchableOpacity
								key={section.key}
								onPress={() => setActiveSection(section.key)}
								style={{
									flex: 1,
									flexDirection: 'row',
									alignItems: 'center',
									justifyContent: 'center',
									borderRadius: 13,
									paddingVertical: 10,
									backgroundColor:
										activeSection === section.key ? '#10b981' : 'transparent',
								}}
							>
								<Icon
									name={section.icon}
									size={16}
									color={
										activeSection === section.key ? '#ffffff' : colors.icon
									}
								/>
								<Text
									style={{
										marginLeft: 7,
										color:
											activeSection === section.key
												? '#ffffff'
												: colors.mutedText,
										fontWeight: '800',
									}}
								>
									{section.label}
								</Text>
							</TouchableOpacity>
						))}
					</View>
					{activeSection === 'page_access' ? (
						<ScrollView
							style={{ flex: 1 }}
							contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
						>
							<PageAccessAdminSection />
						</ScrollView>
					) : activeSection === 'users' ? (
						<ScrollView
							style={{ flex: 1 }}
							contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
						>
							<UserManagementSection />
						</ScrollView>
					) : activeSection === 'moderation' ? (
						<ScrollView
							style={{ flex: 1 }}
							contentContainerStyle={{ padding: 16, paddingBottom: 50 }}
						>
							<ModerationSection />
						</ScrollView>
					) : loading ? (
						<View style={styles.center}>
							<ActivityIndicator size="large" color="#10b981" />
							<Text style={{ marginTop: 12, color: colors.mutedText }}>
								Loading admin dashboard…
							</Text>
						</View>
					) : error ? (
						<View style={styles.center}>
							<Icon
								name="alert-triangle"
								size={34}
								color={colors.destructive}
							/>
							<Text style={{ marginTop: 10, color: colors.destructiveText }}>
								{error}
							</Text>
							<TouchableOpacity
								onPress={() => void fetchAdminStats()}
								style={{
									marginTop: 14,
									paddingHorizontal: 18,
									paddingVertical: 10,
									borderRadius: 999,
									backgroundColor: colors.accent,
								}}
							>
								<Text style={{ color: colors.onAccent, fontWeight: '700' }}>
									Retry
								</Text>
							</TouchableOpacity>
						</View>
					) : (
						<ScrollView
							style={{ flex: 1 }}
							contentContainerStyle={{ padding: 20, gap: 16 }}
						>
							<Text style={[styles.sectionTitle, { color: colors.text }]}>
								Overview & Metrics
							</Text>

							{/* Metric Cards */}
							<View style={styles.grid}>
								<View
									style={[
										styles.metricCard,
										{
											backgroundColor: colors.surface,
											borderColor: colors.border,
										},
									]}
								>
									<Icon name="users" size={22} color="#10b981" />
									<Text style={[styles.metricVal, { color: colors.text }]}>
										{stats.usersCount}
									</Text>
									<Text
										style={[styles.metricLabel, { color: colors.mutedText }]}
									>
										Total Users
									</Text>
								</View>
								<View
									style={[
										styles.metricCard,
										{
											backgroundColor: colors.surface,
											borderColor: colors.border,
										},
									]}
								>
									<Icon name="file-text" size={22} color="#3b82f6" />
									<Text style={[styles.metricVal, { color: colors.text }]}>
										{stats.postsCount}
									</Text>
									<Text
										style={[styles.metricLabel, { color: colors.mutedText }]}
									>
										Total Posts
									</Text>
								</View>
								<View
									style={[
										styles.metricCard,
										{
											backgroundColor: colors.surface,
											borderColor: colors.border,
										},
									]}
								>
									<Icon name="video" size={22} color="#8b5cf6" />
									<Text style={[styles.metricVal, { color: colors.text }]}>
										{stats.reelsCount}
									</Text>
									<Text
										style={[styles.metricLabel, { color: colors.mutedText }]}
									>
										Total Limes
									</Text>
								</View>
								<View
									style={[
										styles.metricCard,
										{
											backgroundColor: colors.surface,
											borderColor: colors.border,
										},
									]}
								>
									<Icon name="calendar" size={22} color="#f59e0b" />
									<Text style={[styles.metricVal, { color: colors.text }]}>
										{stats.eventsCount}
									</Text>
									<Text
										style={[styles.metricLabel, { color: colors.mutedText }]}
									>
										Events
									</Text>
								</View>
								<View
									style={[
										styles.metricCard,
										{
											backgroundColor: colors.surface,
											borderColor: colors.border,
										},
									]}
								>
									<Icon name="flag" size={22} color="#c64d53" />
									<Text style={[styles.metricVal, { color: colors.text }]}>
										{stats.reportsCount}
									</Text>
									<Text
										style={[styles.metricLabel, { color: colors.mutedText }]}
									>
										Reports
									</Text>
								</View>
							</View>

							<View
								style={[
									styles.notice,
									{ backgroundColor: colors.successSurface },
								]}
							>
								<Icon name="shield" size={20} color={colors.accent} />
								<Text
									style={[styles.noticeText, { color: colors.successText }]}
								>
									Admin tools are role-gated and use authenticated server
									operations.
								</Text>
							</View>
							<View
								style={[
									styles.pendingSection,
									{
										backgroundColor: colors.surface,
										borderColor: colors.border,
									},
								]}
							>
								<Text style={[styles.sectionTitle, { color: colors.text }]}>
									Additional Workspaces
								</Text>
								<Text
									style={[styles.pendingIntro, { color: colors.mutedText }]}
								>
									Open native administration workspaces for live platform
									records and role-gated controls.
								</Text>
								{REMAINING_ADMIN_WORKSPACES.map((workspace) => (
									<TouchableOpacity
										key={workspace.id}
										onPress={() => router.push(workspace.route)}
										style={[
											styles.pendingRow,
											{ borderTopColor: colors.border },
										]}
									>
										<Icon name={workspace.icon} size={19} color={colors.icon} />
										<Text
											style={[styles.pendingRowTitle, { color: colors.text }]}
										>
											{workspace.title}
										</Text>
										<Text
											style={[
												styles.webBadge,
												{
													backgroundColor: colors.control,
													color: colors.secondaryText,
												},
											]}
										>
											LIVE
										</Text>
										<Icon
											name="chevron-right"
											size={18}
											color={colors.mutedText}
										/>
									</TouchableOpacity>
								))}
							</View>
						</ScrollView>
					)}
				</>
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#f8fafc' },
	center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 14,
		backgroundColor: '#ffffff',
		borderBottomWidth: 1,
		borderBottomColor: '#e2e8f0',
	},
	backBtn: { padding: 4 },
	headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
	sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
	grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
	metricCard: {
		width: '47%',
		padding: 16,
		borderRadius: 16,
		backgroundColor: '#ffffff',
		borderWidth: 1,
		borderColor: '#e2e8f0',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.04,
		shadowRadius: 6,
		elevation: 2,
	},
	metricVal: {
		fontSize: 24,
		fontWeight: '800',
		color: '#0f172a',
		marginTop: 8,
	},
	metricLabel: {
		fontSize: 12,
		color: '#64748b',
		fontWeight: '600',
		marginTop: 2,
	},
	notice: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		padding: 16,
		borderRadius: 16,
		backgroundColor: '#ecfdf5',
	},
	noticeText: { flex: 1, fontSize: 13, color: '#047857', lineHeight: 19 },
	deniedTitle: {
		marginTop: 14,
		fontSize: 20,
		fontWeight: '900',
		color: '#0f172a',
	},
	deniedText: {
		maxWidth: 320,
		marginTop: 8,
		paddingHorizontal: 18,
		textAlign: 'center',
		lineHeight: 20,
		color: '#64748b',
	},
	deniedButton: {
		marginTop: 20,
		borderRadius: 999,
		backgroundColor: '#10b981',
		paddingHorizontal: 20,
		paddingVertical: 11,
	},
	deniedButtonText: { color: '#ffffff', fontWeight: '800' },
	pendingSection: {
		padding: 16,
		borderRadius: 16,
		backgroundColor: '#ffffff',
		borderWidth: 1,
		borderColor: '#e2e8f0',
	},
	pendingIntro: {
		marginTop: 6,
		marginBottom: 8,
		fontSize: 12,
		lineHeight: 18,
		color: '#64748b',
	},
	pendingRow: {
		minHeight: 48,
		flexDirection: 'row',
		alignItems: 'center',
		borderTopWidth: 1,
		borderTopColor: '#f1f5f9',
	},
	pendingRowTitle: {
		flex: 1,
		marginLeft: 10,
		color: '#334155',
		fontWeight: '700',
	},
	webBadge: {
		marginRight: 8,
		borderRadius: 999,
		paddingHorizontal: 7,
		paddingVertical: 3,
		overflow: 'hidden',
		backgroundColor: '#e2e8f0',
		color: '#475569',
		fontSize: 10,
		fontWeight: '900',
	},
});
