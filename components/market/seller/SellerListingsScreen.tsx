import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Copy, ExternalLink, FilePenLine, Package, Plus, Power, Search, Trash2, Truck, X } from 'lucide-react-native';
import CachedImage from '@/components/ui/CachedImage';
import CustomModal from '@/components/ui/CustomModal';
import { SellerButton } from '@/components/ehub/EHubSellerFormParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useMarketListings, useSellerEligibility } from '@/lib/hooks/useMarketListings';
import { formatMarketPrice } from '@/lib/utils/formatMarketPrice';
import type { ListingFilter, SellerListing } from '@/lib/types/marketListing';
import SellerScreenFrame, { SellerLoading } from './SellerScreenFrame';
import SellerEligibilityNotice from './SellerEligibilityNotice';

const FILTERS: readonly { value: ListingFilter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'published', label: 'Published' }, { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' }, { value: 'hidden', label: 'Unpublished' }, { value: 'draft', label: 'Draft' },
];

const isPublished = (listing: SellerListing): boolean => listing.status === 'approved' || listing.status === 'active';
const stockOf = (listing: SellerListing): number => listing.variants.reduce((total, variant) => total + variant.quantity, 0);
const priceOf = (listing: SellerListing): string => {
  const active = listing.variants.filter((variant) => variant.status === 'active');
  if (!active.length) return 'No price';
  const minimum = Math.min(...active.map((variant) => variant.price));
  return `${active.some((variant) => variant.price !== minimum) ? 'From ' : ''}${formatMarketPrice(active[0].currency || listing.currency, minimum)}`;
};
const matchesFilter = (listing: SellerListing, filter: ListingFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'published') return isPublished(listing);
  if (filter === 'pending') return listing.status === 'pending';
  if (filter === 'rejected') return listing.status === 'rejected';
  if (filter === 'hidden') return listing.status === 'inactive';
  return false;
};

type PendingConfirm = { kind: 'delete' | 'status'; listing: SellerListing } | null;

