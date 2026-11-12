import { useCallback } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, BookOpen, ChevronRight, Compass, Home, LifeBuoy, Users, type LucideIcon } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const WORRIED_STICKER = require('@/assets/images/stickers/reactions/Worried.png');

type QuickLink = { title: string; description: string; route: Href; icon: LucideIcon; accent: string; badge?: string };

/** The website's 404 quick links (components/common/NotFoundView), pointing at the matching app screens. */
const QUICK_LINKS: readonly QuickLink[] = [
  { title: 'Home Feed', description: 'Explore recent posts, updates, and news.', route: '/(tabs)', icon: Home, accent: '#10b981', badge: 'Popular' },
  { title: 'Communities', description: 'Discover interest-based clubs and groups.', route: '/communities', icon: Users, accent: '#4f46e5' },
  { title: 'Discover', description: 'Find new content, creators, and topics.', route: '/(tabs)/Discover', icon: Compass, accent: '#db2777' },
  { title: 'Blogs & Articles', description: 'Read insightful posts, guides, and stories.', route: '/blogs', icon: BookOpen, accent: '#ea580c' },
  { title: 'Help Center', description: 'Get support, report bugs, or read FAQs.', route: '/help', icon: LifeBuoy, accent: '#0891b2' },
];

export default function NotFoundScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  const handleGoHome = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ title: 'Page Not Found', headerShown: false }} />
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 32 }}>
          <Image source={WORRIED_STICKER} style={{ width: 150, height: 150 }} resizeMode="contain" accessibilityLabel="Worried sticker" />

          <View style={{ marginTop: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(16,185,129,0.35)', backgroundColor: 'rgba(16,185,129,0.12)' }}>
            <Text style={{ color: colors.accentText, fontSize: 12, fontWeight: '800', letterSpacing: 1 }}>ERROR 404</Text>
          </View>
          <Text style={{ marginTop: 12, color: colors.text, fontSize: 28, fontWeight: '900', textAlign: 'center' }}>Page Not Found</Text>
          <Text style={{ marginTop: 8, maxWidth: 420, color: colors.mutedText, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>
            Sorry, the page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
          </Text>

          <View style={{ width: '100%', maxWidth: 420, marginTop: 22, gap: 10 }}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleGoHome}
              activeOpacity={0.85}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, borderRadius: 999, backgroundColor: '#10b981', shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: isDark ? 0.4 : 0.25, shadowRadius: 10, elevation: 6 }}
            >
              <Home size={19} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '800' }}>Return to Home</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleGoBack}
              activeOpacity={0.8}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
            >
              <ArrowLeft size={18} color={colors.secondaryText} />
              <Text style={{ color: colors.secondaryText, fontSize: 15, fontWeight: '800' }}>Go Back</Text>
            </TouchableOpacity>
          </View>

          <View style={{ width: '100%', maxWidth: 420, marginTop: 28 }}>
            <Text style={{ color: colors.mutedText, fontSize: 13, textAlign: 'center', marginBottom: 12 }}>
              Looking for something specific? Try navigating to one of the main sections below.
            </Text>
            <View style={{ gap: 10 }}>
              {QUICK_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <TouchableOpacity
                    key={link.title}
                    accessibilityRole="link"
                    onPress={() => router.replace(link.route)}
                    activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}
                  >
                    <View style={{ width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: link.accent }}>
                      <Icon size={20} color="#ffffff" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>{link.title}</Text>
                        {link.badge ? (
                          <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.successSurface }}>
                            <Text style={{ color: colors.successText, fontSize: 10, fontWeight: '800' }}>{link.badge}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text numberOfLines={2} style={{ marginTop: 2, color: colors.mutedText, fontSize: 12 }}>{link.description}</Text>
                    </View>
                    <ChevronRight size={18} color={colors.icon} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
