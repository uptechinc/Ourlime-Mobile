import '@/lib/shims/codegenNativeComponent';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { View, ActivityIndicator, LogBox } from 'react-native';
import { useAuthGuard } from '@/lib/hooks/useAuthGuard';
import "./globals.css";
import { NotificationProvider } from '@/lib/contexts/NotificationContext';
import { PageAccessProvider } from '@/lib/contexts/PageAccessContext';
import PageAccessOverlay from '@/components/pageAccess/PageAccessOverlay';
import { pushNotificationService } from '@/lib/services/PushNotificationService';
import { AppDataProvider } from '@/lib/contexts/AppDataContext';

LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'SafeAreaView has been deprecated and will be removed in a future release',
  '@firebase/firestore',
  'WebChannelConnection',
  "RPC 'Listen' stream",
  'transport errored',
  'Cannot connect to Expo CLI',
]);

pushNotificationService.configureForegroundPresentation();

export default function Layout() {
  const router = useRouter();
  const { isInitializing } = useAuthGuard();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      router.push(pushNotificationService.resolveNotificationDestination(response.notification.request.content.data ?? {}));
    });
    return () => subscription.remove();
  }, [router]);

  if (isInitializing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <AppDataProvider>
      <PageAccessProvider>
      <NotificationProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        {/* Login is public — no slide-in animation */}
        <Stack.Screen name="(auth)/login" options={{ animation: 'none' }} />
        {/* Register slides in from right */}
        <Stack.Screen name="(auth)/register" options={{ animation: 'slide_from_right' }} />
        </Stack>
        <PageAccessOverlay />
      </NotificationProvider>
      </PageAccessProvider>
    </AppDataProvider>
  );
}
