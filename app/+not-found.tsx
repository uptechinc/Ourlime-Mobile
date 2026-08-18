import { useCallback } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const WORRIED_STICKER = require('@/assets/images/stickers/reactions/Worried.png');

export default function NotFoundScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  const handleGoHome = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ title: 'Page Not Found', headerShown: false }} />
      <SafeAreaView
        edges={['top', 'bottom', 'left', 'right']}
        style={{ flex: 1, backgroundColor: colors.canvas }}
        className="flex-1 items-center justify-center px-6"
      >
        <View className="items-center justify-center w-full max-w-sm">
          {/* Sticker Image */}
          <View className="items-center justify-center mb-6">
            <Image
              source={WORRIED_STICKER}
              style={{ width: 200, height: 200 }}
              resizeMode="contain"
              className="w-[200px] h-[200px]"
              accessibilityLabel="Sad Worried Sticker"
            />
          </View>

          {/* 404 Title */}
          <Text
            style={{ color: '#10b981' }}
            className="text-6xl font-extrabold text-greenTheme tracking-wider mb-2 text-center"
          >
            404
          </Text>

          {/* Subtitle */}
          <Text
            style={{ color: colors.text }}
            className="text-xl font-bold text-center mb-2"
          >
            Oops! This page doesn't exist.
          </Text>

          {/* Smaller Message */}
          <Text
            style={{ color: colors.mutedText }}
            className="text-base text-center leading-6 mb-8 px-4"
          >
            The page you're looking for has gone missing.
          </Text>

          {/* Go Home Button */}
          <TouchableOpacity
            onPress={handleGoHome}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#10b981',
              shadowColor: '#10b981',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: isDark ? 0.4 : 0.25,
              shadowRadius: 10,
              elevation: 6,
            }}
            className="flex-row items-center justify-center bg-greenTheme px-8 py-4 rounded-full w-full max-w-xs gap-2"
            accessibilityRole="button"
            accessibilityLabel="Go Home"
          >
            <Ionicons name="home-outline" size={20} color="#ffffff" />
            <Text className="text-white text-base font-bold tracking-wide">
              Go Home
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}
