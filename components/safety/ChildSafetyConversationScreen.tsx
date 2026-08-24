import { useCallback, useEffect, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { auth } from '@/lib/firebaseConfig';
import { childSafetyReportService } from '@/lib/services/ChildSafetyReportService';
import {
	supportTicketService,
	type SupportImageDraft,
} from '@/lib/services/SupportTicketService';
import {
	CHILD_SAFETY_CATEGORY_LABELS,
	type ChildSafetyAction,
	type ChildSafetyMessage,
	type ChildSafetyReportRecord,
} from '@/lib/types/childSafety';
import PrivateCaseAttachmentImage from '@/components/support/PrivateCaseAttachmentImage';

type ChildSafetyConversationScreenProps = {
	reportId: string;
	reviewerMode?: boolean;
};
export default function ChildSafetyConversationScreen({
	reportId,
	reviewerMode = false,
}: ChildSafetyConversationScreenProps) {
	const router = useRouter();
	const { colors } = useAppTheme();
	const [report, setReport] = useState<ChildSafetyReportRecord | null>(null);
	const [messages, setMessages] = useState<ChildSafetyMessage[]>([]);
	const [text, setText] = useState('');
	const [images, setImages] = useState<SupportImageDraft[]>([]);
	const [acknowledged, setAcknowledged] = useState(false);
	const [busy, setBusy] = useState(true);
	const [note, setNote] = useState('');
	const [transferId, setTransferId] = useState('');
	const load = useCallback(
		async (quiet = false) => {
			if (!quiet) setBusy(true);
			try {
				const [caseRecord, page] = await Promise.all([
					reviewerMode
						? childSafetyReportService.getCase(reportId)
						: childSafetyReportService.getMyReport(reportId),
					childSafetyReportService.listMessages(reportId, reviewerMode),
				]);
				setReport(caseRecord);
				setMessages(page.items);
			} catch (error: unknown) {
				if (!quiet)
					Alert.alert(
						'Case unavailable',
						error instanceof Error ? error.message : 'Please try again.'
					);
			} finally {
				if (!quiet) setBusy(false);
			}
		},
		[reportId, reviewerMode]
	);
	useEffect(() => {
		void load();
		const timer = setInterval(() => void load(true), 8_000);
		return () => clearInterval(timer);
	}, [load]);
	const blockedAttachments =
		report?.category === 'suspected_child_sexual_abuse_material' ||
		report?.category === 'child_sexual_abuse_or_exploitation';
	const mayReply =
		!reviewerMode ||
		Boolean(
			report?.assignedReviewerId === auth.currentUser?.uid &&
				report?.allowContact === true
		);
	const pickImages = async () => {
		if (blockedAttachments)
			return Alert.alert(
				'Attachments disabled',
				'Do not upload suspected harmful material for this category.'
			);
		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!permission.granted) return;
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ['images'],
			allowsMultipleSelection: true,
			selectionLimit: 5,
			quality: 1,
		});
		if (result.canceled) return;
		const drafts = result.assets.map((asset, index): SupportImageDraft => ({
			uri: asset.uri,
			fileName: asset.fileName || `safety-update-${index + 1}.jpg`,
			mediaType: asset.mimeType || 'image/jpeg',
			byteSize: asset.fileSize || 0,
		}));
		if (drafts.some((image) => image.byteSize <= 0))
			return Alert.alert(
				'Image unavailable',
				'A selected image did not provide a valid size.'
			);
		setImages(drafts);
	};
	const handleSend = async () => {
		if (images.length && !acknowledged)
			return Alert.alert(
				'Confirmation required',
				'Confirm that the images do not contain suspected CSAM.'
			);
		setBusy(true);
		try {
			const attachmentIds = images.length
				? await supportTicketService.uploadImages(
						reportId,
						images,
						'child_safety',
						acknowledged
					)
				: [];
			const message = await childSafetyReportService.sendMessage(
				reportId,
				text,
				attachmentIds,
				reviewerMode
			);
			setMessages((current) => [...current, message]);
			setText('');
			setImages([]);
			setAcknowledged(false);
		} catch (error: unknown) {
			Alert.alert(
				'Update not sent',
				error instanceof Error ? error.message : 'Please try again.'
			);
		} finally {
			setBusy(false);
		}
	};
	const handleAction = async (
		action: ChildSafetyAction,
		assignedReviewerId?: string
	) => {
		if (note.trim().length < 3)
			return Alert.alert('Reason required', 'Enter a reviewer reason first.');
		setBusy(true);
		try {
			const updated = await childSafetyReportService.applyAction(reportId, {
				action,
				note,
				...(assignedReviewerId ? { assignedReviewerId } : {}),
			});
			if (updated) setReport(updated);
			setNote('');
		} catch (error: unknown) {
			Alert.alert(
				'Case not updated',
				error instanceof Error ? error.message : 'Please try again.'
			);
		} finally {
			setBusy(false);
		}
	};
	const handleContactToggle = async () => {
		if (!report || reviewerMode) return;
		setBusy(true);
		try {
			setReport(
				await childSafetyReportService.setReporterContact(
					reportId,
					!report.allowContact
				)
			);
		} catch (error: unknown) {
			Alert.alert(
				'Preference not updated',
				error instanceof Error ? error.message : 'Please try again.'
			);
		} finally {
			setBusy(false);
		}
	};
	const renderMessage = ({ item }: { item: ChildSafetyMessage }) => {
		const reviewer = item.authorRole === 'child_safety_reviewer';
		return (
			<View
				style={{
					maxWidth: '84%',
					alignSelf: reviewer ? 'flex-end' : 'flex-start',
					marginVertical: 4,
					padding: 12,
					borderRadius: 17,
					backgroundColor: reviewer ? colors.destructive : colors.surface,
				}}
			>
				<Text
					style={{
						color: reviewer ? '#fff' : colors.mutedText,
						fontSize: 11,
						fontWeight: '900',
					}}
				>
					{item.authorDisplayName}
					{reviewer ? ' · Child Safety' : ''}
				</Text>
				{item.text ? (
					<Text
						style={{
							marginTop: 4,
							color: reviewer ? '#fff' : colors.text,
							lineHeight: 20,
						}}
					>
						{item.text}
					</Text>
				) : null}
				{item.attachments.map((attachment) => (
					<PrivateCaseAttachmentImage
						key={attachment.id}
						attachmentId={attachment.id}
						fileName={attachment.fileName}
					/>
				))}
			</View>
		);
	};
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
				<TouchableOpacity onPress={() => router.back()}>
					<Ionicons name="chevron-back" size={26} color={colors.icon} />
				</TouchableOpacity>
				<View style={{ flex: 1, marginLeft: 9 }}>
					<Text
						numberOfLines={1}
						style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}
					>
						{report
							? CHILD_SAFETY_CATEGORY_LABELS[report.category]
							: 'Restricted case'}
					</Text>
					<Text style={{ color: colors.mutedText, fontSize: 11 }}>
						{report?.reference || 'Loading…'} ·{' '}
						{report?.status.replaceAll('_', ' ')}
					</Text>
				</View>
				{!reviewerMode && report ? (
					<TouchableOpacity
						disabled={busy}
						onPress={() => void handleContactToggle()}
						style={{
							paddingHorizontal: 10,
							paddingVertical: 8,
							borderRadius: 12,
							backgroundColor: report.allowContact
								? colors.destructiveSurface
								: colors.successSurface,
						}}
					>
						<Text
							style={{
								color: report.allowContact
									? colors.destructiveText
									: colors.accentText,
								fontSize: 10,
								fontWeight: '900',
							}}
						>
							{report.allowContact ? 'STOP REPLIES' : 'ALLOW REPLIES'}
						</Text>
					</TouchableOpacity>
				) : null}
			</View>
			<KeyboardAvoidingView
				style={{ flex: 1 }}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				{busy && !report ? (
					<ActivityIndicator
						style={{ marginTop: 40 }}
						color={colors.destructive}
					/>
				) : (
					<FlashList
						data={messages}
						renderItem={renderMessage}
						keyExtractor={(item) => item.id}
						contentContainerStyle={{ padding: 12 }}
						maintainVisibleContentPosition={{
							autoscrollToBottomThreshold: 0.2,
							startRenderingFromBottom: true,
						}}
						ListHeaderComponent={
							report ? (
								<View
									style={{
										maxWidth: '84%',
										marginBottom: 8,
										padding: 12,
										borderRadius: 17,
										backgroundColor: colors.surface,
									}}
								>
									<Text
										style={{
											color: colors.mutedText,
											fontSize: 11,
											fontWeight: '900',
										}}
									>
										ORIGINAL REPORT
									</Text>
									<Text
										style={{ marginTop: 4, color: colors.text, lineHeight: 20 }}
									>
										{report.description}
									</Text>
								</View>
							) : null
						}
					/>
				)}
				{reviewerMode ? (
					<View
						style={{
							padding: 9,
							borderTopWidth: 1,
							borderTopColor: colors.border,
							backgroundColor: colors.surface,
						}}
					>
						<TextInput
							value={note}
							onChangeText={setNote}
							placeholder="Required reviewer reason"
							placeholderTextColor={colors.mutedText}
							style={{
								minHeight: 44,
								padding: 10,
								borderRadius: 12,
								borderWidth: 1,
								borderColor: colors.border,
								color: colors.text,
							}}
						/>
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={{ gap: 6, paddingTop: 7 }}
						>
							<Action
								label="Claim"
								onPress={() => void handleAction('claim')}
								colors={colors}
							/>
							<Action
								label="Release"
								onPress={() => void handleAction('release')}
								colors={colors}
							/>
							<Action
								label="Resolve"
								onPress={() => void handleAction('resolve')}
								colors={colors}
							/>
						</ScrollView>
						<View style={{ flexDirection: 'row', gap: 7, marginTop: 7 }}>
							<TextInput
								value={transferId}
								onChangeText={setTransferId}
								placeholder="Reviewer user ID"
								placeholderTextColor={colors.mutedText}
								style={{
									flex: 1,
									padding: 9,
									borderRadius: 11,
									borderWidth: 1,
									borderColor: colors.border,
									color: colors.text,
								}}
							/>
							<Action
								label="Transfer"
								onPress={() => void handleAction('transfer', transferId)}
								colors={colors}
							/>
						</View>
					</View>
				) : null}
				{mayReply ? (
					<View
						style={{
							padding: 9,
							borderTopWidth: 1,
							borderTopColor: colors.border,
							backgroundColor: colors.navigation,
						}}
					>
						<View
							style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 7 }}
						>
							<TouchableOpacity
								onPress={() => void pickImages()}
								style={{ padding: 9 }}
							>
								<Ionicons
									name="image"
									size={22}
									color={
										blockedAttachments
											? colors.disabledText
											: colors.destructive
									}
								/>
							</TouchableOpacity>
							<TextInput
								value={text}
								onChangeText={setText}
								multiline
								maxLength={5000}
								placeholder="Add a secure update…"
								placeholderTextColor={colors.mutedText}
								style={{
									flex: 1,
									minHeight: 44,
									maxHeight: 110,
									padding: 10,
									borderRadius: 15,
									borderWidth: 1,
									borderColor: colors.border,
									color: colors.text,
									backgroundColor: colors.input,
								}}
							/>
							<TouchableOpacity
								disabled={busy || (!text.trim() && !images.length)}
								onPress={() => void handleSend()}
								style={{
									width: 44,
									height: 44,
									borderRadius: 22,
									alignItems: 'center',
									justifyContent: 'center',
									backgroundColor: colors.destructive,
								}}
							>
								<Ionicons name="send" size={19} color="#fff" />
							</TouchableOpacity>
						</View>
						{images.length ? (
							<TouchableOpacity
								onPress={() => setAcknowledged((current) => !current)}
								style={{
									flexDirection: 'row',
									alignItems: 'center',
									marginTop: 7,
								}}
							>
								<Ionicons
									name={acknowledged ? 'checkbox' : 'square-outline'}
									size={19}
									color={colors.destructive}
								/>
								<Text
									style={{
										marginLeft: 6,
										color: colors.mutedText,
										fontSize: 11,
									}}
								>
									These {images.length} images do not contain suspected CSAM.
								</Text>
							</TouchableOpacity>
						) : null}
					</View>
				) : (
					<Text
						style={{
							padding: 11,
							color: colors.warningText,
							backgroundColor: colors.warningSurface,
						}}
					>
						{!report?.assignedReviewerId
							? 'Claim this case before replying.'
							: 'The reporter has not enabled contact.'}
					</Text>
				)}
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}
type ThemeColors = ReturnType<typeof useAppTheme>['colors'];
function Action({
	label,
	onPress,
	colors,
}: {
	label: string;
	onPress: () => void;
	colors: ThemeColors;
}) {
	return (
		<TouchableOpacity
			onPress={onPress}
			style={{
				paddingHorizontal: 14,
				paddingVertical: 9,
				borderRadius: 11,
				backgroundColor: colors.destructive,
			}}
		>
			<Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>
				{label}
			</Text>
		</TouchableOpacity>
	);
}