/** Website /profile/products ("Seller Dashboard"): the seller's own listings with status filters and listing actions. */
export default function SellerListingsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { profile, getDecision } = usePageAccess();
  const userId = profile?.uid ?? null;
  const canMutate = getDecision('/market').canMutate;
  const market = useMarketListings(userId);
  const seller = useSellerEligibility(userId);
  const [filter, setFilter] = useState<ListingFilter>('all');
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<PendingConfirm>(null);
  const [notice, setNotice] = useState<{ title: string; message: string; type: 'success' | 'error' } | null>(null);
  const isApproved = seller.eligibility?.status === 'approved';
  const { reload } = market;

  // Coming back from the editor: show the saved listing and the latest draft (the first focus is the initial load).
  const hasFocused = useRef(false);
  useFocusEffect(useCallback(() => {
    if (hasFocused.current) void reload();
    hasFocused.current = true;
  }, [reload]));

  const counts = useMemo(() => ({
    total: market.listings.length,
    published: market.listings.filter(isPublished).length,
    pending: market.listings.filter((listing) => listing.status === 'pending').length,
    lowStock: market.listings.filter((listing) => listing.variants.length > 0 && stockOf(listing) <= 3).length,
  }), [market.listings]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return market.listings.filter((listing) => matchesFilter(listing, filter)).filter((listing) => !term || `${listing.title} ${listing.category} ${listing.shortDescription}`.toLowerCase().includes(term));
  }, [filter, market.listings, search]);

  const openEditor = (productId?: string) => router.push((productId ? `/market/seller/edit?id=${encodeURIComponent(productId)}` : '/market/seller/edit') as Href);

  const handleConfirm = async () => {
    if (!confirm) return;
    const { kind, listing } = confirm;
    try {
      if (kind === 'delete') {
        await market.remove(listing);
        setNotice({ type: 'success', title: 'Listing deleted', message: `${listing.title} was removed from your listings.` });
      } else {
        const message = await market.toggleStatus(listing);
        setNotice({ type: 'success', title: 'Listing updated', message });
      }
    } catch (failure: unknown) {
      setNotice({ type: 'error', title: 'Action failed', message: failure instanceof Error ? failure.message : 'Please try again.' });
    } finally {
      setConfirm(null);
    }
  };

  const handleDuplicate = async (listing: SellerListing) => {
    try {
      await market.duplicate(listing);
      openEditor();
    } catch {
      setNotice({ type: 'error', title: 'Duplicate failed', message: 'This listing could not be copied to a draft.' });
    }
  };

  const draft = market.draft;
  const showDraft = draft !== null && (filter === 'all' || filter === 'draft') && (!search.trim() || draft.title.toLowerCase().includes(search.trim().toLowerCase()));

  return <SellerScreenFrame title="My listings" subtitle="Manage your catalogue, prices and orders"
    accessory={<Pressable accessibilityRole="button" accessibilityLabel="Fulfilment and orders" onPress={() => router.push('/market/seller/orders' as Href)} style={styles.headerButton}><Truck size={21} color={colors.text} /></Pressable>}>
    {market.isLoading ? <SellerLoading label="Loading your listings…" /> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={market.isRefreshing} onRefresh={() => { void market.refresh(); void seller.refresh(); }} tintColor={colors.accent} />}>
      {seller.eligibility && !isApproved ? <SellerEligibilityNotice compact eligibility={seller.eligibility} onApplicationClosed={() => void seller.refresh()} /> : null}
      <View style={styles.actionsRow}>
        <View style={styles.flex}><SellerButton label="Add product" icon={<Plus size={17} color="#ffffff" />} disabled={!isApproved || !canMutate} onPress={() => openEditor()} /></View>
        <View style={styles.flex}><SellerButton variant="secondary" label="Orders" icon={<Truck size={17} color={colors.text} />} onPress={() => router.push('/market/seller/orders' as Href)} /></View>
      </View>
      <View style={styles.stats}>
        <Stat label="Total listings" value={counts.total} color={colors.text} styles={styles} />
        <Stat label="Active in market" value={counts.published} color={colors.successText} styles={styles} />
        <Stat label="Pending review" value={counts.pending} color={colors.warningText} styles={styles} />
        <Stat label="Low stock (≤3)" value={counts.lowStock} color={colors.destructiveText} styles={styles} />
      </View>
      <View style={styles.searchBox}>
        <Search size={19} color={colors.mutedText} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search your catalogue" placeholderTextColor={colors.mutedText} accessibilityLabel="Search your catalogue" style={styles.searchInput} />
        {search ? <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setSearch('')}><X size={18} color={colors.mutedText} /></Pressable> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((option) => {
          const selected = option.value === filter;
          return <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setFilter(option.value)} style={[styles.filter, selected ? styles.filterActive : null]}>
            <Text style={[styles.filterText, selected ? styles.filterTextActive : null]}>{option.label}</Text>
          </Pressable>;
        })}
      </ScrollView>
      {market.error ? <Pressable onPress={() => void market.refresh()} style={styles.errorCard}><Text accessibilityRole="alert" style={styles.errorText}>{market.error} Tap to retry.</Text></Pressable> : null}
      {showDraft && draft ? <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={[styles.thumb, styles.thumbEmpty]}><FilePenLine size={22} color={colors.mutedText} /></View>
          <View style={styles.flex}>
            <Text numberOfLines={2} style={styles.cardTitle}>{draft.title || 'Untitled draft'}</Text>
            <Text style={styles.meta}>Saved on this device · {new Date(draft.savedAtMs).toLocaleDateString()}</Text>
            <Text style={[styles.badge, styles.badgeMuted]}>Draft</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <SellerButton compact label="Continue" disabled={!isApproved || !canMutate} onPress={() => openEditor()} />
          <SellerButton compact variant="danger" label="Discard" onPress={() => void market.discardDraft()} />
        </View>
      </View> : null}
      {filter !== 'draft' ? visible.map((listing) => <ListingCard key={listing.id} listing={listing} styles={styles} colors={colors} busy={market.busyId === listing.id} canMutate={canMutate}
        onEdit={() => openEditor(listing.id)} onToggle={() => setConfirm({ kind: 'status', listing })} onDelete={() => setConfirm({ kind: 'delete', listing })}
        onDuplicate={() => void handleDuplicate(listing)} onView={() => router.push(`/market/${encodeURIComponent(listing.id)}` as Href)} />) : null}
      {!market.error && ((filter === 'draft' && !showDraft) || (filter !== 'draft' && !visible.length && !showDraft)) ? <View style={styles.empty}>
        <Package size={40} color={colors.mutedText} />
        <Text style={styles.emptyTitle}>{market.listings.length || draft ? 'No listings match' : 'No listings yet'}</Text>
        <Text style={styles.emptyText}>{market.listings.length || draft ? 'Try another search or status filter.' : 'Add your first product and submit it for review.'}</Text>
      </View> : null}
    </ScrollView>}
    <CustomModal visible={Boolean(confirm)} type={confirm?.kind === 'delete' ? 'danger' : 'warning'}
      title={confirm?.kind === 'delete' ? 'Delete listing?' : confirm && isPublished(confirm.listing) ? 'Unpublish listing?' : 'Submit for review?'}
      message={confirm?.kind === 'delete' ? `${confirm.listing.title} will be archived and removed from the marketplace. This cannot be undone.` : confirm && isPublished(confirm.listing) ? `${confirm.listing.title} will be hidden from buyers until you republish it.` : `${confirm?.listing.title ?? 'This listing'} will be sent to an administrator for review before it appears in the marketplace.`}
      confirmText={confirm?.kind === 'delete' ? 'Delete' : confirm && isPublished(confirm.listing) ? 'Unpublish' : 'Submit'} cancelText="Cancel"
      isLoading={Boolean(confirm && market.busyId === confirm.listing.id)} onConfirm={() => void handleConfirm()} onCancel={() => setConfirm(null)} onClose={() => setConfirm(null)} />
    <CustomModal visible={Boolean(notice)} type={notice?.type ?? 'info'} title={notice?.title ?? ''} message={notice?.message ?? ''} onClose={() => setNotice(null)} />
  </SellerScreenFrame>;
}

