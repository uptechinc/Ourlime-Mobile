import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
	Image,
	Modal,
	ScrollView,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import CustomModal from '@/components/ui/CustomModal';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import AdminWorkspaceShell from './AdminWorkspaceShell';
import {
	AdminWorkspaceService,
	type AdminStickerFields,
	type AdminWorkspaceItem,
	type AdminWorkspaceKind,
	type AdminWorkspaceStatus,
} from '@/lib/services/AdminWorkspaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type AdminCollectionWorkspaceProps = {
	kind: AdminWorkspaceKind;
	title: string;
	subtitle: string;
	/** Controls shown under the workspace header (e.g. tabs that switch between collections). */
	accessory?: ReactNode;
};

const workspaceService = AdminWorkspaceService.getInstance();
/** Product decisions that hide a listing; the server requires a reason the seller sees (like the web reject dialog). */
const PRODUCT_HIDING_STATUSES: readonly AdminWorkspaceStatus[] = ['rejected', 'disabled', 'archived'];
const STATUS_FILTERS: readonly (AdminWorkspaceStatus | 'all')[] = [
	'all',
	'active',
	'pending',
	'approved',
	'rejected',
	'archived',
	'disabled',
];

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
	{ value: 'all', label: 'All Prices' },
	{ value: 'under50', label: 'Under $50' },
	{ value: '50to200', label: '$50 - $200' },
	{ value: '200to500', label: '$200 - $500' },
	{ value: 'above500', label: '$500+' },
];
const PRIVACY_FILTERS: readonly { value: PrivacyFilter; label: string }[] = [
	{ value: 'all', label: 'All Privacy Types' },
	{ value: 'public', label: 'Public' },
	{ value: 'private', label: 'Private' },
];

const matchesPrice = (price: number, filter: PriceFilter): boolean => {
	if (filter === 'under50') return price < 50;
	if (filter === '50to200') return price >= 50 && price <= 200;
	if (filter === '200to500') return price > 200 && price <= 500;
	if (filter === 'above500') return price > 500;
	return true;
};

type FilterChipProps = { label: string; selected: boolean; onPress: () => void };

function FilterChip({ label, selected, onPress }: FilterChipProps) {
	const { colors } = useAppTheme();
	return (
		<TouchableOpacity
			onPress={onPress}
			style={{ marginRight: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.successSurface : 'transparent' }}
		>
			<Text style={{ color: selected ? colors.successText : colors.secondaryText, fontSize: 12, fontWeight: '700' }}>{label}</Text>
		</TouchableOpacity>
	);
}

