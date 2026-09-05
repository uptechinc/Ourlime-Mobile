import '@/lib/shims/promiseFinally';
import '@/lib/shims/codegenNativeComponent';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, LogBox, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthGuard } from '@/lib/hooks/useAuthGuard';
import './globals.css';
import { NotificationProvider } from '@/lib/contexts/NotificationContext';
import { PageAccessProvider } from '@/lib/contexts/PageAccessContext';
import PageAccessOverlay from '@/components/pageAccess/PageAccessOverlay';
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
import NotificationNavigationCoordinator from '@/components/providers/NotificationNavigationCoordinator';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/ui/AppErrorBoundary';

errorLogService.install();
memoryPressureService.install();
void crashReportingService.initialize();
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

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
  const { user, isInitializing } = useAuthGuard();
  const { colors } = useAppTheme();

  useEffect(() => {
    if (!isInitializing) void SplashScreen.hideAsync().catch(() => undefined);
  }, [isInitializing]);

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
            <Stack.Screen name="index" options={{ animation: 'none' }} />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)/login" options={{ animation: 'none' }} />
            <Stack.Screen name="(auth)/register" options={{ animation: 'slide_from_right' }} />
          </Stack>
          <NotificationNavigationCoordinator userId={user?.uid ?? null} />
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
