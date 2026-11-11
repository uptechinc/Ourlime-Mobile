import { Stack } from 'expo-router';
import PageAccessBoundary from '@/components/pageAccess/PageAccessBoundary';

export default function MarketplaceLayout() {
  return <PageAccessBoundary><Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', gestureEnabled: true }} /></PageAccessBoundary>;
}
