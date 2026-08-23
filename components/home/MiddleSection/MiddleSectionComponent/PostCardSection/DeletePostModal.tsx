import { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import AnimatedActionButton from '@/components/ui/AnimatedActionButton';
import { ModalBackdrop, ModalMotionSurface } from '@/components/ui/ModalMotion';

type DeletePostModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirmDelete: () => Promise<void>;
};

export default function DeletePostModal({ visible, onClose, onConfirmDelete }: DeletePostModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [deleteState, setDeleteState] = useState<'idle' | 'deleting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleStartDelete = async () => {
    setDeleteState('deleting');
    try {
      await onConfirmDelete();
      setDeleteState('success');
    } catch (err) {
      console.error('[DeletePostModal] Error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete post.');
      setDeleteState('error');
    }
  };

  const handleCloseSuccess = () => {
    setDeleteState('idle');
    onClose();
  };

  const handleReset = () => {
    setDeleteState('idle');
    setErrorMessage('');
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <ModalBackdrop onPress={deleteState === 'deleting' ? undefined : onClose} style={styles.overlay}>
        <ModalMotionSurface variant="dialog" style={styles.card}>
        <Pressable onPress={(event) => event.stopPropagation()} style={styles.cardContent}>
          {deleteState === 'idle' && (
            <>
              <View style={styles.iconBadgeDanger}>
                <Icon name="trash-2" size={28} color={colors.destructive} />
              </View>
              <Text style={styles.title}>Delete this post?</Text>
              <Text style={styles.subtitle}>
                This action cannot be undone. This post will be permanently removed from your profile and feed.
              </Text>
              <View style={styles.buttonRow}>
                <AnimatedActionButton onPress={onClose} style={styles.cancelBtn} accessibilityLabel="Cancel deletion">
                  <Text style={styles.cancelText}>Cancel</Text>
                </AnimatedActionButton>
                <AnimatedActionButton onPress={handleStartDelete} style={styles.deleteBtn} feedback="warning" accessibilityLabel="Delete post">
                  <Text style={styles.deleteText}>Delete</Text>
                </AnimatedActionButton>
              </View>
            </>
          )}

          {deleteState === 'deleting' && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.destructive} style={{ marginBottom: 16 }} />
              <Text style={styles.title}>Deleting post...</Text>
              <Text style={styles.subtitle}>Please wait while we remove this post.</Text>
            </View>
          )}

          {deleteState === 'success' && (
            <>
              <View style={styles.iconBadgeSuccess}>
                <Icon name="check" size={30} color={colors.successText} />
              </View>
              <Text style={styles.title}>Done, post deleted!</Text>
              <Text style={styles.subtitle}>Your post has been successfully removed.</Text>
              <AnimatedActionButton onPress={handleCloseSuccess} style={styles.successBtn} feedback="success" accessibilityLabel="Close success message">
                <Text style={styles.successBtnText}>Great!</Text>
              </AnimatedActionButton>
            </>
          )}

          {deleteState === 'error' && (
            <>
              <View style={styles.iconBadgeDanger}>
                <Icon name="alert-triangle" size={28} color={colors.destructive} />
              </View>
              <Text style={styles.title}>Action Failed</Text>
              <Text style={styles.subtitle}>{errorMessage || 'Could not delete post. Please try again.'}</Text>
              <View style={styles.buttonRow}>
                <AnimatedActionButton onPress={handleReset} style={styles.cancelBtn} accessibilityLabel="Try deleting again">
                  <Text style={styles.cancelText}>Try Again</Text>
                </AnimatedActionButton>
                <AnimatedActionButton onPress={onClose} style={styles.deleteBtn} accessibilityLabel="Close error message">
                  <Text style={styles.deleteText}>Close</Text>
                </AnimatedActionButton>
              </View>
            </>
          )}
        </Pressable>
        </ModalMotionSurface>
      </ModalBackdrop>
    </Modal>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.modalScrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  cardContent: {
    width: '100%',
    alignItems: 'center',
  },
  iconBadgeDanger: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.destructiveSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconBadgeSuccess: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.mutedText,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.control,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.secondaryText,
    fontSize: 14,
    fontWeight: '700',
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: colors.destructive,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  deleteText: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '700',
  },
  successBtn: {
    width: '100%',
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  successBtnText: {
    color: colors.onAccent,
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
});
