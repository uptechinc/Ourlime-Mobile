import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { X } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppUpdate } from '@/lib/hooks/useAppUpdate';
import { appUpdateService } from '@/lib/services/AppUpdateService';
import AppUpdatePanel from '@/components/ui/AppUpdatePanel';

/**
 * Non-blocking "Update available" / "What's new" sheet. Mounted at the root (works before sign-in) and starts the
 * update service. The blocking minimum-version screen is AppUpdateRequiredModal.
 */
export default function AppUpdateSheet() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const update = useAppUpdate();
  const { isSheetVisible, versionCheck, status, sheetMode, isMandatory, dismissSheet } = update;

  useEffect(() => {
    appUpdateService.start();
  }, []);

  // The blocking screen shows the same flow; never stack both.
  const isVisible = isSheetVisible && versionCheck.status !== 'update_required';
  // Updates are mandatory: an update this phone can install keeps the sheet up (no Later, back or tap-outside) until
  // it's installed. "What's new" can always be closed.
  const isBlocking = sheetMode === 'update' && isMandatory;
  const canDismiss = !isBlocking && status !== 'installing' && status !== 'verifying';
  const isWhatsNew = sheetMode === 'whats_new' && !isBlocking;
  const handleDismiss = () => { if (canDismiss) dismissSheet(); };
  const handleOpenReleaseNotes = () => {
    dismissSheet();
    router.push('/settings/release-notes' as Href);
  };

  return (
    <Modal visible={isVisible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={handleDismiss}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* The backdrop sits behind the sheet (not around it), so nothing in the sheet competes with the list's scrolling. */}
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={handleDismiss} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.modalScrim }} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            maxHeight: '88%',
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 12 }} />
          {isWhatsNew ? <>
            <View style={{ paddingHorizontal: 22, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Text accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: 20, fontWeight: '800' }}>{`What's new in Ourlime ${update.whatsNewVersion}`.trim()}</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={dismissSheet} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.control }}>
                <X color={colors.text} size={20} />
              </TouchableOpacity>
            </View>
            {/* flexShrink keeps the list inside the height cap so it scrolls instead of pushing the buttons off screen. */}
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 8 }} showsVerticalScrollIndicator persistentScrollbar>
              {update.whatsNewNotes.length > 0 ? update.whatsNewNotes.map((note) => (
                <View key={note} style={{ flexDirection: 'row', marginBottom: 10 }}>
                  <Text style={{ color: colors.accent, fontSize: 15, marginRight: 8 }}>•</Text>
                  <Text style={{ flex: 1, color: colors.secondaryText, fontSize: 15, lineHeight: 21 }}>{note}</Text>
                </View>
              )) : <Text style={{ color: colors.secondaryText, fontSize: 15, lineHeight: 21 }}>Ourlime was updated with fixes and improvements.</Text>}
            </ScrollView>
            <View style={{ paddingHorizontal: 22, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity accessibilityRole="button" onPress={dismissSheet} style={{ borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: colors.accent }}>
                <Text style={{ color: colors.onAccent, fontSize: 16, fontWeight: '700' }}>Got it</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="link" onPress={handleOpenReleaseNotes} style={{ marginTop: 6, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: colors.accentText, fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' }}>See all release notes</Text>
              </TouchableOpacity>
            </View>
          </> : (
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 22 }} bounces={false} showsVerticalScrollIndicator={false}>
              <AppUpdatePanel isBlocking={isBlocking} />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
