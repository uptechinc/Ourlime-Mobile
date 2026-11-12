import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { AdsFormSkeleton } from '@/components/ads/AdsSkeletons';
import { AdsButton, AdsCard, AdsEmptyState, AdsErrorState, AdsField, AdsHeading, AdsScreen, AdsSectionLabel, AdsStarRating } from '@/components/ads/AdsUi';
import { AdsMarketplaceService, adsMarketplaceService } from '@/lib/services/AdsMarketplaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { AdBooking, AdOffer, Client, Host } from '@/lib/types/adsMarketplace';

type BreakdownKey = 'communication' | 'delivery' | 'quality' | 'value';
const BREAKDOWN: { key: BreakdownKey; label: string }[] = [
  { key: 'communication', label: 'Communication' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'quality', label: 'Quality' },
  { key: 'value', label: 'Value' },
];

/** Write a review of a completed booking (website /ads/marketplace/bookings/[bookingId]/review). */
export default function BookingReviewRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<AdBooking | null>(null);
  const [offer, setOffer] = useState<AdOffer | null>(null);
  const [host, setHost] = useState<Host | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [breakdown, setBreakdown] = useState<{ [key in BreakdownKey]: number }>({ communication: 0, delivery: 0, quality: 0, value: 0 });
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
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
      if (!bookingData) {
        toast.error('Booking not found');
        router.replace(adsRoutes.myBookings);
        return;
      }
      if (bookingData.status !== 'completed') {
        toast.error('Can only review completed bookings');
        router.replace(adsRoutes.booking(bookingId));
        return;
      }
      setBooking(bookingData);
      const [hostData, clientData, offerData] = await Promise.all([
        adsMarketplaceService.getHost(bookingData.hostId).catch(() => null),
        adsMarketplaceService.getClient(bookingData.clientId).catch(() => null),
        adsMarketplaceService.getOffer(bookingData.offerId).catch(() => null),
      ]);
      setHost(hostData);
      setClient(clientData);
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

  const handleSubmit = async (): Promise<void> => {
    if (!booking || !host || !client) return;
    if (rating === 0) {
      toast.error('Please provide a rating');
      return;
    }
    if (!comment.trim()) {
      toast.error('Please provide a comment');
      return;
    }
    setIsSubmitting(true);
    try {
      await adsMarketplaceService.createReview({
        bookingId: booking.bookingId,
        hostId: booking.hostId,
        clientId: booking.clientId,
        reviewedUserId: isClient ? host.userId : client.userId,
        rating,
        ratingBreakdown: Object.values(breakdown).some((value) => value > 0) ? breakdown : undefined,
        title: title || undefined,
        comment,
      });
      toast.success('Review submitted successfully!');
      router.replace(adsRoutes.booking(booking.bookingId));
    } catch (submitError: unknown) {
      toast.error(AdsMarketplaceService.errorMessage(submitError, 'Failed to submit review'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const reviewedEntity = host && client ? (isClient ? AdsMarketplaceService.hostName(host) : client.clientName) : '';

  return (
    <AdsScreen
      title="Write a Review"
      loading={isLoading}
      skeleton={<AdsFormSkeleton sections={2} />}
      onBackPress={() => (router.canGoBack() ? router.back() : router.replace(bookingId ? adsRoutes.booking(bookingId) : adsRoutes.myBookings))}
      footer={booking && host && client && offer ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AdsButton label="Cancel" variant="secondary" disabled={isSubmitting} onPress={() => router.replace(adsRoutes.booking(booking.bookingId))} style={{ flex: 1 }} />
          <AdsButton label={isSubmitting ? 'Submitting…' : 'Submit review'} loading={isSubmitting} disabled={rating === 0 || !comment.trim()} onPress={() => void handleSubmit()} style={{ flex: 1 }} />
        </View>
      ) : undefined}
    >
      {error ? <AdsErrorState message={error} onRetry={() => void fetchBooking()} /> : !booking || !host || !client || !offer ? (
        <AdsCard>
          <AdsEmptyState icon={<SearchX size={30} color={colors.mutedText} />} title="Booking not found" actionLabel="Back to Bookings" onAction={() => router.replace(adsRoutes.myBookings)} />
        </AdsCard>
      ) : (
        <>
          <AdsHeading title="Write a Review" subtitle={`Share your experience with ${reviewedEntity}`} />
          <AdsCard title="Overall Rating">
            <AdsSectionLabel title="Overall Rating *" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <AdsStarRating value={rating} onChange={setRating} label="overall" />
              <Text style={{ fontSize: 13, color: colors.mutedText }}>{rating > 0 ? `${rating} out of 5` : 'Select rating'}</Text>
            </View>
            <AdsSectionLabel title="Detailed Ratings (Optional)" />
            {BREAKDOWN.map((item) => (
              <View key={item.key} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 14, color: colors.secondaryText }}>{item.label}</Text>
                  <Text style={{ fontSize: 13, color: colors.mutedText }}>{breakdown[item.key] > 0 ? `${breakdown[item.key]}/5` : 'Not rated'}</Text>
                </View>
                <AdsStarRating value={breakdown[item.key]} size={22} label={item.label.toLowerCase()} onChange={(value) => setBreakdown((previous) => ({ ...previous, [item.key]: value }))} />
              </View>
            ))}
          </AdsCard>
          <AdsCard title="Review Details">
            <AdsField label="Review title (optional)" placeholder="e.g., Great experience!" value={title} onChangeText={setTitle} />
            <AdsField label="Your review" required hint="Tell others about your experience with this booking" placeholder="Share your experience..." multiline value={comment} onChangeText={setComment} />
          </AdsCard>
        </>
      )}
    </AdsScreen>
  );
}
