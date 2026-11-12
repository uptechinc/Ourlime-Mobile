import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Building2, CircleCheck, Users } from 'lucide-react-native';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { AdsChoiceSkeleton } from '@/components/ads/AdsSkeletons';
import { ADS_GREEN, AdsCard, AdsCheckLine, AdsErrorState, AdsHeading, AdsScreen } from '@/components/ads/AdsUi';
import { useAdsHostRegistrationGate } from '@/lib/hooks/useAdsHostRegistrationGate';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

/** Become a Host (website /ads/marketplace/become-host): choose business or influencer registration. */
export default function BecomeHostRoute() {
  const router = useRouter();
  const { isChecking, error, retry } = useAdsHostRegistrationGate(adsRoutes.login, adsRoutes.hostDashboard);

  return (
    <AdsScreen title="Become a Host" loading={isChecking} skeleton={<AdsChoiceSkeleton />}>
      <AdsHeading title="Become a Host" subtitle="Choose your host type to get started" />
      {error ? <AdsErrorState message={error} onRetry={retry} /> : (
        <>
          <HostTypeCard
            icon={<Building2 size={24} color={ADS_GREEN} />}
            title="Business Host"
            description="Offer ad space on your website, app, digital screens, or physical locations."
            points={['Business verification required', 'Multiple display types', 'Set your own pricing']}
            onPress={() => router.push(adsRoutes.becomeBusinessHost)}
          />
          <HostTypeCard
            icon={<Users size={24} color={ADS_GREEN} />}
            title="Influencer Host"
            description="Monetize your social media presence with sponsored posts and promotions."
            points={['ID verification required', 'Tier-based recognition', 'Engagement-based pricing']}
            onPress={() => router.push(adsRoutes.becomeInfluencerHost)}
          />
        </>
      )}
    </AdsScreen>
  );
}

function HostTypeCard({ icon, title, description, points, onPress }: { icon: ReactNode; title: string; description: string; points: string[]; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <AdsCard onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ padding: 12, borderRadius: 14, backgroundColor: colors.successSurface }}>{icon}</View>
        <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text }}>{title}</Text>
      </View>
      <Text style={{ fontSize: 14, color: colors.secondaryText, lineHeight: 20 }}>{description}</Text>
      {points.map((point) => <AdsCheckLine key={point} text={point} icon={<CircleCheck size={16} color={ADS_GREEN} />} />)}
    </AdsCard>
  );
}
