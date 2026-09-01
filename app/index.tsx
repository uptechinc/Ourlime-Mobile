import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
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

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.canvas,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onLayout={() => {
        if (!isInitializing && hasNavigated) {
          void SplashScreen.hideAsync().catch(() => undefined);
        }
      }}
    >
      <ActivityIndicator size="large" color="#10b981" />
    </View>
  );
}
