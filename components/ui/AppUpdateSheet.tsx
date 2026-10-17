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
  const { isSheetVisible, versionCheck, status, dismissSheet } = useAppUpdate();

  useEffect(() => {
    appUpdateService.start();
  }, []);

  // The blocking screen shows the same flow; never stack both.
  const isVisible = isSheetVisible && versionCheck.status !== 'update_required';
  // While Android's installer takes over (or a download is being verified), the sheet can't be swiped away by accident.
  const canDismiss = status !== 'installing' && status !== 'verifying';

  return (
    <Modal visible={isVisible} transparent animationType="slide" statusBarTranslucent onRequestClose={() => { if (canDismiss) dismissSheet(); }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={() => { if (canDismiss) dismissSheet(); }}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalScrim }}
      >
        <Pressable
          onPress={() => undefined}
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
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            <AppUpdatePanel />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
