import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import CachedImage from '@/components/ui/CachedImage';
import { readMultiFilter, readSingleFilter, type AnyFilterGroup, type FilterValues } from '@/components/ui/FilterSheet';
import AdminScreen, { type AdminScreenState } from './AdminScreen';
import AdminToolbar, { type AdminToolbarSegments } from './AdminToolbar';
import AdminListRow from './AdminListRow';
import AdminStatCard, { AdminStatGrid } from './AdminStatCard';
import AdminState from './AdminState';
import AdminSection from './AdminSection';
import AdminStatusPill from './AdminStatusPill';
import AdminButton from './AdminButton';
import AdminIconButton from './AdminIconButton';
import AdminOverflowMenu from './AdminOverflowMenu';
import AdminDialog from './AdminDialog';
import {
	AdminWorkspaceService,
	type AdminStickerFields,
	type AdminWorkspaceItem,
	type AdminWorkspaceKind,
	type AdminWorkspaceStats,
	type AdminWorkspaceStatus,
} from '@/lib/services/AdminWorkspaceService';
import { ADMIN_MIN_TOUCH, getAdminTone, radius, space, type, type AdminIconName, type AdminToneName } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type AdminCollectionWorkspaceProps = {
	kind: AdminWorkspaceKind;
	title: string;
	subtitle: string;
	/** 2–3 mutually exclusive views shown at the top of the toolbar (e.g. Sticker Packs / Stickers). */
	segments?: AdminToolbarSegments;
};

const workspaceService = AdminWorkspaceService.getInstance();
/** Product decisions that hide a listing; the server requires a reason the seller sees (like the web reject dialog). */
const PRODUCT_HIDING_STATUSES: readonly AdminWorkspaceStatus[] = ['rejected', 'disabled', 'archived'];
const STATUS_OPTIONS: readonly AdminWorkspaceStatus[] = ['active', 'approved', 'pending', 'rejected', 'archived', 'disabled'];

type SortOption = 'newest' | 'oldest' | 'name' | 'most-members' | 'price-desc' | 'price-asc';
type PriceFilter = 'all' | 'under50' | '50to200' | '200to500' | 'above500';
type PrivacyFilter = 'all' | 'public' | 'private';

const SORT_LABELS: { [option in SortOption]: string } = {
	newest: 'Newest',
	oldest: 'Oldest',
	name: 'A-Z',
	'most-members': 'Most members',
	'price-desc': 'Price high-low',
	'price-asc': 'Price low-high',
};
const PRICE_FILTERS: readonly { value: PriceFilter; label: string }[] = [
	{ value: 'all', label: 'All prices' },
	{ value: 'under50', label: 'Under $50' },
	{ value: '50to200', label: '$50 - $200' },
	{ value: '200to500', label: '$200 - $500' },
	{ value: 'above500', label: '$500+' },
];
const PRIVACY_FILTERS: readonly { value: PrivacyFilter; label: string }[] = [
	{ value: 'all', label: 'All privacy types' },
	{ value: 'public', label: 'Public' },
	{ value: 'private', label: 'Private' },
];

const KIND_ICONS: { [workspaceKind in AdminWorkspaceKind]: AdminIconName } = {
	products: 'shopping-bag',
	communities: 'users',
	sticker_packs: 'package',
	stickers: 'smile',
};
const KIND_NOUNS: { [workspaceKind in AdminWorkspaceKind]: string } = {
	products: 'products',
	communities: 'communities',
	sticker_packs: 'sticker packs',
	stickers: 'stickers',
};

const sortOptionsFor = (kind: AdminWorkspaceKind): readonly SortOption[] =>
	kind === 'communities' ? ['most-members', 'newest', 'oldest', 'name'] : kind === 'products' ? ['newest', 'oldest', 'price-desc', 'price-asc'] : ['newest', 'oldest', 'name'];
