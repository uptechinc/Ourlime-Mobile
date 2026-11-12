import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Megaphone, Plus, Wallet } from 'lucide-react-native';
import { adsRoutes } from '@/components/ads/adsRoutes';
import { ADS_GREEN, AdsButton, AdsCard, AdsCheckLine, AdsEmptyState, AdsHeading, AdsScreen, AdsTabs } from '@/components/ads/AdsUi';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type AdsTab = 'campaigns' | 'marketplace';

const TABS: { value: AdsTab; label: string }[] = [
  { value: 'campaigns', label: 'Campaigns' },
  { value: 'marketplace', label: 'Marketplace' },
];

/**
 * Ourlime Ads (website /ads): campaigns and the ads marketplace hub. The website's Analytics tab shows mock numbers
 * and its Settings tab is a placeholder, so the app leaves both out.
 */
export default function AdsRoute() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [activeTab, setActiveTab] = useState<AdsTab>('campaigns');

  const handleCreateAd = (): void => router.push(adsRoutes.create);

  return (
    <AdsScreen title="Ourlime Ads" onBackPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ padding: 10, borderRadius: 14, backgroundColor: colors.successSurface }}>
          <Megaphone size={24} color={ADS_GREEN} />
        </View>
        <View style={{ flex: 1 }}>
          <AdsHeading title="Ourlime Ads" subtitle="Reach your audience and grow your presence" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <AdsButton label="Wallet" variant="secondary" icon={<Wallet size={16} color={colors.text} />} onPress={() => router.push(adsRoutes.wallet)} style={{ flex: 1 }} />
        <AdsButton label="Create Ad" icon={<Plus size={16} color="#ffffff" />} onPress={handleCreateAd} style={{ flex: 1 }} />
      </View>
      <AdsTabs tabs={TABS} value={activeTab} onChange={setActiveTab} />

      {activeTab === 'campaigns' ? (
        <>
          <AdsCard title="Quick Actions" subtitle="Get started with your advertising journey">
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <AdsButton label="Manage Ads" variant="secondary" onPress={() => router.push(adsRoutes.manage)} style={{ flex: 1 }} />
              <AdsButton label="Create New Ad" onPress={handleCreateAd} style={{ flex: 1 }} />
            </View>
          </AdsCard>
          <AdsCard title="Your Campaigns">
            <AdsEmptyState
              icon={<Megaphone size={30} color={colors.mutedText} />}
              title="No campaigns yet"
              message="Create your first ad campaign to start reaching your audience"
              actionLabel="Create Your First Ad"
              onAction={handleCreateAd}
            />
          </AdsCard>
        </>
      ) : (
        <>
          <AdsCard title="Ads Marketplace" subtitle="Buy ad space from hosts or offer your own ad space">
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <AdsButton label="Browse Offers" variant="secondary" onPress={() => router.push(adsRoutes.browse)} style={{ flex: 1 }} />
              <AdsButton label="Become a Host" onPress={() => router.push(adsRoutes.becomeHost)} style={{ flex: 1 }} />
            </View>
          </AdsCard>
          <AdsCard title="I want to advertise">
            <Text style={{ fontSize: 14, color: colors.secondaryText, lineHeight: 20 }}>Browse verified hosts offering ad space on websites, social media, or physical locations.</Text>
            <AdsCheckLine text="Browse verified hosts" />
            <AdsCheckLine text="Book ad placements" />
            <AdsCheckLine text="Track delivery & reviews" />
            <AdsButton label="Browse Ad Offers" onPress={() => router.push(adsRoutes.browse)} />
          </AdsCard>
          <AdsCard title="I want to offer ad space">
            <Text style={{ fontSize: 14, color: colors.secondaryText, lineHeight: 20 }}>Monetize your platform by offering ad space to businesses and brands.</Text>
            <AdsCheckLine text="Create ad offers" />
            <AdsCheckLine text="Manage bookings" />
            <AdsCheckLine text="Earn commission" />
            <AdsButton label="Become a Host" onPress={() => router.push(adsRoutes.becomeHost)} />
          </AdsCard>
          <AdsCard title="My Marketplace Activity">
            <AdsCard onPress={() => router.push(adsRoutes.myBookings)} style={{ padding: 14, gap: 4 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>My Bookings</Text>
              <Text style={{ fontSize: 13, color: colors.mutedText }}>View and manage your ad bookings</Text>
            </AdsCard>
            <AdsCard onPress={() => router.push(adsRoutes.myOffers)} style={{ padding: 14, gap: 4 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>My Offers</Text>
              <Text style={{ fontSize: 13, color: colors.mutedText }}>Manage your ad offers as a host</Text>
            </AdsCard>
          </AdsCard>
        </>
      )}
    </AdsScreen>
  );
}
