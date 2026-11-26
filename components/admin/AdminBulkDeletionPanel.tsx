import { useMemo, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import AdminPressable from '@/components/admin/AdminPressable';
import Icon from 'react-native-vector-icons/Feather';
import { toast } from 'sonner-native';
import AdminScreen from './AdminScreen';
import AdminSection from './AdminSection';
import AdminButton from './AdminButton';
import AdminState from './AdminState';
import AdminDialog, { type AdminDialogStage } from './AdminDialog';
import AdminFilterSheet from './AdminFilterSheet';
import { readSingleFilter, type FilterValues } from '@/components/ui/FilterSheet';
import { adminContentService, DELETABLE_CONTENT_TYPES } from '@/lib/services/AdminContentService';
import type { BulkDeletionItem, DeletableContentType, PredefinedDeletionCategory } from '@/lib/types/adminContent';
import { ADMIN_MIN_TOUCH, getAdminTone, radius, space, type } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const REASONS: readonly { value: PredefinedDeletionCategory; label: string }[] = [
	{ value: 'inappropriate', label: 'Inappropriate content' },
	{ value: 'harassment', label: 'Harassment & bullying' },
	{ value: 'spam', label: 'Spam & commercial fraud' },
	{ value: 'misinformation', label: 'Misinformation' },
	{ value: 'copyright', label: 'Copyright infringement' },
	{ value: 'safety', label: 'Child safety' },
	{ value: 'tos_violation', label: 'Terms of Service' },
	{ value: 'custom', label: 'Custom reason' },
];

const TYPE_LABELS: { [contentType in DeletableContentType]: string } = {
	post: 'Posts',
	comment: 'Comments',
	product: 'Products',
	blog: 'Blogs',
	project: 'Projects',
	community: 'Communities',
	lime: 'Limes',
};

const itemCountLabel = (count: number): string => `${count} ${count === 1 ? 'item' : 'items'}`;

/**
 * Bulk delete screen (the website's "Bulk Actions" moderation tab), opened from the Moderation overflow menu:
 * 1 type, 2 IDs, 3 reason, then "Delete N items" behind a typed DELETE confirmation.
 */
export default function AdminBulkDeletionPanel() {
	const { colors } = useAppTheme();
	const positive = getAdminTone(colors, 'positive');
	const [contentType, setContentType] = useState<DeletableContentType>('post');
	const [typeSheetOpen, setTypeSheetOpen] = useState(false);
	const [contentIds, setContentIds] = useState('');
	const [category, setCategory] = useState<PredefinedDeletionCategory>('spam');
	const [customReason, setCustomReason] = useState('');
	const [confirming, setConfirming] = useState(false);
	const [dialogStage, setDialogStage] = useState<AdminDialogStage>('idle');
	const [submitting, setSubmitting] = useState(false);
	const [errorMessage, setErrorMessage] = useState('');
	const [successMessage, setSuccessMessage] = useState('');
	/** Synchronous double-submit guard. */
	const submittingRef = useRef(false);

	const items = useMemo<BulkDeletionItem[]>(
		() => [...new Set(contentIds.split(/[\s,]+/).map((value) => value.trim()).filter(Boolean))].map((contentId) => ({ contentType, contentId })),
		[contentIds, contentType]
	);
	const isValid = items.length > 0 && (category !== 'custom' || Boolean(customReason.trim()));
	const canSubmit = !submitting && isValid;

	const handleApplyType = (values: FilterValues) => {
		const next = readSingleFilter(values, 'type');
		setContentType(DELETABLE_CONTENT_TYPES.find((option) => option === next) ?? contentType);
	};

	const openConfirm = () => {
		if (!canSubmit) return;
		setErrorMessage('');
		setDialogStage('idle');
		setConfirming(true);
	};

	const handleBulkDelete = async (): Promise<void> => {
		if (!isValid || submittingRef.current) return;
		submittingRef.current = true;
		setSubmitting(true);
		setDialogStage('busy');
		setErrorMessage('');
		setSuccessMessage('');
		try {
			const result = await adminContentService.bulkDeleteContent(items, category, customReason);
			const deletedNote = `${itemCountLabel(result.affectedCount)} deleted, audited, and their authors notified.`;
			if (result.failed.length === 0) {
				setContentIds('');
				setSuccessMessage(deletedNote);
				setDialogStage('success');
			} else {
				// Keep only the failed IDs so they can be retried.
				setContentIds(result.failed.map((failure) => failure.contentId).join('\n'));
				setErrorMessage(`${result.failed.length} failed: ${result.failed.map((failure) => `${failure.contentId} (${failure.error})`).join('; ')}`);
				setConfirming(false);
				setDialogStage('idle');
				if (result.affectedCount > 0) toast.success(deletedNote);
			}
		} catch (bulkError: unknown) {
			console.error('[AdminBulkDeletionPanel.handleBulkDelete] Error:', bulkError instanceof Error ? bulkError.message : bulkError);
			setErrorMessage(bulkError instanceof Error ? bulkError.message : 'Bulk deletion failed');
			setConfirming(false);
			setDialogStage('idle');
		} finally {
			submittingRef.current = false;
			setSubmitting(false);
		}
	};

	const handleCloseDialog = () => {
		if (submittingRef.current) return;
		setConfirming(false);
		setDialogStage('idle');
	};

	const inputStyle = [
		type.body,
		{ minHeight: ADMIN_MIN_TOUCH, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text },
	];

	return (
		<AdminScreen
			title="Bulk delete"
			subtitle="Delete many items of one type"
			state={{ kind: 'ready' }}
			backFallback="/admin/moderation"
			keyboardAware
			footer={
				<AdminButton
					label={submitting ? 'Deleting…' : `Delete ${itemCountLabel(items.length)}`}
					icon="trash-2"
					tone="danger"
					emphasis="primary"
					busy={submitting}
					disabled={!canSubmit}
					accessibilityHint={!items.length ? 'Enter at least one content ID first' : undefined}
					onPress={openConfirm}
					style={{ flex: 1 }}
				/>
			}
		>
			<View style={{ gap: space.lg }}>
				<AdminSection tone="danger" title="Bulk content deletion" description="Every item receives the same mandatory reason, an individual notification and an audit entry." />
				{errorMessage ? <AdminState kind="inlineError" message={errorMessage} /> : null}
				{successMessage ? (
					<View accessibilityRole="alert" style={{ padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: positive.border, backgroundColor: positive.soft }}>
						<Text style={[type.body, { color: positive.text }]}>{successMessage}</Text>
					</View>
				) : null}

				<AdminSection title="1. Content type">
					<AdminPressable
						onPress={() => setTypeSheetOpen(true)}
						disabled={submitting}
						accessibilityRole="button"
						accessibilityLabel={`Content type: ${TYPE_LABELS[contentType]}`}
						accessibilityHint="Opens the type picker"
						style={({ pressed }) => ({
							minHeight: ADMIN_MIN_TOUCH,
							flexDirection: 'row',
							alignItems: 'center',
							gap: space.sm,
							paddingHorizontal: space.md,
							borderRadius: radius.md,
							borderWidth: 1,
							borderColor: colors.border,
							backgroundColor: colors.input,
							opacity: pressed ? 0.7 : 1,
						})}
					>
						<Text style={[type.bodyStrong, { flex: 1, color: colors.text }]}>{TYPE_LABELS[contentType]}</Text>
						<Icon name="chevron-down" size={18} color={colors.icon} />
					</AdminPressable>
				</AdminSection>

				<AdminSection title="2. Content IDs" description="One per line or comma-separated. Duplicates are ignored.">
					<TextInput
						value={contentIds}
						onChangeText={setContentIds}
						editable={!submitting}
						multiline
						autoCapitalize="none"
						autoCorrect={false}
						accessibilityLabel="Content IDs"
						placeholder="One ID per line"
						placeholderTextColor={colors.mutedText}
						style={[inputStyle, { minHeight: 120, textAlignVertical: 'top' }]}
					/>
					<Text style={[type.meta, { color: colors.mutedText }]}>{itemCountLabel(items.length)} ready</Text>
				</AdminSection>

				<AdminSection title="3. Reason">
					<View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
						{REASONS.map((reason) => {
							const isSelected = category === reason.value;
							return (
								<AdminPressable
									key={reason.value}
									disabled={submitting}
									onPress={() => setCategory(reason.value)}
									accessibilityRole="radio"
									accessibilityLabel={reason.label}
									accessibilityState={{ selected: isSelected, disabled: submitting }}
									style={({ pressed }) => ({
										minHeight: ADMIN_MIN_TOUCH,
										flexDirection: 'row',
										alignItems: 'center',
										gap: space.md,
										paddingHorizontal: space.md,
										borderRadius: radius.md,
										borderWidth: 1,
										borderColor: isSelected ? positive.border : colors.border,
										backgroundColor: isSelected ? positive.soft : colors.surface,
										opacity: pressed ? 0.7 : 1,
									})}
								>
									<View style={{ width: 20, height: 20, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: isSelected ? positive.text : colors.border }}>
										{isSelected ? <View style={{ width: 10, height: 10, borderRadius: radius.pill, backgroundColor: positive.text }} /> : null}
									</View>
									<Text style={[type.bodyStrong, { flex: 1, color: isSelected ? positive.text : colors.text }]}>{reason.label}</Text>
								</AdminPressable>
							);
						})}
					</View>
					{category === 'custom' ? (
						<View style={{ gap: space.xs }}>
							<Text style={[type.label, { color: colors.mutedText }]}>Custom reason (required)</Text>
							<TextInput value={customReason} onChangeText={setCustomReason} editable={!submitting} accessibilityLabel="Custom reason" style={inputStyle} />
						</View>
					) : null}
				</AdminSection>
			</View>

			<AdminFilterSheet
				visible={typeSheetOpen}
				title="Content type"
				applyLabel="Use this type"
				groups={[
					{
						key: 'type',
						label: 'Type',
						options: DELETABLE_CONTENT_TYPES.map((option) => ({ value: option, label: TYPE_LABELS[option] })),
						value: contentType,
						defaultValue: 'post',
					},
				]}
				onApply={handleApplyType}
				onClose={() => setTypeSheetOpen(false)}
			/>

			<AdminDialog
				visible={confirming}
				tone="danger"
				icon="trash-2"
				title={`Delete ${itemCountLabel(items.length)}?`}
				description={`${TYPE_LABELS[contentType]}: each item is deleted with the reason "${category === 'custom' ? customReason.trim() : REASONS.find((reason) => reason.value === category)?.label ?? category}", its author is notified, and an audit entry is written.`}
				confirmLabel="Delete"
				requireText="DELETE"
				stage={dialogStage}
				busyTitle={`Deleting ${itemCountLabel(items.length)}…`}
				busyMessage="Please wait while the items are removed."
				successTitle="Bulk delete complete"
				successMessage={successMessage || undefined}
				onConfirm={() => void handleBulkDelete()}
				onClose={handleCloseDialog}
			/>
		</AdminScreen>
	);
}
