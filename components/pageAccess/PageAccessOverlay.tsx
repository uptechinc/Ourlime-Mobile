import { useMemo } from 'react';
import { useRouter, useSegments, type Href } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { pageAccessService } from '@/lib/services/PageAccessService';
import type { PageAccessStatus } from '@/lib/types/pageAccess';

const PRESENTATION: Record<PageAccessStatus, { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; color: string; background: string }> = {
  enabled: { icon: 'checkmark-circle-outline', title: '', description: '', color: '#10b981', background: '#ecfdf5' },
  coming_soon: { icon: 'sparkles-outline', title: 'Coming Soon', description: 'We are putting the finishing touches on this part of Ourlime.', color: '#10b981', background: '#ecfdf5' },
  maintenance: { icon: 'construct-outline', title: 'Under Maintenance', description: 'This page is temporarily unavailable while we improve it.', color: '#f59e0b', background: '#fffbeb' },
  beta_only: { icon: 'flask-outline', title: 'Beta Access Only', description: 'This experience is currently available to approved beta members.', color: '#8b5cf6', background: '#f5f3ff' },
  developer_only: { icon: 'code-slash-outline', title: 'Developer Access Only', description: 'This experience is currently limited to Ourlime developers.', color: '#2563eb', background: '#eff6ff' },
  admin_only: { icon: 'shield-checkmark-outline', title: 'Administrator Access Required', description: 'Your account does not have permission to open this workspace.', color: '#dc2626', background: '#fef2f2' },
  disabled: { icon: 'close-circle-outline', title: 'Page Unavailable', description: 'This page is not currently available.', color: '#64748b', background: '#f8fafc' },
};

export default function PageAccessOverlay() {
  const router = useRouter();
  const segments = useSegments();
  const { getDecision, loading } = usePageAccess();
  const route = useMemo(() => pageAccessService.normalizeRoute(segments.join('/') || '/'), [segments]);
  const decision = getDecision(route);

  if (loading || pageAccessService.isPublicRoute(route) || decision.canAccess) return null;
  const presentation = PRESENTATION[decision.status];
  const title = decision.setting?.overlayTitle || presentation.title;
  const description = decision.setting?.overlayDescription || decision.setting?.description || presentation.description;
  const primaryLabel = decision.setting?.primaryButtonLabel || 'Return Home';
  const primaryRoute = decision.setting?.primaryButtonRoute || '/(tabs)';

  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 9999, backgroundColor: 'rgba(255,255,255,0.97)' }}>
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, backgroundColor: presentation.background }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 }}>
          <Ionicons name={presentation.icon} size={40} color={presentation.color} />
        </View>
        <Text style={{ marginTop: 24, color: '#0f172a', fontSize: 25, fontWeight: '800', textAlign: 'center' }}>{title}</Text>
        <Text style={{ marginTop: 10, maxWidth: 390, color: '#64748b', fontSize: 15, lineHeight: 22, textAlign: 'center' }}>{description}</Text>
        <TouchableOpacity onPress={() => router.replace(primaryRoute as Href)} style={{ marginTop: 26, minWidth: 180, alignItems: 'center', borderRadius: 16, backgroundColor: presentation.color, paddingHorizontal: 22, paddingVertical: 13 }}>
          <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '800' }}>{primaryLabel}</Text>
        </TouchableOpacity>
        {decision.setting?.secondaryButtonLabel && decision.setting.secondaryButtonRoute ? (
          <TouchableOpacity onPress={() => router.push(decision.setting?.secondaryButtonRoute as Href)} style={{ marginTop: 12, padding: 10 }}>
            <Text style={{ color: presentation.color, fontWeight: '700' }}>{decision.setting.secondaryButtonLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
