import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar, CircleCheck, CircleX, Clock } from 'lucide-react-native';
import { bookingStatusTone } from '@/components/ads/adsLabels';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { AdsListSkeleton } from '@/components/ads/AdsSkeletons';
import { AdsButton, AdsCard, AdsChip, AdsEmptyState, AdsErrorState, AdsHeading, AdsInfoRow, AdsScreen, AdsTabs } from '@/components/ads/AdsUi';
import { AdsMarketplaceService, adsMarketplaceService } from '@/lib/services/AdsMarketplaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { AdBooking, BookingStatus } from '@/lib/types/adsMarketplace';

type BookingTab = 'all' | BookingStatus;
const TABS: { value: BookingTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

/** My Bookings (website /ads/marketplace/my-bookings): the signed-in advertiser's bookings by status. */
export default function MyBookingsRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [bookings, setBookings] = useState<AdBooking[]>([]);
  const [selectedTab, setSelectedTab] = useState<BookingTab>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const client = await adsMarketplaceService.getMyClient();
      setBookings(client ? await adsMarketplaceService.getClientBookings(client.clientId, selectedTab === 'all' ? undefined : selectedTab) : []);
    } catch (fetchError: unknown) {
      setError(AdsMarketplaceService.errorMessage(fetchError, 'Failed to load bookings.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedTab]);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  const filteredBookings = selectedTab === 'all' ? bookings : bookings.filter((booking) => booking.status === selectedTab);
  const statusIcon = (status: BookingStatus) => {
    if (status === 'completed') return <CircleCheck size={14} color={colors.successText} />;
    if (status === 'cancelled') return <CircleX size={14} color={colors.destructiveText} />;
    return <Clock size={14} color={colors.mutedText} />;
  };

  return (
    <AdsScreen title="My Bookings" loading={isLoading} skeleton={<AdsListSkeleton withTabs rows={3} />} refreshing={isRefreshing} onRefresh={() => void fetchBookings(true)}>
      <AdsHeading title="My Bookings" subtitle="View and manage your ad bookings" />
      <AdsTabs tabs={TABS} value={selectedTab} onChange={setSelectedTab} />
      {error ? <AdsErrorState message={error} onRetry={() => void fetchBookings()} /> : filteredBookings.length === 0 ? (
        <AdsCard>
          <AdsEmptyState
            icon={<Calendar size={30} color={colors.mutedText} />}
            title="No bookings found"
            message={selectedTab === 'all' ? "You haven't made any bookings yet" : `No ${AdsMarketplaceService.statusLabel(selectedTab)} bookings`}
            actionLabel="Browse Offers"
            onAction={() => router.push(adsRoutes.browse)}
          />
        </AdsCard>
      ) : filteredBookings.map((booking) => (
        <AdsCard key={booking.bookingId}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <AdsChip label={AdsMarketplaceService.statusLabel(booking.status)} tone={bookingStatusTone(booking.status)} icon={statusIcon(booking.status)} />
            <AdsChip label={booking.paymentStatus} tone={booking.paymentStatus === 'paid' ? 'success' : 'warning'} />
          </View>
          <AdsInfoRow label="Start Date" value={AdsMarketplaceService.formatDate(booking.startDate)} />
          <AdsInfoRow label="End Date" value={AdsMarketplaceService.formatDate(booking.endDate)} />
          <AdsInfoRow label="Duration" value={AdsMarketplaceService.countLabel(booking.duration, 'day')} />
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 10 }}>
            <View>
              <Text style={{ fontSize: 13, color: colors.mutedText }}>Total Price</Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>{AdsMarketplaceService.formatPrice(booking.agreedPrice, booking.currency)}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <AdsButton label="View Details" variant="secondary" onPress={() => router.push(adsRoutes.booking(booking.bookingId))} style={{ flex: 1 }} />
              {booking.status === 'active' && booking.proofOfDelivery?.submitted ? (
                <AdsButton label="View Proof" onPress={() => router.push(adsRoutes.booking(booking.bookingId))} style={{ flex: 1 }} />
              ) : null}
            </View>
          </View>
        </AdsCard>
      ))}
    </AdsScreen>
  );
}
