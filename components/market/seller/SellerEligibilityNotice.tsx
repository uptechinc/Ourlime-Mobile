import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, Clock, ShieldAlert } from 'lucide-react-native';
import SellerApplicationModal from '@/components/market/SellerApplicationModal';
import { SellerButton } from '@/components/ehub/EHubSellerFormParts';
import { useListingStyles } from './ListingFormParts';
import type { SellerEligibility } from '@/lib/types/marketListing';

type SellerEligibilityNoticeProps = { eligibility: SellerEligibility; onApplicationClosed: () => void; compact?: boolean };

/**
 * Shown instead of the listing editor (and above My listings) when the server would refuse a new or republished listing:
 * selling needs an approved seller application (publicStores verificationStatus 'approved') and an active account.
 */
export default function SellerEligibilityNotice({ eligibility, onApplicationClosed, compact }: SellerEligibilityNoticeProps) {
  const { colors, styles } = useListingStyles();
  const router = useRouter();
  const [isApplicationOpen, setIsApplicationOpen] = useState(false);
  if (eligibility.status === 'approved') return null;

  const content = eligibility.status === 'signed_out'
    ? { icon: <ShieldAlert size={compact ? 20 : 34} color={colors.accentText} />, title: 'Sign in to sell', body: 'Sign in to list products on Lime Market.', action: 'Sign in' }
    : eligibility.status === 'suspended'
      ? { icon: <AlertTriangle size={compact ? 20 : 34} color={colors.destructiveText} />, title: 'Seller account suspended', body: 'Your ability to list and edit products has been suspended after an administrative policy review. Contact support from Help to appeal.', action: 'Open Help' }
      : eligibility.status === 'pending'
        ? { icon: <Clock size={compact ? 20 : 34} color={colors.warningText} />, title: 'Seller application under review', body: 'An administrator is reviewing your seller application. You can list products as soon as it is approved.', action: 'View application' }
        : { icon: <ShieldAlert size={compact ? 20 : 34} color={colors.accentText} />, title: eligibility.status === 'rejected' ? 'Seller application not approved' : 'Seller approval required', body: 'Verification is required before selling products. This helps reduce impersonation, fraudulent listings and marketplace abuse. Your documents are never shared with buyers.', action: eligibility.status === 'rejected' ? 'Update application' : 'Apply to sell' };

  const handleAction = () => {
    if (eligibility.status === 'signed_out') { router.push('/(auth)/login'); return; }
    if (eligibility.status === 'suspended') { router.push('/help'); return; }
    setIsApplicationOpen(true);
  };

  return <View style={[styles.section, compact ? null : { alignItems: 'center', paddingVertical: 26 }]}>
    <View style={compact ? { flexDirection: 'row', gap: 10, alignItems: 'flex-start' } : { alignItems: 'center', gap: 10 }}>
      {content.icon}
      <View style={compact ? styles.flex : { alignItems: 'center', gap: 6 }}>
        <Text style={[styles.sectionTitle, compact ? null : { fontSize: 20, textAlign: 'center' }]}>{content.title}</Text>
        <Text style={[styles.hint, compact ? null : { textAlign: 'center', fontSize: 13, lineHeight: 19 }]}>{content.body}</Text>
      </View>
    </View>
    <SellerButton compact={compact} label={content.action} onPress={handleAction} />
    {isApplicationOpen ? <SellerApplicationModal onClose={() => { setIsApplicationOpen(false); onApplicationClosed(); }} /> : null}
  </View>;
}
