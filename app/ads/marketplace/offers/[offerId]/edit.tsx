import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { offerStatusTone } from '@/components/ads/adsLabels';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { AdsFormSkeleton } from '@/components/ads/AdsSkeletons';
import { AdsButton, AdsCard, AdsChip, AdsEmptyState, AdsErrorState, AdsField, AdsHeading, AdsScreen, AdsSectionLabel } from '@/components/ads/AdsUi';
import { AdsNumberField, OfferDisplaySpecsFields, OfferPricingFields, OfferTagsField, type OfferPricingValues } from '@/components/ads/OfferFormSections';
import CustomModal from '@/components/ui/CustomModal';
import { AdsMarketplaceService, adsMarketplaceService } from '@/lib/services/AdsMarketplaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { AdAudienceInfo, AdDisplaySpecs, AdOffer, AdOfferStatus } from '@/lib/types/adsMarketplace';

/** Edit an offer (website /ads/marketplace/offers/[offerId]/edit), for the offer's host. */
export default function EditOfferRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { offerId } = useLocalSearchParams<{ offerId: string }>();
  const [offer, setOffer] = useState<AdOffer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<AdOfferStatus | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [displaySpecs, setDisplaySpecs] = useState<AdDisplaySpecs>({});
  const [audienceInfo, setAudienceInfo] = useState<AdAudienceInfo>({ estimatedReach: 0 });
  const [pricing, setPricing] = useState<OfferPricingValues>({ basePrice: 0, currency: 'USD', pricingModel: 'fixed', minimumDuration: 1, maximumDuration: 30 });
  const [totalInventory, setTotalInventory] = useState(1);
  const [status, setStatus] = useState<AdOfferStatus>('draft');

  const fetchOffer = useCallback(async () => {
    if (!offerId) return;
    const userId = adsMarketplaceService.currentUserId();
    if (!userId) {
      toast.error('Please log in');
      router.replace(adsRoutes.login);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const offerData = await adsMarketplaceService.getOffer(offerId);
      if (!offerData) {
        toast.error('Offer not found');
        router.replace(adsRoutes.myOffers);
        return;
      }
      if (offerData.userId !== userId) {
        toast.error('You do not have permission to edit this offer');
        router.replace(adsRoutes.offer(offerId));
        return;
      }
      if (offerData.status === 'active') {
        const bookings = await adsMarketplaceService.getHostBookings(offerData.hostId);
        if (bookings.some((booking) => booking.offerId === offerId && (booking.status === 'active' || booking.status === 'paid'))) {
          toast.error('Cannot edit offer with active bookings. Please pause it first.');
          router.replace(adsRoutes.offer(offerId));
          return;
        }
      }
      setOffer(offerData);
      setTitle(offerData.title);
      setDescription(offerData.description);
      setCategory(offerData.category ?? '');
      setTags(offerData.tags ?? []);
      setDisplaySpecs(offerData.displaySpecs ?? {});
      setAudienceInfo({
        demographics: {
          ageRange: offerData.audienceInfo.demographics?.ageRange ?? { min: 18, max: 65 },
          gender: offerData.audienceInfo.demographics?.gender ?? 'all',
          location: offerData.audienceInfo.demographics?.location ?? [],
        },
        interests: offerData.audienceInfo.interests ?? [],
        estimatedReach: offerData.audienceInfo.estimatedReach,
        averageEngagement: offerData.audienceInfo.averageEngagement ?? 0,
      });
      setPricing({
        basePrice: offerData.pricing.basePrice,
        currency: offerData.pricing.currency,
        pricingModel: offerData.pricing.pricingModel,
        minimumDuration: offerData.pricing.minimumDuration || 1,
        maximumDuration: offerData.pricing.maximumDuration || 30,
      });
      setTotalInventory(offerData.totalInventory || 1);
      setStatus(offerData.status);
    } catch (fetchError: unknown) {
      setError(AdsMarketplaceService.errorMessage(fetchError, 'Failed to load offer.'));
    } finally {
      setIsLoading(false);
    }
  }, [offerId, router]);

  useEffect(() => {
    void fetchOffer();
  }, [fetchOffer]);

  const ageRange = audienceInfo.demographics?.ageRange ?? { min: 18, max: 65 };
  const updateAgeRange = (update: Partial<{ min: number; max: number }>): void => {
    setAudienceInfo((previous) => ({ ...previous, demographics: { ...previous.demographics, ageRange: { ...ageRange, ...update } } }));
  };

  const handleSave = async (): Promise<void> => {
    if (!offer || !offerId) return;
    if (!title.trim() || !description.trim()) {
      toast.error('Title and description are required');
      return;
    }
    if (pricing.basePrice <= 0) {
      toast.error('Base price must be greater than 0');
      return;
    }
    if (audienceInfo.estimatedReach <= 0) {
      toast.error('Estimated reach must be greater than 0');
      return;
    }
    setIsSubmitting(true);
    try {
      await adsMarketplaceService.updateOffer(offerId, {
        title,
        description,
        category: category || undefined,
        tags: tags.length > 0 ? tags : undefined,
        displaySpecs,
        audienceInfo,
        pricing,
        totalInventory,
      });
      toast.success('Offer updated successfully');
      router.replace(adsRoutes.offer(offerId));
    } catch (saveError: unknown) {
      toast.error(AdsMarketplaceService.errorMessage(saveError, 'Failed to update offer'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmStatusChange = async (): Promise<void> => {
    if (!pendingStatus || !offerId) return;
    const nextStatus = pendingStatus;
    setIsChangingStatus(true);
    try {
      await adsMarketplaceService.updateOffer(offerId, { status: nextStatus });
      toast.success(`Offer ${nextStatus} successfully`);
      setStatus(nextStatus);
    } catch (statusError: unknown) {
      toast.error(AdsMarketplaceService.errorMessage(statusError, 'Failed to update offer status'));
    } finally {
      setIsChangingStatus(false);
      setPendingStatus(null);
    }
  };

  return (
    <AdsScreen
      title="Edit Offer"
      loading={isLoading}
      skeleton={<AdsFormSkeleton sections={4} />}
      footer={offer ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AdsButton label="Cancel" variant="secondary" disabled={isSubmitting} onPress={() => router.replace(adsRoutes.offer(offer.offerId))} style={{ flex: 1 }} />
          <AdsButton label={isSubmitting ? 'Saving…' : 'Save changes'} loading={isSubmitting} onPress={() => void handleSave()} style={{ flex: 1 }} />
        </View>
      ) : undefined}
    >
      {error ? <AdsErrorState message={error} onRetry={() => void fetchOffer()} /> : !offer ? (
        <AdsCard>
          <AdsEmptyState icon={<SearchX size={30} color={colors.mutedText} />} title="Offer not found" actionLabel="Back to My Offers" onAction={() => router.replace(adsRoutes.myOffers)} />
        </AdsCard>
      ) : (
        <>
          <AdsHeading title="Edit offer" subtitle="Update your ad offer details" />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <AdsChip label={status} tone={offerStatusTone(status)} />
            {status === 'active' ? <AdsButton label="Pause" variant="secondary" compact onPress={() => setPendingStatus('paused')} /> : null}
            {status === 'paused' ? <AdsButton label="Activate" variant="secondary" compact onPress={() => setPendingStatus('active')} /> : null}
          </View>
          <AdsCard>
            <AdsSectionLabel title="Basic information" />
            <AdsField label="Offer title" required value={title} onChangeText={setTitle} />
            <AdsField label="Description" required multiline value={description} onChangeText={setDescription} />
            <AdsField label="Category" value={category} onChangeText={setCategory} />
            <OfferTagsField tags={tags} onChange={setTags} />
          </AdsCard>
          <AdsCard>
            <AdsSectionLabel title="Display" description="Display type cannot be changed after creation." />
            <AdsChip label={offer.displayType} />
            <OfferDisplaySpecsFields
              displayType={offer.displayType}
              specs={displaySpecs}
              onSpecsChange={(update) => setDisplaySpecs((previous) => ({ ...previous, ...update }))}
              estimatedReach={audienceInfo.estimatedReach}
              onEstimatedReachChange={(estimatedReach) => setAudienceInfo((previous) => ({ ...previous, estimatedReach }))}
              readOnlyChoices
            />
          </AdsCard>
          <AdsCard>
            <AdsSectionLabel title="Audience" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><AdsNumberField label="Minimum age" value={ageRange.min} onChange={(min) => updateAgeRange({ min })} /></View>
              <View style={{ flex: 1 }}><AdsNumberField label="Maximum age" value={ageRange.max} onChange={(max) => updateAgeRange({ max })} /></View>
            </View>
            <AdsNumberField label="Estimated reach" required value={audienceInfo.estimatedReach} onChange={(estimatedReach) => setAudienceInfo((previous) => ({ ...previous, estimatedReach }))} />
          </AdsCard>
          <AdsCard>
            <AdsSectionLabel title="Pricing & inventory" />
            <OfferPricingFields pricing={pricing} onChange={(update) => setPricing((previous) => ({ ...previous, ...update }))} />
            <AdsNumberField label="Total inventory" required hint="Number of available ad slots" fallback={1} value={totalInventory} onChange={setTotalInventory} />
          </AdsCard>
        </>
      )}
      <CustomModal
        visible={pendingStatus !== null}
        type="warning"
        title={pendingStatus === 'paused' ? 'Pause this offer?' : 'Activate this offer?'}
        message={`${pendingStatus === 'paused' ? 'Advertisers will not be able to book it while it is paused.' : 'Advertisers will be able to find and book it again.'} You can change this again at any time.`}
        confirmText={isChangingStatus ? 'Updating…' : pendingStatus === 'paused' ? 'Pause offer' : 'Activate offer'}
        cancelText="Cancel"
        isLoading={isChangingStatus}
        onConfirm={() => void confirmStatusChange()}
        onCancel={() => setPendingStatus(null)}
        onClose={() => {
          if (!isChangingStatus) setPendingStatus(null);
        }}
      />
    </AdsScreen>
  );
}
