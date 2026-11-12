import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Info, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { displayTypeTone } from '@/components/ads/adsLabels';
import { pickAdsMedia } from '@/components/ads/adsPickers';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { AdsFormSkeleton } from '@/components/ads/AdsSkeletons';
import { AdsButton, AdsCard, AdsChip, AdsErrorState, AdsField, AdsHeading, AdsInfoRow, AdsScreen, AdsSectionLabel, AdsUploadTile } from '@/components/ads/AdsUi';
import DateTimeField from '@/components/ui/DateTimeField';
import { AdsMarketplaceService, adsMarketplaceService, OURLIME_COMMISSION_PERCENT } from '@/lib/services/AdsMarketplaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { AdOffer } from '@/lib/types/adsMarketplace';

/** Book an offer (website /ads/marketplace/offers/[offerId]/book): booking period, ad materials and price summary. */
export default function BookOfferRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { offerId } = useLocalSearchParams<{ offerId: string }>();
  const [offer, setOffer] = useState<AdOffer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState<'images' | 'videos' | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [copy, setCopy] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');

  const fetchOffer = useCallback(async () => {
    if (!offerId) return;
    if (!adsMarketplaceService.currentUserId()) {
      toast.error('Please log in to book an offer');
      router.replace(adsRoutes.login);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const offerData = await adsMarketplaceService.getOffer(offerId);
      if (!offerData) {
        toast.error('Offer not found');
        router.replace(adsRoutes.browse);
        return;
      }
      if (offerData.status !== 'active') {
        toast.error('This offer is not currently active');
        router.replace(adsRoutes.offer(offerId));
        return;
      }
      if (offerData.availableInventory !== undefined && offerData.availableInventory <= 0) {
        toast.error('No available inventory for this offer');
        router.replace(adsRoutes.offer(offerId));
        return;
      }
      setOffer(offerData);
    } catch (fetchError: unknown) {
      setError(AdsMarketplaceService.errorMessage(fetchError, 'Failed to load offer.'));
    } finally {
      setIsLoading(false);
    }
  }, [offerId, router]);

  useEffect(() => {
    void fetchOffer();
  }, [fetchOffer]);

  const duration = startDate && endDate ? AdsMarketplaceService.durationDays(startDate, endDate) : 1;
  const agreedPrice = useMemo(() => (offer ? AdsMarketplaceService.calculatePrice(offer, duration) : 0), [offer, duration]);
  const currency = offer?.pricing.currency ?? 'USD';
  const commissionAmount = (agreedPrice * OURLIME_COMMISSION_PERCENT) / 100;
  const hostPayout = agreedPrice - commissionAmount;

  const handleUpload = async (kind: 'images' | 'videos'): Promise<void> => {
    const files = await pickAdsMedia(kind, true);
    if (files.length === 0) return;
    setUploading(kind);
    try {
      const urls = await Promise.all(files.map((file) => adsMarketplaceService.uploadBookingMaterial(file, kind === 'images' ? 'image' : 'video')));
      if (kind === 'images') setImages((previous) => [...previous, ...urls]);
      else setVideos((previous) => [...previous, ...urls]);
      toast.success(kind === 'images' ? 'Images uploaded successfully' : 'Videos uploaded successfully');
    } catch (uploadError: unknown) {
      toast.error(AdsMarketplaceService.errorMessage(uploadError, kind === 'images' ? 'Failed to upload images' : 'Failed to upload videos'));
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!offer) return;
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates');
      return;
    }
    if (endDate <= startDate) {
      toast.error('End date must be after start date');
      return;
    }
    if (offer.pricing.minimumDuration && duration < offer.pricing.minimumDuration) {
      toast.error(`Minimum duration is ${AdsMarketplaceService.countLabel(offer.pricing.minimumDuration, 'day')}`);
      return;
    }
    if (offer.pricing.maximumDuration && duration > offer.pricing.maximumDuration) {
      toast.error(`Maximum duration is ${AdsMarketplaceService.countLabel(offer.pricing.maximumDuration, 'day')}`);
      return;
    }
    if (!copy.trim() && images.length === 0 && videos.length === 0) {
      toast.error('Please provide ad materials (images, videos, or copy)');
      return;
    }
    setIsSubmitting(true);
    try {
      const clientId = await adsMarketplaceService.ensureMyClientId();
      const bookingId = await adsMarketplaceService.createBooking({
        offerId: offer.offerId,
        hostId: offer.hostId,
        clientId,
        adMaterials: { images, videos, copy, ctaUrl },
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        agreedPrice,
        currency,
      });
      toast.success('Booking created successfully!');
      router.replace(adsRoutes.bookingPayment(bookingId));
    } catch (submitError: unknown) {
      toast.error(AdsMarketplaceService.errorMessage(submitError, 'Failed to create booking'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdsScreen
      title="Book Offer"
      loading={isLoading}
      skeleton={<AdsFormSkeleton sections={3} />}
      footer={offer ? (
        <View style={{ gap: 6 }}>
          <AdsButton label={isSubmitting ? 'Booking…' : 'Proceed to Payment'} loading={isSubmitting} disabled={!startDate || !endDate || uploading !== null} onPress={() => void handleSubmit()} />
          <Text style={{ fontSize: 12, color: colors.mutedText, textAlign: 'center' }}>By proceeding, you agree to our terms and conditions</Text>
        </View>
      ) : undefined}
    >
      {error ? <AdsErrorState message={error} onRetry={() => void fetchOffer()} /> : offer ? (
        <>
          <AdsHeading title="Book This Offer" subtitle="Complete the form below to book this ad space" />
          <AdsCard title="Offer Summary">
            <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{offer.title}</Text>
            <Text style={{ fontSize: 14, color: colors.secondaryText, lineHeight: 20 }}>{offer.description}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <AdsChip label={offer.displayType} tone={displayTypeTone(offer.displayType)} />
              {offer.category ? <AdsChip label={offer.category} raw /> : null}
            </View>
          </AdsCard>

          <AdsCard title="Booking Period">
            <DateTimeField label="Start Date" mode="datetime" placeholder="Choose a start date" value={startDate} onChange={setStartDate} minimumDate={new Date()} required />
            <DateTimeField label="End Date" mode="datetime" placeholder="Choose an end date" value={endDate} onChange={setEndDate} minimumDate={startDate ?? new Date()} required />
            {startDate && endDate ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, padding: 12 }}>
                <Info size={16} color={colors.mutedText} />
                <Text style={{ fontSize: 14, color: colors.secondaryText }}>Duration: {AdsMarketplaceService.countLabel(duration, 'day')}</Text>
              </View>
            ) : null}
            {offer.pricing.minimumDuration ? <Text style={{ fontSize: 12, color: colors.mutedText }}>Minimum duration: {AdsMarketplaceService.countLabel(offer.pricing.minimumDuration, 'day')}</Text> : null}
            {offer.pricing.maximumDuration ? <Text style={{ fontSize: 12, color: colors.mutedText }}>Maximum duration: {AdsMarketplaceService.countLabel(offer.pricing.maximumDuration, 'day')}</Text> : null}
          </AdsCard>

          <AdsCard title="Ad Materials">
            <AdsSectionLabel title="Images" />
            <AdsUploadTile label={uploading === 'images' ? 'Uploading images…' : 'Upload images'} helper="JPG, PNG or WebP. You can choose several at once." disabled={uploading !== null} onPress={() => void handleUpload('images')} />
            {images.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {images.map((url, index) => (
                  <View key={url} style={{ width: '47%', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                    <Image source={{ uri: url }} accessibilityLabel={`Upload ${index + 1}`} contentFit="cover" style={{ width: '100%', height: 110 }} />
                    <RemoveButton label="Remove image" onPress={() => setImages((previous) => previous.filter((_, imageIndex) => imageIndex !== index))} />
                  </View>
                ))}
              </View>
            ) : null}
            <AdsSectionLabel title="Videos (optional)" />
            <AdsUploadTile label={uploading === 'videos' ? 'Uploading videos…' : 'Upload videos'} helper="MP4, MOV or WebM" disabled={uploading !== null} onPress={() => void handleUpload('videos')} />
            {videos.map((url, index) => (
              <View key={url} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ fontSize: 14, color: colors.secondaryText }}>Video {index + 1}</Text>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Remove video" hitSlop={8} onPress={() => setVideos((previous) => previous.filter((_, videoIndex) => videoIndex !== index))}>
                  <X size={18} color={colors.mutedText} />
                </TouchableOpacity>
              </View>
            ))}
            <AdsField label="Ad copy" hint="The text content for your advertisement" placeholder="Enter your ad text/copy here..." multiline value={copy} onChangeText={setCopy} />
            <AdsField label="Call-to-action URL" hint="URL where users will be directed when they click your ad" placeholder="https://example.com" autoCapitalize="none" keyboardType="url" value={ctaUrl} onChangeText={setCtaUrl} />
          </AdsCard>

          <AdsCard title="Price Summary">
            <AdsInfoRow label="Base Price" value={AdsMarketplaceService.formatPrice(offer.pricing.basePrice, offer.pricing.currency)} />
            {offer.pricing.pricingModel !== 'fixed' ? <AdsInfoRow label="Duration" value={AdsMarketplaceService.countLabel(duration, 'day')} /> : null}
            <AdsInfoRow label="Pricing Model" value={AdsMarketplaceService.pricingModelLabel(offer.pricing.pricingModel)} />
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 8 }}>
              <AdsInfoRow label="Subtotal" value={AdsMarketplaceService.formatPrice(agreedPrice, currency)} valueStyle="strong" />
              <AdsInfoRow label={`Ourlime Commission (${OURLIME_COMMISSION_PERCENT}%)`} value={AdsMarketplaceService.formatPrice(commissionAmount, currency)} valueStyle="muted" />
              <AdsInfoRow label="Host Payout" value={AdsMarketplaceService.formatPrice(hostPayout, currency)} valueStyle="muted" />
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '900', color: colors.text }}>Total</Text>
              <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text }}>{AdsMarketplaceService.formatPrice(agreedPrice, currency)}</Text>
            </View>
          </AdsCard>
        </>
      ) : null}
    </AdsScreen>
  );
}

function RemoveButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}
    >
      <X size={16} color={colors.mutedText} />
    </TouchableOpacity>
  );
}
