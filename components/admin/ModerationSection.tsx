import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';
import { Ionicons } from '@expo/vector-icons';
import CustomModal from '@/components/ui/CustomModal';
import {
	AdminModerationService,
	type AdminModerationReport,
	type AdminReportStatus,
} from '@/lib/services/AdminModerationService';
import { adminContentService } from '@/lib/services/AdminContentService';
import type { ContentAppealRecord } from '@/lib/types/adminContent';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';

const moderationService = AdminModerationService.getInstance();

const STATUS_FILTERS: readonly (AdminReportStatus | 'all')[] = [
	'all',
	'pending',
	'under_review',
	'action_taken',
	'resolved',
	'dismissed',
	'escalated',
];
const SEVERITY_FILTERS = ['all', 'low', 'medium', 'high', 'critical'] as const;

export default function ModerationSection() {
	const router = useRouter();
	const { colors, isDark } = useAppTheme();
	const [activeSubTab, setActiveSubTab] = useState<'reports' | 'appeals'>('reports');
	const [reports, setReports] = useState<AdminModerationReport[]>([]);
	const [appeals, setAppeals] = useState<ContentAppealRecord[]>([]);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<AdminReportStatus | 'all'>('all');
	const [severity, setSeverity] =
		useState<(typeof SEVERITY_FILTERS)[number]>('all');
	const [loading, setLoading] = useState(true);
	const [appealsLoading, setAppealsLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [reportsData, appealsData] = await Promise.all([
				moderationService.fetchReports().catch(() => []),
				adminContentService.getPendingAppeals().catch(() => []),
			]);
			setReports(reportsData);
			setAppeals(appealsData);
		} catch (loadError: unknown) {
			setMessage(
				loadError instanceof Error
					? loadError.message
					: 'Reports could not be loaded'
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const handleReviewAppeal = async (appealId: string, decision: 'approved' | 'rejected') => {
		try {
			setAppealsLoading(true);
			void interactionFeedbackService.play('post');
			const res = await adminContentService.reviewAppeal(appealId, decision);
			if (res.success) {
				void interactionFeedbackService.play('success');
				setAppeals((prev) => prev.filter((a) => a.id !== appealId));
				setMessage(
					decision === 'approved'
						? 'Appeal approved and content restored successfully.'
						: 'Appeal rejected.'
				);
			} else {
				throw new Error(res.error || 'Failed to update appeal');
			}
		} catch (err: unknown) {
			setMessage(err instanceof Error ? err.message : 'Failed to review appeal');
			void interactionFeedbackService.play('warning');
		} finally {
			setAppealsLoading(false);
		}
	};

	const visible = useMemo(() => {
		const normalized = search.trim().toLowerCase();
		return reports.filter(
			(report) =>
				(status === 'all' || report.status === status) &&
				(severity === 'all' || report.severity === severity) &&
				(!normalized ||
					`${report.reason} ${report.contentType} ${report.reporterName} ${report.status} ${report.targetId}`
						.toLowerCase()
						.includes(normalized))
		);
	}, [reports, search, severity, status]);

	if (loading)
		return (
			<View style={{ paddingVertical: 50, alignItems: 'center' }}>
				<ActivityIndicator color={colors.accent} />
				<Text style={{ marginTop: 8, color: colors.mutedText }}>
					Loading moderation workspace…
				</Text>
			</View>
		);

	return (
		<>
			{/* Sub-tab switcher */}
			<View style={{ flexDirection: 'row', marginBottom: 14, backgroundColor: colors.control, borderRadius: 14, padding: 3 }}>
				<TouchableOpacity
					onPress={() => setActiveSubTab('reports')}
					style={{
						flex: 1,
						paddingVertical: 9,
						alignItems: 'center',
						borderRadius: 12,
						backgroundColor: activeSubTab === 'reports' ? colors.elevated : 'transparent',
					}}
				>
					<Text style={{ fontSize: 12, fontWeight: '800', color: activeSubTab === 'reports' ? colors.text : colors.mutedText }}>
						Reports ({reports.length})
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					onPress={() => setActiveSubTab('appeals')}
					style={{
						flex: 1,
						paddingVertical: 9,
						alignItems: 'center',
						borderRadius: 12,
						backgroundColor: activeSubTab === 'appeals' ? colors.elevated : 'transparent',
					}}
				>
					<Text style={{ fontSize: 12, fontWeight: '800', color: activeSubTab === 'appeals' ? colors.text : colors.mutedText }}>
						Appeals ({appeals.length})
					</Text>
				</TouchableOpacity>
			</View>

			{activeSubTab === 'appeals' ? (
				<View className="space-y-3">
					{appeals.length === 0 ? (
						<View style={{ padding: 40, alignItems: 'center' }}>
							<Ionicons name="checkmark-done-circle-outline" size={44} color={colors.mutedText} />
							<Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, marginTop: 10 }}>
								No Pending Appeals
							</Text>
							<Text style={{ color: colors.mutedText, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
								All user content restoration appeals have been reviewed.
							</Text>
						</View>
					) : (
						appeals.map((appeal) => (
							<View
								key={appeal.id}
								style={{
									backgroundColor: colors.elevated,
									borderColor: colors.border,
									borderWidth: 1,
									borderRadius: 16,
									padding: 14,
									marginBottom: 10,
								}}
							>
								<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
									<View style={{ flexDirection: 'row', alignItems: 'center' }}>
										<View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
											<Ionicons name="trash" size={13} color="#ef4444" />
										</View>
										<Text style={{ color: colors.text, fontWeight: '800', fontSize: 13, textTransform: 'capitalize' }}>
											{appeal.contentType} Appeal
										</Text>
									</View>
									<Text style={{ color: colors.warningText, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>
										{appeal.status}
									</Text>
								</View>

								<View style={{ marginTop: 8, padding: 8, borderRadius: 10, backgroundColor: isDark ? '#27272a' : '#f4f4f5' }}>
									<Text style={{ color: colors.mutedText, fontSize: 11 }}>
										<Text style={{ fontWeight: '700', color: colors.text }}>Author: </Text>
										{appeal.authorName || appeal.authorId}
									</Text>
									<Text style={{ color: '#ef4444', fontSize: 11, marginTop: 2 }}>
										<Text style={{ fontWeight: '700' }}>Original Deletion Reason: </Text>
										{appeal.deletionReason}
									</Text>
								</View>

								<View style={{ marginTop: 8 }}>
									<Text style={{ color: colors.text, fontSize: 11, fontWeight: '700' }}>
										User's Appeal Explanation:
									</Text>
									<Text style={{ color: colors.secondaryText, fontSize: 12, lineHeight: 18, marginTop: 2 }}>
										"{appeal.appealReason}"
									</Text>
								</View>

								<View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
									<TouchableOpacity
										disabled={appealsLoading}
										onPress={() => void handleReviewAppeal(appeal.id, 'rejected')}
										style={{
											paddingHorizontal: 12,
											paddingVertical: 7,
											borderRadius: 10,
											backgroundColor: isDark ? '#27272a' : '#e4e4e7',
											marginRight: 8,
										}}
									>
										<Text style={{ color: colors.text, fontSize: 11, fontWeight: '700' }}>
											Reject Appeal
										</Text>
									</TouchableOpacity>

									<TouchableOpacity
										disabled={appealsLoading}
										onPress={() => void handleReviewAppeal(appeal.id, 'approved')}
										style={{
											paddingHorizontal: 14,
											paddingVertical: 7,
											borderRadius: 10,
											backgroundColor: '#10b981',
											flexDirection: 'row',
											alignItems: 'center',
										}}
									>
										<Ionicons name="refresh" size={13} color="#ffffff" style={{ marginRight: 4 }} />
										<Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800' }}>
											Approve & Restore
										</Text>
									</TouchableOpacity>
								</View>
							</View>
						))
					)}
				</View>
			) : (
				<>
					<View
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							paddingHorizontal: 12,
							marginBottom: 10,
							borderRadius: 14,
							borderWidth: 1,
							borderColor: colors.border,
							backgroundColor: colors.input,
						}}
					>
						<Icon name="search" size={18} color={colors.mutedText} />
						<TextInput
							value={search}
							onChangeText={setSearch}
							placeholder="Search reports, people, content IDs"
							placeholderTextColor={colors.mutedText}
							style={{ flex: 1, padding: 11, color: colors.text }}
						/>
						<TouchableOpacity onPress={() => void load()}>
							<Icon name="refresh-cw" size={17} color={colors.accent} />
						</TouchableOpacity>
					</View>
					<ScrollView horizontal showsHorizontalScrollIndicator={false}>
						{STATUS_FILTERS.map((filter) => (
							<TouchableOpacity
								key={filter}
								onPress={() => setStatus(filter)}
								style={{
									marginRight: 7,
									borderRadius: 999,
									paddingHorizontal: 11,
									paddingVertical: 7,
									backgroundColor:
										status === filter ? colors.accent : colors.control,
								}}
							>
								<Text
									style={{
										color:
											status === filter ? colors.onAccent : colors.secondaryText,
										textTransform: 'capitalize',
										fontSize: 11,
										fontWeight: '800',
									}}
								>
									{filter.replace('_', ' ')}
								</Text>
							</TouchableOpacity>
						))}
					</ScrollView>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						style={{ marginTop: 9, marginBottom: 12 }}
					>
						{SEVERITY_FILTERS.map((filter) => (
							<TouchableOpacity
								key={filter}
								onPress={() => setSeverity(filter)}
								style={{
									marginRight: 7,
									borderRadius: 999,
									paddingHorizontal: 10,
									paddingVertical: 6,
									backgroundColor:
										severity === filter ? colors.accent : colors.control,
								}}
							>
								<Text
									style={{
										color:
											severity === filter
												? colors.onAccent
												: colors.secondaryText,
										textTransform: 'capitalize',
										fontSize: 11,
										fontWeight: '800',
									}}
								>
									{filter}
								</Text>
							</TouchableOpacity>
						))}
					</ScrollView>
					{visible.length === 0 ? (
						<View
							style={{
								paddingVertical: 40,
								alignItems: 'center',
								backgroundColor: colors.surface,
								borderRadius: 16,
								borderWidth: 1,
								borderColor: colors.border,
							}}
						>
							<Icon name="shield" size={36} color={colors.mutedText} />
							<Text
								style={{
									marginTop: 10,
									color: colors.text,
									fontWeight: '800',
								}}
							>
								No matching reports found
							</Text>
							<Text
								style={{
									marginTop: 4,
									color: colors.mutedText,
									fontSize: 12,
								}}
							>
								Try clearing filters or search keywords
							</Text>
						</View>
					) : (
						visible.map((report) => (
							<TouchableOpacity
								key={report.id}
								onPress={() =>
									router.push({
										pathname: '/admin/reports/[reportId]',
										params: { reportId: report.id },
									})
								}
								style={{
									padding: 15,
									borderRadius: 16,
									borderWidth: 1,
									borderColor: colors.border,
									backgroundColor: colors.surface,
									marginBottom: 10,
								}}
							>
								<View style={{ flexDirection: 'row' }}>
									<Text style={{ flex: 1, color: colors.text, fontWeight: '900' }}>
										{report.reason}
									</Text>
									<Text
										style={{
											color:
												report.status === 'pending'
													? colors.warningText
													: colors.mutedText,
											fontSize: 10,
											fontWeight: '900',
											textTransform: 'uppercase',
										}}
									>
										{report.status.replace('_', ' ')}
									</Text>
								</View>
								<Text
									style={{ marginTop: 5, color: colors.mutedText, fontSize: 12 }}
								>
									{report.contentType} · reported by {report.reporterName}
								</Text>
								{report.description ? (
									<Text
										numberOfLines={2}
										style={{
											marginTop: 8,
											color: colors.secondaryText,
											lineHeight: 19,
										}}
									>
										{report.description}
									</Text>
								) : null}
								<View
									style={{
										marginTop: 10,
										flexDirection: 'row',
										alignItems: 'center',
									}}
								>
									<Text
										style={{
											flex: 1,
											color:
												report.severity === 'critical' || report.severity === 'high'
													? colors.destructiveText
													: colors.mutedText,
											fontSize: 10,
											fontWeight: '900',
											textTransform: 'uppercase',
										}}
									>
										{report.severity}
									</Text>
									<Text
										style={{
											color: colors.accent,
											fontSize: 12,
											fontWeight: '800',
										}}
									>
										Review
									</Text>
									<Icon name="chevron-right" size={16} color={colors.accent} />
								</View>
							</TouchableOpacity>
						))
					)}
				</>
			)}
			<CustomModal
				visible={Boolean(message)}
				title="Content moderation"
				message={message ?? ''}
				type="info"
				onClose={() => setMessage(null)}
			/>
		</>
	);
}