export default function AdminCollectionWorkspace({
	kind,
	title,
	subtitle,
	accessory,
}: AdminCollectionWorkspaceProps) {
	const { colors } = useAppTheme();
	const [items, setItems] = useState<AdminWorkspaceItem[]>([]);
	const [query, setQuery] = useState('');
	const [status, setStatus] = useState<AdminWorkspaceStatus | 'all'>('all');
	const [sort, setSort] = useState<SortOption>(kind === 'communities' ? 'most-members' : 'newest');
	const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
	const [privacyFilter, setPrivacyFilter] = useState<PrivacyFilter>('all');
	const sortOptions: readonly SortOption[] =
		kind === 'communities'
			? ['most-members', 'newest', 'oldest', 'name']
			: kind === 'products'
				? ['newest', 'oldest', 'price-desc', 'price-asc']
				: ['newest', 'oldest', 'name'];
	const [selected, setSelected] = useState<AdminWorkspaceItem | null>(null);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [reviewReason, setReviewReason] = useState('');

	const [stickerFields, setStickerFields] = useState<AdminStickerFields | null>(null);

	useEffect(() => {
		setReviewReason('');
		setStickerFields(selected?.stickerFields ?? null);
		// Only reset when a different record opens, not when its status changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selected?.id]);

	const handleSaveStickerFields = async () => {
		if (!selected || !stickerFields || busy || (kind !== 'stickers' && kind !== 'sticker_packs')) return;
		setBusy(true);
		try {
			await workspaceService.updateStickerRecord(kind, selected.id, stickerFields);
			const updated: AdminWorkspaceItem = {
				...selected,
				title: stickerFields.name.trim(),
				subtitle: kind === 'stickers' ? stickerFields.packId.trim() || 'Unassigned pack' : selected.subtitle,
				description: kind === 'sticker_packs' ? stickerFields.description.trim() : selected.description,
				imageUrl: kind === 'stickers' ? stickerFields.imageUrl.trim() || selected.imageUrl : selected.imageUrl,
				stickerFields,
			};
			setItems((current) => current.map((item) => (item.id === selected.id ? updated : item)));
			setSelected(updated);
			setMessage(kind === 'sticker_packs' ? 'Pack updated!' : 'Sticker updated!');
		} catch (saveError: unknown) {
			setMessage(saveError instanceof Error ? saveError.message : 'Changes could not be saved.');
		} finally {
			setBusy(false);
		}
	};

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

	const load = useCallback(
		async (isRefresh = false) => {
			if (isRefresh) setRefreshing(true);
			else setLoading(true);
			setError(null);
			try {
				setItems(await workspaceService.fetchWorkspaceItems(kind));
			} catch (loadError: unknown) {
				setError(
					loadError instanceof Error
						? loadError.message
						: `${title} could not be loaded.`
				);
			} finally {
				setLoading(false);
				setRefreshing(false);
			}
		},
		[kind, title]
	);

	useEffect(() => {
		void load();
	}, [load]);

	const visibleItems = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		return items
			.filter((item) => status === 'all' || item.status === status)
			.filter((item) => kind !== 'products' || matchesPrice(item.price, priceFilter))
			.filter((item) => kind !== 'communities' || privacyFilter === 'all' || item.privacy === privacyFilter)
			.filter(
				(item) =>
					!normalizedQuery ||
					`${item.title} ${item.subtitle} ${item.description} ${item.category}`
						.toLowerCase()
						.includes(normalizedQuery)
			)
			.sort((first, second) => {
				if (sort === 'name') return first.title.localeCompare(second.title);
				if (sort === 'oldest') return first.createdAtMs - second.createdAtMs;
				if (sort === 'most-members') return second.memberCount - first.memberCount;
				if (sort === 'price-desc') return second.price - first.price;
				if (sort === 'price-asc') return first.price - second.price;
				return second.createdAtMs - first.createdAtMs;
			});
	}, [items, kind, priceFilter, privacyFilter, query, sort, status]);

	const statCards = useMemo(() => {
		if (kind === 'products') {
			return [
				{ label: 'Total Products', value: items.length },
				{ label: 'Pending Review', value: items.filter((item) => item.status === 'pending').length },
				{ label: 'Approved', value: items.filter((item) => item.status === 'approved' || item.status === 'active').length },
				{ label: 'Rejected', value: items.filter((item) => item.status === 'rejected').length },
			];
		}
		if (kind === 'communities') {
			return [
				{ label: 'Total Communities', value: items.length },
				{ label: 'Public Communities', value: items.filter((item) => item.privacy === 'public').length },
				{ label: 'Private Communities', value: items.filter((item) => item.privacy === 'private').length },
				{ label: 'Total Memberships', value: items.reduce((total, item) => total + item.memberCount, 0) },
			];
		}
		return [];
	}, [items, kind]);

	const handleStatus = async (nextStatus: AdminWorkspaceStatus) => {
		if (!selected || busy) return;
		const needsReason = kind === 'products' && PRODUCT_HIDING_STATUSES.includes(nextStatus);
		if (needsReason && !reviewReason.trim()) {
			setMessage('Enter a reason for the seller before rejecting this listing.');
			return;
		}
		setBusy(true);
		try {
			await workspaceService.setWorkspaceStatus(kind, selected.id, nextStatus, needsReason ? reviewReason.trim() : undefined);
			if (needsReason) setReviewReason('');
			setItems((current) =>
				current.map((item) =>
					item.id === selected.id
						? {
								...item,
								status: nextStatus,
								isActive: nextStatus === 'active' || nextStatus === 'approved',
							}
						: item
				)
			);
			setSelected((current) =>
				current ? { ...current, status: nextStatus } : null
			);
			setMessage(`${selected.title} is now ${nextStatus}.`);
		} catch (actionError: unknown) {
			setMessage(
				actionError instanceof Error
					? actionError.message
					: 'Status could not be updated.'
			);
		} finally {
			setBusy(false);
		}
	};

	const handleDelete = async () => {
		if (!selected || busy) return;
		setBusy(true);
		try {
			await workspaceService.deleteWorkspaceItem(kind, selected.id);
			setItems((current) => current.filter((item) => item.id !== selected.id));
			setMessage(`${selected.title} was deleted.`);
			setSelected(null);
		} catch (actionError: unknown) {
			setMessage(
				actionError instanceof Error
					? actionError.message
					: 'Item could not be deleted.'
			);
		} finally {
			setBusy(false);
		}
	};

	return (
		<AdminWorkspaceShell
			title={title}
			subtitle={subtitle}
			loading={loading}
			refreshing={refreshing}
			error={error}
			onRefresh={() => void load(true)}
		>
			{accessory}
			<View
				style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}
			>
				<View
					style={{
						flex: 1,
						minWidth: 150,
						marginRight: 8,
						marginBottom: 8,
						flexDirection: 'row',
						alignItems: 'center',
						borderRadius: 14,
						backgroundColor: colors.input,
						borderWidth: 1,
						borderColor: colors.border,
						paddingHorizontal: 12,
					}}
				>
					<Icon name="search" size={17} color={colors.mutedText} />
					<TextInput
						value={query}
						onChangeText={setQuery}
						placeholder={`Search ${kind.replace('_', ' ')}`}
						placeholderTextColor={colors.mutedText}
						style={{ flex: 1, padding: 11, color: colors.text }}
					/>
				</View>
				<TouchableOpacity
					onPress={() =>
						setSort((current) => sortOptions[(sortOptions.indexOf(current) + 1) % sortOptions.length])
					}
					accessibilityLabel={`Sort: ${SORT_LABELS[sort]}`}
					style={{
						marginBottom: 8,
						flexDirection: 'row',
						alignItems: 'center',
						borderRadius: 14,
						backgroundColor: colors.control,
						borderWidth: 1,
						borderColor: colors.border,
						paddingHorizontal: 13,
					}}
				>
					<Icon name="sliders" size={16} color={colors.icon} />
					<Text
						style={{
							marginLeft: 7,
							color: colors.secondaryText,
							fontWeight: '700',
						}}
					>
						{SORT_LABELS[sort]}
					</Text>
				</TouchableOpacity>
			</View>
			{statCards.length ? (
				<View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4, marginBottom: 8 }}>
					{statCards.map((card) => (
						<View key={card.label} style={{ width: '50%', padding: 4 }}>
							<View style={{ padding: 12, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
								<Text numberOfLines={1} style={{ color: colors.mutedText, fontSize: 11 }}>{card.label}</Text>
								<Text style={{ marginTop: 2, color: colors.text, fontSize: 19, fontWeight: '900' }}>{card.value.toLocaleString()}</Text>
							</View>
						</View>
					))}
				</View>
			) : null}
			{kind === 'products' ? (
				<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
					{PRICE_FILTERS.map((filter) => (
						<FilterChip key={filter.value} label={filter.label} selected={priceFilter === filter.value} onPress={() => setPriceFilter(filter.value)} />
					))}
				</ScrollView>
			) : null}
			{kind === 'communities' ? (
				<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
					{PRIVACY_FILTERS.map((filter) => (
						<FilterChip key={filter.value} label={filter.label} selected={privacyFilter === filter.value} onPress={() => setPrivacyFilter(filter.value)} />
					))}
				</ScrollView>
			) : null}
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={{ marginBottom: 14 }}
			>
				{STATUS_FILTERS.map((filterStatus) => (
					<TouchableOpacity
						key={filterStatus}
						onPress={() => setStatus(filterStatus)}
						style={{
							marginRight: 8,
							borderRadius: 999,
							paddingHorizontal: 12,
							paddingVertical: 8,
							backgroundColor:
								status === filterStatus ? colors.accent : colors.control,
						}}
					>
						<Text
							style={{
								textTransform: 'capitalize',
								color:
									status === filterStatus
										? colors.onAccent
										: colors.secondaryText,
								fontSize: 12,
								fontWeight: '800',
							}}
						>
							{filterStatus}
						</Text>
					</TouchableOpacity>
				))}
			</ScrollView>
			<Text style={{ marginBottom: 10, color: colors.mutedText, fontSize: 12 }}>
				{visibleItems.length} of {items.length} records
			</Text>
			{visibleItems.map((item) => (
				<TouchableOpacity
					key={item.id}
					onPress={() => setSelected(item)}
					style={{
						marginBottom: 10,
						padding: 13,
						borderRadius: 17,
						backgroundColor: colors.surface,
						borderWidth: 1,
						borderColor: colors.border,
						flexDirection: 'row',
						alignItems: 'center',
					}}
				>
					{item.imageUrl ? (
						<Image
							source={{ uri: item.imageUrl }}
							style={{
								width: 54,
								height: 54,
								borderRadius: 14,
								backgroundColor: colors.control,
							}}
						/>
					) : (
						<View
							style={{
								width: 54,
								height: 54,
								borderRadius: 14,
								backgroundColor: colors.successSurface,
								alignItems: 'center',
								justifyContent: 'center',
							}}
						>
							<Icon
								name={
									kind === 'products'
										? 'shopping-bag'
										: kind === 'communities'
											? 'users'
											: kind === 'sticker_packs'
												? 'package'
												: 'smile'
								}
								size={22}
								color={colors.accent}
							/>
						</View>
					)}
					<View style={{ flex: 1, marginLeft: 11 }}>
						<Text
							numberOfLines={1}
							style={{ color: colors.text, fontWeight: '900' }}
						>
							{item.title}
						</Text>
						<Text
							numberOfLines={1}
							style={{ marginTop: 3, color: colors.mutedText, fontSize: 12 }}
						>
							{item.subtitle}
							{item.metricLabel ? ` · ${item.metricLabel}` : ''}
						</Text>
						<Text
							style={{
								marginTop: 5,
								color:
									item.status === 'active' || item.status === 'approved'
										? colors.successText
										: item.status === 'rejected' || item.status === 'disabled'
											? colors.destructiveText
											: colors.warningText,
								fontSize: 10,
								fontWeight: '900',
								textTransform: 'uppercase',
							}}
						>
							{item.status}
						</Text>
					</View>
					<Icon name="chevron-right" size={18} color={colors.mutedText} />
				</TouchableOpacity>
			))}
			{!visibleItems.length ? (
				<View style={{ paddingVertical: 50, alignItems: 'center' }}>
					<Icon name="inbox" size={36} color={colors.mutedText} />
					<Text style={{ marginTop: 10, color: colors.mutedText }}>
						No matching records.
					</Text>
				</View>
			) : null}

			<Modal
				visible={Boolean(selected)}
				transparent
				statusBarTranslucent
				navigationBarTranslucent
				animationType="none"
				presentationStyle="overFullScreen"
				onRequestClose={() => setSelected(null)}
			>
				<SwipeDismissSurface
					visible={Boolean(selected)}
					onDismiss={() => setSelected(null)}
					handleColor={colors.border}
					disabled={busy}
					accessibilityLabel="Swipe down to close admin record"
					style={{ flex: 1, backgroundColor: colors.canvas }}
				>
					<SafeAreaView
						edges={['top', 'left', 'right']}
						style={{ flex: 1, backgroundColor: colors.canvas }}
					>
						<View
							style={{
								flexDirection: 'row',
								alignItems: 'center',
								padding: 16,
								backgroundColor: colors.navigation,
							}}
						>
							<Text
								style={{
									flex: 1,
									fontSize: 19,
									fontWeight: '900',
									color: colors.text,
								}}
							>
								{selected?.title}
							</Text>
							<TouchableOpacity onPress={() => setSelected(null)}>
								<Icon name="x" size={24} color={colors.icon} />
							</TouchableOpacity>
						</View>
						{selected ? (
							<KeyboardSafeView style={{ flex: 1 }}>
							<ScrollView
								keyboardShouldPersistTaps="handled"
								contentContainerStyle={{ padding: 18, paddingBottom: 50 }}
							>
								<Text style={{ color: colors.secondaryText, lineHeight: 20 }}>
									{selected.description || 'No description supplied.'}
								</Text>
								<Text
									style={{
										marginTop: 18,
										color: colors.text,
										fontWeight: '800',
									}}
								>
									Record ID
								</Text>
								<Text
									selectable
									style={{ marginTop: 4, color: colors.mutedText }}
								>
									{selected.id}
								</Text>
								{stickerFields ? (
									<View style={{ marginTop: 18 }}>
										<Text style={{ marginBottom: 8, color: colors.text, fontWeight: '800' }}>
											{kind === 'sticker_packs' ? 'Edit pack' : 'Edit sticker'}
										</Text>
										{stickerFieldList.map((field) => (
											<View key={field.key} style={{ marginBottom: 10 }}>
												<Text style={{ marginBottom: 5, color: colors.secondaryText, fontSize: 12, fontWeight: '700' }}>{field.label}</Text>
												<TextInput
													value={stickerFields[field.key]}
													onChangeText={(value) => setStickerFields((current) => (current ? { ...current, [field.key]: value } : current))}
													editable={!busy}
													autoCapitalize={field.key === 'name' || field.key === 'description' ? 'sentences' : 'none'}
													placeholder={field.placeholder}
													placeholderTextColor={colors.mutedText}
													style={{ padding: 11, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text }}
												/>
											</View>
										))}
										<TouchableOpacity
											disabled={busy}
											onPress={() => void handleSaveStickerFields()}
											style={{ alignItems: 'center', padding: 13, borderRadius: 14, backgroundColor: colors.accent, opacity: busy ? 0.6 : 1 }}
										>
											<Text style={{ color: colors.onAccent, fontWeight: '900' }}>Save changes</Text>
										</TouchableOpacity>
									</View>
								) : null}
								<Text
									style={{
										marginTop: 18,
										marginBottom: 10,
										color: colors.text,
										fontWeight: '800',
									}}
								>
									Moderation status
								</Text>
								{kind === 'products' ? (
									<View style={{ marginBottom: 12 }}>
										<Text style={{ marginBottom: 6, color: colors.secondaryText, fontSize: 12, fontWeight: '700' }}>
											Reason for the seller (required to reject, disable or archive)
										</Text>
										<TextInput
											value={reviewReason}
											onChangeText={setReviewReason}
											editable={!busy}
											multiline
											maxLength={4000}
											placeholder="e.g. The cover photo does not show the item being sold."
											placeholderTextColor={colors.mutedText}
											style={{
												minHeight: 84,
												textAlignVertical: 'top',
												padding: 12,
												borderRadius: 14,
												borderWidth: 1,
												borderColor: colors.border,
												backgroundColor: colors.input,
												color: colors.text,
											}}
										/>
									</View>
								) : null}
								{(
									[
										'active',
										'approved',
										'pending',
										'rejected',
										'archived',
										'disabled',
									] as const
								).map((nextStatus) => (
									<TouchableOpacity
										key={nextStatus}
										disabled={busy || selected.status === nextStatus}
										onPress={() => void handleStatus(nextStatus)}
										style={{
											marginBottom: 8,
											flexDirection: 'row',
											padding: 14,
											borderRadius: 14,
											backgroundColor:
												selected.status === nextStatus
													? colors.successSurface
													: colors.surface,
										}}
									>
										<Text
											style={{
												flex: 1,
												textTransform: 'capitalize',
												color:
													selected.status === nextStatus
														? colors.successText
														: colors.text,
												fontWeight: '800',
											}}
										>
											{nextStatus}
										</Text>
										{selected.status === nextStatus ? (
											<Icon name="check" size={18} color={colors.successText} />
										) : null}
									</TouchableOpacity>
								))}
								<TouchableOpacity
									disabled={busy}
									onPress={() => void handleDelete()}
									style={{
										marginTop: 18,
										alignItems: 'center',
										padding: 14,
										borderRadius: 14,
										backgroundColor: colors.destructive,
									}}
								>
									<Text style={{ color: colors.onAccent, fontWeight: '900' }}>
										Delete permanently
									</Text>
								</TouchableOpacity>
							</ScrollView>
							</KeyboardSafeView>
						) : null}
					</SafeAreaView>
				</SwipeDismissSurface>
			</Modal>
			<CustomModal
				visible={Boolean(message)}
				type="info"
				title={title}
				message={message ?? ''}
				onClose={() => setMessage(null)}
			/>
		</AdminWorkspaceShell>
	);
}