type ListingStyles = ReturnType<typeof createStyles>;

function Stat({ label, value, color, styles }: { label: string; value: number; color: string; styles: ListingStyles }) {
  return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={[styles.statValue, { color }]}>{value}</Text></View>;
}

type ListingCardProps = {
  listing: SellerListing; styles: ListingStyles; colors: AppThemeColors; busy: boolean; canMutate: boolean;
  onEdit: () => void; onToggle: () => void; onDelete: () => void; onDuplicate: () => void; onView: () => void;
};

function ListingCard({ listing, styles, colors, busy, canMutate, onEdit, onToggle, onDelete, onDuplicate, onView }: ListingCardProps) {
  const published = isPublished(listing);
  const pending = listing.status === 'pending';
  const badge = published ? { label: 'Published', style: styles.badgeSuccess } : pending ? { label: 'Pending review', style: styles.badgeWarning }
    : listing.status === 'rejected' ? { label: 'Rejected', style: styles.badgeDanger } : { label: 'Unpublished', style: styles.badgeMuted };
  const stock = stockOf(listing);
  return <View style={styles.card}>
    <View style={styles.cardTop}>
      <View style={styles.thumb}>{listing.thumbnailImage ? <CachedImage uri={listing.thumbnailImage} style={styles.fill} accessibilityLabel={listing.title} /> : <Package size={22} color={colors.mutedText} />}</View>
      <View style={styles.flex}>
        <Text numberOfLines={2} style={styles.cardTitle}>{listing.title}</Text>
        <Text numberOfLines={1} style={styles.meta}>{listing.category || 'Uncategorised'} · {listing.condition.replace('_', ' ')}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.price}>{priceOf(listing)}</Text>
          <Text style={[styles.meta, stock <= 3 && listing.variants.length ? { color: colors.destructiveText, fontWeight: '800' } : null]}>{stock} in stock</Text>
          <Text style={[styles.badge, badge.style]}>{badge.label}</Text>
        </View>
      </View>
    </View>
    {listing.status === 'rejected' && listing.rejectionReason ? <View style={styles.feedback}><Text style={styles.feedbackText}><Text style={{ fontWeight: '900' }}>Admin feedback: </Text>{listing.rejectionReason}</Text></View> : null}
    {pending ? <Text style={styles.meta}>Pending listings can be edited once an administrator has reviewed them.</Text> : null}
    <View style={styles.cardActions}>
      <IconAction label={`Edit ${listing.title}`} disabled={pending || !canMutate || busy} onPress={onEdit} styles={styles}><FilePenLine size={17} color={colors.text} /></IconAction>
      <IconAction label={`Duplicate ${listing.title}`} disabled={!canMutate} onPress={onDuplicate} styles={styles}><Copy size={17} color={colors.text} /></IconAction>
      {published ? <IconAction label={`View ${listing.title} in the market`} onPress={onView} styles={styles}><ExternalLink size={17} color={colors.text} /></IconAction> : null}
      <SellerButton compact variant="secondary" label={published ? 'Unpublish' : 'Republish'} icon={<Power size={15} color={colors.text} />} isLoading={busy} disabled={!canMutate || pending} onPress={onToggle} />
      <IconAction label={`Delete ${listing.title}`} danger disabled={!canMutate || busy} onPress={onDelete} styles={styles}><Trash2 size={17} color={colors.destructiveText} /></IconAction>
    </View>
  </View>;
}

