import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppVersionGate } from '@/lib/hooks/useAppVersionGate';
import { useAppUpdate } from '@/lib/hooks/useAppUpdate';
import AppUpdatePanel from '@/components/ui/AppUpdatePanel';

/**
 * Blocks the app when this build is older than siteConfig/mobileApp.minimumVersion. On sideload builds with a
 * published APK the update downloads and installs right here; otherwise "Update now" opens the store / APK link.
 */
export default function AppUpdateRequiredModal() {
  const { colors } = useAppTheme();
  const { check, isChecking, recheck } = useAppVersionGate();
  const { status, canInstallInApp, release, openExternalUpdate } = useAppUpdate();

  if (check.status !== 'update_required') return null;

  const canUpdateInApp = canInstallInApp && release?.apkUrl && release.apkSha256 && release.apkSizeBytes && release.sideloadUpdates;
  const isFlowUnderWay = status !== 'available' && status !== 'checking' && status !== 'up_to_date' && status !== 'idle';

  return (
    <Modal visible transparent={false} animationType="fade" statusBarTranslucent onRequestClose={() => undefined}>
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 24 }}>
          <View style={{ alignItems: 'center' }}>
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
            <Text style={{ color: colors.mutedText, fontSize: 13, textAlign: 'center', marginBottom: 28 }}>
              {`Installed ${check.installedVersion} · Required ${check.minimumVersion} or later`}
            </Text>
          </View>

          {canUpdateInApp || isFlowUnderWay ? (
            <View style={{ alignSelf: 'stretch', padding: 18, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <AppUpdatePanel isBlocking />
            </View>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => void openExternalUpdate()}
              style={{ alignSelf: 'stretch', backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}
            >
              <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '700' }}>Update now</Text>
            </TouchableOpacity>
          )}

          {!isFlowUnderWay ? (
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
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
