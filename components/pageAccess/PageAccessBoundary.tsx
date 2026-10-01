import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import {
  BlogCatalogSkeleton,
  EHubSkeleton,
  ELearningSkeleton,
  EventsSkeleton,
  FeedSkeleton,
  JobManagementSkeleton,
  MarketplaceSkeleton,
  ProjectManagementSkeleton,
} from '@/components/ui/Skeleton';

function renderPageSkeleton(pathname: string): ReactNode {
  if (pathname.startsWith('/ehub')) return <EHubSkeleton />;
  if (pathname.startsWith('/eLearning')) return <ELearningSkeleton />;
  if (pathname.startsWith('/projectManagement')) return <ProjectManagementSkeleton />;
  if (pathname.startsWith('/events')) return <EventsSkeleton />;
  if (pathname.startsWith('/marketplace') || pathname.startsWith('/market')) return <MarketplaceSkeleton />;
  if (pathname.startsWith('/blog') || pathname.startsWith('/blogs')) return <BlogCatalogSkeleton />;
  if (pathname.startsWith('/jobs')) return <JobManagementSkeleton />;
  return <FeedSkeleton />;
}

type PageAccessBoundaryProps = { children: ReactNode };
export default function PageAccessBoundary({ children }: PageAccessBoundaryProps) {
  const pathname = usePathname();
  const { loading, error, retry, getDecision, exitPreview, profile } = usePageAccess();
  const { colors } = useAppTheme();
  const decision = getDecision(pathname);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, paddingHorizontal: 16, paddingTop: 16 }}>
        {renderPageSkeleton(pathname)}
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
