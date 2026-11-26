import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { toast } from 'sonner-native';
import AdminDialog from './AdminDialog';
import AdminListRow from './AdminListRow';
import AdminState from './AdminState';
import { readSingleFilter, type AnyFilterGroup, type FilterValues } from '@/components/ui/FilterSheet';
import { adminContentService, DELETABLE_CONTENT_TYPES } from '@/lib/services/AdminContentService';
import { adminUserService } from '@/lib/services/AdminUserService';
import type { DeletableContentType, DeletedContentRecord } from '@/lib/types/adminContent';
import { ADMIN_MIN_TOUCH, radius, space, type } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const TYPE_LABELS: { [contentType in DeletableContentType]: string } = {
	post: 'Posts',
	comment: 'Comments',
	product: 'Products',
	blog: 'Blogs',
	project: 'Projects',
	community: 'Communities',
	lime: 'Limes',
};
const DEFAULT_RESTORE_REASON = 'Restored after administrator review.';

export type DeletedContentTypeFilter = 'all' | DeletableContentType;

export type DeletedContentController = {
	records: DeletedContentRecord[];
	filteredRecords: DeletedContentRecord[];
	loading: boolean;
	refreshing: boolean;
	error: string;
	searchQuery: string;
	setSearchQuery: (next: string) => void;
	selectedType: DeletedContentTypeFilter;
	/** The Type group for the toolbar's Filters sheet. */
	filterGroups: AnyFilterGroup[];
	applyFilters: (values: FilterValues) => void;
	clearFilters: () => void;
	reload: (mode?: 'initial' | 'refresh') => Promise<void>;
	setRecords: (updater: (current: DeletedContentRecord[]) => DeletedContentRecord[]) => void;
};

/**
 * Data and filters for the Deleted tab. Loads lazily the first time `enabled` is true (the tab opens), so the
 * Moderation screen can build its toolbar and pull-to-refresh around it.
 */
export function useDeletedContent(enabled: boolean): DeletedContentController {
	const [records, setRecords] = useState<DeletedContentRecord[]>([]);
	const [selectedType, setSelectedType] = useState<DeletedContentTypeFilter>('all');
	const [searchQuery, setSearchQuery] = useState('');
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState('');
	const hasLoadedRef = useRef(false);
	/** Ignores a slower, older response so it cannot overwrite a newer one. */
	const requestRef = useRef(0);

	const reload = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
		const requestId = requestRef.current + 1;
		requestRef.current = requestId;
		if (mode === 'refresh') setRefreshing(true);
		else setLoading(true);
		try {
			const next = await adminContentService.getDeletedContent();
			if (requestRef.current !== requestId) return;
			setRecords(next);
			setError('');
		} catch (loadError: unknown) {
			if (requestRef.current !== requestId) return;
			console.error('[AdminDeletedContentPanel.fetchDeletedContent] Error:', loadError instanceof Error ? loadError.message : loadError);
			setError(loadError instanceof Error ? loadError.message : 'Unable to load deleted content');
		} finally {
			if (requestRef.current === requestId) {
				setLoading(false);
				setRefreshing(false);
			}
		}
	}, []);

	useEffect(() => {
		if (!enabled || hasLoadedRef.current) return;
		hasLoadedRef.current = true;
		void reload('initial');
	}, [enabled, reload]);

	const filteredRecords = useMemo(() => {
		const normalizedQuery = searchQuery.trim().toLowerCase();
		return records.filter((record) => {
			if (selectedType !== 'all' && record.contentType !== selectedType) return false;
			if (!normalizedQuery) return true;
			return [record.contentTitle, record.reason, record.authorId, record.contentId].some((value) => value.toLowerCase().includes(normalizedQuery));
		});
	}, [records, searchQuery, selectedType]);

	const filterGroups: AnyFilterGroup[] = [
		{
			key: 'type',
			label: 'Type',
			options: [{ value: 'all', label: 'All types' }, ...DELETABLE_CONTENT_TYPES.map((contentType) => ({ value: contentType, label: TYPE_LABELS[contentType] }))],
			value: selectedType,
			defaultValue: 'all',
		},
	];

	const applyFilters = (values: FilterValues) => {
		const nextType = readSingleFilter(values, 'type');
		setSelectedType(DELETABLE_CONTENT_TYPES.find((contentType) => contentType === nextType) ?? 'all');
	};

	const clearFilters = () => {
		setSelectedType('all');
		setSearchQuery('');
	};

	return {
		records,
		filteredRecords,
		loading,
		refreshing,
		error,
		searchQuery,
		setSearchQuery,
		selectedType,
		filterGroups,
		applyFilters,
		clearFilters,
		reload,
		setRecords,
	};
}

