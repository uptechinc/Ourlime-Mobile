import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

type DeletePostModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirmDelete: () => Promise<void>;
};

export default function DeletePostModal({ visible, onClose, onConfirmDelete }: DeletePostModalProps) {
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {deleteState === 'idle' && (
            <>
              <View style={styles.iconBadgeDanger}>
                <Icon name="trash-2" size={28} color="#ef4444" />
              </View>
              <Text style={styles.title}>Delete this post?</Text>
              <Text style={styles.subtitle}>
                This action cannot be undone. This post will be permanently removed from your profile and feed.
              </Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleStartDelete} style={styles.deleteBtn}>
                  <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {deleteState === 'deleting' && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#ef4444" style={{ marginBottom: 16 }} />
              <Text style={styles.title}>Deleting post...</Text>
              <Text style={styles.subtitle}>Please wait while we remove this post.</Text>
            </View>
          )}

          {deleteState === 'success' && (
            <>
              <View style={styles.iconBadgeSuccess}>
                <Icon name="check" size={30} color="#10b981" />
              </View>
              <Text style={styles.title}>Done, post deleted!</Text>
              <Text style={styles.subtitle}>Your post has been successfully removed.</Text>
              <TouchableOpacity onPress={handleCloseSuccess} style={styles.successBtn}>
                <Text style={styles.successBtnText}>Great!</Text>
              </TouchableOpacity>
            </>
          )}

          {deleteState === 'error' && (
            <>
              <View style={styles.iconBadgeDanger}>
                <Icon name="alert-triangle" size={28} color="#ef4444" />
              </View>
              <Text style={styles.title}>Action Failed</Text>
              <Text style={styles.subtitle}>{errorMessage || 'Could not delete post. Please try again.'}</Text>
              <View style={styles.buttonRow}>
                <TouchableOpacity onPress={handleReset} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.deleteBtn}>
                  <Text style={styles.deleteText}>Close</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  iconBadgeDanger: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconBadgeSuccess: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
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
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  deleteText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  successBtn: {
    width: '100%',
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  successBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
});
