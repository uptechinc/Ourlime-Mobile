import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Image, ImageSourcePropType, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { pageAccessService } from '@/lib/services/PageAccessService';
import type { PageAccessStatus } from '@/lib/types/pageAccess';

const STICKERS: Record<PageAccessStatus, ImageSourcePropType> = {
  enabled: require('@/assets/images/stickers/greetings/Good Job.png'),
  coming_soon: require('@/assets/images/stickers/thinking/Thinking.png'),
  maintenance: require('@/assets/images/stickers/reactions/Worried.png'),
  beta_only: require('@/assets/images/stickers/emotions/Heart Eyes.png'),
  developer_only: require('@/assets/images/stickers/thinking/Taking Notes.png'),
  admin_only: require('@/assets/images/stickers/thinking/Detective .png'),
  disabled: require('@/assets/images/stickers/reactions/Sleepy.png'),
};

type PageAccessPresentation = { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; color: string; background: string };
type PageAccessPresentationMap = { [status in PageAccessStatus]: PageAccessPresentation };
type PreviousDestination = { route: string; label: string };

const PRESENTATION: PageAccessPresentationMap = {
  enabled: { icon: 'checkmark-circle-outline', title: '', description: '', color: '#10b981', background: '#ecfdf5' },
  coming_soon: { icon: 'time-outline', title: 'Coming Soon', description: 'This feature is not currently available during Phase 2 testing. We are focusing on a smaller set of core Ourlime features before expanding access. Thank you for helping us improve Ourlime.', color: '#10b981', background: '#ecfdf5' },
  maintenance: { icon: 'construct-outline', title: 'Under Maintenance', description: 'This page is temporarily unavailable while we improve it.', color: '#f59e0b', background: '#fffbeb' },
  beta_only: { icon: 'flask-outline', title: 'Beta Access Only', description: 'This experience is currently available to approved beta members.', color: '#8b5cf6', background: '#f5f3ff' },
  developer_only: { icon: 'code-slash-outline', title: 'Developer Access Only', description: 'This experience is currently limited to Ourlime developers.', color: '#2563eb', background: '#eff6ff' },
  admin_only: { icon: 'shield-checkmark-outline', title: 'Administrator Access Required', description: 'Your account does not have permission to open this workspace.', color: '#dc2626', background: '#fef2f2' },
  disabled: { icon: 'close-circle-outline', title: 'Page Unavailable', description: 'This page is not currently available.', color: '#64748b', background: '#f8fafc' },
};

export default function PageAccessOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const { getDecision, loading } = usePageAccess();
  const route = useMemo(() => pageAccessService.normalizeRoute(pathname || '/'), [pathname]);
  const decision = getDecision(route);
  const [previousDestination, setPreviousDestination] = useState<PreviousDestination>({ route: '/(tabs)', label: 'Home' });

  useEffect(() => {
    if (!decision.canAccess || decision.status === 'coming_soon' || pageAccessService.isPublicRoute(route)) return;
    setPreviousDestination({ route, label: decision.setting?.pageName || (route === '/' ? 'Home' : 'Previous Page') });
  }, [decision.canAccess, decision.setting?.pageName, decision.status, loading, route]);

  const shouldBlock = !decision.canAccess;
  if (pageAccessService.isPublicRoute(route) || !shouldBlock) return null;
  const presentation = PRESENTATION[decision.status];
  const stickerSource = STICKERS[decision.status] || STICKERS.coming_soon;
  const title = decision.setting?.overlayTitle || presentation.title;
  const description = decision.setting?.overlayDescription || decision.setting?.description || presentation.description;
  const primaryLabel = `Back to ${previousDestination.label}`;

  const handleReturn = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(previousDestination.route as Href);
  };

  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 9999, backgroundColor: 'rgba(2,6,23,0.78)' }}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 }}>
        <View style={{ width: '100%', maxWidth: 410, alignItems: 'center', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(15,23,42,0.96)', paddingHorizontal: 26, paddingVertical: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 18 }}>
          {/* Playful Sticker Artwork */}
          <Image
            source={stickerSource}
            style={{ width: 110, height: 110, marginBottom: 8 }}
            resizeMode="contain"
            accessibilityLabel="Status Illustration"
          />

          <View style={{ marginTop: 6, borderRadius: 999, borderWidth: 1, borderColor: `${presentation.color}55`, backgroundColor: `${presentation.color}18`, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ color: presentation.color, fontSize: 12, fontWeight: '800' }}>
              {decision.setting?.badgeText || (decision.status === 'coming_soon' ? 'Phase 2 Beta' : presentation.title)}
            </Text>
          </View>
          <Text style={{ marginTop: 14, color: '#ffffff', fontSize: 24, fontWeight: '900', textAlign: 'center' }}>
            {title}
          </Text>
          <Text style={{ marginTop: 8, maxWidth: 340, color: '#cbd5e1', fontSize: 14, lineHeight: 21, textAlign: 'center' }}>
            {description}
          </Text>
          <TouchableOpacity onPress={handleReturn} style={{ marginTop: 22, minWidth: 180, alignItems: 'center', borderRadius: 16, backgroundColor: presentation.color, paddingHorizontal: 22, paddingVertical: 13 }}>
            <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '800' }}>{primaryLabel}</Text>
          </TouchableOpacity>
          {decision.setting?.secondaryButtonLabel && decision.setting.secondaryButtonRoute ? (
            <TouchableOpacity onPress={() => router.push(decision.setting?.secondaryButtonRoute as Href)} style={{ marginTop: 10, padding: 8 }}>
              <Text style={{ color: presentation.color, fontWeight: '700' }}>{decision.setting.secondaryButtonLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}
