import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Clock } from 'lucide-react-native';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { AdsButton, AdsCard, AdsScreen } from '@/components/ads/AdsUi';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

/**
 * Proof-of-delivery review (website /ads/marketplace/admin/proof-verification). The website has no pending-proof
 * listing yet and shows this notice, so the app does the same.
 */
export default function ProofVerificationRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  return (
    <AdsScreen title="Proof Review">
      <AdsCard>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 16 }}>
          <Clock size={48} color={colors.mutedText} />
          <Text style={{ fontSize: 21, fontWeight: '900', color: colors.text, textAlign: 'center' }}>{"Proof review isn't available yet"}</Text>
          <Text style={{ fontSize: 14, color: colors.mutedText, textAlign: 'center', lineHeight: 20 }}>
            Reviewing proof-of-delivery submissions for ad bookings will open here once the ads marketplace launches.
          </Text>
          <AdsButton label="Back to Ads" variant="ghost" onPress={() => router.replace(adsRoutes.home)} />
        </View>
      </AdsCard>
    </AdsScreen>
  );
}
