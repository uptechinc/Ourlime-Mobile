import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';

type SellerScreenFrameProps = {
  title: string;
  subtitle: string;
  /** Buttons on the right of the header. */
  accessory?: ReactNode;
  /** Where Back goes when there is no screen to return to. */
  fallbackRoute?: '/market' | '/market/seller';
  children: ReactNode;
};

/** Seller screens' shell: Lime Market header (outside the keyboard area) and a keyboard-safe body. */
export default function SellerScreenFrame({ title, subtitle, accessory, fallbackRoute = '/market', children }: SellerScreenFrameProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace(fallbackRoute as Href)} style={styles.iconButton}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <View style={styles.headerTitle}>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text>
      </View>
      {accessory}
    </View>
    <KeyboardSafeView style={styles.body}>{children}</KeyboardSafeView>
  </SafeAreaView>;
}

export function SellerLoading({ label }: { label: string }) {
  const { colors } = useAppTheme();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 30 }}>
    <ActivityIndicator color={colors.accent} />
    <Text style={{ color: colors.mutedText, fontSize: 13 }}>{label}</Text>
  </View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 68, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.navigation, borderBottomWidth: 1, borderBottomColor: colors.navigationBorder },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 32, lineHeight: 35 },
  headerTitle: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 21, fontWeight: '900' },
  subtitle: { color: colors.mutedText, fontSize: 11, marginTop: 1 },
  body: { flex: 1 },
});
