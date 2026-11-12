import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CircleCheck, CircleX, Clock, DollarSign, Plus, Star, TrendingUp, Users } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { capitalize, displayTypeTone, offerStatusTone, verificationTone } from '@/components/ads/adsLabels';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { AdsDashboardSkeleton } from '@/components/ads/AdsSkeletons';
import { ADS_GREEN, AdsButton, AdsCard, AdsChip, AdsEmptyState, AdsErrorState, AdsHeading, AdsScreen, type AdsTone } from '@/components/ads/AdsUi';
import { AdsMarketplaceService, adsMarketplaceService } from '@/lib/services/AdsMarketplaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { AdBooking, AdOffer, Host } from '@/lib/types/adsMarketplace';

type DashboardMetrics = {
  totalOffers: number;
  activeOffers: number;
  totalBookings: number;
  activeBookings: number;
  completedBookings: number;
  totalRevenue: number;
  pendingRevenue: number;
};

function calculateMetrics(offers: AdOffer[], bookings: AdBooking[]): DashboardMetrics {
  const activeBookings = bookings.filter((booking) => booking.status === 'active' || booking.status === 'paid');
  const completedBookings = bookings.filter((booking) => booking.status === 'completed');
  return {
    totalOffers: offers.length,
    activeOffers: offers.filter((offer) => offer.status === 'active').length,
    totalBookings: bookings.length,
    activeBookings: activeBookings.length,
    completedBookings: completedBookings.length,
    totalRevenue: completedBookings.reduce((sum, booking) => sum + (booking.hostPayout || 0), 0),
    pendingRevenue: activeBookings.reduce((sum, booking) => sum + (booking.hostPayout || 0), 0),
  };
}

const TIER_TONE: { [tier: string]: AdsTone } = { platinum: 'purple', gold: 'warning', silver: 'neutral', bronze: 'neutral' };