function IconAction({ label, onPress, disabled, danger, styles, children }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean; styles: ListingStyles; children: ReactNode }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={onPress}
    style={[styles.iconButton, danger ? styles.iconDanger : null, disabled ? { opacity: 0.4 } : null]}>{children}</Pressable>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  fill: { width: '100%', height: '100%' },
  content: { padding: 14, paddingBottom: 40, gap: 14 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.control },
  actionsRow: { flexDirection: 'row', gap: 10 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { width: '47%', flexGrow: 1, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  statLabel: { color: colors.mutedText, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  statValue: { marginTop: 4, fontSize: 24, fontWeight: '900' },
  searchBox: { minHeight: 50, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: 15 },
  filters: { gap: 8, paddingRight: 14 },
  filter: { minHeight: 40, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { color: colors.secondaryText, fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: colors.onAccent },
  errorCard: { padding: 12, borderRadius: 13, backgroundColor: colors.destructiveSurface },
  errorText: { color: colors.destructiveText, lineHeight: 18 },
  card: { padding: 14, gap: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 72, height: 72, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.control },
  thumbEmpty: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  meta: { marginTop: 3, color: colors.mutedText, fontSize: 12, textTransform: 'capitalize' },
  metaRow: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  price: { color: colors.text, fontSize: 14, fontWeight: '900' },
  badge: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden', fontSize: 11, fontWeight: '800' },
  badgeSuccess: { backgroundColor: colors.successSurface, color: colors.successText },
  badgeWarning: { backgroundColor: colors.warningSurface, color: colors.warningText },
  badgeDanger: { backgroundColor: colors.destructiveSurface, color: colors.destructiveText },
  badgeMuted: { backgroundColor: colors.control, color: colors.secondaryText },
  feedback: { padding: 11, borderRadius: 12, backgroundColor: colors.destructiveSurface },
  feedbackText: { color: colors.destructiveText, fontSize: 12, lineHeight: 17 },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: colors.border },
  iconDanger: { borderColor: colors.destructive, backgroundColor: colors.destructiveSurface },
  empty: { paddingVertical: 40, paddingHorizontal: 20, alignItems: 'center', gap: 8, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  emptyText: { color: colors.mutedText, textAlign: 'center', lineHeight: 19 },
});
