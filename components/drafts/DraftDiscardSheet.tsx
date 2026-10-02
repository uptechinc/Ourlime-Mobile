import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type DraftDiscardSheetProps = {
  visible: boolean;
  title?: string;
  message?: string;
  /** Hide "Save draft" where drafts aren't available (e.g. community posts, like the website). */
  canSaveDraft?: boolean;
  isSaving?: boolean;
  onSaveDraft: () => void;
  onDiscard: () => void;
  onContinue: () => void;
};

/**
 * "Discard post?" bottom sheet shown when closing a form with unsaved changes (same choices as the website):
 * Save draft and close / Discard / Continue editing.
 */
export default function DraftDiscardSheet({
  visible,
  title = 'Discard post?',
  message = 'You have unsaved changes. If you leave without saving a draft, your post data will be lost.',
  canSaveDraft = true,
  isSaving = false,
  onSaveDraft,
  onDiscard,
  onContinue,
}: DraftDiscardSheetProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={onContinue}>
      <Pressable style={styles.backdrop} onPress={isSaving ? undefined : onContinue} accessibilityLabel="Continue editing">
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) + 8 }]} onPress={() => undefined}>
          <View style={styles.iconBadge}>
            <Icon name="alert-circle" size={24} color="#fbbf24" />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.secondaryText }]}>{message}</Text>
          {canSaveDraft ? (
            <TouchableOpacity onPress={onSaveDraft} disabled={isSaving} style={[styles.primaryButton, { backgroundColor: colors.accent }]} accessibilityRole="button">
              {isSaving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={[styles.primaryText, { color: colors.onAccent }]}>Save draft and close</Text>}
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={onDiscard} disabled={isSaving} style={[styles.discardButton, { backgroundColor: colors.destructiveSurface }]} accessibilityRole="button">
            <Text style={[styles.discardText, { color: colors.destructiveText }]}>Discard</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onContinue} disabled={isSaving} style={styles.continueButton} accessibilityRole="button">
            <Text style={[styles.continueText, { color: colors.text }]}>Continue editing</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,0.65)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 22 },
  iconBadge: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(251,191,36,0.15)', marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '800' },
  message: { fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 18 },
  primaryButton: { minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  primaryText: { fontSize: 15, fontWeight: '800' },
  discardButton: { minHeight: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  discardText: { fontSize: 15, fontWeight: '800' },
  continueButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  continueText: { fontSize: 15, fontWeight: '700' },
});
