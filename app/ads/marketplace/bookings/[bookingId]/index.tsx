import { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CircleCheck, CircleX, Clock, SearchX, Star, Upload } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { bookingStatusTone, displayTypeTone } from '@/components/ads/adsLabels';
import { AdsFileLinks, AdsImageGrid, openAdsFile } from '@/components/ads/AdsMediaGrid';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { AdsDetailSkeleton } from '@/components/ads/AdsSkeletons';
import { ADS_GREEN, AdsButton, AdsCard, AdsChip, AdsEmptyState, AdsErrorState, AdsHeading, AdsInfoRow, AdsScreen, AdsSectionLabel } from '@/components/ads/AdsUi';
import { AdsMarketplaceService, adsMarketplaceService } from '@/lib/services/AdsMarketplaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { AdBooking, AdOffer, Host } from '@/lib/types/adsMarketplace';

/** Booking detail (website /ads/marketplace/bookings/[bookingId]) for the booking's client or its host. */
export default function BookingDetailRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<AdBooking | null>(null);
  const [offer, setOffer] = useState<AdOffer | null>(null);
  const [host, setHost] = useState<Host | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = adsMarketplaceService.currentUserId();

  const fetchBooking = useCallback(async () => {
    if (!bookingId) return;
    if (!adsMarketplaceService.currentUserId()) {
      toast.error('Please log in');
      router.replace(adsRoutes.login);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const bookingData = await adsMarketplaceService.getBooking(bookingId);
      setBooking(bookingData);
      if (!bookingData) return;
      const [hostData, offerData] = await Promise.all([
        adsMarketplaceService.getHost(bookingData.hostId).catch(() => null),
        adsMarketplaceService.getOffer(bookingData.offerId).catch(() => null),
      ]);
      setHost(hostData);
      setOffer(offerData);
    } catch (fetchError: unknown) {
      setError(AdsMarketplaceService.errorMessage(fetchError, 'Failed to load booking.'));
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    void fetchBooking();
  }, [fetchBooking]);

  const isClient = Boolean(booking && userId && booking.userId === userId);
  const isHost = Boolean(host && userId && host.userId === userId);
  const backTarget = isClient ? adsRoutes.myBookings : adsRoutes.hostDashboard;
  const proof = booking?.proofOfDelivery;
  const statusIcon = (status: string) => {
    if (status === 'completed') return <CircleCheck size={14} color={colors.successText} />;
    if (status === 'cancelled') return <CircleX size={14} color={colors.destructiveText} />;
    return <Clock size={14} color={colors.mutedText} />;
  };

  return (
    <AdsScreen title="Booking Details" loading={isLoading} skeleton={<AdsDetailSkeleton />} onBackPress={() => (router.canGoBack() ? router.back() : router.replace(backTarget))}>
      {error ? <AdsErrorState message={error} onRetry={() => void fetchBooking()} /> : !booking || !offer ? (
        <AdsCard>
          <AdsEmptyState icon={<SearchX size={30} color={colors.mutedText} />} title="Booking not found" actionLabel="Back to Bookings" onAction={() => router.replace(adsRoutes.myBookings)} />
        </AdsCard>
      ) : (
        <>
          <AdsHeading title="Booking Details" subtitle={`Booking ID: ${booking.bookingId}`} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <AdsChip label={AdsMarketplaceService.statusLabel(booking.status)} tone={bookingStatusTone(booking.status)} icon={statusIcon(booking.status)} />
            <AdsChip label={booking.paymentStatus} tone={booking.paymentStatus === 'paid' ? 'success' : 'warning'} />
          </View>

          {isClient && booking.paymentStatus === 'pending' && booking.status === 'pending_payment' ? (
            <AdsCard accent="#f59e0b">
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Payment Required</Text>
              <Text style={{ fontSize: 14, color: colors.mutedText }}>Complete payment to activate your booking</Text>
              <AdsButton label="Pay Now" onPress={() => router.push(adsRoutes.bookingPayment(booking.bookingId))} />
            </AdsCard>
          ) : null}

          <AdsCard title="Offer Information">
            <TouchableOpacity accessibilityRole="link" onPress={() => router.push(adsRoutes.offer(offer.offerId))}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{offer.title}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 14, color: colors.secondaryText, lineHeight: 20 }}>{offer.description}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <AdsChip label={offer.displayType} tone={displayTypeTone(offer.displayType)} />
              {offer.category ? <AdsChip label={offer.category} raw /> : null}
            </View>
            {host ? (
              <View style={{ gap: 2 }}>
                <Text style={{ fontSize: 13, color: colors.mutedText }}>Host</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{AdsMarketplaceService.hostName(host)}</Text>
              </View>
            ) : null}
          </AdsCard>

          <AdsCard title="Schedule">
            <AdsInfoRow label="Start Date" value={AdsMarketplaceService.formatDate(booking.startDate, true)} />
            <AdsInfoRow label="End Date" value={AdsMarketplaceService.formatDate(booking.endDate, true)} />
            <AdsInfoRow label="Duration" value={AdsMarketplaceService.countLabel(booking.duration, 'day')} />
            <AdsInfoRow label="Created" value={AdsMarketplaceService.formatDate(booking.createdAt, true)} />
          </AdsCard>

          <AdsCard title="Ad Materials">
            {booking.adMaterials.images && booking.adMaterials.images.length > 0 ? (
              <View style={{ gap: 8 }}>
                <AdsSectionLabel title="Images" />
                <AdsImageGrid urls={booking.adMaterials.images} labelPrefix="Ad image" />
              </View>
            ) : null}
            {booking.adMaterials.videos && booking.adMaterials.videos.length > 0 ? (
              <View style={{ gap: 8 }}>
                <AdsSectionLabel title="Videos" />
                <AdsFileLinks urls={booking.adMaterials.videos} label="Video" />
              </View>
            ) : null}
            {booking.adMaterials.copy ? (
              <View style={{ gap: 4 }}>
                <AdsSectionLabel title="Ad Copy" />
                <Text style={{ fontSize: 14, color: colors.secondaryText, lineHeight: 20 }}>{booking.adMaterials.copy}</Text>
              </View>
            ) : null}
            {booking.adMaterials.ctaUrl ? (
              <View style={{ gap: 4 }}>
                <AdsSectionLabel title="Call-to-Action URL" />
                <TouchableOpacity accessibilityRole="link" onPress={() => openAdsFile(booking.adMaterials.ctaUrl ?? '')}>
                  <Text style={{ fontSize: 14, color: '#2563eb' }}>{booking.adMaterials.ctaUrl}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </AdsCard>

          {isHost && booking.status === 'active' ? (
            <AdsCard title="Proof of Delivery">
              {proof?.submitted ? (
                <>
                  <StatusLine done text="Proof submitted" />
                  {proof.verified ? <StatusLine done text="Verified" /> : null}
                  {proof.proofFiles && proof.proofFiles.length > 0 ? (
                    <View style={{ gap: 8 }}>
                      <AdsSectionLabel title="Proof Files" />
                      <AdsImageGrid urls={proof.proofFiles} labelPrefix="Proof" />
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 14, color: colors.mutedText }}>Submit proof of delivery once the ad has been displayed</Text>
                  <AdsButton label="Submit Proof" variant="secondary" icon={<Upload size={16} color={colors.text} />} onPress={() => router.push(adsRoutes.bookingProof(booking.bookingId))} />
                </>
              )}
            </AdsCard>
          ) : null}

          {isClient && proof?.submitted ? (
            <AdsCard title="Proof of Delivery">
              {proof.verified ? <StatusLine done text="Verified" /> : <StatusLine done={false} text="Pending Verification" />}
              {proof.proofFiles && proof.proofFiles.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <AdsSectionLabel title="Proof Files" />
                  <AdsImageGrid urls={proof.proofFiles} labelPrefix="Proof" />
                </View>
              ) : null}
            </AdsCard>
          ) : null}

          {isClient && booking.status === 'completed' ? (
            <AdsCard title="Review">
              <Text style={{ fontSize: 14, color: colors.mutedText }}>Share your experience with this host.</Text>
              <AdsButton label="Write a Review" variant="secondary" icon={<Star size={16} color={colors.text} />} onPress={() => router.push(adsRoutes.bookingReview(booking.bookingId))} />
            </AdsCard>
          ) : null}

          <AdsCard title="Payment Details">
            <AdsInfoRow label="Total Price" value={AdsMarketplaceService.formatPrice(booking.agreedPrice, booking.currency)} valueStyle="strong" />
            <AdsInfoRow label="Payment Status" value={<AdsChip label={booking.paymentStatus} tone={booking.paymentStatus === 'paid' ? 'success' : 'warning'} />} />
            {booking.paidAt ? <AdsInfoRow label="Paid At" value={AdsMarketplaceService.formatDate(booking.paidAt, true)} /> : null}
            {isClient && booking.paymentStatus === 'pending' ? <AdsButton label="Complete Payment" onPress={() => router.push(adsRoutes.bookingPayment(booking.bookingId))} /> : null}
          </AdsCard>
        </>
      )}
    </AdsScreen>
  );
}

function StatusLine({ done, text }: { done: boolean; text: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {done ? <CircleCheck size={20} color={ADS_GREEN} /> : <Clock size={20} color="#ca8a04" />}
      <Text style={{ fontSize: 15, fontWeight: '700', color: done ? colors.text : '#ca8a04' }}>{text}</Text>
    </View>
  );
}
