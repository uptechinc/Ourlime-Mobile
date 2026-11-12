import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { HomeStartupSkeleton } from '@/components/home/FeedSkeletons';
import { auth } from '@/lib/firebaseConfig';
import { useAuthGuard } from '@/lib/hooks/useAuthGuard';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { deepLinkService } from '@/lib/services/DeepLinkService';
import { notificationNavigationService } from '@/lib/services/NotificationNavigationService';

export default function IndexScreen() {
  const { user, isInitializing } = useAuthGuard();
  const { colors } = useAppTheme();
  const router = useRouter();
  const [hasNavigated, setHasNavigated] = useState(false);
  const isResolvingRef = useRef(false);

  useEffect(() => {
    if (isInitializing || hasNavigated || isResolvingRef.current) return;
    isResolvingRef.current = true;

    const resolveDestination = async () => {
      if (!user) {
        setHasNavigated(true);
        router.replace('/(auth)/login' as Href);
        return;
      }

      try {
        const hasPendingNotification = await notificationNavigationService.hasPending();
        if (hasPendingNotification) {
          setHasNavigated(true);
          router.replace('/(tabs)' as Href);
          return;
        }

        const pendingDestination = await deepLinkService.consumePendingDestination();
        if (pendingDestination?.route) {
          setHasNavigated(true);
          router.replace(pendingDestination.route as Href);
          return;
        }
      } catch {
        // Fallback to tabs
      }

      setHasNavigated(true);
      router.replace('/(tabs)' as Href);
    };

    void resolveDestination();
  }, [hasNavigated, isInitializing, router, user]);

  // Display only: the root layout has already resolved auth, so auth.currentUser is set before this
  // screen's own listener reports it. A verified user is headed to the Home tab (the usual case);
  // a signed-out user is replaced to login on the first effect, so they get the plain canvas.
  const isSignedIn = user !== null || (isInitializing && auth.currentUser?.emailVerified === true);

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.canvas }}
      onLayout={() => {
        if (!isInitializing && hasNavigated) {
          void SplashScreen.hideAsync().catch(() => undefined);
        }
      }}
    >
      {isSignedIn ? <HomeStartupSkeleton /> : null}
    </View>
  );
}
