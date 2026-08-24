import { useCallback, useEffect, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { childSafetyReportService } from '@/lib/services/ChildSafetyReportService';
import {
	CHILD_SAFETY_CATEGORY_LABELS,
	type ChildSafetyAction,
	type ChildSafetyCaseActionInput,
	type ChildSafetyPriority,
	type ChildSafetyReportRecord,
	type ChildSafetyStatus,
} from '@/lib/types/childSafety';

type ChildSafetyCaseDetailScreenProps = { queueRoute?: Href };

export default function ChildSafetyCaseDetailScreen({
	queueRoute = '/admin/child-safety' as Href,
}: ChildSafetyCaseDetailScreenProps) {
	const { reportId } = useLocalSearchParams<{ reportId: string }>();
	const router = useRouter();
	const { colors } = useAppTheme();
	const [report, setReport] = useState<ChildSafetyReportRecord | null>(null);
	const [note, setNote] = useState('');
	const [busy, setBusy] = useState(false);
	const [authorityName, setAuthorityName] = useState('');
	const [authorityReference, setAuthorityReference] = useState('');
	const loadCase = useCallback(async () => {
		try {
			setReport(await childSafetyReportService.getCase(reportId));
		} catch (error: unknown) {
			Alert.alert(
				'Case unavailable',
				error instanceof Error ? error.message : 'Please try again.'
			);
		}
	}, [reportId]);
	useEffect(() => {
		void loadCase();
	}, [loadCase]);

	const handleAction = async (
		action: ChildSafetyAction,
		extra: Partial<ChildSafetyCaseActionInput> = {}
	) => {
		if (note.trim().length < 3)
			return Alert.alert(
				'Reviewer note required',
				'Enter the reason for this action first.'
			);
		setBusy(true);
		try {
			const updated = await childSafetyReportService.applyAction(reportId, {
				action,
				note,
				...extra,
			});
			if (!updated) {
				router.replace(queueRoute);
				return;
			}
			setReport(updated);
			setNote('');
		} catch (error: unknown) {
			Alert.alert(
				'Action not saved',
				error instanceof Error ? error.message : 'Please try again.'
			);
		} finally {
			setBusy(false);
		}
	};

	if (!report)
		return (
			<SafeAreaView
				edges={['top', 'bottom', 'left', 'right']}
				style={{
					flex: 1,
					backgroundColor: colors.canvas,
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<ActivityIndicator color={colors.accent} />
			</SafeAreaView>
		);
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
				}}
			>
				<TouchableOpacity onPress={() => router.back()}>
					<Ionicons name="chevron-back" size={26} color={colors.icon} />
				</TouchableOpacity>
				<Text
					style={{
						flex: 1,
						marginLeft: 10,
						color: colors.text,
						fontSize: 18,
						fontWeight: '900',
					}}
				>
					{report.reference}
				</Text>
				{report.legalHold ? (
					<Ionicons name="lock-closed" size={19} color={colors.warningText} />
				) : null}
			</View>
			<ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 35 }}>
				<TouchableOpacity
					onPress={() =>
						router.push({
							pathname: '/help/child-safety/reports/[reportId]',
							params: { reportId, reviewerMode: '1' },
						})
					}
					style={{
						marginBottom: 12,
						padding: 14,
						borderRadius: 15,
						alignItems: 'center',
						backgroundColor: colors.destructive,
					}}
				>
					<Text style={{ color: '#ffffff', fontWeight: '900' }}>
						Open secure reviewer conversation
					</Text>
				</TouchableOpacity>
				<View
					style={{
						padding: 17,
						borderRadius: 19,
						borderWidth: 1,
						borderColor:
							report.priority === 'critical'
								? colors.destructive
								: colors.border,
						backgroundColor: colors.surface,
					}}
				>
					<Text
						style={{
							color: colors.destructive,
							fontSize: 11,
							fontWeight: '900',
							textTransform: 'uppercase',
						}}
					>
						{report.priority} · {report.status.replaceAll('_', ' ')}
					</Text>
					<Text
						style={{
							marginTop: 7,
							color: colors.text,
							fontSize: 20,
							fontWeight: '900',
						}}
					>
						{CHILD_SAFETY_CATEGORY_LABELS[report.category]}
					</Text>
					<Text style={{ marginTop: 8, color: colors.mutedText }}>
						Target: {report.target.type} · {report.target.id}
					</Text>
					<Text
						style={{
							marginTop: 13,
							color: colors.secondaryText,
							lineHeight: 22,
						}}
					>
						{report.description}
					</Text>
				</View>
				<View
					style={{
						marginTop: 14,
						padding: 16,
						borderRadius: 19,
						backgroundColor: colors.surface,
					}}
				>
					<Text style={{ color: colors.text, fontWeight: '900' }}>
						Reviewer action
					</Text>
					<TextInput
						value={note}
						onChangeText={setNote}
						multiline
						placeholder="Required reviewer note or reason"
						placeholderTextColor={colors.mutedText}
						style={{
							minHeight: 90,
							marginTop: 10,
							padding: 12,
							borderRadius: 14,
							borderWidth: 1,
							borderColor: colors.border,
							backgroundColor: colors.input,
							color: colors.text,
							textAlignVertical: 'top',
						}}
					/>
					<Text
						style={{
							marginTop: 12,
							color: colors.mutedText,
							fontSize: 12,
							fontWeight: '800',
						}}
					>
						Set status
					</Text>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{ gap: 7, paddingTop: 7 }}
					>
						{(
							[
								'submitted',
								'under_review',
								'escalated',
								'action_required',
								'resolved',
								'reported_to_authority',
								'closed',
							] as ChildSafetyStatus[]
						).map((status) => (
							<ActionButton
								key={status}
								label={status.replaceAll('_', ' ')}
								onPress={() => void handleAction('set_status', { status })}
								disabled={busy}
								colors={colors}
							/>
						))}
					</ScrollView>
					<Text
						style={{
							marginTop: 12,
							color: colors.mutedText,
							fontSize: 12,
							fontWeight: '800',
						}}
					>
						Set priority
					</Text>
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={{ gap: 7, paddingTop: 7 }}
					>
						{(
							[
								'critical',
								'high',
								'medium',
								'standard',
							] as ChildSafetyPriority[]
						).map((priority) => (
							<ActionButton
								key={priority}
								label={priority}
								onPress={() => void handleAction('set_priority', { priority })}
								disabled={busy}
								colors={colors}
							/>
						))}
					</ScrollView>
					<TextInput
						value={authorityName}
						onChangeText={setAuthorityName}
						placeholder="Authority name for referral"
						placeholderTextColor={colors.mutedText}
						style={{
							marginTop: 12,
							padding: 12,
							borderRadius: 14,
							borderWidth: 1,
							borderColor: colors.border,
							backgroundColor: colors.input,
							color: colors.text,
						}}
					/>
					<TextInput
						value={authorityReference}
						onChangeText={setAuthorityReference}
						placeholder="Authority reference (optional)"
						placeholderTextColor={colors.mutedText}
						style={{
							marginTop: 8,
							padding: 12,
							borderRadius: 14,
							borderWidth: 1,
							borderColor: colors.border,
							backgroundColor: colors.input,
							color: colors.text,
						}}
					/>
					<View style={{ marginTop: 11, gap: 8 }}>
						<ActionButton
							label="Add note"
							onPress={() => void handleAction('note')}
							disabled={busy}
							colors={colors}
						/>
						<ActionButton
							label="Assign to me"
							onPress={() => void handleAction('assign')}
							disabled={busy}
							colors={colors}
						/>
						<ActionButton
							label="Escalate"
							onPress={() => void handleAction('escalate')}
							disabled={busy}
							colors={colors}
						/>
						<ActionButton
							label="Hide & preserve"
							onPress={() => void handleAction('moderation_action')}
							disabled={busy}
							colors={colors}
						/>
						<ActionButton
							label="Legal hold"
							onPress={() => void handleAction('preserve')}
							disabled={busy}
							colors={colors}
						/>
						{report.legalHold ? (
							<ActionButton
								label="Release legal hold"
								onPress={() => void handleAction('release_legal_hold')}
								disabled={busy}
								colors={colors}
							/>
						) : null}
						<ActionButton
							label="Record authority referral"
							onPress={() =>
								void handleAction('authority_referral', {
									authorityName,
									authorityReference,
								})
							}
							disabled={busy || !authorityName.trim()}
							colors={colors}
						/>
						<ActionButton
							label="Resolve"
							onPress={() => void handleAction('resolve')}
							disabled={busy}
							colors={colors}
						/>
						<ActionButton
							label="Purge (administrator only)"
							onPress={() => void handleAction('purge')}
							disabled={busy || report.legalHold}
							colors={colors}
							danger
						/>
					</View>
					{report.legalHold ? (
						<Text
							style={{
								marginTop: 10,
								color: colors.warningText,
								fontSize: 12,
								fontWeight: '700',
							}}
						>
							Purge is blocked while legal hold is active.
						</Text>
					) : null}
				</View>
				<View
					style={{
						marginTop: 14,
						padding: 16,
						borderRadius: 19,
						backgroundColor: colors.surface,
					}}
				>
					<Text style={{ color: colors.text, fontWeight: '900' }}>
						Case history
					</Text>
					{report.audit?.map((entry) => (
						<View
							key={entry.id}
							style={{
								marginTop: 12,
								borderLeftWidth: 2,
								borderLeftColor: colors.accent,
								paddingLeft: 10,
							}}
						>
							<Text
								style={{
									color: colors.secondaryText,
									fontWeight: '800',
									textTransform: 'capitalize',
								}}
							>
								{entry.action.replaceAll('_', ' ')}
							</Text>
							<Text style={{ marginTop: 3, color: colors.mutedText }}>
								{entry.note}
							</Text>
							<Text
								style={{
									marginTop: 3,
									color: colors.disabledText,
									fontSize: 11,
								}}
							>
								{new Date(entry.createdAt).toLocaleString()}
							</Text>
						</View>
					))}
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

type ActionButtonProps = {
	label: string;
	onPress: () => void;
	disabled: boolean;
	colors: ReturnType<typeof useAppTheme>['colors'];
	danger?: boolean;
};
function ActionButton({
	label,
	onPress,
	disabled,
	colors,
	danger = false,
}: ActionButtonProps) {
	return (
		<TouchableOpacity
			disabled={disabled}
			onPress={onPress}
			style={{
				alignItems: 'center',
				padding: 12,
				borderRadius: 13,
				backgroundColor: danger ? colors.destructive : colors.accent,
				opacity: disabled ? 0.45 : 1,
			}}
		>
			<Text style={{ color: '#ffffff', fontWeight: '900' }}>{label}</Text>
		</TouchableOpacity>
	);
}