/** Host Dashboard (website /ads/marketplace/host-dashboard): verification, metrics, tier and recent offers. */
export default function HostDashboardRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [host, setHost] = useState<Host | null>(null);
  const [offers, setOffers] = useState<AdOffer[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (refresh = false) => {
    if (!adsMarketplaceService.currentUserId()) {
      toast.error('Please log in');
      router.replace(adsRoutes.login);
      return;
    }
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const hostData = await adsMarketplaceService.getMyHost();
      if (!hostData) {
        toast.error('You must be a registered host to access the dashboard');
        router.replace(adsRoutes.becomeHost);
        return;
      }
      const [offerList, bookingList] = await Promise.all([
        adsMarketplaceService.getHostOffers(hostData.hostId),
        adsMarketplaceService.getHostBookings(hostData.hostId),
      ]);
      setHost(hostData);
      setOffers(offerList);
      setMetrics(calculateMetrics(offerList, bookingList));
    } catch (fetchError: unknown) {
      setError(AdsMarketplaceService.errorMessage(fetchError, 'Failed to load dashboard.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const verificationIcon = (status: string) => {
    if (status === 'verified') return <CircleCheck size={20} color={colors.successText} />;
    if (status === 'pending') return <Clock size={20} color={colors.warningText} />;
    return <CircleX size={20} color={colors.destructiveText} />;
  };
  const tierProgress = host ? host.completedBookings / Math.max(host.completedBookings + 10, 1) : 0;

  return (
    <AdsScreen title="Host Dashboard" loading={isLoading} skeleton={<AdsDashboardSkeleton />} refreshing={isRefreshing} onRefresh={() => void fetchDashboard(true)}>
      {error ? <AdsErrorState message={error} onRetry={() => void fetchDashboard()} /> : !host || !metrics ? null : (
        <>
          <AdsHeading title="Host Dashboard" subtitle={`Welcome back, ${AdsMarketplaceService.hostName(host)}`} />
          <AdsButton label="Create New Offer" icon={<Plus size={16} color="#ffffff" />} onPress={() => router.push(adsRoutes.createOffer)} />

          {host.verificationStatus !== 'verified' ? (
            <AdsCard accent="#f59e0b">
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                {verificationIcon(host.verificationStatus)}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>Verification Status: {capitalize(host.verificationStatus)}</Text>
                  <Text style={{ fontSize: 13, color: colors.mutedText, lineHeight: 19 }}>
                    {host.verificationStatus === 'pending'
                      ? 'Your host account is under review. You can still create offers, but they will be marked as pending verification.'
                      : 'Your host account verification was rejected. Please update your information and resubmit.'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <AdsChip label={host.verificationStatus} tone={verificationTone(host.verificationStatus)} />
                <AdsButton label="View Details" variant="secondary" compact onPress={() => router.push(adsRoutes.verification)} />
              </View>
            </AdsCard>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            <MetricTile label="Total Offers" value={String(metrics.totalOffers)} caption={`${metrics.activeOffers} active`} icon={<TrendingUp size={20} color="#2563eb" />} tone="info" />
            <MetricTile label={metrics.totalBookings === 1 ? 'Total Booking' : 'Total Bookings'} value={String(metrics.totalBookings)} caption={`${metrics.activeBookings} active`} icon={<Users size={20} color={ADS_GREEN} />} tone="success" />
            <MetricTile label="Total Revenue" value={AdsMarketplaceService.formatPrice(metrics.totalRevenue, 'USD')} caption={`${AdsMarketplaceService.formatPrice(metrics.pendingRevenue, 'USD')} pending`} icon={<DollarSign size={20} color="#ca8a04" />} tone="warning" />
            <MetricTile label="Average Rating" value={host.averageRating > 0 ? host.averageRating.toFixed(1) : 'N/A'} caption={AdsMarketplaceService.countLabel(host.totalReviews, 'review')} icon={<Star size={20} color="#7c3aed" fill="#7c3aed" />} tone="purple" />
          </View>

          <AdsCard title="Host Tier">
            <AdsChip label={capitalize(host.tier)} tone={TIER_TONE[host.tier] ?? 'neutral'} />
            <Text style={{ fontSize: 13, color: colors.mutedText }}>{host.completedBookings} completed bookings</Text>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.control, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(tierProgress * 100)}%`, height: 8, backgroundColor: ADS_GREEN }} />
            </View>
            <Text style={{ fontSize: 12, color: colors.mutedText, textAlign: 'right' }}>Progress to next tier</Text>
          </AdsCard>

          <AdsCard title="Manage Offers" subtitle="View and manage all your ad offers" onPress={() => router.push(adsRoutes.myOffers)}>
            <AdsButton label="View All Offers" variant="secondary" compact onPress={() => router.push(adsRoutes.myOffers)} style={{ alignSelf: 'flex-start' }} />
          </AdsCard>
          <AdsCard title="View Bookings" subtitle="Manage your bookings and track delivery" onPress={() => router.push(adsRoutes.myBookings)}>
            <AdsButton label="View Bookings" variant="secondary" compact onPress={() => router.push(adsRoutes.myBookings)} style={{ alignSelf: 'flex-start' }} />
          </AdsCard>

          <AdsCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Recent Offers</Text>
              <AdsButton label="View All" variant="ghost" compact onPress={() => router.push(adsRoutes.myOffers)} />
            </View>
            {offers.length === 0 ? (
              <AdsEmptyState icon={<TrendingUp size={28} color={colors.mutedText} />} title="No offers yet" actionLabel="Create Your First Offer" onAction={() => router.push(adsRoutes.createOffer)} />
            ) : offers.slice(0, 5).map((offer) => (
              <AdsCard key={offer.offerId} onPress={() => router.push(adsRoutes.offer(offer.offerId))} style={{ padding: 12, gap: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{offer.title}</Text>
                <Text style={{ fontSize: 13, color: colors.mutedText }} numberOfLines={1}>{offer.description}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <AdsChip label={offer.displayType} tone={displayTypeTone(offer.displayType)} />
                  <AdsChip label={offer.status} tone={offerStatusTone(offer.status)} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{AdsMarketplaceService.formatPrice(offer.pricing.basePrice, offer.pricing.currency)}</Text>
                  <Text style={{ fontSize: 12, color: colors.mutedText }}>{offer.availableInventory || 0} / {offer.totalInventory || 0} available</Text>
                </View>
              </AdsCard>
            ))}
          </AdsCard>
        </>
      )}
    </AdsScreen>
  );
}

function MetricTile({ label, value, caption, icon, tone }: { label: string; value: string; caption: string; icon: ReactNode; tone: AdsTone }) {
  const { colors, isDark } = useAppTheme();
  const iconBackground = { info: isDark ? '#172554' : '#dbeafe', success: colors.successSurface, warning: colors.warningSurface, purple: isDark ? '#2e1065' : '#ede9fe' }[tone as 'info' | 'success' | 'warning' | 'purple'] ?? colors.control;
  return (
    <View style={{ flexBasis: '46%', flexGrow: 1 }}>
      <AdsCard style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 12, color: colors.mutedText, flex: 1 }}>{label}</Text>
          <View style={{ padding: 8, borderRadius: 10, backgroundColor: iconBackground }}>{icon}</View>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        <Text style={{ fontSize: 11, color: colors.mutedText }}>{caption}</Text>
      </AdsCard>
    </View>
  );
}
