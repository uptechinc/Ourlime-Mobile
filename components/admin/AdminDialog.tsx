import type { ReactNode } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

export type AdminDialogTone = 'positive' | 'danger' | 'pending';

type AdminDialogProps = {
  visible: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: AdminDialogTone;
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
};

/** Centered admin dialog with optional form fields; stays above the keyboard. Used by the admin workspaces. */
export default function AdminDialog({
  visible,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'positive',
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onClose,
}: AdminDialogProps) {
  const { colors } = useAppTheme();
  const confirmColor = tone === 'danger' ? colors.destructive : tone === 'pending' ? '#d97706' : '#10b981';
  const isConfirmDisabled = busy || confirmDisabled;

  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <KeyboardSafeView style={{ flex: 1, backgroundColor: colors.modalScrim, justifyContent: 'center', padding: 18 }}>
        <TouchableOpacity activeOpacity={1} onPress={busy ? undefined : onClose} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} accessibilityLabel="Close dialog" />
        <View style={{ maxHeight: '90%', borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.elevated, overflow: 'hidden' }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{title}</Text>
            {description ? <Text style={{ marginTop: 8, color: colors.secondaryText, lineHeight: 20 }}>{description}</Text> : null}
            {children ? <View style={{ marginTop: 14 }}>{children}</View> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 }}>
              <TouchableOpacity disabled={busy} onPress={onClose} style={{ paddingHorizontal: 16, paddingVertical: 11, borderRadius: 13, borderWidth: 1, borderColor: colors.border, marginRight: onConfirm ? 10 : 0 }}>
                <Text style={{ color: colors.secondaryText, fontWeight: '800' }}>{onConfirm ? cancelLabel : 'Close'}</Text>
              </TouchableOpacity>
              {onConfirm && confirmLabel ? (
                <TouchableOpacity
                  disabled={isConfirmDisabled}
                  onPress={onConfirm}
                  style={{ minWidth: 110, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderRadius: 13, backgroundColor: confirmColor, opacity: isConfirmDisabled ? 0.55 : 1 }}
                >
                  {busy ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={{ color: '#ffffff', fontWeight: '900' }}>{confirmLabel}</Text>}
                </TouchableOpacity>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </KeyboardSafeView>
    </Modal>
  );
}