type AdminDeletedContentPanelProps = {
	controller: DeletedContentController;
};

const formatDeletedAt = (deletedAt: string | null): string => {
	if (!deletedAt) return 'Unknown deletion date';
	const parsed = new Date(deletedAt);
	return Number.isNaN(parsed.getTime()) ? 'Unknown deletion date' : parsed.toLocaleString();
};

/** The website's "Deleted Content" moderation tab: every current admin deletion, with restore and ban-author actions. */
export default function AdminDeletedContentPanel({ controller }: AdminDeletedContentPanelProps) {
	const { colors } = useAppTheme();
	const { filteredRecords, records, error, reload, refreshing, setRecords } = controller;
	const [processing, setProcessing] = useState(false);
	const [restoreTarget, setRestoreTarget] = useState<DeletedContentRecord | null>(null);
	const [restoreReason, setRestoreReason] = useState(DEFAULT_RESTORE_REASON);
	const [restoreMessage, setRestoreMessage] = useState('');
	const [banTarget, setBanTarget] = useState<DeletedContentRecord | null>(null);
	const [banReason, setBanReason] = useState('');
	const [actionError, setActionError] = useState('');
	/** Synchronous double-submit guard (state updates land a frame later). */
	const processingRef = useRef(false);

	const openRestore = (record: DeletedContentRecord) => {
		setActionError('');
		setRestoreTarget(record);
		setRestoreReason(DEFAULT_RESTORE_REASON);
		setRestoreMessage('');
	};

	const openBan = (record: DeletedContentRecord) => {
		setActionError('');
		setBanTarget(record);
		setBanReason(`Repeated or serious violation connected to deleted ${record.contentType}: ${record.reason}`);
	};

	const handleRestore = async (): Promise<void> => {
		if (!restoreTarget || !restoreReason.trim() || processingRef.current) return;
		processingRef.current = true;
		setProcessing(true);
		setActionError('');
		try {
			const result = await adminContentService.restoreContent({
				contentType: restoreTarget.contentType,
				contentId: restoreTarget.contentId,
				restoreReason: restoreReason.trim(),
				message: restoreMessage.trim() || undefined,
			});
			if (!result.success) throw new Error(result.error || 'Unable to restore content');
			const restoredId = restoreTarget.id;
			setRecords((current) => current.filter((record) => record.id !== restoredId));
			setRestoreTarget(null);
			setRestoreMessage('');
			toast.success('Content restored. The user was notified in Ourlime and by email.');
		} catch (restoreError: unknown) {
			console.error('[AdminDeletedContentPanel.handleRestore] Error:', restoreError instanceof Error ? restoreError.message : restoreError);
			setActionError(restoreError instanceof Error ? restoreError.message : 'Unable to restore content');
		} finally {
			processingRef.current = false;
			setProcessing(false);
		}
	};

	const handleBanAuthor = async (): Promise<void> => {
		if (!banTarget?.authorId || !banReason.trim()) {
			setActionError('A user and ban reason are required.');
			return;
		}
		if (processingRef.current) return;
		processingRef.current = true;
		setProcessing(true);
		setActionError('');
		try {
			await adminUserService.updateAccountStatus(banTarget.authorId, 'banned', banReason.trim(), null);
			const bannedAuthorId = banTarget.authorId;
			setRecords((current) => current.map((record) => (record.authorId === bannedAuthorId ? { ...record, authorStatus: 'banned', isAuthorBanned: true } : record)));
			setBanTarget(null);
			setBanReason('');
			toast.success('Author banned. Their account is now blocked.');
		} catch (banError: unknown) {
			console.error('[AdminDeletedContentPanel.handleBanAuthor] Error:', banError instanceof Error ? banError.message : banError);
			setActionError(banError instanceof Error ? banError.message : 'Unable to ban the author');
		} finally {
			processingRef.current = false;
			setProcessing(false);
		}
	};

	const textAreaStyle = [
		type.body,
		{ minHeight: 88, textAlignVertical: 'top' as const, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text },
	];
	const isFiltered = Boolean(controller.searchQuery.trim()) || controller.selectedType !== 'all';

	return (
		<View style={{ gap: space.md }}>
			<Text style={[type.meta, { color: colors.mutedText }]}>Every current deletion appears here, even when no appeal was submitted.</Text>
			{error ? <AdminState kind="inlineError" message={error} onRetry={() => void reload('refresh')} retrying={refreshing} /> : null}

			{filteredRecords.length ? (
				<View style={{ gap: space.sm }}>
					{filteredRecords.map((record) => (
						<AdminListRow
							key={record.id}
							title={record.contentTitle}
							subtitle={record.reason}
							meta={`${TYPE_LABELS[record.contentType] ?? record.contentType} · ${formatDeletedAt(record.deletedAt)} · by ${record.adminName}`}
							leading={record.authorId ? { kind: 'avatar', name: record.contentTitle, userId: record.authorId } : { kind: 'icon', name: 'trash-2', tone: 'danger' }}
							status={record.isAuthorBanned ? { label: 'Author banned', tone: 'danger' } : undefined}
							inlineAction={{ key: 'restore', label: 'Restore', icon: 'rotate-ccw', tone: 'positive', disabled: processing, onPress: () => openRestore(record) }}
							overflowActions={[
								{
									key: 'ban',
									label: record.isAuthorBanned ? 'Author already banned' : 'Ban author',
									icon: 'slash',
									tone: 'danger',
									disabled: !record.authorId || record.isAuthorBanned || processing,
									description: `Author ${record.authorId || 'unknown'} · Content ${record.contentId}`,
									onPress: () => openBan(record),
								},
							]}
						/>
					))}
				</View>
			) : records.length && isFiltered ? (
				<AdminState kind="empty" title="" filtered onClearFilters={controller.clearFilters} />
			) : error ? null : (
				<AdminState kind="empty" icon="check-circle" title="No deleted content" description="Nothing has been removed by an administrator." />
			)}

			<AdminDialog
				visible={Boolean(restoreTarget)}
				icon="rotate-ccw"
				title="Restore content"
				description={restoreTarget ? `Restore "${restoreTarget.contentTitle}"? The author is notified in Ourlime and by email.` : ''}
				confirmLabel={processing ? 'Restoring…' : 'Restore'}
				busy={processing}
				confirmDisabled={!restoreReason.trim()}
				onConfirm={() => void handleRestore()}
				onClose={() => {
					setRestoreTarget(null);
					setRestoreMessage('');
				}}
			>
				<View style={{ gap: space.md }}>
					{actionError ? <AdminState kind="inlineError" message={actionError} /> : null}
					<View style={{ gap: space.xs }}>
						<Text style={[type.label, { color: colors.mutedText }]}>Audit reason (required)</Text>
						<TextInput value={restoreReason} onChangeText={setRestoreReason} editable={!processing} maxLength={500} multiline accessibilityLabel="Audit reason" style={textAreaStyle} />
					</View>
					<View style={{ gap: space.xs }}>
						<Text style={[type.label, { color: colors.mutedText }]}>Message to the user (optional)</Text>
						<TextInput
							value={restoreMessage}
							onChangeText={setRestoreMessage}
							editable={!processing}
							maxLength={1000}
							multiline
							placeholder="Included in their Ourlime notification and email."
							placeholderTextColor={colors.mutedText}
							accessibilityLabel="Message to the user"
							style={textAreaStyle}
						/>
					</View>
				</View>
			</AdminDialog>

			<AdminDialog
				visible={Boolean(banTarget)}
				icon="slash"
				title="Ban author"
				description={banTarget ? `Ban the author of "${banTarget.contentTitle}"? Their account is blocked.` : ''}
				confirmLabel={processing ? 'Banning…' : 'Ban author'}
				tone="danger"
				busy={processing}
				confirmDisabled={!banReason.trim()}
				onConfirm={() => void handleBanAuthor()}
				onClose={() => {
					setBanTarget(null);
					setBanReason('');
				}}
			>
				<View style={{ gap: space.md }}>
					{actionError ? <AdminState kind="inlineError" message={actionError} /> : null}
					<View style={{ gap: space.xs }}>
						<Text style={[type.label, { color: colors.mutedText }]}>Ban reason (required)</Text>
						<TextInput value={banReason} onChangeText={setBanReason} editable={!processing} multiline accessibilityLabel="Ban reason" style={[textAreaStyle, { minHeight: ADMIN_MIN_TOUCH * 2 }]} />
					</View>
				</View>
			</AdminDialog>
		</View>
	);
}
