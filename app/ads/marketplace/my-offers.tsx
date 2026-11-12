import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, Pause, Pencil, Play, Plus, Trash2, TrendingUp } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { displayTypeTone, offerStatusTone } from '@/components/ads/adsLabels';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { AdsListSkeleton } from '@/components/ads/AdsSkeletons';
import { AdsButton, AdsCard, AdsChip, AdsEmptyState, AdsErrorState, AdsHeading, AdsInfoRow, AdsScreen, AdsTabs } from '@/components/ads/AdsUi';
import CustomModal from '@/components/ui/CustomModal';
import { AdsMarketplaceService, adsMarketplaceService } from '@/lib/services/AdsMarketplaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { AdOffer, AdOfferStatus } from '@/lib/types/adsMarketplace';

type OfferTab = 'all' | 'draft' | 'active' | 'paused' | 'completed';
const TABS: { value: OfferTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
];

/** My Offers (website /ads/marketplace/my-offers): the host's offers with view, edit, pause / activate and delete. */
export default function MyOffersRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [offers, setOffers] = useState<AdOffer[]>([]);
  const [selectedTab, setSelectedTab] = useState<OfferTab>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offerPendingDelete, setOfferPendingDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [updatingOfferId, setUpdatingOfferId] = useState<string | null>(null);

  const fetchOffers = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      if (!adsMarketplaceService.currentUserId()) {
        setOffers([]);
        return;
      }
      const host = await adsMarketplaceService.getMyHost();
      setOffers(host ? await adsMarketplaceService.getHostOffers(host.hostId, selectedTab === 'all' ? undefined : selectedTab) : []);
    } catch (fetchError: unknown) {
      setError(AdsMarketplaceService.errorMessage(fetchError, 'Failed to load offers.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedTab]);

  useEffect(() => {
    void fetchOffers();
  }, [fetchOffers]);

  const handleUpdateStatus = async (offerId: string, status: AdOfferStatus): Promise<void> => {
    setUpdatingOfferId(offerId);
    try {
      await adsMarketplaceService.updateOffer(offerId, { status });
      toast.success('Offer status updated');
      void fetchOffers(true);
    } catch (updateError: unknown) {
      toast.error(AdsMarketplaceService.errorMessage(updateError, 'Failed to update offer'));
    } finally {
      setUpdatingOfferId(null);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!offerPendingDelete) return;
    setIsDeleting(true);
    try {
      await adsMarketplaceService.deleteOffer(offerPendingDelete);
      toast.success('Offer deleted successfully');
      void fetchOffers(true);
    } catch (deleteError: unknown) {
      toast.error(AdsMarketplaceService.errorMessage(deleteError, 'Failed to delete offer'));
    } finally {
      setIsDeleting(false);
      setOfferPendingDelete(null);
    }
  };

  const filteredOffers = selectedTab === 'all' ? offers : offers.filter((offer) => offer.status === selectedTab);

  return (
    <AdsScreen
      title="My Offers"
      loading={isLoading}
      skeleton={<AdsListSkeleton withTabs rows={3} />}
      refreshing={isRefreshing}
      onRefresh={() => void fetchOffers(true)}
    >
      <AdsHeading title="My Offers" subtitle="Manage your ad offers" />
      <AdsButton label="Create Offer" icon={<Plus size={16} color="#ffffff" />} onPress={() => router.push(adsRoutes.createOffer)} />
      <AdsTabs tabs={TABS} value={selectedTab} onChange={setSelectedTab} />
      {error ? <AdsErrorState message={error} onRetry={() => void fetchOffers()} /> : offers.length === 0 ? (
        <AdsCard>
          <AdsEmptyState icon={<TrendingUp size={30} color={colors.mutedText} />} title="No offers yet" message="Create your first ad offer to start earning" actionLabel="Create Your First Offer" onAction={() => router.push(adsRoutes.createOffer)} />
        </AdsCard>
      ) : filteredOffers.length === 0 ? (
        <AdsCard>
          <Text style={{ fontSize: 14, color: colors.mutedText, textAlign: 'center', paddingVertical: 24 }}>No {selectedTab} offers found</Text>
        </AdsCard>
      ) : filteredOffers.map((offer) => (
        <AdsCard key={offer.offerId}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{offer.title}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <AdsChip label={offer.status} tone={offerStatusTone(offer.status)} />
            <AdsChip label={offer.displayType} tone={displayTypeTone(offer.displayType)} />
            {offer.isFeatured ? <AdsChip label="Featured" tone="warning" /> : null}
          </View>
          <Text style={{ fontSize: 14, color: colors.secondaryText, lineHeight: 20 }} numberOfLines={2}>{offer.description}</Text>
          <AdsInfoRow label="Price" value={`${AdsMarketplaceService.formatPrice(offer.pricing.basePrice, offer.pricing.currency)} · ${AdsMarketplaceService.pricingModelLabel(offer.pricing.pricingModel)}`} />
          <AdsInfoRow label="Reach" value={offer.audienceInfo.estimatedReach.toLocaleString()} />
          <AdsInfoRow label="Inventory" value={`${offer.availableInventory || 'N/A'} / ${offer.totalInventory || 'N/A'} available`} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
            <AdsButton label="View Details" variant="secondary" compact icon={<Eye size={15} color={colors.text} />} onPress={() => router.push(adsRoutes.offer(offer.offerId))} />
            <AdsButton label="Edit" variant="secondary" compact icon={<Pencil size={15} color={colors.text} />} onPress={() => router.push(adsRoutes.editOffer(offer.offerId))} />
            {offer.status === 'active' ? (
              <AdsButton label="Pause" variant="secondary" compact loading={updatingOfferId === offer.offerId} icon={<Pause size={15} color={colors.text} />} onPress={() => void handleUpdateStatus(offer.offerId, 'paused')} />
            ) : offer.status === 'paused' ? (
              <AdsButton label="Activate" variant="secondary" compact loading={updatingOfferId === offer.offerId} icon={<Play size={15} color={colors.text} />} onPress={() => void handleUpdateStatus(offer.offerId, 'active')} />
            ) : offer.status === 'draft' ? (
              // Drafts go live once the host is verified (the server refuses unverified hosts with a clear message).
              <AdsButton label="Publish" variant="secondary" compact loading={updatingOfferId === offer.offerId} icon={<Play size={15} color={colors.text} />} onPress={() => void handleUpdateStatus(offer.offerId, 'active')} />
            ) : null}
            <AdsButton label="Delete" variant="secondary" compact icon={<Trash2 size={15} color={colors.destructive} />} onPress={() => setOfferPendingDelete(offer.offerId)} />
          </View>
        </AdsCard>
      ))}
      <CustomModal
        visible={offerPendingDelete !== null}
        type="danger"
        title="Delete this offer?"
        message="This cannot be undone. Advertisers will no longer be able to find or book it."
        confirmText={isDeleting ? 'Deleting…' : 'Delete offer'}
        cancelText="Cancel"
        isLoading={isDeleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setOfferPendingDelete(null)}
        onClose={() => {
          if (!isDeleting) setOfferPendingDelete(null);
        }}
      />
    </AdsScreen>
  );
}
