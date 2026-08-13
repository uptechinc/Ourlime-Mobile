import '@/lib/shims/codegenNativeComponent';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, LogBox, View } from 'react-native';
import Constants from 'expo-constants';
import { useAuthGuard } from '@/lib/hooks/useAuthGuard';
import './globals.css';
import { NotificationProvider } from '@/lib/contexts/NotificationContext';
import { PageAccessProvider } from '@/lib/contexts/PageAccessContext';
import PageAccessOverlay from '@/components/pageAccess/PageAccessOverlay';
import { pushNotificationService } from '@/lib/services/PushNotificationService';
import { AppDataProvider } from '@/lib/contexts/AppDataContext';
import { AppErrorBoundary } from '@/components/ui/AppErrorBoundary';
import { errorLogService } from '@/lib/services/ErrorLogService';
import { ThemeProvider, useAppTheme } from '@/lib/contexts/ThemeContext';

errorLogService.install();

LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'SafeAreaView has been deprecated and will be removed in a future release',
  '@firebase/firestore',
  'WebChannelConnection',
  "RPC 'Listen' stream",
  'transport errored',
  'Cannot connect to Expo CLI',
  'expo-notifications: Android Push notifications',
  'Overwriting backgroundColor style attribute preprocessor',
  'Overwriting color style attribute preprocessor',
  'Overwriting borderColor style attribute preprocessor',
  'Overwriting borderTopColor style attribute preprocessor',
  'Overwriting borderRightColor style attribute preprocessor',
  'Overwriting borderBottomColor style attribute preprocessor',
  'Overwriting borderLeftColor style attribute preprocessor',
]);

function AppRouteTree() {
  const { isInitializing } = useAuthGuard();
  const { isDark, colors } = useAppTheme();

  if (isInitializing) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <AppDataProvider>
      <PageAccessProvider>
        <NotificationProvider>
          <Stack
            key={isDark ? 'dark-navigation' : 'light-navigation'}
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              gestureEnabled: true,
              gestureDirection: 'horizontal',
              contentStyle: { backgroundColor: colors.canvas },
            }}
          >
            <Stack.Screen name="(auth)/login" options={{ animation: 'none' }} />
            <Stack.Screen name="(auth)/register" options={{ animation: 'slide_from_right' }} />
          </Stack>
          <PageAccessOverlay />
        </NotificationProvider>
      </PageAccessProvider>
    </AppDataProvider>
  );
}

export default function Layout() {
  const router = useRouter();

  useEffect(() => {
    pushNotificationService.configureForegroundPresentation();
    if (Constants.appOwnership === 'expo') return;

    let subscription: { remove: () => void } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require('expo-notifications') as typeof import('expo-notifications');
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        router.push(pushNotificationService.resolveNotificationDestination(response.notification.request.content.data ?? {}));
      });
    } catch {
      // Remote push listeners are unavailable in Expo Go.
    }
    return () => subscription?.remove();
  }, [router]);

  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AppRouteTree />
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
