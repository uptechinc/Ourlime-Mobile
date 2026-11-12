import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck, SearchX } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { AdsFormSkeleton } from '@/components/ads/AdsSkeletons';
import { AdsButton, AdsCard, AdsEmptyState, AdsErrorState, AdsHeading, AdsInfoRow, AdsNotice, AdsScreen } from '@/components/ads/AdsUi';
import { AdsMarketplaceService, adsMarketplaceService, OURLIME_COMMISSION_PERCENT } from '@/lib/services/AdsMarketplaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { AdBooking, AdOffer } from '@/lib/types/adsMarketplace';

/**
 * Booking payment (website /ads/marketplace/bookings/[bookingId]/payment). Payments are not connected anywhere yet,
 * so, like the website, this shows the total and a disabled "Payments coming soon" button.
 */
export default function BookingPaymentRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<AdBooking | null>(null);
  const [offer, setOffer] = useState<AdOffer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooking = useCallback(async () => {
    if (!bookingId) return;
    const userId = adsMarketplaceService.currentUserId();
    if (!userId) {
      toast.error('Please log in');
      router.replace(adsRoutes.login);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const bookingData = await adsMarketplaceService.getBooking(bookingId);
      if (!bookingData) {
        toast.error('Booking not found');
        router.replace(adsRoutes.myBookings);
        return;
      }
      if (bookingData.userId !== userId) {
        toast.error('Access denied');
        router.replace(adsRoutes.myBookings);
        return;
      }
      if (bookingData.paymentStatus === 'paid') {
        toast.success('This booking has already been paid');
        router.replace(adsRoutes.booking(bookingId));
        return;
      }
      setBooking(bookingData);
      setOffer(await adsMarketplaceService.getOffer(bookingData.offerId).catch(() => null));
    } catch (fetchError: unknown) {
      setError(AdsMarketplaceService.errorMessage(fetchError, 'Failed to load booking.'));
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    void fetchBooking();
  }, [fetchBooking]);

  const commission = booking?.ourlimeCommission || OURLIME_COMMISSION_PERCENT;
  const commissionAmount = booking ? (booking.agreedPrice * commission) / 100 : 0;
  const hostPayout = booking ? booking.agreedPrice - commissionAmount : 0;

  return (
    <AdsScreen title="Payment" loading={isLoading} skeleton={<AdsFormSkeleton sections={2} />} onBackPress={() => (router.canGoBack() ? router.back() : router.replace(bookingId ? adsRoutes.booking(bookingId) : adsRoutes.myBookings))}>
      {error ? <AdsErrorState message={error} onRetry={() => void fetchBooking()} /> : !booking || !offer ? (
        <AdsCard>
          <AdsEmptyState icon={<SearchX size={30} color={colors.mutedText} />} title="Booking not found" actionLabel="Back to Bookings" onAction={() => router.replace(adsRoutes.myBookings)} />
        </AdsCard>
      ) : (
        <>
          <AdsHeading title="Payment" subtitle="Review your booking total" />
          <AdsCard title="Booking Summary">
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{offer.title}</Text>
              <Text style={{ fontSize: 13, color: colors.secondaryText }}>{offer.description}</Text>
            </View>
            <AdsInfoRow label="Start Date" value={AdsMarketplaceService.formatDate(booking.startDate)} />
            <AdsInfoRow label="End Date" value={AdsMarketplaceService.formatDate(booking.endDate)} />
            <AdsInfoRow label="Duration" value={AdsMarketplaceService.countLabel(booking.duration, 'day')} />
            <AdsInfoRow label="Status" value={AdsMarketplaceService.statusLabel(booking.status)} />
          </AdsCard>
          <AdsCard title="Payment Method">
            <AdsNotice
              tone="warning"
              title="Online payment isn't available yet"
              message="Wallet, card and bank transfer payments for ad bookings are not connected to a payment processor yet. You have not been charged, and this booking stays unpaid until payments open."
            />
          </AdsCard>
          <AdsCard title="Payment Summary">
            <AdsInfoRow label="Subtotal" value={AdsMarketplaceService.formatPrice(booking.agreedPrice, booking.currency)} />
            <AdsInfoRow label={`Ourlime Commission (${commission}%)`} value={AdsMarketplaceService.formatPrice(commissionAmount, booking.currency)} valueStyle="muted" />
            <AdsInfoRow label="Host Payout" value={AdsMarketplaceService.formatPrice(hostPayout, booking.currency)} valueStyle="muted" />
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '900', color: colors.text }}>Total</Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>{AdsMarketplaceService.formatPrice(booking.agreedPrice, booking.currency)}</Text>
            </View>
            <AdsButton label="Payments coming soon" disabled icon={<CircleCheck size={18} color={colors.disabledText} />} onPress={() => undefined} />
          </AdsCard>
        </>
      )}
    </AdsScreen>
  );
}
