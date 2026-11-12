import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChartColumn, FileText, ImageIcon, SearchX, Video, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { pickAdsDocuments, pickAdsMedia } from '@/components/ads/adsPickers';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { AdsFormSkeleton } from '@/components/ads/AdsSkeletons';
import { AdsButton, AdsCard, AdsEmptyState, AdsErrorState, AdsField, AdsHeading, AdsOptionGroup, AdsScreen, AdsSectionLabel, AdsUploadTile } from '@/components/ads/AdsUi';
import { AdsMarketplaceService, adsMarketplaceService } from '@/lib/services/AdsMarketplaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { AdBooking, ProofAnalyticsData, ProofFileType } from '@/lib/types/adsMarketplace';

type ProofFile = { type: ProofFileType; url: string; description: string; uploadedAt: string };
type AnalyticsKey = 'impressions' | 'clicks' | 'reach' | 'engagement' | 'views';

const FILE_TYPE_OPTIONS: { value: ProofFileType; label: string }[] = [
  { value: 'photo', label: 'Photo' },
  { value: 'screenshot', label: 'Screenshot' },
  { value: 'video', label: 'Video' },
  { value: 'analytics_report', label: 'Analytics report' },
];
const ANALYTICS_FIELDS: { key: AnalyticsKey; label: string }[] = [
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'reach', label: 'Reach' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'views', label: 'Views' },
];

