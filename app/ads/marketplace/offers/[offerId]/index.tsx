import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, CircleCheck, MapPin, SearchX, Star, Users } from 'lucide-react-native';
import { displayTypeTone } from '@/components/ads/adsLabels';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { AdsDetailSkeleton } from '@/components/ads/AdsSkeletons';
import { AdsButton, AdsCard, AdsChip, AdsEmptyState, AdsErrorState, AdsScreen, AdsStat } from '@/components/ads/AdsUi';
import { AdsMarketplaceService, adsMarketplaceService } from '@/lib/services/AdsMarketplaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { AdOffer, Host } from '@/lib/types/adsMarketplace';

/** Offer detail (website /ads/marketplace/offers/[offerId]). */
export default function OfferDetailRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { offerId } = useLocalSearchParams<{ offerId: string }>();
  const [offer, setOffer] = useState<AdOffer | null>(null);
  const [host, setHost] = useState<Host | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOffer = useCallback(async () => {
    if (!offerId) return;
    setIsLoading(true);
    setError(null);
    try {
      const offerData = await adsMarketplaceService.getOffer(offerId);
      setOffer(offerData);
      if (offerData) setHost(await adsMarketplaceService.getHost(offerData.hostId).catch(() => null));
    } catch (fetchError: unknown) {
      setError(AdsMarketplaceService.errorMessage(fetchError, 'Failed to load offer.'));
    } finally {
      setIsLoading(false);
    }
  }, [offerId]);

  useEffect(() => {
    void fetchOffer();
  }, [fetchOffer]);

  const canBook = Boolean(offer && offer.status === 'active' && !(offer.availableInventory !== undefined && offer.availableInventory <= 0));

  return (
    <AdsScreen title="Ad Offer" loading={isLoading} skeleton={<AdsDetailSkeleton />} onBackPress={() => (router.canGoBack() ? router.back() : router.replace(adsRoutes.browse))}>
      {error ? <AdsErrorState message={error} onRetry={() => void fetchOffer()} /> : !offer ? (
        <AdsCard>
          <AdsEmptyState
            icon={<SearchX size={30} color={colors.mutedText} />}
            title="Ad Offer Not Found"
            message="The sponsorship or ad offer you are looking for is no longer available or does not exist."
            actionLabel="Browse Offers"
            onAction={() => router.replace(adsRoutes.browse)}
          />
        </AdsCard>
      ) : (
        <>
          <AdsCard>
            <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text }}>{offer.title}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <AdsChip label={offer.displayType} tone={displayTypeTone(offer.displayType)} />
              {host?.verificationStatus === 'verified' ? <AdsChip label="Verified Host" tone="success" icon={<CircleCheck size={14} color={colors.successText} />} /> : null}
            </View>
            {host ? <Text style={{ fontSize: 14, color: colors.mutedText }}>by {AdsMarketplaceService.hostName(host)}</Text> : null}
            <View>
              <Text style={{ fontSize: 28, fontWeight: '900', color: colors.text }}>{AdsMarketplaceService.formatPrice(offer.pricing.basePrice, offer.pricing.currency)}</Text>
              <Text style={{ fontSize: 13, color: colors.mutedText }}>{AdsMarketplaceService.pricingModelLabel(offer.pricing.pricingModel)}</Text>
            </View>
            <Text style={{ fontSize: 15, color: colors.secondaryText, lineHeight: 22 }}>{offer.description}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
              {offer.audienceInfo.estimatedReach ? <AdsStat label="Estimated Reach" value={offer.audienceInfo.estimatedReach.toLocaleString()} icon={<Users size={20} color={colors.mutedText} />} /> : null}
              {host && host.averageRating > 0 ? <AdsStat label="Host Rating" value={`${host.averageRating.toFixed(1)} (${AdsMarketplaceService.countLabel(host.totalReviews, 'review')})`} icon={<Star size={20} color="#facc15" fill="#facc15" />} /> : null}
              {offer.displaySpecs.digitalLocation ? <AdsStat label="Location" value={offer.displaySpecs.digitalLocation} icon={<MapPin size={20} color={colors.mutedText} />} /> : null}
              {offer.availableInventory !== undefined ? <AdsStat label="Available Slots" value={`${offer.availableInventory} of ${offer.totalInventory ?? 0}`} icon={<Calendar size={20} color={colors.mutedText} />} /> : null}
            </View>
            <AdsButton label="Book This Offer" disabled={!canBook} onPress={() => router.push(adsRoutes.bookOffer(offer.offerId))} />
          </AdsCard>

          <AdsCard title="Additional Details">
            {offer.category ? <Detail label="Category" value={offer.category} /> : null}
            {offer.pricing.minimumDuration ? <Detail label="Minimum Duration" value={AdsMarketplaceService.countLabel(offer.pricing.minimumDuration, 'day')} /> : null}
            {offer.pricing.maximumDuration ? <Detail label="Maximum Duration" value={AdsMarketplaceService.countLabel(offer.pricing.maximumDuration, 'day')} /> : null}
            {offer.tags && offer.tags.length > 0 ? (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 13, color: colors.mutedText }}>Tags</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {offer.tags.map((tag) => <AdsChip key={tag} label={tag} raw />)}
                </View>
              </View>
            ) : null}
          </AdsCard>
        </>
      )}
    </AdsScreen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: 13, color: colors.mutedText }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{value}</Text>
    </View>
  );
}
