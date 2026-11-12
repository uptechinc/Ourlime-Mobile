import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CircleCheck, CircleX, Clock, ExternalLink, FileText, Globe, Mail } from 'lucide-react-native';
import { toast } from 'sonner-native';
import { capitalize, verificationTone } from '@/components/ads/adsLabels';
import { openAdsFile } from '@/components/ads/AdsMediaGrid';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { AdsVerificationSkeleton } from '@/components/ads/AdsSkeletons';
import { ADS_GREEN, AdsCard, AdsChip, AdsErrorState, AdsHeading, AdsNotice, AdsScreen } from '@/components/ads/AdsUi';
import { AdsMarketplaceService, adsMarketplaceService } from '@/lib/services/AdsMarketplaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { Host } from '@/lib/types/adsMarketplace';

/**
 * Host verification (website /ads/marketplace/verification): status, progress and each requirement. The website's
 * re-upload control only stores the file without attaching it to the host record, so the app shows the requirement
 * status and links to uploaded documents but no re-upload.
 */
export default function HostVerificationRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [host, setHost] = useState<Host | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHost = useCallback(async () => {
    if (!adsMarketplaceService.currentUserId()) {
      toast.error('Please log in');
      router.replace(adsRoutes.login);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const hostData = await adsMarketplaceService.getMyHost();
      if (!hostData) {
        toast.error('You must be a registered host');
        router.replace(adsRoutes.becomeHost);
        return;
      }
      setHost(hostData);
    } catch (fetchError: unknown) {
      setError(AdsMarketplaceService.errorMessage(fetchError, 'Failed to load host information.'));
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchHost();
  }, [fetchHost]);

  const progress = !host ? 0 : host.hostType === 'business'
    ? ([host.verificationDocuments?.registrationCertificate, host.verificationDocuments?.taxIdDocument].filter(Boolean).length / 2) * 100
    : (host.governmentIdDocument ? 100 : 0);
  const statusIcon = (status: string) => {
    if (status === 'verified') return <CircleCheck size={14} color={colors.successText} />;
    if (status === 'pending') return <Clock size={14} color={colors.warningText} />;
    return <CircleX size={14} color={colors.destructiveText} />;
  };
  const verifiedAt = host?.hostType === 'business' ? AdsMarketplaceService.toDate(host.verifiedAt) : null;

  return (
    <AdsScreen title="Host Verification" loading={isLoading} skeleton={<AdsVerificationSkeleton />} onBackPress={() => (router.canGoBack() ? router.back() : router.replace(adsRoutes.hostDashboard))}>
      {error ? <AdsErrorState message={error} onRetry={() => void fetchHost()} /> : !host ? null : (
        <>
          <AdsHeading title="Host Verification" subtitle="Complete verification to start accepting bookings" />
          <AdsCard>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>Verification Status</Text>
              <AdsChip label={capitalize(host.verificationStatus)} tone={verificationTone(host.verificationStatus)} icon={statusIcon(host.verificationStatus)} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.secondaryText }}>Verification Progress</Text>
              <Text style={{ fontSize: 13, color: colors.mutedText }}>{Math.round(progress)}%</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.control, overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(progress)}%`, height: 8, backgroundColor: ADS_GREEN }} />
            </View>
            {host.verificationStatus === 'pending' ? <AdsNotice tone="warning" message="Your verification request is under review. This usually takes 1-3 business days." /> : null}
            {host.verificationStatus === 'rejected' ? <AdsNotice tone="danger" message="Your verification was rejected. Please review your documents and resubmit." /> : null}
            {host.verificationStatus === 'verified' ? <AdsNotice tone="success" icon={<CircleCheck size={18} color={colors.successText} />} message="Your host account has been verified! You can now create and manage offers." /> : null}
            {verifiedAt ? <Text style={{ fontSize: 12, color: colors.mutedText }}>Verified on: {verifiedAt.toLocaleDateString()}</Text> : null}
          </AdsCard>

          {host.hostType === 'business' ? (
            <AdsCard title="Business Verification Requirements">
              <Requirement icon={<FileText size={20} color={colors.mutedText} />} title="Business Registration Certificate" description="Upload your business registration document" documentUrl={host.verificationDocuments?.registrationCertificate} missingLabel="Required" />
              <Requirement icon={<FileText size={20} color={colors.mutedText} />} title="Tax ID Document (Optional)" description="Upload your tax identification document" documentUrl={host.verificationDocuments?.taxIdDocument} missingLabel="Optional" />
              <Requirement icon={<Mail size={20} color={colors.mutedText} />} title="Business Email Verification" description={host.businessEmail} verified={Boolean(host.verificationDocuments?.businessEmailVerified)} />
              {host.businessWebsite ? (
                <Requirement icon={<Globe size={20} color={colors.mutedText} />} title="Website Verification" description={host.businessWebsite} link={host.businessWebsite} verified={Boolean(host.verificationDocuments?.websiteVerified)} />
              ) : null}
            </AdsCard>
          ) : (
            <AdsCard title="Influencer Verification Requirements">
              <Requirement icon={<FileText size={20} color={colors.mutedText} />} title="Government ID" description="Upload a valid government-issued ID" documentUrl={host.governmentIdDocument} missingLabel="Required" />
              {host.linkedSocialAccounts && host.linkedSocialAccounts.length > 0 ? (
                <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>Linked Social Accounts</Text>
                  {host.linkedSocialAccounts.map((account, index) => (
                    <View key={`${account.platform}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, textTransform: 'capitalize' }}>{account.platform}</Text>
                        <Text style={{ fontSize: 13, color: colors.mutedText }}>@{account.username}</Text>
                      </View>
                      {account.verified ? <AdsChip label="Verified" tone="success" /> : <AdsChip label="Pending" tone="warning" />}
                    </View>
                  ))}
                </View>
              ) : null}
            </AdsCard>
          )}

          {host.verificationStatus !== 'verified' ? (
            <AdsCard title="Next Steps">
              {['Upload all required verification documents', 'Wait for admin review (1-3 business days)', 'Once verified, you can create and publish offers', 'Start accepting bookings and earning revenue'].map((step, index) => (
                <Text key={step} style={{ fontSize: 14, color: colors.secondaryText }}>{index + 1}. {step}</Text>
              ))}
            </AdsCard>
          ) : null}
        </>
      )}
    </AdsScreen>
  );
}

type RequirementProps = {
  icon: ReactNode;
  title: string;
  description: string;
  documentUrl?: string;
  missingLabel?: string;
  verified?: boolean;
  link?: string;
};

function Requirement({ icon, title, description, documentUrl, missingLabel, verified, link }: RequirementProps) {
  const { colors } = useAppTheme();
  const isDocument = missingLabel !== undefined;
  return (
    <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        {icon}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{title}</Text>
          {link ? (
            <TouchableOpacity accessibilityRole="link" onPress={() => openAdsFile(link)}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.accentText }}>{description}</Text>
            </TouchableOpacity>
          ) : <Text style={{ fontSize: 13, color: colors.mutedText }}>{description}</Text>}
        </View>
        {isDocument
          ? (documentUrl ? <AdsChip label="Uploaded" tone="success" /> : <AdsChip label={missingLabel ?? 'Required'} />)
          : (verified ? <AdsChip label="Verified" tone="success" /> : <AdsChip label="Pending" tone="warning" />)}
      </View>
      {isDocument && documentUrl ? (
        <TouchableOpacity accessibilityRole="link" onPress={() => openAdsFile(documentUrl)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.accentText }}>View Document</Text>
          <ExternalLink size={14} color={colors.accentText} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