/** Submit proof of delivery (website /ads/marketplace/bookings/[bookingId]/proof), for the booking's host. */
export default function SubmitProofRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<AdBooking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingType, setUploadingType] = useState<ProofFileType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proofFiles, setProofFiles] = useState<ProofFile[]>([]);
  const [analytics, setAnalytics] = useState<{ [key in AnalyticsKey]: number }>({ impressions: 0, clicks: 0, reach: 0, engagement: 0, views: 0 });
  const [platform, setPlatform] = useState('');

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
        router.replace(adsRoutes.hostDashboard);
        return;
      }
      const host = await adsMarketplaceService.getHost(bookingData.hostId);
      if (host && host.userId !== userId) {
        toast.error('Only the host can submit proof of delivery');
        router.replace(adsRoutes.booking(bookingId));
        return;
      }
      if (bookingData.proofOfDelivery?.submitted) {
        toast('Proof of delivery has already been submitted');
        router.replace(adsRoutes.booking(bookingId));
        return;
      }
      if (bookingData.status !== 'active' && bookingData.status !== 'paid') {
        toast.error('Can only submit proof for active bookings');
        router.replace(adsRoutes.booking(bookingId));
        return;
      }
      setBooking(bookingData);
    } catch (fetchError: unknown) {
      setError(AdsMarketplaceService.errorMessage(fetchError, 'Failed to load booking.'));
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    void fetchBooking();
  }, [fetchBooking]);

  const handleUpload = async (type: ProofFileType): Promise<void> => {
    if (!bookingId) return;
    const files = type === 'analytics_report'
      ? await pickAdsDocuments(false, true)
      : await pickAdsMedia(type === 'video' ? 'videos' : 'images', true);
    if (files.length === 0) return;
    setUploadingType(type);
    try {
      const uploaded = await Promise.all(files.map(async (file): Promise<ProofFile> => ({
        type,
        url: await adsMarketplaceService.uploadProofFile(bookingId, file),
        description: '',
        uploadedAt: new Date().toISOString(),
      })));
      setProofFiles((previous) => [...previous, ...uploaded]);
      toast.success('Files uploaded successfully');
    } catch (uploadError: unknown) {
      toast.error(AdsMarketplaceService.errorMessage(uploadError, 'Failed to upload files'));
    } finally {
      setUploadingType(null);
    }
  };

  const updateFile = (index: number, update: Partial<ProofFile>): void => {
    setProofFiles((previous) => previous.map((file, fileIndex) => (fileIndex === index ? { ...file, ...update } : file)));
  };

  const handleSubmit = async (): Promise<void> => {
    if (!bookingId) return;
    if (proofFiles.length === 0) {
      toast.error('Please upload at least one proof file');
      return;
    }
    const hasAnalytics = Object.values(analytics).some((value) => value > 0) || Boolean(platform);
    const analyticsData: ProofAnalyticsData | undefined = hasAnalytics ? { ...analytics, platform } : undefined;
    setIsSubmitting(true);
    try {
      await adsMarketplaceService.submitProof(bookingId, proofFiles, analyticsData);
      toast.success('Proof of delivery submitted successfully!');
      router.replace(adsRoutes.booking(bookingId));
    } catch (submitError: unknown) {
      toast.error(AdsMarketplaceService.errorMessage(submitError, 'Failed to submit proof of delivery'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const tiles: { type: ProofFileType; label: string; helper: string; icon: ReactNode; uploading: string }[] = [
    { type: 'photo', label: 'Upload photos', helper: 'JPG, PNG or WebP', icon: <ImageIcon size={24} color={colors.mutedText} />, uploading: 'Uploading photos…' },
    { type: 'screenshot', label: 'Upload screenshots', helper: 'JPG, PNG or WebP', icon: <FileText size={24} color={colors.mutedText} />, uploading: 'Uploading screenshots…' },
    { type: 'video', label: 'Upload videos', helper: 'MP4, MOV or WebM', icon: <Video size={24} color={colors.mutedText} />, uploading: 'Uploading videos…' },
    { type: 'analytics_report', label: 'Upload analytics reports', helper: 'PDF or Word document', icon: <ChartColumn size={24} color={colors.mutedText} />, uploading: 'Uploading analytics…' },
  ];
  const fileIcon = (type: ProofFileType) => (type === 'video' ? <Video size={20} color={colors.mutedText} /> : <ChartColumn size={20} color={colors.mutedText} />);

  return (
    <AdsScreen
      title="Submit Proof"
      loading={isLoading}
      skeleton={<AdsFormSkeleton sections={2} />}
      onBackPress={() => (router.canGoBack() ? router.back() : router.replace(bookingId ? adsRoutes.booking(bookingId) : adsRoutes.hostDashboard))}
      footer={booking ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AdsButton label="Cancel" variant="secondary" disabled={isSubmitting} onPress={() => router.replace(adsRoutes.booking(booking.bookingId))} style={{ flex: 1 }} />
          <AdsButton label={isSubmitting ? 'Submitting…' : 'Submit proof'} loading={isSubmitting} disabled={proofFiles.length === 0 || uploadingType !== null} onPress={() => void handleSubmit()} style={{ flex: 1 }} />
        </View>
      ) : undefined}
    >
      {error ? <AdsErrorState message={error} onRetry={() => void fetchBooking()} /> : !booking ? (
        <AdsCard>
          <AdsEmptyState icon={<SearchX size={30} color={colors.mutedText} />} title="Booking not found" actionLabel="Back to Dashboard" onAction={() => router.replace(adsRoutes.hostDashboard)} />
        </AdsCard>
      ) : (
        <>
          <AdsHeading title="Submit proof of delivery" subtitle="Upload evidence that the ad has been displayed as agreed" />
          <AdsCard>
            <AdsSectionLabel title="Proof files" description="Add at least one file. You can choose several at once." />
            {tiles.map((tile) => (
              <AdsUploadTile key={tile.type} label={uploadingType === tile.type ? tile.uploading : tile.label} helper={tile.helper} icon={tile.icon} disabled={uploadingType !== null} onPress={() => void handleUpload(tile.type)} />
            ))}
            {proofFiles.length > 0 ? (
              <View style={{ gap: 10 }}>
                <AdsSectionLabel title="Uploaded files" />
                {proofFiles.map((file, index) => (
                  <View key={`${file.url}-${index}`} style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                      {file.type === 'photo' || file.type === 'screenshot' ? (
                        <Image source={{ uri: file.url }} accessibilityLabel={`Proof ${index + 1}`} contentFit="cover" style={{ width: 72, height: 72, borderRadius: 10 }} />
                      ) : (
                        <View style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center' }}>{fileIcon(file.type)}</View>
                      )}
                      <View style={{ flex: 1 }}>
                        <AdsOptionGroup value={file.type} options={FILE_TYPE_OPTIONS} onChange={(type) => updateFile(index, { type })} />
                      </View>
                      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Remove file" hitSlop={8} onPress={() => setProofFiles((previous) => previous.filter((_, fileIndex) => fileIndex !== index))}>
                        <X size={18} color={colors.mutedText} />
                      </TouchableOpacity>
                    </View>
                    <AdsField label="File description" placeholder="Add a description for this file..." multiline value={file.description} onChangeText={(description) => updateFile(index, { description })} style={{ minHeight: 64 }} />
                  </View>
                ))}
              </View>
            ) : null}
          </AdsCard>
          <AdsCard>
            <AdsSectionLabel title="Analytics data" description="Optional. Share the numbers your platform reported." />
            {ANALYTICS_FIELDS.map((field) => (
              <AdsField
                key={field.key}
                label={field.label}
                keyboardType="number-pad"
                value={analytics[field.key].toString()}
                onChangeText={(text) => setAnalytics((previous) => ({ ...previous, [field.key]: parseInt(text, 10) || 0 }))}
              />
            ))}
            <AdsField label="Platform" placeholder="e.g., Instagram, Facebook" value={platform} onChangeText={setPlatform} />
          </AdsCard>
        </>
      )}
    </AdsScreen>
  );
}
