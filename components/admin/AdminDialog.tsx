import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import AdminButton from '@/components/admin/AdminButton';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { getAdminTone, radius, space, type, type AdminIconName } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type AdminDialogTone = 'positive' | 'danger' | 'pending';

/** idle = confirm; busy = processing (buttons locked); success = completed, one "Done" button. */
export type AdminDialogStage = 'idle' | 'busy' | 'success';

export type AdminDialogProps = {
	visible: boolean;
	title: string;
	description?: string;
	children?: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	tone?: AdminDialogTone;
	/** Without `stage`: spinner in the confirm button while the form stays visible (legacy behaviour). */
	busy?: boolean;
	confirmDisabled?: boolean;
	onConfirm?: () => void;
	onClose: () => void;
	/** Tone icon badge (48pt soft circle). Defaults to 'alert-triangle' for danger and none otherwise; null hides it. */
	icon?: AdminIconName | null;
	/** Opt-in three-stage flow (custom-modals): pass 'busy' while the action runs and 'success' when it is done. */
	stage?: AdminDialogStage;
	/** Busy-stage copy; defaults to the title and "Please wait…". */
	busyTitle?: string;
	busyMessage?: string;
	/** Success-stage copy; defaults to "Done" and no message. */
	successTitle?: string;
	successMessage?: string;
	/** Success-stage button label; default "Done". */
	successLabel?: string;
	/** Success-stage button; defaults to onClose. */
	onSuccessClose?: () => void;
	/** Typed confirmation, e.g. "DELETE": Confirm stays disabled until the input matches exactly. */
	requireText?: string;
};

/**
 * Centered admin dialog with optional form fields; stays above the keyboard. Soft tone buttons, fixed footer, radius 24.
 * Used by the admin workspaces; the original props behave as before.
 */
