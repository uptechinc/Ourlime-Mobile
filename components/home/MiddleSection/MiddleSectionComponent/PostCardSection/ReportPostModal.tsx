import { useState } from 'react';
import {
	ActivityIndicator,
	Image,
	Modal,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/Feather';
import {
	ModerationService,
	CHILD_SAFETY_REASON_CATEGORY,
	REPORT_REASONS,
	type ReportReasonCategory,
	type ReportEvidenceDraft,
} from '@/lib/services/ModerationService';
import type { PostItem } from '@/lib/services/PostService';
import CustomModal, { type CustomModalType } from '@/components/ui/CustomModal';
import { CommunityService } from '@/lib/services/CommunityService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { linkPresentationService } from '@/lib/services/LinkPresentationService';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';
import ChildSafetyIntakeFields from '@/components/safety/ChildSafetyIntakeFields';
import type { ChildSafetyDangerAnswer } from '@/lib/types/childSafety';
import { useRouter } from 'expo-router';

type ReportPostModalProps = {
	visible: boolean;
	post: PostItem;
	onClose: () => void;
};

const moderationService = ModerationService.getInstance();
const communityService = CommunityService.getInstance();

export default function ReportPostModal({
	visible,
	post,
	onClose,
}: ReportPostModalProps) {
	const router = useRouter();
	const { colors } = useAppTheme();
	const [category, setCategory] = useState<ReportReasonCategory | null>(null);
	const [reason, setReason] = useState('');
	const [description, setDescription] = useState('');
	const [submitting, setSubmitting] = useState(false);
	const [evidenceFiles, setEvidenceFiles] = useState<ReportEvidenceDraft[]>([]);
	const [immediateDanger, setImmediateDanger] =
		useState<ChildSafetyDangerAnswer>('unsure');
	const [goodFaithAcknowledged, setGoodFaithAcknowledged] = useState(false);
	const [allowContact, setAllowContact] = useState(true);
	const [feedback, setFeedback] = useState<{
		title: string;
		message: string;
		type: CustomModalType;
	} | null>(null);
	const handleClose = () => {
		if (submitting) return;
		setCategory(null);
		setReason('');
		setDescription('');
		setEvidenceFiles([]);
		setImmediateDanger('unsure');
		setGoodFaithAcknowledged(false);
		setAllowContact(true);
		onClose();
	};
	const swipeDismiss = useSwipeDismiss({
		visible,
		onDismiss: handleClose,
		disabled: submitting,
	});

	const handlePickEvidence = async () => {
		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (!permission.granted) {
			setFeedback({
				title: 'Permission needed',
				message: 'Allow photo access to attach report evidence.',
				type: 'warning',
			});
			return;
		}
		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsMultipleSelection: true,
			selectionLimit: Math.max(1, 3 - evidenceFiles.length),
			quality: 0.85,
		});
		if (result.canceled) return;
		const accepted: ReportEvidenceDraft[] = [];
		const rejected: string[] = [];
		result.assets.slice(0, 3 - evidenceFiles.length).forEach((asset, index) => {
			const fileName =
				asset.fileName ?? `report-evidence-${Date.now()}-${index}.jpg`;
			if ((asset.fileSize ?? 0) > 10 * 1024 * 1024)
				rejected.push(`${fileName} exceeds 10 MB.`);
			else
				accepted.push({
					uri: asset.uri,
					fileName,
					mimeType: asset.mimeType ?? undefined,
					fileSize: asset.fileSize,
				});
		});
		setEvidenceFiles((current) => [...current, ...accepted].slice(0, 3));
		if (rejected.length > 0)
			setFeedback({
				title: 'Evidence not added',
				message: rejected.join('\n'),
				type: 'warning',
			});
	};

	const handleSubmit = async () => {
		if (!category || !reason || submitting) return;
		setSubmitting(true);
		try {
			if (
				post.origin === 'community' &&
				post.communityId &&
				category !== CHILD_SAFETY_REASON_CATEGORY
			) {
				await communityService.reportContent({
					communityId: post.communityId,
					targetId: post.id,
					targetType: 'post',
					reason,
					details: description,
				});
			} else {
				const reference = await moderationService.reportPost({
					targetId: post.id,
					reportedUserId: post.userId,
					reasonCategory: category,
					reason,
					description,
					contentUrl: post.media[0]?.typeUrl,
					evidenceFiles:
						category === CHILD_SAFETY_REASON_CATEGORY ? [] : evidenceFiles,
					immediateDanger,
					goodFaithAcknowledged,
					allowContact,
				});
				if (category === CHILD_SAFETY_REASON_CATEGORY) {
					setSubmitting(false);
					handleClose();
					setFeedback({
						title: 'Restricted report received',
						message: `Keep this confirmation reference: ${reference}`,
						type: 'success',
					});
					return;
				}
			}
			setSubmitting(false);
			handleClose();
			setFeedback({
				title: 'Report submitted',
				message: 'Our moderation team will review this post.',
				type: 'success',
			});
		} catch (error: unknown) {
			setFeedback({
				title: 'Report not submitted',
				message: error instanceof Error ? error.message : 'Please try again',
				type: 'danger',
			});
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<>
			<Modal
				visible={visible}
				transparent
				statusBarTranslucent
				navigationBarTranslucent
				presentationStyle="overFullScreen"
				animationType="none"
				onRequestClose={swipeDismiss.dismissWithAnimation}
			>
				<Animated.View style={[{ flex: 1 }, swipeDismiss.animatedStyle]}>
					<SafeAreaView
						style={{ flex: 1, backgroundColor: colors.canvas }}
						edges={['top', 'left', 'right']}
					>
						<SwipeDismissHandle
							gesture={swipeDismiss.gesture}
							color={colors.border}
							animatedStyle={swipeDismiss.handleAnimatedStyle}
							accessibilityLabel="Swipe down to close post report"
						/>
						<View
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								padding: 15,
								borderBottomWidth: 1,
								borderBottomColor: colors.border,
								backgroundColor: colors.surface,
							}}
						>
							{category ? (
								<TouchableOpacity
									onPress={() => {
										setCategory(null);
										setReason('');
									}}
									style={{ padding: 7 }}
								>
									<Icon name="arrow-left" size={22} color={colors.icon} />
								</TouchableOpacity>
							) : null}
							<View style={{ flex: 1, marginLeft: category ? 5 : 0 }}>
								<Text
									style={{
										color: colors.text,
										fontSize: 18,
										fontWeight: '800',
									}}
								>
									Report Post
								</Text>
								<Text style={{ color: colors.mutedText, fontSize: 12 }}>
									Help us keep Ourlime safe
								</Text>
							</View>
							<TouchableOpacity onPress={handleClose} style={{ padding: 7 }}>
								<Icon name="x" size={22} color={colors.icon} />
							</TouchableOpacity>
						</View>
						<ScrollView
							contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
						>
							<View
								style={{
									padding: 13,
									borderRadius: 14,
									backgroundColor: colors.control,
									marginBottom: 18,
								}}
							>
								<Text numberOfLines={3} style={{ color: colors.secondaryText }}>
									{linkPresentationService.compactUrlsInText(
										post.caption || post.description || 'Post content'
									)}
								</Text>
							</View>
							{!category ? (
								<View>
									<Text
										style={{
											marginBottom: 12,
											color: colors.text,
											fontWeight: '800',
										}}
									>
										What type of issue is this?
									</Text>
									{(
										Object.entries(REPORT_REASONS) as [
											ReportReasonCategory,
											(typeof REPORT_REASONS)[ReportReasonCategory],
										][]
									).map(([key, group]) => (
										<TouchableOpacity
											key={key}
										onPress={() => {
											if (key === CHILD_SAFETY_REASON_CATEGORY) {
												handleClose();
												router.push({ pathname: '/help/child-safety/report', params: { targetType: 'post', targetId: post.id, ownerUserId: post.userId, routePath: `/post/${post.id}` } });
												return;
											}
											setCategory(key);
										}}
											style={{
												flexDirection: 'row',
												alignItems: 'center',
												marginBottom: 10,
												padding: 15,
												borderRadius: 15,
												borderWidth: 1,
												borderColor:
													key === CHILD_SAFETY_REASON_CATEGORY
														? colors.destructive
														: colors.border,
												backgroundColor:
													key === CHILD_SAFETY_REASON_CATEGORY
														? colors.destructiveSurface
														: colors.surface,
											}}
										>
											<Icon
												name={
													key === CHILD_SAFETY_REASON_CATEGORY
														? 'shield'
														: 'alert-circle'
												}
												size={19}
												color={colors.destructive}
											/>
											<Text
												style={{
													flex: 1,
													marginLeft: 11,
													color:
														key === CHILD_SAFETY_REASON_CATEGORY
															? colors.destructiveText
															: colors.secondaryText,
													fontWeight: '700',
												}}
											>
												{group.label}
											</Text>
											<Icon
												name="chevron-right"
												size={19}
												color={colors.icon}
											/>
										</TouchableOpacity>
									))}
								</View>
							) : (
								<View>
									<Text
										style={{
											marginBottom: 12,
											color: colors.text,
											fontWeight: '800',
										}}
									>
										Why are you reporting this post?
									</Text>
									{REPORT_REASONS[category].reasons.map((item) => (
										<TouchableOpacity
											key={item}
											onPress={() => setReason(item)}
											style={{
												flexDirection: 'row',
												alignItems: 'center',
												marginBottom: 9,
												padding: 14,
												borderRadius: 14,
												borderWidth: 1,
												borderColor:
													reason === item ? colors.destructive : colors.border,
												backgroundColor:
													reason === item
														? colors.destructiveSurface
														: colors.surface,
											}}
										>
											<View
												style={{
													width: 19,
													height: 19,
													borderRadius: 10,
													borderWidth: 2,
													borderColor:
														reason === item
															? colors.destructive
															: colors.border,
													alignItems: 'center',
													justifyContent: 'center',
												}}
											>
												{reason === item ? (
													<View
														style={{
															width: 9,
															height: 9,
															borderRadius: 5,
															backgroundColor: colors.destructive,
														}}
													/>
												) : null}
											</View>
											<Text
												style={{
													flex: 1,
													marginLeft: 11,
													color:
														reason === item
															? colors.destructiveText
															: colors.secondaryText,
													fontWeight: '600',
												}}
											>
												{item}
											</Text>
										</TouchableOpacity>
									))}
									{reason ? (
										<TextInput
											value={description}
											onChangeText={setDescription}
											multiline
											maxLength={2000}
											placeholder={
												category === CHILD_SAFETY_REASON_CATEGORY
													? 'Describe the concern (required, at least 20 characters). Do not paste suspected CSAM.'
													: 'Additional details (optional)'
											}
											placeholderTextColor={colors.mutedText}
											style={{
												minHeight: 105,
												marginTop: 10,
												padding: 13,
												borderRadius: 14,
												borderWidth: 1,
												borderColor: colors.border,
												backgroundColor: colors.input,
												color: colors.text,
												textAlignVertical: 'top',
											}}
										/>
									) : null}
									{reason && category === CHILD_SAFETY_REASON_CATEGORY ? (
										<ChildSafetyIntakeFields
											immediateDanger={immediateDanger}
											goodFaithAcknowledged={goodFaithAcknowledged}
											allowContact={allowContact}
											onImmediateDangerChange={setImmediateDanger}
											onGoodFaithAcknowledgedChange={setGoodFaithAcknowledged}
											onAllowContactChange={setAllowContact}
										/>
									) : reason ? (
										<View style={{ marginTop: 14 }}>
											<TouchableOpacity
												onPress={() => void handlePickEvidence()}
												disabled={evidenceFiles.length >= 3}
												style={{
													flexDirection: 'row',
													alignItems: 'center',
													justifyContent: 'center',
													padding: 13,
													borderWidth: 1,
													borderStyle: 'dashed',
													borderColor: '#c64d53',
													borderRadius: 14,
												}}
											>
												<Icon name="paperclip" size={18} color="#c64d53" />
												<Text
													style={{
														marginLeft: 8,
														color: '#991b1b',
														fontWeight: '700',
													}}
												>
													Add evidence ({evidenceFiles.length}/3, 10 MB each)
												</Text>
											</TouchableOpacity>
											{evidenceFiles.length > 0 ? (
												<ScrollView
													horizontal
													showsHorizontalScrollIndicator={false}
													style={{ marginTop: 10 }}
												>
													{evidenceFiles.map((file, index) => (
														<View
															key={`${file.uri}-${index}`}
															style={{ marginRight: 9 }}
														>
															<Image
																source={{ uri: file.uri }}
																style={{
																	width: 84,
																	height: 84,
																	borderRadius: 10,
																}}
															/>
															<TouchableOpacity
																onPress={() =>
																	setEvidenceFiles((current) =>
																		current.filter(
																			(_, itemIndex) => itemIndex !== index
																		)
																	)
																}
																style={{
																	position: 'absolute',
																	right: 3,
																	top: 3,
																	width: 23,
																	height: 23,
																	borderRadius: 12,
																	backgroundColor: '#111827cc',
																	alignItems: 'center',
																	justifyContent: 'center',
																}}
															>
																<Icon name="x" size={14} color="#ffffff" />
															</TouchableOpacity>
														</View>
													))}
												</ScrollView>
											) : null}
										</View>
									) : null}
								</View>
							)}
						</ScrollView>
						{category ? (
							<View
								style={{
									padding: 15,
									borderTopWidth: 1,
									borderTopColor: colors.border,
									backgroundColor: colors.surface,
								}}
							>
								<TouchableOpacity
									disabled={
										!reason ||
										submitting ||
										(category === CHILD_SAFETY_REASON_CATEGORY &&
											(description.trim().length < 20 ||
												!goodFaithAcknowledged))
									}
									onPress={() => void handleSubmit()}
									style={{
										alignItems: 'center',
										borderRadius: 17,
										paddingVertical: 13,
										backgroundColor:
											reason &&
											(category !== CHILD_SAFETY_REASON_CATEGORY ||
												(description.trim().length >= 20 &&
													goodFaithAcknowledged))
												? colors.destructive
												: colors.disabled,
									}}
								>
									{submitting ? (
										<ActivityIndicator color={colors.onAccent} />
									) : (
										<Text
											style={{
												color:
													reason &&
													(category !== CHILD_SAFETY_REASON_CATEGORY ||
														(description.trim().length >= 20 &&
															goodFaithAcknowledged))
														? colors.onAccent
														: colors.disabledText,
												fontWeight: '800',
											}}
										>
											Submit Report
										</Text>
									)}
								</TouchableOpacity>
							</View>
						) : null}
					</SafeAreaView>
				</Animated.View>
			</Modal>
			<CustomModal
				visible={feedback !== null}
				type={feedback?.type}
				title={feedback?.title ?? ''}
				message={feedback?.message ?? ''}
				onClose={() => setFeedback(null)}
			/>
		</>
	);
}
