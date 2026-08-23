import '@/lib/shims/codegenNativeComponent';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, LogBox, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthGuard } from '@/lib/hooks/useAuthGuard';
import './globals.css';
import { NotificationProvider } from '@/lib/contexts/NotificationContext';
import { PageAccessProvider } from '@/lib/contexts/PageAccessContext';
import PageAccessOverlay from '@/components/pageAccess/PageAccessOverlay';
import { pushNotificationService } from '@/lib/services/PushNotificationService';
import { platformEnvironmentService } from '@/lib/services/PlatformEnvironmentService';
import { AppDataProvider } from '@/lib/contexts/AppDataContext';
import { AppErrorBoundary } from '@/components/ui/AppErrorBoundary';
import { errorLogService } from '@/lib/services/ErrorLogService';
import { ThemeProvider, useAppTheme } from '@/lib/contexts/ThemeContext';
import AppPreloadCoordinator from '@/components/providers/AppPreloadCoordinator';
import { AppDrawerProvider } from '@/lib/contexts/AppDrawerContext';
import { CallProvider } from '@/lib/contexts/CallContext';
import GlobalCallOverlay from '@/components/calls/GlobalCallOverlay';
import InAppNotificationBanner from '@/components/ui/InAppNotificationBanner';
import { crashReportingService } from '@/lib/services/CrashReportingService';
import { memoryPressureService } from '@/lib/services/MemoryPressureService';
import { nativeCallService } from '@/lib/services/NativeCallService';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui/AppErrorBoundary';

errorLogService.install();
memoryPressureService.install();
void crashReportingService.initialize();

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
          <InAppNotificationBanner />
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
    if (!platformEnvironmentService.isNativePushSupported()) return;

    let subscription: { remove: () => void } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require('expo-notifications') as typeof import('expo-notifications');
      const handleResponse = async (response: import('expo-notifications').NotificationResponse) => {
        const responseId = `${response.notification.request.identifier}:${response.actionIdentifier}`;
        if (handledResponseIds.current.has(responseId)) return;
        handledResponseIds.current.add(responseId);
        const handledAsCall = await nativeCallService.handleNotificationResponse(
          response.notification.request.content.data,
          response.actionIdentifier,
        );
        if (handledAsCall) return;
        router.push(pushNotificationService.resolveNotificationDestination(response.notification.request.content.data));
      };
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        void handleResponse(response);
      });
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) void handleResponse(response);
      });
    } catch {
      // Remote push listeners are unavailable in Expo Go.
    }
    return () => subscription?.remove();
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppErrorBoundary>
        <ThemeProvider>
          <AppRouteTree />
        </ThemeProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}
