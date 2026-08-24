import { useCallback, useEffect, useState } from 'react';
import {
	ActivityIndicator,
	RefreshControl,
	ScrollView,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { childSafetyReportService } from '@/lib/services/ChildSafetyReportService';
import {
	CHILD_SAFETY_CATEGORY_LABELS,
	type ChildSafetyPriority,
	type ChildSafetyReportRecord,
	type ChildSafetyStatus,
} from '@/lib/types/childSafety';

type ChildSafetyCasesScreenProps = { detailRoutePrefix?: string };

export default function ChildSafetyCasesScreen({
	detailRoutePrefix = '/admin/child-safety',
}: ChildSafetyCasesScreenProps) {
	const router = useRouter();
	const { colors } = useAppTheme();
	const [items, setItems] = useState<ChildSafetyReportRecord[]>([]);
	const [priority, setPriority] = useState<ChildSafetyPriority | undefined>();
	const [status, setStatus] = useState<ChildSafetyStatus | undefined>();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [hasMore, setHasMore] = useState(false);

	const loadCases = useCallback(
		async (cursor: string | null = null) => {
			setError('');
			try {
				const page = await childSafetyReportService.listCases({
					priority,
					status,
					cursor: cursor ?? undefined,
				});
				setItems((current) =>
					cursor ? [...current, ...page.items] : page.items
				);
				setNextCursor(page.nextCursor);
				setHasMore(page.hasMore);
			} catch (loadError: unknown) {
				setError(
					loadError instanceof Error
						? loadError.message
						: 'Restricted cases could not be loaded.'
				);
			} finally {
				setLoading(false);
			}
		},
		[priority, status]
	);
	useEffect(() => {
		setLoading(true);
		void loadCases(null);
	}, [loadCases]);

	return (
		<SafeAreaView
			edges={['top', 'bottom', 'left', 'right']}
			style={{ flex: 1, backgroundColor: colors.canvas }}
		>
			<View
				style={{
					flexDirection: 'row',
					alignItems: 'center',
					padding: 14,
					borderBottomWidth: 1,
					borderBottomColor: colors.border,
					backgroundColor: colors.navigation,
				}}
			>
				<TouchableOpacity onPress={() => router.back()} style={{ padding: 5 }}>
					<Ionicons name="chevron-back" size={26} color={colors.icon} />
				</TouchableOpacity>
				<View style={{ flex: 1, marginLeft: 8 }}>
					<Text
						style={{
							color: colors.destructive,
							fontSize: 11,
							fontWeight: '900',
							textTransform: 'uppercase',
						}}
					>
						Restricted workspace
					</Text>
					<Text style={{ color: colors.text, fontSize: 19, fontWeight: '900' }}>
						Child Safety cases
					</Text>
				</View>
			</View>
			<ScrollView
				refreshControl={
					<RefreshControl
						refreshing={loading}
						onRefresh={() => void loadCases(null)}
						tintColor={colors.accent}
					/>
				}
				contentContainerStyle={{ padding: 15, paddingBottom: 35 }}
			>
				<Text
					style={{
						marginBottom: 7,
						color: colors.mutedText,
						fontSize: 11,
						fontWeight: '900',
						textTransform: 'uppercase',
					}}
				>
					Priority
				</Text>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={{ gap: 8, paddingBottom: 13 }}
				>
					{([undefined, 'critical', 'high', 'medium', 'standard'] as const).map(
						(option) => (
							<TouchableOpacity
								key={option ?? 'all'}
								onPress={() => setPriority(option)}
								style={{
									paddingHorizontal: 14,
									paddingVertical: 9,
									borderRadius: 999,
									backgroundColor:
										priority === option ? colors.destructive : colors.control,
								}}
							>
								<Text
									style={{
										color:
											priority === option ? '#ffffff' : colors.secondaryText,
										fontWeight: '800',
										textTransform: 'capitalize',
									}}
								>
									{option ?? 'All'}
								</Text>
							</TouchableOpacity>
						)
					)}
				</ScrollView>
				<Text
					style={{
						marginBottom: 7,
						color: colors.mutedText,
						fontSize: 11,
						fontWeight: '900',
						textTransform: 'uppercase',
					}}
				>
					Status
				</Text>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={{ gap: 8, paddingBottom: 13 }}
				>
					{(
						[
							undefined,
							'submitted',
							'under_review',
							'escalated',
							'action_required',
							'resolved',
							'reported_to_authority',
							'closed',
						] as const
					).map((option) => (
						<TouchableOpacity
							key={option ?? 'all'}
							onPress={() => setStatus(option)}
							style={{
								paddingHorizontal: 14,
								paddingVertical: 9,
								borderRadius: 999,
								backgroundColor:
									status === option ? colors.accent : colors.control,
							}}
						>
							<Text
								style={{
									color:
										status === option ? colors.onAccent : colors.secondaryText,
									fontWeight: '800',
									textTransform: 'capitalize',
								}}
							>
								{option?.replaceAll('_', ' ') ?? 'All'}
							</Text>
						</TouchableOpacity>
					))}
				</ScrollView>
				{error ? (
					<View
						style={{
							padding: 14,
							borderRadius: 14,
							backgroundColor: colors.destructiveSurface,
						}}
					>
						<Text style={{ color: colors.destructiveText }}>{error}</Text>
					</View>
				) : null}
				{loading && items.length === 0 ? (
					<ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
				) : (
					items.map((report) => (
						<TouchableOpacity
							key={report.id}
							onPress={() =>
								router.push(
									`${detailRoutePrefix}/${encodeURIComponent(report.id)}` as Href
								)
							}
							style={{
								marginBottom: 10,
								padding: 15,
								borderRadius: 17,
								borderWidth: 1,
								borderColor:
									report.priority === 'critical'
										? colors.destructive
										: colors.border,
								backgroundColor: colors.surface,
							}}
						>
							<View style={{ flexDirection: 'row' }}>
								<Ionicons
									name="shield"
									size={21}
									color={
										report.priority === 'critical'
											? colors.destructive
											: colors.accent
									}
								/>
								<View style={{ flex: 1, marginLeft: 10 }}>
									<Text style={{ color: colors.text, fontWeight: '900' }}>
										{report.reference}
									</Text>
									<Text
										style={{
											marginTop: 4,
											color: colors.secondaryText,
											fontWeight: '700',
										}}
									>
										{CHILD_SAFETY_CATEGORY_LABELS[report.category]}
									</Text>
									<Text
										numberOfLines={2}
										style={{
											marginTop: 6,
											color: colors.mutedText,
											lineHeight: 19,
										}}
									>
										{report.description}
									</Text>
									<Text
										style={{
											marginTop: 9,
											color:
												report.priority === 'critical'
													? colors.destructiveText
													: colors.accentText,
											fontSize: 11,
											fontWeight: '900',
											textTransform: 'uppercase',
										}}
									>
										{report.priority} · {report.status.replaceAll('_', ' ')}
										{report.legalHold ? ' · Legal hold' : ''}
									</Text>
								</View>
								<Ionicons
									name="chevron-forward"
									size={18}
									color={colors.icon}
								/>
							</View>
						</TouchableOpacity>
					))
				)}
				{hasMore && nextCursor ? (
					<TouchableOpacity
						disabled={loading}
						onPress={() => {
							setLoading(true);
							void loadCases(nextCursor);
						}}
						style={{
							minHeight: 48,
							alignItems: 'center',
							justifyContent: 'center',
							borderRadius: 15,
							borderWidth: 1,
							borderColor: colors.border,
							backgroundColor: colors.surface,
							opacity: loading ? 0.5 : 1,
						}}
					>
						<Text style={{ color: colors.secondaryText, fontWeight: '900' }}>
							{loading ? 'Loading…' : 'Load more cases'}
						</Text>
					</TouchableOpacity>
				) : null}
			</ScrollView>
		</SafeAreaView>
	);
}
