import '@/lib/shims/codegenNativeComponent';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
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
import AppPreloadCoordinator from '@/components/providers/AppPreloadCoordinator';
import { AppDrawerProvider } from '@/lib/contexts/AppDrawerContext';
import { CallProvider } from '@/lib/contexts/CallContext';
import GlobalCallOverlay from '@/components/calls/GlobalCallOverlay';

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
]);

function AppRouteTree() {
  const { isInitializing } = useAuthGuard();
  const { colors } = useAppTheme();

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
        <AppPreloadCoordinator />
        <CallProvider>
        <AppDrawerProvider>
        <NotificationProvider>
          <Stack
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
          <GlobalCallOverlay />
        </NotificationProvider>
        </AppDrawerProvider>
        </CallProvider>
      </PageAccessProvider>
    </AppDataProvider>
  );
}

export default function Layout() {
  const router = useRouter();
  const handledResponseIds = useRef(new Set<string>());

  useEffect(() => {
    pushNotificationService.configureForegroundPresentation();
    if (Constants.appOwnership === 'expo') return;

    let subscription: { remove: () => void } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require('expo-notifications') as typeof import('expo-notifications');
      const handleResponse = (response: import('expo-notifications').NotificationResponse) => {
        const responseId = response.notification.request.identifier;
        if (handledResponseIds.current.has(responseId)) return;
        handledResponseIds.current.add(responseId);
        router.push(pushNotificationService.resolveNotificationDestination(response.notification.request.content.data));
      };
      subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) handleResponse(response);
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
