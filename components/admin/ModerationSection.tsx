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
import CustomModal from '@/components/ui/CustomModal';
import {
	AdminModerationService,
	type AdminModerationReport,
	type AdminReportStatus,
} from '@/lib/services/AdminModerationService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

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
	const { colors } = useAppTheme();
	const [reports, setReports] = useState<AdminModerationReport[]>([]);
	const [search, setSearch] = useState('');
	const [status, setStatus] = useState<AdminReportStatus | 'all'>('all');
	const [severity, setSeverity] =
		useState<(typeof SEVERITY_FILTERS)[number]>('all');
	const [loading, setLoading] = useState(true);
	const [message, setMessage] = useState<string | null>(null);
	const load = useCallback(async () => {
		setLoading(true);
		try {
			setReports(await moderationService.fetchReports());
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
					Loading reports…
				</Text>
			</View>
		);
	return (
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
							paddingHorizontal: 11,
							paddingVertical: 7,
							backgroundColor:
								severity === filter ? colors.text : colors.control,
						}}
					>
						<Text
							style={{
								color:
									severity === filter ? colors.canvas : colors.secondaryText,
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
			<Text style={{ marginBottom: 9, color: colors.mutedText, fontSize: 12 }}>
				{visible.length} of {reports.length} reports
			</Text>
			{visible.length === 0 ? (
				<View style={{ padding: 36, alignItems: 'center' }}>
					<Icon name="check-circle" size={38} color={colors.accent} />
					<Text
						style={{ marginTop: 10, fontWeight: '900', color: colors.text }}
					>
						No reports found
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
							marginBottom: 10,
							borderRadius: 16,
							backgroundColor: colors.surface,
							borderWidth: 1,
							borderColor:
								report.severity === 'critical' || report.severity === 'high'
									? colors.destructive
									: colors.border,
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
