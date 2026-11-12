import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MapPin, Search, Star, Users } from 'lucide-react-native';
import { displayTypeTone } from '@/components/ads/adsLabels';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { AdsListSkeleton } from '@/components/ads/AdsSkeletons';
import { AdsButton, AdsCard, AdsChip, AdsEmptyState, AdsErrorState, AdsHeading, AdsScreen, AdsTabs } from '@/components/ads/AdsUi';
import { AdsMarketplaceService, adsMarketplaceService } from '@/lib/services/AdsMarketplaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { AdOffer, Host } from '@/lib/types/adsMarketplace';

type DisplayFilter = 'all' | 'digital' | 'social' | 'physical';

const DISPLAY_FILTERS: { value: DisplayFilter; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'digital', label: 'Digital' },
  { value: 'social', label: 'Social media' },
  { value: 'physical', label: 'Physical' },
];

/** Browse Ad Offers (website /ads/marketplace/browse): search, display-type filter and active offer cards. */
export default function BrowseOffersRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [offers, setOffers] = useState<AdOffer[]>([]);
  const [hosts, setHosts] = useState<Map<string, Host>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayTypeFilter, setDisplayTypeFilter] = useState<DisplayFilter>('all');

  const fetchOffers = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const offerList = await adsMarketplaceService.browseOffers({ displayType: displayTypeFilter === 'all' ? undefined : displayTypeFilter });
      setOffers(offerList);
      const hostIds = Array.from(new Set(offerList.map((offer) => offer.hostId)));
      const hostEntries = await Promise.all(hostIds.map(async (hostId) => {
        try {
          return [hostId, await adsMarketplaceService.getHost(hostId)] as const;
        } catch (hostError: unknown) {
          console.warn('[BrowseOffersRoute.fetchOffers] Error:', hostId, hostError);
          return [hostId, null] as const;
        }
      }));
      const hostMap = new Map<string, Host>();
      hostEntries.forEach(([hostId, host]) => {
        if (host) hostMap.set(hostId, host);
      });
      setHosts(hostMap);
    } catch (fetchError: unknown) {
      setError(AdsMarketplaceService.errorMessage(fetchError, 'Failed to load offers.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [displayTypeFilter]);

  useEffect(() => {
    void fetchOffers();
  }, [fetchOffers]);

  const filteredOffers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return offers;
    return offers.filter((offer) => offer.title.toLowerCase().includes(query)
      || offer.description.toLowerCase().includes(query)
      || Boolean(offer.category?.toLowerCase().includes(query)));
  }, [offers, searchQuery]);

  const handleClearFilters = (): void => {
    setSearchQuery('');
    setDisplayTypeFilter('all');
  };

  return (
    <AdsScreen
      title="Browse Offers"
      loading={isLoading}
      skeleton={<AdsListSkeleton withSearch rows={3} />}
      refreshing={isRefreshing}
      onRefresh={() => void fetchOffers(true)}
    >
      <AdsHeading title="Browse Ad Offers" subtitle="Find the perfect ad space for your campaign" />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.input, paddingHorizontal: 12 }}>
        <Search size={16} color={colors.mutedText} />
        <TextInput
          accessibilityLabel="Search offers"
          placeholder="Search offers..."
          placeholderTextColor={colors.mutedText}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={{ flex: 1, minHeight: 46, color: colors.text, fontSize: 15 }}
        />
      </View>
      <AdsTabs tabs={DISPLAY_FILTERS} value={displayTypeFilter} onChange={setDisplayTypeFilter} />

      {error ? <AdsErrorState message={error} onRetry={() => void fetchOffers()} /> : filteredOffers.length === 0 ? (
        <AdsCard>
          <AdsEmptyState
            icon={<Search size={30} color={colors.mutedText} />}
            title="No offers found"
            message="Try adjusting your search or filters"
            actionLabel="Clear Filters"
            onAction={handleClearFilters}
          />
        </AdsCard>
      ) : filteredOffers.map((offer) => {
        const host = hosts.get(offer.hostId);
        return (
          <AdsCard key={offer.offerId}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }} numberOfLines={2}>{offer.title}</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <AdsChip label={offer.displayType} tone={displayTypeTone(offer.displayType)} />
              {host?.verificationStatus === 'verified' ? <AdsChip label="Verified" tone="success" /> : null}
            </View>
            <Text style={{ fontSize: 14, color: colors.secondaryText, lineHeight: 20 }} numberOfLines={3}>{offer.description}</Text>
            <View style={{ gap: 6 }}>
              {offer.displaySpecs.digitalLocation ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MapPin size={16} color={colors.mutedText} />
                  <Text style={{ fontSize: 13, color: colors.secondaryText }}>{offer.displaySpecs.digitalLocation}</Text>
                </View>
              ) : null}
              {offer.audienceInfo.estimatedReach ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Users size={16} color={colors.mutedText} />
                  <Text style={{ fontSize: 13, color: colors.secondaryText }}>{offer.audienceInfo.estimatedReach.toLocaleString()} reach</Text>
                </View>
              ) : null}
              {host && host.averageRating > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Star size={16} color="#facc15" fill="#facc15" />
                  <Text style={{ fontSize: 13, color: colors.secondaryText }}>{host.averageRating.toFixed(1)} ({AdsMarketplaceService.countLabel(host.totalReviews, 'review')})</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
              <View>
                <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>{AdsMarketplaceService.formatPrice(offer.pricing.basePrice, offer.pricing.currency)}</Text>
                <Text style={{ fontSize: 12, color: colors.mutedText }}>{AdsMarketplaceService.pricingModelLabel(offer.pricing.pricingModel)}</Text>
              </View>
              <AdsButton label="View Details" compact onPress={() => router.push(adsRoutes.offer(offer.offerId))} />
            </View>
          </AdsCard>
        );
      })}
    </AdsScreen>
  );
}
