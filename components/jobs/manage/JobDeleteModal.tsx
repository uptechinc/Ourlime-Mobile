import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Lock, Trash2 } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import AnimatedActionButton from '@/components/ui/AnimatedActionButton';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { ModalBackdrop, ModalMotionSurface } from '@/components/ui/ModalMotion';

export type JobDeleteMode = 'close' | 'delete';

type JobDeleteModalProps = {
  visible: boolean;
  mode: JobDeleteMode;
  jobTitle: string;
  applicationCount: number;
  isProcessing: boolean;
  /** Deletes the job permanently (delete mode, after the title was typed). */
  onDelete: () => void;
  /** Closes the job instead, keeping it and its applications. */
  onCloseJob: () => void;
  onDismiss: () => void;
};

/**
 * Website JobDeleteModal: a live job is closed first so its applications are kept; any other job is deleted only after
 * its title is typed, with closing offered instead when the job can still be closed.
 */
export default function JobDeleteModal({ visible, mode, jobTitle, applicationCount, isProcessing, onDelete, onCloseJob, onDismiss }: JobDeleteModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (!visible) setConfirmText('');
  }, [visible]);

  if (!visible) return null;
  const isDeleteMode = mode === 'delete';
  const titleMatches = confirmText.trim() === jobTitle.trim();
  const handleDismiss = (): void => { if (!isProcessing) onDismiss(); };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" onRequestClose={handleDismiss}>
      <KeyboardSafeView style={styles.flex}>
        <ModalBackdrop onPress={handleDismiss} style={styles.overlay}>
          <ModalMotionSurface variant="dialog" style={styles.card}>
            <Pressable onPress={(event) => event.stopPropagation()} style={styles.content}>
              <View style={[styles.iconContainer, { backgroundColor: isDeleteMode ? colors.destructiveSurface : colors.warningSurface }]}>
                {isDeleteMode ? <Trash2 size={28} color={colors.destructiveText} /> : <Lock size={28} color={colors.warningText} />}
              </View>
              <Text style={styles.title}>{isDeleteMode ? 'Delete job' : 'Close job first'}</Text>
              {isDeleteMode ? (
                <Text style={styles.message}>
                  This will permanently delete <Text style={styles.strong}>“{jobTitle}”</Text>, its screening questions and its uploaded files.
                  {applicationCount > 0 ? `\n\n${applicationCount} existing application${applicationCount === 1 ? '' : 's'} will be kept with a “job withdrawn” status, but the job will no longer be visible.` : ''}
                  {'\n\n'}<Text style={styles.danger}>This cannot be undone.</Text>
                </Text>
              ) : (
                <Text style={styles.message}>
                  <Text style={styles.strong}>“{jobTitle}”</Text> is live. Close it so it stops accepting applications
                  {applicationCount > 0 ? ` and your ${applicationCount} existing application${applicationCount === 1 ? ' is' : 's are'} kept for review` : ''}. You can delete it once it is closed.
                </Text>
              )}
              {isDeleteMode ? (
                <View style={styles.field}>
                  <Text style={styles.label}>Type “{jobTitle}” to confirm</Text>
                  <TextInput
                    value={confirmText}
                    onChangeText={setConfirmText}
                    placeholder={jobTitle}
                    placeholderTextColor={colors.mutedText}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    editable={!isProcessing}
                    accessibilityLabel="Job title confirmation"
                    style={styles.input}
                  />
                </View>
              ) : null}
              <View style={styles.buttons}>
                <AnimatedActionButton onPress={handleDismiss} disabled={isProcessing} style={styles.cancelButton} accessibilityLabel="Cancel">
                  <Text style={styles.cancelText}>Cancel</Text>
                </AnimatedActionButton>
                {isDeleteMode ? (
                  <AnimatedActionButton
                    onPress={onDelete}
                    disabled={isProcessing || !titleMatches}
                    feedback="warning"
                    style={[styles.confirmButton, styles.deleteButton, (!titleMatches || isProcessing) && styles.disabled]}
                    accessibilityLabel="Permanently delete job"
                  >
                    {isProcessing ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.confirmText}>Delete</Text>}
                  </AnimatedActionButton>
                ) : (
                  <AnimatedActionButton onPress={onCloseJob} disabled={isProcessing} style={[styles.confirmButton, styles.closeButton]} accessibilityLabel="Close job">
                    {isProcessing ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.confirmText}>Close job</Text>}
                  </AnimatedActionButton>
                )}
              </View>
            </Pressable>
          </ModalMotionSurface>
        </ModalBackdrop>
      </KeyboardSafeView>
    </Modal>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, backgroundColor: colors.modalScrim, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  card: { width: '100%', maxWidth: 360, borderRadius: 24, backgroundColor: colors.surface, padding: 22 },
  content: { width: '100%', alignItems: 'center' },
  iconContainer: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { color: colors.text, fontSize: 19, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  message: { color: colors.secondaryText, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  strong: { color: colors.text, fontWeight: '800' },
  danger: { color: colors.destructiveText, fontWeight: '800' },
  field: { width: '100%', marginTop: 16, gap: 6 },
  label: { color: colors.secondaryText, fontSize: 12, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.input, color: colors.text, paddingHorizontal: 12, paddingVertical: 10 },
  buttons: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 20 },
  cancelButton: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  cancelText: { color: colors.secondaryText, fontWeight: '800' },
  confirmButton: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  deleteButton: { backgroundColor: '#ef4444' },
  closeButton: { backgroundColor: '#f59e0b' },
  confirmText: { color: '#ffffff', fontWeight: '900' },
  disabled: { opacity: 0.5 },
});