const defaultSortFor = (kind: AdminWorkspaceKind): SortOption => (kind === 'communities' ? 'most-members' : 'newest');

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/** Tone for a moderation status pill. */
const statusTone = (status: AdminWorkspaceStatus): AdminToneName => {
	if (status === 'active' || status === 'approved') return 'positive';
	if (status === 'rejected' || status === 'disabled') return 'danger';
	if (status === 'pending') return 'pending';
	return 'neutral';
};

const matchesPrice = (price: number, filter: PriceFilter): boolean => {
	if (filter === 'under50') return price < 50;
	if (filter === '50to200') return price >= 50 && price <= 200;
	if (filter === '200to500') return price > 200 && price <= 500;
	if (filter === 'above500') return price > 500;
	return true;
};

type StatCardModel = { label: string; value: number; onPress?: () => void };
type SheetNotice = { tone: 'positive' | 'danger'; message: string } | null;

type CollectionRecordSheetProps = {
	kind: AdminWorkspaceKind;
	record: AdminWorkspaceItem | null;
	busy: boolean;
	onClose: () => void;
	/** Resolves with the status the server stored; throws on failure. */
	onApplyStatus: (nextStatus: AdminWorkspaceStatus, reason: string | undefined) => Promise<AdminWorkspaceStatus>;
	onSaveStickerFields: (fields: AdminStickerFields) => Promise<void>;
	/** Throws on failure; the parent closes the sheet on success. */
	onDelete: () => Promise<void>;
};

