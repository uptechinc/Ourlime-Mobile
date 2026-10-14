import { ActivityIndicator, Linking, Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppVersionGate } from '@/lib/hooks/useAppVersionGate';

const ANDROID_MARKET_URL = 'market://details?id=com.ourlime.app';
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.ourlime.app';

/** Blocks the app when this build is older than siteConfig/mobileApp.minimumVersion. */
export default function AppUpdateRequiredModal() {
  const { colors } = useAppTheme();
  const { check, isChecking, recheck } = useAppVersionGate();

  if (check.status !== 'update_required') return null;

  const handleUpdate = async () => {
    // The default Play link opens the Play Store app when it's installed, the web page otherwise.
    const urls = check.storeUrl === ANDROID_STORE_URL ? [ANDROID_MARKET_URL, ANDROID_STORE_URL] : [check.storeUrl];
    for (const url of urls) {
      try {
        await Linking.openURL(url);
        return;
      } catch (error) {
        console.warn('[AppUpdateRequiredModal.handleUpdate] Error:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
  };

  return (
    <Modal visible transparent={false} animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <View
            style={{
              width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.successSurface, marginBottom: 24,
            }}
          >
            <Ionicons name="arrow-up-circle-outline" size={48} color={colors.accent} />
          </View>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>
            Update Ourlime
          </Text>
          <Text style={{ color: colors.secondaryText, fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 8 }}>
            {check.message}
          </Text>
          <Text style={{ color: colors.mutedText, fontSize: 13, textAlign: 'center', marginBottom: 32 }}>
            {`Installed ${check.installedVersion} · Required ${check.minimumVersion} or later`}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => void handleUpdate()}
            style={{ alignSelf: 'stretch', backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}
          >
            <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '700' }}>Update now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            disabled={isChecking}
            onPress={() => void recheck()}
            style={{ alignSelf: 'stretch', paddingVertical: 14, alignItems: 'center', marginTop: 8 }}
          >
            {isChecking
              ? <ActivityIndicator color={colors.accent} />
              : <Text style={{ color: colors.accentText, fontSize: 15, fontWeight: '600' }}>Check again</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
