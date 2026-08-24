import { useCallback, useEffect, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	Platform,
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
import { supportTicketResourceService } from '@/lib/services/SupportTicketResourceService';
import {
	supportTicketService,
	type SupportImageDraft,
} from '@/lib/services/SupportTicketService';
import { useSupportTicketStore } from '@/lib/store/useSupportTicketStore';
import type {
	SupportTicketAction,
	SupportTicketMessage,
} from '@/lib/types/support';
import PrivateCaseAttachmentImage from './PrivateCaseAttachmentImage';

type SupportTicketConversationScreenProps = {
	ticketId: string;
	staffMode?: boolean;
};

export default function SupportTicketConversationScreen({
	ticketId,
	staffMode = false,
}: SupportTicketConversationScreenProps) {
	const router = useRouter();
	const { colors } = useAppTheme();
	const ticket = useSupportTicketStore(
		(state) => state.selectedTickets[ticketId]
	);
	const resource = useSupportTicketStore(
		(state) => state.conversations[ticketId]
	);
	const [text, setText] = useState('');
	const [images, setImages] = useState<SupportImageDraft[]>([]);
	const [busy, setBusy] = useState(false);
	const [reason, setReason] = useState('');
	const [transferUserId, setTransferUserId] = useState('');
	const load = useCallback(async () => {
		await supportTicketResourceService.hydrateConversation(ticketId);
		await supportTicketResourceService.refreshConversation(ticketId);
	}, [ticketId]);
	useEffect(() => {
		void load();
		const timer = setInterval(
			() => void supportTicketResourceService.refreshConversation(ticketId),
			8_000
		);
		return () => clearInterval(timer);
	}, [load, ticketId]);
	const handlePickImages = async () => {
		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!permission.granted)
			return Alert.alert(
				'Photo permission needed',
				'Allow photo access to attach images.'
			);
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ['images'],
			allowsMultipleSelection: true,
			selectionLimit: 5,
			quality: 1,
		});
		if (result.canceled) return;
		const drafts = result.assets.map((asset, index): SupportImageDraft => ({
			uri: asset.uri,
			fileName: asset.fileName || `support-image-${index + 1}.jpg`,
			mediaType: asset.mimeType || 'image/jpeg',
			byteSize: asset.fileSize || 0,
		}));
		if (drafts.some((draft) => draft.byteSize <= 0))
			return Alert.alert(
				'Image unavailable',
				'One or more selected images did not provide a valid size.'
			);
		setImages(drafts);
	};
	const handleSend = async () => {
		setBusy(true);
		try {
			const attachmentIds = await supportTicketService.uploadImages(
				ticketId,
				images
			);
			const message = await supportTicketService.sendMessage(
				ticketId,
				text,
				attachmentIds
			);
			await supportTicketResourceService.appendMessage(ticketId, message);
			setText('');
			setImages([]);
		} catch (error: unknown) {
			Alert.alert(
				'Message not sent',
				error instanceof Error ? error.message : 'Please try again.'
			);
		} finally {
			setBusy(false);
		}
	};
	const handleAction = async (
		action: SupportTicketAction,
		assignedStaffId?: string
	) => {
		const actionReason =
			action === 'claim' ? 'Claimed by support staff.' : reason;
		if (actionReason.trim().length < 3)
			return Alert.alert('Reason required', 'Enter an internal reason first.');
		setBusy(true);
		try {
			const updated = await supportTicketService.applyAction(ticketId, {
				action,
				reason: actionReason,
				...(assignedStaffId ? { assignedStaffId } : {}),
			});
			useSupportTicketStore.getState().setSelectedTicket(updated);
			setReason('');
		} catch (error: unknown) {
			Alert.alert(
				'Ticket not updated',
				error instanceof Error ? error.message : 'Please try again.'
			);
		} finally {
			setBusy(false);
		}
	};
	const messages = resource?.data?.items ?? [];
	const renderMessage = ({ item }: { item: SupportTicketMessage }) => {
		const fromSupport = item.authorRole === 'support';
		return (
			<View
				style={{
					maxWidth: '84%',
					alignSelf: fromSupport ? 'flex-end' : 'flex-start',
					marginVertical: 4,
					padding: 12,
					borderRadius: 17,
					borderBottomRightRadius: fromSupport ? 4 : 17,
					borderBottomLeftRadius: fromSupport ? 17 : 4,
					backgroundColor: fromSupport ? colors.accent : colors.surface,
				}}
			>
				<Text
					style={{
						color: fromSupport ? '#fff' : colors.mutedText,
						fontSize: 11,
						fontWeight: '900',
					}}
				>
					{item.authorDisplayName}
					{fromSupport ? ' · Ourlime Support' : ''}
				</Text>
				{item.text ? (
					<Text
						style={{
							marginTop: 4,
							color: fromSupport ? '#fff' : colors.text,
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
				<View style={{ flex: 1, marginLeft: 10 }}>
					<Text
						numberOfLines={1}
						style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}
					>
						{ticket?.subject || 'Support ticket'}
					</Text>
					<Text style={{ marginTop: 1, color: colors.mutedText, fontSize: 11 }}>
						{ticket?.reference || 'Loading…'} ·{' '}
						{ticket?.status.replaceAll('_', ' ')}
					</Text>
				</View>
			</View>
			<KeyboardAvoidingView
				style={{ flex: 1 }}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<View
					style={{
						paddingHorizontal: 14,
						paddingVertical: 9,
						borderBottomWidth: 1,
						borderBottomColor: colors.border,
						backgroundColor: colors.surface,
					}}
				>
					<Text
						style={{
							color: ticket?.assignedStaff
								? colors.secondaryText
								: colors.warningText,
							fontSize: 12,
							fontWeight: '800',
						}}
					>
						{ticket?.assignedStaff
							? `${ticket.assignedStaff.displayName} · Ourlime Support`
							: 'Waiting for claim'}
					</Text>
				</View>
				{resource?.status === 'hydrating' && !messages.length ? (
					<ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
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
							ticket ? (
								<View>
									{resource?.data?.hasMore && resource.data.nextCursor ? (
										<TouchableOpacity
											onPress={() =>
												void supportTicketResourceService.loadOlderConversation(
													ticketId
												)
											}
											style={{
												alignSelf: 'center',
												marginBottom: 10,
												padding: 9,
											}}
										>
											<Text
												style={{
													color: colors.accent,
													fontSize: 12,
													fontWeight: '900',
												}}
											>
												Load older messages
											</Text>
										</TouchableOpacity>
									) : null}
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
											ORIGINAL REQUEST
										</Text>
										<Text
											style={{
												marginTop: 4,
												color: colors.text,
												lineHeight: 20,
											}}
										>
											{ticket.description}
										</Text>
									</View>
								</View>
							) : null
						}
					/>
				)}
				{resource?.error ? (
					<Text
						style={{
							padding: 10,
							color: colors.destructiveText,
							backgroundColor: colors.destructiveSurface,
						}}
					>
						{resource.error.message}
					</Text>
				) : null}
				{staffMode ? (
					<View
						style={{
							padding: 10,
							borderTopWidth: 1,
							borderTopColor: colors.border,
							backgroundColor: colors.surface,
						}}
					>
						<TextInput
							value={reason}
							onChangeText={setReason}
							placeholder="Required internal reason"
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
						<View style={{ flexDirection: 'row', gap: 6, marginTop: 7 }}>
							<SmallAction
								label="Claim"
								onPress={() => void handleAction('claim')}
								colors={colors}
							/>
							<SmallAction
								label="Release"
								onPress={() => void handleAction('release')}
								colors={colors}
							/>
							<SmallAction
								label="Resolve"
								onPress={() => void handleAction('resolve')}
								colors={colors}
							/>
						</View>
						<View style={{ flexDirection: 'row', gap: 7, marginTop: 7 }}>
							<TextInput
								value={transferUserId}
								onChangeText={setTransferUserId}
								placeholder="Staff user ID"
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
							<SmallAction
								label="Transfer"
								onPress={() => void handleAction('transfer', transferUserId)}
								colors={colors}
							/>
						</View>
					</View>
				) : null}
				{(!staffMode || ticket?.assignedStaffId === auth.currentUser?.uid) &&
				ticket?.status !== 'closed' ? (
					<View
						style={{
							padding: 10,
							borderTopWidth: 1,
							borderTopColor: colors.border,
							backgroundColor: colors.navigation,
						}}
					>
						<View
							style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}
						>
							<TouchableOpacity
								onPress={() => void handlePickImages()}
								style={{ padding: 10 }}
							>
								<Ionicons name="image" size={23} color={colors.accent} />
							</TouchableOpacity>
							<TextInput
								value={text}
								onChangeText={setText}
								multiline
								maxLength={5000}
								placeholder="Write a reply…"
								placeholderTextColor={colors.mutedText}
								style={{
									flex: 1,
									maxHeight: 110,
									minHeight: 44,
									paddingHorizontal: 12,
									paddingVertical: 10,
									borderRadius: 16,
									borderWidth: 1,
									borderColor: colors.border,
									backgroundColor: colors.input,
									color: colors.text,
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
									backgroundColor: colors.accent,
									opacity: busy ? 0.5 : 1,
								}}
							>
								{busy ? (
									<ActivityIndicator color="#fff" />
								) : (
									<Ionicons name="send" size={20} color="#fff" />
								)}
							</TouchableOpacity>
						</View>
						{images.length ? (
							<Text
								style={{ marginTop: 5, color: colors.mutedText, fontSize: 11 }}
							>
								{images.length} image{images.length === 1 ? '' : 's'} selected
							</Text>
						) : null}
					</View>
				) : null}
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];
function SmallAction({
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
				flex: 1,
				alignItems: 'center',
				padding: 9,
				borderRadius: 11,
				backgroundColor: colors.accent,
			}}
		>
			<Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>
				{label}
			</Text>
		</TouchableOpacity>
	);
}
