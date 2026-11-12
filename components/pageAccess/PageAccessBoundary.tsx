import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { BlogCatalogPageSkeleton } from '@/components/blog/BlogCatalogSkeletons';
import { EHubHomePageSkeleton } from '@/components/ehub/EHubSkeletons';
import { ELearningPageSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { EventsPageSkeleton } from '@/components/events/EventSkeletons';
import { FeedPageSkeleton } from '@/components/home/FeedSkeletons';
import { JobsPageSkeleton } from '@/components/jobs/JobsSkeletons';
import { MarketplacePageSkeleton } from '@/components/market/MarketSkeletons';
import { ProjectsPageSkeleton } from '@/components/projectManagement/ProjectSkeletons';

/** Whole-page skeletons (header, safe area and sections) for each area while page access loads. */
function renderPageSkeleton(pathname: string, signedIn: boolean): ReactNode {
  if (pathname.startsWith('/ehub')) return <EHubHomePageSkeleton />;
  if (pathname.startsWith('/eLearning')) return <ELearningPageSkeleton />;
  if (pathname.startsWith('/projectManagement')) return <ProjectsPageSkeleton />;
  if (pathname.startsWith('/events') || pathname.startsWith('/calendar')) return <EventsPageSkeleton />;
  if (pathname.startsWith('/marketplace') || pathname.startsWith('/market')) return <MarketplacePageSkeleton signedIn={signedIn} />;
  if (pathname.startsWith('/blog') || pathname.startsWith('/blogs')) return <BlogCatalogPageSkeleton />;
  if (pathname.startsWith('/jobs')) return <JobsPageSkeleton />;
  return <FeedPageSkeleton />;
}

type PageAccessBoundaryProps = { children: ReactNode };
export default function PageAccessBoundary({ children }: PageAccessBoundaryProps) {
  const pathname = usePathname();
  const { loading, error, retry, getDecision, exitPreview, profile } = usePageAccess();
  const { colors } = useAppTheme();
  const decision = getDecision(pathname);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        {renderPageSkeleton(pathname, Boolean(profile?.uid))}
      </View>
    );
  }

  if (!decision.canRead) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }}>
        {error ? (
          <Pressable accessibilityRole="button" onPress={retry} style={{ padding: 20 }}>
            <Text style={{ color: colors.text }}>{error} Tap to retry.</Text>
          </Pressable>
        ) : (
          <Text style={{ color: colors.mutedText, padding: 20 }}>This page is currently unavailable.</Text>
        )}
      </View>
    );
  }

  return (
    <View key={profile?.uid ?? 'signed-out'} style={{ flex: 1 }}>
      {decision.isDeveloperPreview ? (
        <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: colors.surface }}>
          <Pressable accessibilityRole="button" onPress={exitPreview} style={{ padding: 12 }}>
            <Text style={{ color: colors.text }}>Staff preview · Read only · Exit preview</Text>
          </Pressable>
        </SafeAreaView>
      ) : null}
      {children}
    </View>
  );
}
