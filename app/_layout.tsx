import '@/lib/shims/codegenNativeComponent';
import { Stack } from 'expo-router';
import { View, ActivityIndicator, LogBox } from 'react-native';
import { useAuthGuard } from '@/lib/hooks/useAuthGuard';
import "./globals.css";

LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'SafeAreaView has been deprecated and will be removed in a future release',
  '@firebase/firestore: WebChannelConnection RPC',
  'Cannot connect to Expo CLI',
]);

import { NotificationProvider } from '@/lib/contexts/NotificationContext';

export default function Layout() {
  const { isInitializing } = useAuthGuard();

  if (isInitializing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
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
    </NotificationProvider>
  );
}
