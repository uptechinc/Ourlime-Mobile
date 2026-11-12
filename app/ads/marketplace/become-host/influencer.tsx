import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Users, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import AdsDocumentField from '@/components/ads/AdsDocumentField';
import { pickAdsDocuments } from '@/components/ads/adsPickers';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { AdsFormSkeleton } from '@/components/ads/AdsSkeletons';
import { AdsButton, AdsCard, AdsErrorState, AdsField, AdsHeading, AdsOptionGroup, AdsScreen, AdsSectionLabel } from '@/components/ads/AdsUi';
import { useAdsHostRegistrationGate } from '@/lib/hooks/useAdsHostRegistrationGate';
import { AdsMarketplaceService, adsMarketplaceService } from '@/lib/services/AdsMarketplaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { LinkedSocialAccount, SocialPlatform } from '@/lib/types/adsMarketplace';

const PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'x', label: 'X' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
];

/** Register as an influencer host (website /ads/marketplace/become-host/influencer). */
export default function InfluencerHostRegistrationRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { isChecking, error, retry } = useAdsHostRegistrationGate(adsRoutes.login, adsRoutes.hostDashboard);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [followerBase, setFollowerBase] = useState('');
  const [averageEngagement, setAverageEngagement] = useState('');
  const [accounts, setAccounts] = useState<LinkedSocialAccount[]>([]);
  const [governmentId, setGovernmentId] = useState<{ name: string; url: string } | null>(null);

  const updateAccount = (index: number, update: Partial<LinkedSocialAccount>): void => {
    setAccounts((previous) => previous.map((account, accountIndex) => (accountIndex === index ? { ...account, ...update } : account)));
  };

  const handlePickDocument = async (): Promise<void> => {
    const [file] = await pickAdsDocuments(true, false);
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await adsMarketplaceService.uploadVerificationDocument(file, 'governmentId');
      setGovernmentId({ name: file.name, url });
      toast.success('Document uploaded successfully');
    } catch (uploadError: unknown) {
      toast.error(AdsMarketplaceService.errorMessage(uploadError, 'Failed to upload document'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    const followers = parseInt(followerBase, 10);
    const engagement = parseInt(averageEngagement, 10);
    if (!followers || !engagement) {
      toast.error('Follower base and average engagement are required');
      return;
    }
    if (!governmentId) {
      toast.error('Government ID document is required');
      return;
    }
    setIsSubmitting(true);
    try {
      await adsMarketplaceService.registerInfluencerHost({
        followerBase: followers,
        averageEngagement: engagement,
        linkedSocialAccounts: accounts,
        governmentIdDocument: governmentId.url,
      });
      toast.success('Host registration submitted! Your documents will be reviewed by an admin.');
      router.replace(adsRoutes.hostDashboard);
    } catch (submitError: unknown) {
      toast.error(AdsMarketplaceService.errorMessage(submitError, 'Failed to register as host'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = Boolean(followerBase && averageEngagement && governmentId) && !isUploading;

  return (
    <AdsScreen
      title="Influencer Host"
      loading={isChecking}
      skeleton={<AdsFormSkeleton sections={3} />}
      footer={!error ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <AdsButton label="Cancel" variant="secondary" disabled={isSubmitting} onPress={() => router.replace(adsRoutes.becomeHost)} style={{ flex: 1 }} />
          <AdsButton label={isSubmitting ? 'Submitting…' : 'Submit registration'} loading={isSubmitting} disabled={!canSubmit} onPress={() => void handleSubmit()} style={{ flex: 1 }} />
        </View>
      ) : undefined}
    >
      <AdsHeading title="Register as an influencer host" subtitle="Complete the form below and upload required documents. Your account will be verified by an admin before you can create offers." />
      {error ? <AdsErrorState message={error} onRetry={retry} /> : (
        <>
          <AdsCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Users size={16} color={colors.mutedText} />
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>Influencer information</Text>
            </View>
            <AdsField label="Follower base" required hint="Total number of followers across all platforms" placeholder="10000" keyboardType="number-pad" value={followerBase} onChangeText={setFollowerBase} />
            <AdsField label="Average engagement" required hint="Average likes, comments, shares per post" placeholder="500" keyboardType="number-pad" value={averageEngagement} onChangeText={setAverageEngagement} />
          </AdsCard>
          <AdsCard>
            <AdsSectionLabel title="Social media accounts" description="Link your verified social media accounts to increase credibility (optional)." />
            {accounts.map((account, index) => (
              <View key={index} style={{ gap: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12 }}>
                <AdsOptionGroup label="Platform" value={account.platform} options={PLATFORMS} onChange={(platform) => updateAccount(index, { platform })} />
                <AdsField label="Username" placeholder="@username" autoCapitalize="none" value={account.username} onChangeText={(username) => updateAccount(index, { username })} />
                <AdsButton label="Remove" variant="ghost" compact icon={<X size={16} color={colors.destructive} />} onPress={() => setAccounts((previous) => previous.filter((_, accountIndex) => accountIndex !== index))} />
              </View>
            ))}
            <AdsButton label="Add social account" variant="secondary" icon={<Plus size={16} color={colors.text} />} onPress={() => setAccounts((previous) => [...previous, { platform: 'instagram', username: '', verified: false }])} />
          </AdsCard>
          <AdsCard>
            <AdsSectionLabel title="Required documents" description="Upload proof documents for admin review. Your registration will be pending until approved." />
            <AdsDocumentField
              label="Government ID document"
              required
              description="A valid government-issued ID (Driver's License, Passport, National ID)."
              uploadLabel="Upload government ID"
              fileName={governmentId?.name ?? null}
              isUploaded={Boolean(governmentId)}
              isUploading={isUploading}
              onPick={() => void handlePickDocument()}
              onRemove={() => setGovernmentId(null)}
            />
          </AdsCard>
        </>
      )}
    </AdsScreen>
  );
}
