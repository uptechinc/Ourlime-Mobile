import { Stack } from 'expo-router';
import PageAccessBoundary from '@/components/pageAccess/PageAccessBoundary';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

// A stack, so product, provider, discovery and enquiry screens slide in and back returns to the previous E-Hub screen.
export default function EHubLayout() {
  const { colors } = useAppTheme();
  return <PageAccessBoundary>
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true, gestureDirection: 'horizontal', contentStyle: { backgroundColor: colors.canvas } }} />
  </PageAccessBoundary>;
}
