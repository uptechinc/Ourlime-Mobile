import { useEffect } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const { isSheetVisible, versionCheck, status, sheetMode, isMandatory, dismissSheet } = useAppUpdate();

  useEffect(() => {
    appUpdateService.start();
  }, []);

  // The blocking screen shows the same flow; never stack both.
  const isVisible = isSheetVisible && versionCheck.status !== 'update_required';
  // Updates are mandatory: an update this phone can install keeps the sheet up (no Later, back or tap-outside) until
  // it's installed. "What's new" can always be closed.
  const isBlocking = sheetMode === 'update' && isMandatory;
  const canDismiss = !isBlocking && status !== 'installing' && status !== 'verifying';

  return (
    <Modal visible={isVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => { if (canDismiss) dismissSheet(); }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={() => { if (canDismiss) dismissSheet(); }}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalScrim }}
      >
        {/* A View that claims taps (so they don't close the sheet) without swallowing the ScrollView's drags. */}
        <View
          onStartShouldSetResponder={() => true}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 22,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            maxHeight: '85%',
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 16 }} />
          {/* flexShrink lets the list stay inside the 85% cap and scroll, instead of growing past it and being cut off. */}
          <ScrollView style={{ flexShrink: 1 }} bounces={false} showsVerticalScrollIndicator={false}>
            <AppUpdatePanel isBlocking={isBlocking} />
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}