export default function AdminDialog({
	visible,
	title,
	description,
	children,
	confirmLabel,
	cancelLabel = 'Cancel',
	tone = 'positive',
	busy = false,
	confirmDisabled = false,
	onConfirm,
	onClose,
	icon,
	stage,
	busyTitle,
	busyMessage,
	successTitle,
	successMessage,
	successLabel = 'Done',
	onSuccessClose,
	requireText,
}: AdminDialogProps) {
	const { colors } = useAppTheme();
	const [typedText, setTypedText] = useState('');
	const toneColors = getAdminTone(colors, tone);
	const positive = getAdminTone(colors, 'positive');
	const resolvedStage: AdminDialogStage = stage ?? 'idle';
	const isBusy = busy || resolvedStage === 'busy';
	const typedMatches = !requireText || typedText.trim() === requireText;
	const isConfirmDisabled = isBusy || confirmDisabled || !typedMatches;
	const badgeIcon: AdminIconName | null = icon === undefined ? (tone === 'danger' ? 'alert-triangle' : null) : icon;
	const handleSuccessClose = onSuccessClose ?? onClose;

	// A fresh confirmation every time the dialog opens.
	useEffect(() => {
		if (visible) setTypedText('');
	}, [visible]);

	const dismiss = isBusy ? undefined : resolvedStage === 'success' ? handleSuccessClose : onClose;

	const renderBadge = (name: AdminIconName, badgeTone: { soft: string; border: string; text: string }) => (
		<View
			style={{
				width: 48,
				height: 48,
				marginBottom: space.md,
				borderRadius: radius.pill,
				alignItems: 'center',
				justifyContent: 'center',
				borderWidth: 1,
				borderColor: badgeTone.border,
				backgroundColor: badgeTone.soft,
			}}
		>
			<Icon name={name} size={22} color={badgeTone.text} />
		</View>
	);

	const renderBody = () => {
		if (resolvedStage === 'success') {
			return (
				<>
					{renderBadge('check', positive)}
					<Text style={[type.title, { color: colors.text }]}>{successTitle ?? 'Done'}</Text>
					{successMessage ? <Text style={[type.body, { marginTop: space.sm, color: colors.secondaryText }]}>{successMessage}</Text> : null}
				</>
			);
		}
		if (resolvedStage === 'busy') {
			return (
				<>
					<View
						style={{
							width: 48,
							height: 48,
							marginBottom: space.md,
							borderRadius: radius.pill,
							alignItems: 'center',
							justifyContent: 'center',
							borderWidth: 1,
							borderColor: toneColors.border,
							backgroundColor: toneColors.soft,
						}}
					>
						<ActivityIndicator color={toneColors.text} />
					</View>
					<Text style={[type.title, { color: colors.text }]}>{busyTitle ?? title}</Text>
					<Text style={[type.body, { marginTop: space.sm, color: colors.secondaryText }]}>{busyMessage ?? 'Please wait…'}</Text>
				</>
			);
		}
		return (
			<>
				{badgeIcon ? renderBadge(badgeIcon, toneColors) : null}
				<Text style={[type.title, { color: colors.text }]}>{title}</Text>
				{description ? <Text style={[type.body, { marginTop: space.sm, color: colors.secondaryText }]}>{description}</Text> : null}
				{children ? <View style={{ marginTop: space.lg }}>{children}</View> : null}
				{requireText ? (
					<View style={{ marginTop: space.lg, gap: space.sm }}>
						<Text style={[type.meta, { color: colors.secondaryText }]}>
							Type <Text style={{ fontWeight: '700', color: colors.text }}>{requireText}</Text> to confirm.
						</Text>
						<TextInput
							value={typedText}
							onChangeText={setTypedText}
							editable={!isBusy}
							autoCapitalize="characters"
							autoCorrect={false}
							placeholder={requireText}
							placeholderTextColor={colors.mutedText}
							accessibilityLabel={`Type ${requireText} to confirm`}
							style={[
								type.body,
								{
									minHeight: 44,
									paddingHorizontal: space.md,
									borderRadius: radius.md,
									borderWidth: 1,
									borderColor: typedText && !typedMatches ? toneColors.border : colors.border,
									backgroundColor: colors.input,
									color: colors.text,
								},
							]}
						/>
					</View>
				) : null}
			</>
		);
	};

	const renderFooter = () => {
		if (resolvedStage === 'success') {
			return <AdminButton label={successLabel} tone="positive" emphasis="primary" onPress={handleSuccessClose} style={{ flex: 1 }} />;
		}
		const showConfirm = Boolean(onConfirm && confirmLabel);
		return (
			<>
				<AdminButton label={onConfirm ? cancelLabel : 'Close'} tone="neutral" disabled={isBusy} onPress={onClose} style={{ flex: 1 }} />
				{showConfirm && onConfirm && confirmLabel ? (
					<AdminButton label={confirmLabel} tone={tone} emphasis="primary" busy={isBusy} disabled={isConfirmDisabled} onPress={onConfirm} style={{ flex: 1 }} />
				) : null}
			</>
		);
	};

	return (
		<Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={dismiss}>
			<KeyboardSafeView style={{ flex: 1, backgroundColor: colors.modalScrim, justifyContent: 'center', padding: space.lg }}>
				<TouchableOpacity activeOpacity={1} onPress={dismiss} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} accessibilityLabel="Close dialog" />
				<View
					style={{
						maxHeight: '90%',
						borderRadius: radius.dialog,
						borderWidth: 1,
						borderColor: colors.border,
						backgroundColor: colors.elevated,
						overflow: 'hidden',
						shadowOpacity: 0.18,
						shadowRadius: 24,
						shadowOffset: { width: 0, height: 12 },
						elevation: 12,
					}}
				>
					<ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.xl, paddingBottom: space.lg }}>
						{renderBody()}
					</ScrollView>
					<View style={{ flexDirection: 'row', gap: space.md, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xl }}>{renderFooter()}</View>
				</View>
			</KeyboardSafeView>
		</Modal>
	);
}