/** Full-screen record detail: header with thumbnail and status, Details, Edit (stickers), Decision, and a sticky "Apply". */
function CollectionRecordSheet({ kind, record, busy, onClose, onApplyStatus, onSaveStickerFields, onDelete }: CollectionRecordSheetProps) {
	const { colors } = useAppTheme();
	const insets = useSafeAreaInsets();
	const positive = getAdminTone(colors, 'positive');
	const [draftStatus, setDraftStatus] = useState<AdminWorkspaceStatus | null>(record?.status ?? null);
	const [reviewReason, setReviewReason] = useState('');
	const [stickerFields, setStickerFields] = useState<AdminStickerFields | null>(record?.stickerFields ?? null);
	const [notice, setNotice] = useState<SheetNotice>(null);
	const [confirmingStatus, setConfirmingStatus] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const visible = Boolean(record);
	const isPermanentDelete = kind !== 'products';

	const stickerFieldList: readonly { key: keyof AdminStickerFields; label: string; placeholder: string }[] =
		kind === 'sticker_packs'
			? [
					{ key: 'name', label: 'Pack name', placeholder: 'e.g. Reactions' },
					{ key: 'description', label: 'Description', placeholder: 'Short description' },
					{ key: 'icon', label: 'Icon', placeholder: '/images/stickers/reactions/Laughing.png' },
					{ key: 'folder', label: 'Folder', placeholder: 'Must match public/images/stickers/ folder' },
				]
			: [
					{ key: 'name', label: 'Sticker name', placeholder: 'e.g. Thumbs Up' },
					{ key: 'packId', label: 'Pack ID', placeholder: 'e.g. reactions' },
					{ key: 'imageUrl', label: 'Image URL', placeholder: '/images/stickers/reactions/thumbs-up.png' },
					{ key: 'category', label: 'Category', placeholder: 'e.g. reaction' },
					{ key: 'keywords', label: 'Keywords (comma separated)', placeholder: 'happy, smile, lol' },
				];

	const needsReason = kind === 'products' && draftStatus !== null && PRODUCT_HIDING_STATUSES.includes(draftStatus);
	const canApply = Boolean(record) && draftStatus !== null && draftStatus !== record?.status && !busy && (!needsReason || Boolean(reviewReason.trim()));
	const confirmTone: 'pending' | 'danger' = draftStatus === 'disabled' ? 'danger' : 'pending';

	const inputStyle = [
		type.body,
		{ minHeight: ADMIN_MIN_TOUCH, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text },
	];

	const runApply = async () => {
		if (!record || !draftStatus || !canApply) return;
		setConfirmingStatus(false);
		setNotice(null);
		try {
			const appliedStatus = await onApplyStatus(draftStatus, needsReason ? reviewReason.trim() : undefined);
			if (needsReason) setReviewReason('');
			setDraftStatus(appliedStatus);
			setNotice({ tone: 'positive', message: `${record.title} is now ${appliedStatus}.` });
		} catch (actionError: unknown) {
			setNotice({ tone: 'danger', message: actionError instanceof Error ? actionError.message : 'Status could not be updated.' });
		}
	};

	const handleApplyPress = () => {
		if (!canApply) return;
		// Rejecting or disabling hides the record from members: confirm first.
		if (draftStatus === 'rejected' || draftStatus === 'disabled') {
			setConfirmingStatus(true);
			return;
		}
		void runApply();
	};

	const handleSaveSticker = async () => {
		if (!stickerFields || busy) return;
		setNotice(null);
		try {
			await onSaveStickerFields(stickerFields);
			setNotice({ tone: 'positive', message: kind === 'sticker_packs' ? 'Pack updated.' : 'Sticker updated.' });
		} catch (saveError: unknown) {
			setNotice({ tone: 'danger', message: saveError instanceof Error ? saveError.message : 'Changes could not be saved.' });
		}
	};

	const handleConfirmDelete = async () => {
		if (busy) return;
		try {
			await onDelete();
			setConfirmingDelete(false);
		} catch (deleteError: unknown) {
			setConfirmingDelete(false);
			setNotice({ tone: 'danger', message: deleteError instanceof Error ? deleteError.message : 'Item could not be deleted.' });
		}
	};

	return (
		<Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" presentationStyle="overFullScreen" onRequestClose={busy ? undefined : onClose}>
			<SwipeDismissSurface visible={visible} onDismiss={onClose} handleColor={colors.border} disabled={busy} accessibilityLabel="Swipe down to close admin record" style={{ flex: 1, backgroundColor: colors.canvas }}>
				<SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
					<View
						style={{
							minHeight: 56,
							flexDirection: 'row',
							alignItems: 'center',
							gap: space.xs,
							paddingHorizontal: space.xs,
							backgroundColor: colors.navigation,
							borderBottomWidth: 1,
							borderBottomColor: colors.border,
						}}
					>
						<AdminIconButton icon="x" label="Close record" disabled={busy} onPress={onClose} />
						<Text numberOfLines={1} accessibilityRole="header" style={[type.title, { flex: 1, marginLeft: space.xs, color: colors.text }]}>
							{record?.title}
						</Text>
						<AdminOverflowMenu
							title={record?.title ?? 'Record'}
							disabled={busy}
							items={[
								{
									key: 'delete',
									label: kind === 'products' ? 'Delete listing' : 'Delete permanently',
									icon: 'trash-2',
									tone: 'danger',
									description: kind === 'products' ? 'Can be restored from Moderation > Deleted' : 'Cannot be undone',
									onPress: () => setConfirmingDelete(true),
								},
							]}
						/>
					</View>
					{record ? (
						<KeyboardSafeView style={{ flex: 1 }}>
							<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl, gap: space.lg }}>
								<View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
									{record.imageUrl ? (
										<CachedImage uri={record.imageUrl} style={{ width: 64, height: 64, borderRadius: radius.md }} />
									) : (
										<View style={{ width: 64, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: positive.border, backgroundColor: positive.soft }}>
											<Text style={[type.title, { color: positive.text }]}>{record.title.charAt(0).toUpperCase() || '?'}</Text>
										</View>
									)}
									<View style={{ flex: 1, gap: space.xs }}>
										<Text numberOfLines={2} style={[type.section, { color: colors.text }]}>
											{record.title}
										</Text>
										{record.subtitle ? (
											<Text numberOfLines={1} style={[type.meta, { color: colors.mutedText }]}>
												{record.subtitle}
												{record.metricLabel ? ` · ${record.metricLabel}` : ''}
											</Text>
										) : null}
										<AdminStatusPill label={record.status} tone={statusTone(record.status)} />
									</View>
								</View>

								{notice ? (
									notice.tone === 'danger' ? (
										<AdminState kind="inlineError" message={notice.message} />
									) : (
										<View accessibilityRole="alert" style={{ padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: positive.border, backgroundColor: positive.soft }}>
											<Text style={[type.body, { color: positive.text }]}>{notice.message}</Text>
										</View>
									)
								) : null}

								<AdminSection title="Details">
									<Text style={[type.body, { color: colors.secondaryText }]}>{record.description || 'No description supplied.'}</Text>
									<View style={{ gap: space.xs }}>
										<Text style={[type.label, { color: colors.mutedText }]}>Record ID</Text>
										<Text selectable style={[type.body, { color: colors.text }]}>
											{record.id}
										</Text>
									</View>
								</AdminSection>

								{stickerFields ? (
									<AdminSection title={kind === 'sticker_packs' ? 'Edit pack' : 'Edit sticker'}>
										{stickerFieldList.map((field) => (
											<View key={field.key} style={{ gap: space.xs }}>
												<Text style={[type.label, { color: colors.mutedText }]}>{field.label}</Text>
												<TextInput
													value={stickerFields[field.key]}
													onChangeText={(value) => setStickerFields((current) => (current ? { ...current, [field.key]: value } : current))}
													editable={!busy}
													autoCapitalize={field.key === 'name' || field.key === 'description' ? 'sentences' : 'none'}
													placeholder={field.placeholder}
													placeholderTextColor={colors.mutedText}
													accessibilityLabel={field.label}
													style={inputStyle}
												/>
											</View>
										))}
										<AdminButton label="Save changes" icon="save" tone="neutral" busy={busy} onPress={() => void handleSaveSticker()} />
									</AdminSection>
								) : null}

								<AdminSection title="Decision" description="Pick the moderation status, then Apply.">
									<View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
										{STATUS_OPTIONS.map((option) => {
											const isSelected = draftStatus === option;
											const isCurrent = record.status === option;
											const optionTone = getAdminTone(colors, statusTone(option));
											return (
												<Pressable
													key={option}
													disabled={busy}
													onPress={() => setDraftStatus(option)}
													accessibilityRole="radio"
													accessibilityLabel={isCurrent ? `${capitalize(option)}, current status` : capitalize(option)}
													accessibilityState={{ selected: isSelected, disabled: busy }}
													style={({ pressed }) => ({
														minHeight: 48,
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
													<Text style={[type.bodyStrong, { flex: 1, color: isSelected ? positive.text : colors.text }]}>{capitalize(option)}</Text>
													{isCurrent ? <Text style={[type.label, { color: optionTone.text }]}>Current</Text> : null}
												</Pressable>
											);
										})}
									</View>
									{kind === 'products' ? (
										<View style={{ gap: space.xs }}>
											<Text style={[type.label, { color: colors.mutedText }]}>Reason for the seller</Text>
											<Text style={[type.meta, { color: colors.mutedText }]}>Required to reject, disable or archive.</Text>
											<TextInput
												value={reviewReason}
												onChangeText={setReviewReason}
												editable={!busy}
												multiline
												maxLength={4000}
												placeholder="e.g. The cover photo does not show the item being sold."
												placeholderTextColor={colors.mutedText}
												accessibilityLabel="Reason for the seller"
												style={[inputStyle, { minHeight: 88, textAlignVertical: 'top' }]}
											/>
										</View>
									) : null}
								</AdminSection>
							</ScrollView>
							<View style={{ flexDirection: 'row', paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md + insets.bottom, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.navigation }}>
								<AdminButton
									label={draftStatus && draftStatus !== record.status ? `Apply: ${capitalize(draftStatus)}` : 'Apply'}
									icon="check"
									tone="positive"
									emphasis="primary"
									busy={busy && !confirmingDelete}
									disabled={!canApply}
									accessibilityHint={needsReason && !reviewReason.trim() ? 'Enter a reason for the seller first' : undefined}
									onPress={handleApplyPress}
									style={{ flex: 1 }}
								/>
							</View>
						</KeyboardSafeView>
					) : null}
				</SafeAreaView>
			</SwipeDismissSurface>
			<AdminDialog
				visible={confirmingStatus && Boolean(record)}
				tone={confirmTone}
				icon={draftStatus === 'disabled' ? 'slash' : 'alert-circle'}
				title={`${draftStatus === 'disabled' ? 'Disable' : 'Reject'} ${record?.title ?? 'this record'}?`}
				description={
					kind === 'products'
						? 'The listing is hidden from the marketplace and the seller sees your reason.'
						: `The ${KIND_NOUNS[kind].replace(/s$/, '')} is hidden from members until its status changes again.`
				}
				confirmLabel={draftStatus === 'disabled' ? 'Disable' : 'Reject'}
				busy={busy}
				onConfirm={() => void runApply()}
				onClose={() => setConfirmingStatus(false)}
			/>
			<AdminDialog
				visible={confirmingDelete && Boolean(record)}
				tone="danger"
				icon="trash-2"
				title={`Delete ${record?.title ?? 'this record'}?`}
				description={
					isPermanentDelete
						? 'This permanently removes the record. It cannot be undone.'
						: 'The listing is removed from the marketplace, the seller is notified, and it can be restored from Moderation > Deleted.'
				}
				confirmLabel="Delete"
				stage={busy ? 'busy' : 'idle'}
				busyTitle="Deleting…"
				busyMessage="Please wait while the record is removed."
				requireText={isPermanentDelete ? 'DELETE' : undefined}
				onConfirm={() => void handleConfirmDelete()}
				onClose={() => setConfirmingDelete(false)}
			/>
		</Modal>
	);
}

export default function AdminCollectionWorkspace({ kind, title, subtitle, segments }: AdminCollectionWorkspaceProps) {
	const [items, setItems] = useState<AdminWorkspaceItem[]>([]);
	const [query, setQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState<AdminWorkspaceStatus[]>([]);
	const [sort, setSort] = useState<SortOption>(defaultSortFor(kind));
	const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
	const [privacyFilter, setPrivacyFilter] = useState<PrivacyFilter>('all');
	const sortOptions = sortOptionsFor(kind);
	const [selected, setSelected] = useState<AdminWorkspaceItem | null>(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [loadingMore, setLoadingMore] = useState(false);
	const [serverStats, setServerStats] = useState<AdminWorkspaceStats | null>(null);
	/** Ignores responses from an older load so a slow first page cannot overwrite a newer one. */
	const loadRequestRef = useRef(0);
	const hasFocusedRef = useRef(false);

	const refreshStats = useCallback(async () => {
		try {
			setServerStats(await workspaceService.fetchWorkspaceStats(kind));
		} catch (statsError: unknown) {
			// The cards fall back to the loaded records.
			console.warn('[AdminCollectionWorkspace.refreshStats] Warning:', statsError instanceof Error ? statsError.message : statsError);
			setServerStats(null);
		}
	}, [kind]);

	/** 'initial' shows the skeleton, 'refresh' the pull-to-refresh spinner, 'silent' (on return to the screen) neither. */
	const load = useCallback(
		async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
			const requestId = loadRequestRef.current + 1;
			loadRequestRef.current = requestId;
			if (mode === 'refresh') setRefreshing(true);
			else if (mode === 'initial') setLoading(true);
			if (mode !== 'silent') setError(null);
			void refreshStats();
			try {
				const page = await workspaceService.fetchWorkspacePage(kind);
				if (loadRequestRef.current !== requestId) return;
				setItems(page.items);
				setNextCursor(page.nextCursor);
				setError(null);
			} catch (loadError: unknown) {
				if (loadRequestRef.current !== requestId) return;
				console.error('[AdminCollectionWorkspace.load] Error:', loadError instanceof Error ? loadError.message : loadError);
				// A failed background refresh keeps the records already on screen.
				if (mode !== 'silent') {
					setError(loadError instanceof Error ? loadError.message : `${title} could not be loaded.`);
				}
			} finally {
				if (loadRequestRef.current === requestId) {
					setLoading(false);
					setRefreshing(false);
				}
			}
		},
		[kind, refreshStats, title]
	);

	useFocusEffect(
		useCallback(() => {
			void load(hasFocusedRef.current ? 'silent' : 'initial');
			hasFocusedRef.current = true;
		}, [load])
	);

	const handleLoadMore = async () => {
		if (!nextCursor || loadingMore) return;
		const requestId = loadRequestRef.current;
		setLoadingMore(true);
		try {
			const page = await workspaceService.fetchWorkspacePage(kind, nextCursor);
			if (loadRequestRef.current !== requestId) return;
			setItems((current) => {
				const knownIds = new Set(current.map((item) => item.id));
				return [...current, ...page.items.filter((item) => !knownIds.has(item.id))];
			});
			setNextCursor(page.nextCursor);
		} catch (loadError: unknown) {
			console.error('[AdminCollectionWorkspace.handleLoadMore] Error:', loadError instanceof Error ? loadError.message : loadError);
			toast.error(loadError instanceof Error ? loadError.message : 'More records could not be loaded.');
		} finally {
			setLoadingMore(false);
		}
	};

	const visibleItems = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		return items
			.filter((item) => statusFilter.length === 0 || statusFilter.includes(item.status))
			.filter((item) => kind !== 'products' || matchesPrice(item.price, priceFilter))
			.filter((item) => kind !== 'communities' || privacyFilter === 'all' || item.privacy === privacyFilter)
			.filter((item) => !normalizedQuery || `${item.title} ${item.subtitle} ${item.description} ${item.category}`.toLowerCase().includes(normalizedQuery))
			.sort((first, second) => {
				if (sort === 'name') return first.title.localeCompare(second.title);
				if (sort === 'oldest') return first.createdAtMs - second.createdAtMs;
				if (sort === 'most-members') return second.memberCount - first.memberCount;
				if (sort === 'price-desc') return second.price - first.price;
				if (sort === 'price-asc') return first.price - second.price;
				return second.createdAtMs - first.createdAtMs;
			});
	}, [items, kind, priceFilter, privacyFilter, query, sort, statusFilter]);

	const filterGroups: AnyFilterGroup[] = [
		{ kind: 'multiple', key: 'status', label: 'Status', options: STATUS_OPTIONS.map((option) => ({ value: option, label: capitalize(option) })), values: statusFilter },
		...(kind === 'products' ? [{ key: 'price', label: 'Price', options: PRICE_FILTERS.map((filter) => ({ value: filter.value, label: filter.label })), value: priceFilter, defaultValue: 'all' }] : []),
		...(kind === 'communities' ? [{ key: 'privacy', label: 'Privacy', options: PRIVACY_FILTERS.map((filter) => ({ value: filter.value, label: filter.label })), value: privacyFilter, defaultValue: 'all' }] : []),
		{ key: 'sort', label: 'Sort', options: sortOptions.map((option) => ({ value: option, label: SORT_LABELS[option] })), value: sort, defaultValue: defaultSortFor(kind) },
	];

	const handleApplyFilters = (values: FilterValues) => {
		setStatusFilter(STATUS_OPTIONS.filter((option) => readMultiFilter(values, 'status').includes(option)));
		setPriceFilter(PRICE_FILTERS.find((filter) => filter.value === readSingleFilter(values, 'price'))?.value ?? 'all');
		setPrivacyFilter(PRIVACY_FILTERS.find((filter) => filter.value === readSingleFilter(values, 'privacy'))?.value ?? 'all');
		setSort(sortOptions.find((option) => option === readSingleFilter(values, 'sort')) ?? defaultSortFor(kind));
	};

	const handleClearFilters = () => {
		setQuery('');
		setStatusFilter([]);
		setPriceFilter('all');
		setPrivacyFilter('all');
		setSort(defaultSortFor(kind));
	};

	const statCards = useMemo((): StatCardModel[] => {
		// Server totals cover every page; the loaded records are only the fallback when counting fails.
		if (kind === 'products') {
			const stats = serverStats?.kind === 'products' ? serverStats : null;
			return [
				{ label: 'Total products', value: stats ? stats.total : items.length, onPress: () => setStatusFilter([]) },
				{ label: 'Pending review', value: stats ? stats.pending : items.filter((item) => item.status === 'pending').length, onPress: () => setStatusFilter(['pending']) },
				{ label: 'Approved', value: stats ? stats.approved : items.filter((item) => item.status === 'approved' || item.status === 'active').length, onPress: () => setStatusFilter(['active', 'approved']) },
				{ label: 'Rejected', value: stats ? stats.rejected : items.filter((item) => item.status === 'rejected').length, onPress: () => setStatusFilter(['rejected']) },
			];
		}
		if (kind === 'communities') {
			const stats = serverStats?.kind === 'communities' ? serverStats : null;
			return [
				{ label: 'Total communities', value: stats ? stats.total : items.length, onPress: () => setPrivacyFilter('all') },
				{ label: 'Public', value: stats ? stats.publicCount : items.filter((item) => item.privacy === 'public').length, onPress: () => setPrivacyFilter('public') },
				{ label: 'Private', value: stats ? stats.privateCount : items.filter((item) => item.privacy === 'private').length, onPress: () => setPrivacyFilter('private') },
				{ label: 'Total memberships', value: stats ? stats.memberships : items.reduce((total, item) => total + item.memberCount, 0) },
			];
		}
		return [];
	}, [items, kind, serverStats]);

	const handleApplyStatus = async (nextStatus: AdminWorkspaceStatus, reason: string | undefined): Promise<AdminWorkspaceStatus> => {
		if (!selected) throw new Error('No record is open.');
		if (busy) throw new Error('Another change is still saving.');
		const needsReason = kind === 'products' && PRODUCT_HIDING_STATUSES.includes(nextStatus);
		if (needsReason && !reason?.trim()) throw new Error('Enter a reason for the seller before rejecting this listing.');
		setBusy(true);
		try {
			// The server may store a different status than the one picked (products keep every hiding decision as 'rejected').
			const appliedStatus = await workspaceService.setWorkspaceStatus(kind, selected.id, nextStatus, needsReason ? reason?.trim() : undefined);
			const isActive = appliedStatus === 'active' || appliedStatus === 'approved';
			setItems((current) => current.map((item) => (item.id === selected.id ? { ...item, status: appliedStatus, isActive } : item)));
			setSelected((current) => (current ? { ...current, status: appliedStatus, isActive } : null));
			void refreshStats();
			return appliedStatus;
		} catch (actionError: unknown) {
			console.error('[AdminCollectionWorkspace.handleApplyStatus] Error:', actionError instanceof Error ? actionError.message : actionError);
			throw actionError instanceof Error ? actionError : new Error('Status could not be updated.');
		} finally {
			setBusy(false);
		}
	};

	const handleSaveStickerFields = async (fields: AdminStickerFields): Promise<void> => {
		if (!selected || busy || (kind !== 'stickers' && kind !== 'sticker_packs')) return;
		setBusy(true);
		try {
			await workspaceService.updateStickerRecord(kind, selected.id, fields);
			const updated: AdminWorkspaceItem = {
				...selected,
				title: fields.name.trim(),
				subtitle: kind === 'stickers' ? fields.packId.trim() || 'Unassigned pack' : selected.subtitle,
				description: kind === 'sticker_packs' ? fields.description.trim() : selected.description,
				imageUrl: kind === 'stickers' ? fields.imageUrl.trim() || selected.imageUrl : selected.imageUrl,
				stickerFields: fields,
			};
			setItems((current) => current.map((item) => (item.id === selected.id ? updated : item)));
			setSelected(updated);
		} catch (saveError: unknown) {
			console.error('[AdminCollectionWorkspace.handleSaveStickerFields] Error:', saveError instanceof Error ? saveError.message : saveError);
			throw saveError instanceof Error ? saveError : new Error('Changes could not be saved.');
		} finally {
			setBusy(false);
		}
	};

	const handleDelete = async (): Promise<void> => {
		if (!selected || busy) return;
		setBusy(true);
		try {
			await workspaceService.deleteWorkspaceItem(kind, selected.id);
			const deletedTitle = selected.title;
			setItems((current) => current.filter((item) => item.id !== selected.id));
			setSelected(null);
			toast.success(`${deletedTitle} was deleted.`);
			void refreshStats();
		} catch (actionError: unknown) {
			console.error('[AdminCollectionWorkspace.handleDelete] Error:', actionError instanceof Error ? actionError.message : actionError);
			throw actionError instanceof Error ? actionError : new Error('Item could not be deleted.');
		} finally {
			setBusy(false);
		}
	};

	const screenState: AdminScreenState = loading ? { kind: 'loading', variant: 'list' } : error ? { kind: 'error', message: error } : { kind: 'ready' };
	const hasActiveFilters = Boolean(query.trim()) || statusFilter.length > 0 || priceFilter !== 'all' || privacyFilter !== 'all';

	return (
		<AdminScreen
			title={title}
			subtitle={subtitle}
			state={screenState}
			refreshing={refreshing}
			onRefresh={() => load('refresh')}
			toolbar={
				<AdminToolbar
					segments={segments}
					search={{ value: query, placeholder: `Search ${KIND_NOUNS[kind]}`, onChange: setQuery }}
					filters={{ groups: filterGroups, onApply: handleApplyFilters, title: `Filter ${KIND_NOUNS[kind]}` }}
					resultSummary={loading ? undefined : `${visibleItems.length} of ${items.length} ${nextCursor ? 'loaded ' : ''}records`}
				/>
			}
		>
			<View style={{ gap: space.lg }}>
				{statCards.length ? (
					<AdminStatGrid>
						{statCards.map((card) => (
							<AdminStatCard key={card.label} label={card.label} value={card.value.toLocaleString()} compact onPress={card.onPress} />
						))}
					</AdminStatGrid>
				) : null}

				{visibleItems.length ? (
					<View style={{ gap: space.sm }}>
						{visibleItems.map((item) => (
							<AdminListRow
								key={item.id}
								title={item.title}
								subtitle={`${item.subtitle}${item.metricLabel ? ` · ${item.metricLabel}` : ''}`}
								leading={item.imageUrl ? { kind: 'thumb', uri: item.imageUrl } : { kind: 'icon', name: KIND_ICONS[kind], tone: 'positive' }}
								status={{ label: item.status, tone: statusTone(item.status) }}
								onPress={() => setSelected(item)}
								accessibilityHint="Opens the record"
							/>
						))}
					</View>
				) : hasActiveFilters && items.length ? (
					<AdminState kind="empty" title="" filtered onClearFilters={handleClearFilters} />
				) : (
					<AdminState kind="empty" icon={KIND_ICONS[kind]} title={`No ${KIND_NOUNS[kind]} ${nextCursor ? 'on this page' : 'yet'}`} description={nextCursor ? 'Load more to see the next page.' : undefined} />
				)}

				{nextCursor ? (
					<AdminButton label={loadingMore ? 'Loading…' : 'Load more'} icon="chevron-down" tone="neutral" busy={loadingMore} accessibilityLabel="Load more records" onPress={() => void handleLoadMore()} fullWidth />
				) : null}
			</View>

			<CollectionRecordSheet
				key={selected?.id ?? 'closed'}
				kind={kind}
				record={selected}
				busy={busy}
				onClose={() => setSelected(null)}
				onApplyStatus={handleApplyStatus}
				onSaveStickerFields={handleSaveStickerFields}
				onDelete={handleDelete}
			/>
		</AdminScreen>
	);
}
