import { useMemo, useState } from 'react';
import {
	Modal,
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	ActivityIndicator,
	ScrollView,
	TextInput,
} from 'react-native';
import Animated from 'react-native-reanimated';
import {
	CheckCircle,
	ChevronLeft,
	ChevronRight,
	X,
	Flag,
	ShieldAlert,
} from 'lucide-react-native';
import { limeService } from '@/lib/services/LimeService';
import { AuthService } from '@/lib/services/AuthService';
import {
	CHILD_SAFETY_REASON_CATEGORY,
	REPORT_REASONS,
	type ReportReasonCategory,
} from '@/lib/services/ModerationService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';
import ChildSafetyIntakeFields from '@/components/safety/ChildSafetyIntakeFields';
import type { ChildSafetyDangerAnswer } from '@/lib/types/childSafety';
import { useRouter } from 'expo-router';

type ReportLimeModalProps = {
	visible: boolean;
	reelId: string;
	reportedUserId: string;
	reportType: 'lime' | 'user';
	onClose: () => void;
};

export default function ReportLimeModal({
	visible,
	reelId,
	reportedUserId,
	reportType,
	onClose,
}: ReportLimeModalProps) {
	const router = useRouter();
	const { colors } = useAppTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);
	const [selectedReason, setSelectedReason] = useState<string | null>(null);
	const [selectedCategory, setSelectedCategory] =
		useState<ReportReasonCategory | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const [description, setDescription] = useState('');
	const [immediateDanger, setImmediateDanger] =
		useState<ChildSafetyDangerAnswer>('unsure');
	const [goodFaithAcknowledged, setGoodFaithAcknowledged] = useState(false);
	const [allowContact, setAllowContact] = useState(true);
	const handleClose = () => {
		setSelectedReason(null);
		setSelectedCategory(null);
		setSubmitted(false);
		setDescription('');
		setImmediateDanger('unsure');
		setGoodFaithAcknowledged(false);
		setAllowContact(true);
		onClose();
	};
	const swipeDismiss = useSwipeDismiss({
		visible,
		onDismiss: handleClose,
		disabled: isSubmitting,
	});

	const handleSubmit = async () => {
		if (!selectedCategory || !selectedReason || isSubmitting) return;
		setIsSubmitting(true);
		try {
			const currentUserId =
				AuthService.getInstance().getCurrentUser()?.uid ?? '';
			const reference = await limeService.reportLime(
				reelId,
				reportedUserId,
				reportType,
				selectedReason,
				currentUserId,
				selectedCategory,
				description,
				{ immediateDanger, goodFaithAcknowledged, allowContact }
			);
			setSubmitted(true);
			if (selectedCategory === CHILD_SAFETY_REASON_CATEGORY)
				setDescription(`Confirmation reference: ${reference}`);
			setTimeout(
				() => {
					setSubmitted(false);
					setSelectedReason(null);
					setSelectedCategory(null);
					setDescription('');
					setImmediateDanger('unsure');
					setGoodFaithAcknowledged(false);
					setAllowContact(true);
					onClose();
				},
				selectedCategory === CHILD_SAFETY_REASON_CATEGORY ? 5200 : 1600
			);
		} catch {
			// ignore silently
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal
			visible={visible}
			transparent
			animationType="none"
			onRequestClose={swipeDismiss.dismissWithAnimation}
		>
			<View style={styles.backdrop} />
			<TouchableOpacity
				style={StyleSheet.absoluteFill}
				activeOpacity={1}
				onPress={handleClose}
			/>
			<Animated.View style={[styles.sheet, swipeDismiss.animatedStyle]}>
				<SwipeDismissHandle
					gesture={swipeDismiss.gesture}
					color={colors.border}
					animatedStyle={swipeDismiss.handleAnimatedStyle}
					accessibilityLabel="Swipe down to close Lime report"
				/>

				<View style={styles.header}>
					{selectedCategory ? (
						<TouchableOpacity
							onPress={() => {
								setSelectedCategory(null);
								setSelectedReason(null);
							}}
							style={styles.closeBtn}
						>
							<ChevronLeft size={20} color={colors.icon} />
						</TouchableOpacity>
					) : null}
					<Flag size={18} color={colors.destructive} />
					<Text style={styles.title}>
						{reportType === 'user' ? 'Report User' : 'Report Lime'}
					</Text>
					<TouchableOpacity
						onPress={handleClose}
						style={styles.closeBtn}
						activeOpacity={0.7}
					>
						<X size={20} color={colors.icon} />
					</TouchableOpacity>
				</View>

				{submitted ? (
					<View style={styles.successState}>
						<CheckCircle size={42} color={colors.successText} />
						<Text style={styles.successText}>
							{selectedCategory === CHILD_SAFETY_REASON_CATEGORY
								? 'Restricted report received'
								: 'Report submitted. Thank you!'}
						</Text>
						<Text style={styles.successSubtext}>
							{selectedCategory === CHILD_SAFETY_REASON_CATEGORY
								? description
								: "We'll review this and take action if needed."}
						</Text>
					</View>
				) : (
					<ScrollView
						showsVerticalScrollIndicator={false}
						contentContainerStyle={styles.formContent}
					>
						<Text style={styles.subtitle}>
							{selectedCategory
								? 'Why are you reporting this?'
								: 'What type of issue is this?'}
						</Text>

						<View style={styles.reasonGrid}>
							{!selectedCategory
								? (
										Object.entries(REPORT_REASONS) as [
											ReportReasonCategory,
											(typeof REPORT_REASONS)[ReportReasonCategory],
										][]
									).map(([category, group]) => (
										<TouchableOpacity
											key={category}
											onPress={() => {
												if (category === CHILD_SAFETY_REASON_CATEGORY) {
													handleClose();
													router.push({ pathname: '/help/child-safety/report', params: { targetType: reportType === 'user' ? 'profile' : 'lime', targetId: reportType === 'user' ? reportedUserId : reelId, ownerUserId: reportedUserId, routePath: reportType === 'user' ? `/profile/${reportedUserId}` : `/limes?limeId=${reelId}` } });
													return;
												}
												setSelectedCategory(category);
											}}
											style={[
												styles.categoryRow,
												category === CHILD_SAFETY_REASON_CATEGORY &&
													styles.childSafetyRow,
											]}
											activeOpacity={0.7}
										>
											{category === CHILD_SAFETY_REASON_CATEGORY ? (
												<ShieldAlert size={18} color={colors.destructiveText} />
											) : (
												<Flag size={17} color={colors.icon} />
											)}
											<Text
												style={[
													styles.categoryText,
													category === CHILD_SAFETY_REASON_CATEGORY &&
														styles.childSafetyText,
												]}
											>
												{group.label}
											</Text>
											<ChevronRight size={18} color={colors.icon} />
										</TouchableOpacity>
									))
								: REPORT_REASONS[selectedCategory].reasons.map((reason) => (
										<TouchableOpacity
											key={reason}
											onPress={() => setSelectedReason(reason)}
											style={[
												styles.reasonChip,
												selectedReason === reason && styles.reasonChipActive,
											]}
											activeOpacity={0.7}
										>
											<Text
												style={[
													styles.reasonText,
													selectedReason === reason && styles.reasonTextActive,
												]}
											>
												{reason}
											</Text>
										</TouchableOpacity>
									))}
						</View>

						{selectedReason ? (
							<TextInput
								value={description}
								onChangeText={setDescription}
								multiline
								maxLength={5000}
								placeholder={
									selectedCategory === CHILD_SAFETY_REASON_CATEGORY
										? 'Describe the concern (required, at least 20 characters). Do not paste suspected CSAM.'
										: 'Additional details (optional)'
								}
								placeholderTextColor={colors.mutedText}
								style={styles.descriptionInput}
							/>
						) : null}

						{selectedCategory === CHILD_SAFETY_REASON_CATEGORY &&
						selectedReason ? (
							<ChildSafetyIntakeFields
								immediateDanger={immediateDanger}
								goodFaithAcknowledged={goodFaithAcknowledged}
								allowContact={allowContact}
								onImmediateDangerChange={setImmediateDanger}
								onGoodFaithAcknowledgedChange={setGoodFaithAcknowledged}
								onAllowContactChange={setAllowContact}
							/>
						) : null}

						{selectedCategory ? (
							<TouchableOpacity
								onPress={() => void handleSubmit()}
								disabled={
									!selectedReason ||
									isSubmitting ||
									(selectedCategory === CHILD_SAFETY_REASON_CATEGORY &&
										(description.trim().length < 20 || !goodFaithAcknowledged))
								}
								style={[
									styles.submitBtn,
									(!selectedReason ||
										isSubmitting ||
										(selectedCategory === CHILD_SAFETY_REASON_CATEGORY &&
											(description.trim().length < 20 ||
												!goodFaithAcknowledged))) &&
										styles.submitBtnDisabled,
								]}
								activeOpacity={0.8}
							>
								{isSubmitting ? (
									<ActivityIndicator size="small" color="#ffffff" />
								) : (
									<Text style={styles.submitText}>Submit Report</Text>
								)}
							</TouchableOpacity>
						) : null}
					</ScrollView>
				)}
			</Animated.View>
		</Modal>
	);
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) =>
	StyleSheet.create({
		backdrop: {
			...StyleSheet.absoluteFill,
			backgroundColor: 'rgba(0,0,0,0.6)',
		},
		sheet: {
			position: 'absolute',
			bottom: 0,
			left: 0,
			right: 0,
			backgroundColor: colors.surface,
			borderTopLeftRadius: 24,
			borderTopRightRadius: 24,
			paddingHorizontal: 20,
			paddingBottom: 44,
			borderTopWidth: 1,
			borderColor: colors.border,
			maxHeight: '92%',
		},
		formContent: { paddingBottom: 4 },
		handle: {
			width: 40,
			height: 4,
			backgroundColor: colors.border,
			borderRadius: 2,
			alignSelf: 'center',
			marginTop: 12,
			marginBottom: 18,
		},
		header: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 8,
			marginBottom: 16,
		},
		title: {
			flex: 1,
			color: colors.text,
			fontSize: 16,
			fontWeight: '800',
		},
		closeBtn: {
			padding: 4,
		},
		subtitle: {
			color: colors.mutedText,
			fontSize: 13,
			marginBottom: 14,
		},
		reasonGrid: {
			flexDirection: 'row',
			flexWrap: 'wrap',
			gap: 10,
			marginBottom: 22,
		},
		categoryRow: {
			width: '100%',
			minHeight: 48,
			paddingHorizontal: 14,
			flexDirection: 'row',
			alignItems: 'center',
			gap: 10,
			borderRadius: 14,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.control,
		},
		categoryText: {
			flex: 1,
			color: colors.secondaryText,
			fontSize: 13,
			fontWeight: '700',
		},
		childSafetyRow: {
			borderColor: colors.destructive,
			backgroundColor: colors.destructiveSurface,
		},
		childSafetyText: { color: colors.destructiveText },
		childSafetyNotice: {
			marginBottom: 18,
			padding: 13,
			borderRadius: 13,
			borderWidth: 1,
			borderColor: colors.destructive,
			backgroundColor: colors.destructiveSurface,
		},
		childSafetyNoticeTitle: {
			color: colors.destructiveText,
			fontWeight: '800',
			fontSize: 13,
		},
		childSafetyNoticeText: {
			marginTop: 5,
			color: colors.destructiveText,
			fontSize: 12,
			lineHeight: 18,
		},
		descriptionInput: {
			minHeight: 100,
			marginBottom: 12,
			padding: 12,
			borderRadius: 14,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.input,
			color: colors.text,
			textAlignVertical: 'top',
		},
		reasonChip: {
			paddingHorizontal: 14,
			paddingVertical: 9,
			borderRadius: 20,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.control,
		},
		reasonChipActive: {
			borderColor: '#ef4444',
			backgroundColor: 'rgba(239,68,68,0.15)',
		},
		reasonText: {
			color: colors.mutedText,
			fontSize: 13,
			fontWeight: '600',
		},
		reasonTextActive: {
			color: '#ef4444',
			fontWeight: '700',
		},
		submitBtn: {
			backgroundColor: '#ef4444',
			paddingVertical: 14,
			borderRadius: 14,
			alignItems: 'center',
			justifyContent: 'center',
		},
		submitBtnDisabled: {
			opacity: 0.4,
		},
		submitText: {
			color: '#ffffff',
			fontSize: 15,
			fontWeight: '700',
		},
		successState: {
			paddingVertical: 32,
			alignItems: 'center',
			gap: 8,
		},
		successText: {
			color: '#10b981',
			fontSize: 15,
			fontWeight: '800',
		},
		successSubtext: {
			color: colors.mutedText,
			fontSize: 13,
			textAlign: 'center',
		},
	});
