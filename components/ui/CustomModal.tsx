import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import AnimatedActionButton from '@/components/ui/AnimatedActionButton';
import { ModalBackdrop, ModalMotionSurface } from '@/components/ui/ModalMotion';

export type CustomModalType = 'success' | 'danger' | 'warning' | 'info' | 'error';

export type CustomModalProps = {
  visible: boolean;
  type?: CustomModalType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  onClose: () => void;
};

export default function CustomModal({
  visible,
  type = 'info',
  title,
  message,
  confirmText = 'OK',
  cancelText,
  isLoading = false,
  onConfirm,
  onCancel,
  onClose,
}: CustomModalProps) {
  const { isDark } = useAppTheme();
  const themeStyles = createThemeStyles(isDark);
  if (!visible) return null;

  const renderIcon = () => {
    switch (type) {
      case 'success':
        return (
          <View style={[styles.iconContainer, { backgroundColor: '#ecfdf5' }]}>
            <Icon name="check-circle" size={32} color="#10b981" />
          </View>
        );
      case 'danger':
      case 'error':
        return (
          <View style={[styles.iconContainer, { backgroundColor: '#fef2f2' }]}>
            <Icon name="alert-circle" size={32} color="#ef4444" />
          </View>
        );
      case 'warning':
        return (
          <View style={[styles.iconContainer, { backgroundColor: '#fffbeb' }]}>
            <Icon name="alert-triangle" size={32} color="#f59e0b" />
          </View>
        );
      case 'info':
      default:
        return (
          <View style={[styles.iconContainer, { backgroundColor: '#eff6ff' }]}>
            <Icon name="info" size={32} color="#3b82f6" />
          </View>
        );
    }
  };

  const getConfirmButtonStyle = () => {
    switch (type) {
      case 'danger':
      case 'error':
        return { backgroundColor: '#ef4444' };
      case 'success':
        return { backgroundColor: '#10b981' };
      case 'warning':
        return { backgroundColor: '#f59e0b' };
      case 'info':
      default:
        return { backgroundColor: '#10b981' };
    }
  };

  const handleConfirmPress = () => {
    if (onConfirm) onConfirm();
    else onClose();
  };

  const handleCancelPress = () => {
    if (onCancel) onCancel();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <ModalBackdrop onPress={onClose} style={styles.overlay}>
        <ModalMotionSurface variant="dialog" style={[styles.card, themeStyles.card]}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.cardContent}>
              {/* Top Header Icon */}
              <Animated.View entering={ZoomIn.springify().damping(14).stiffness(260).delay(80)}>
                {renderIcon()}
              </Animated.View>

              {/* Title & Message */}
              <Text style={[styles.title, themeStyles.title]}>{title}</Text>
              <Text style={[styles.message, themeStyles.message]}>{message}</Text>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                {cancelText ? (
                  <AnimatedActionButton
                    onPress={handleCancelPress}
                    disabled={isLoading}
                    style={[styles.cancelButton, themeStyles.cancelButton]}
                    accessibilityLabel={cancelText}
                  >
                    <Text style={[styles.cancelButtonText, themeStyles.cancelButtonText]}>{cancelText}</Text>
                  </AnimatedActionButton>
                ) : null}

                <AnimatedActionButton
                  onPress={handleConfirmPress}
                  disabled={isLoading}
                  style={[styles.confirmButton, getConfirmButtonStyle()]}
                  feedback={type === 'danger' || type === 'error' ? 'warning' : 'selection'}
                  accessibilityLabel={confirmText}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.confirmButtonText}>{confirmText}</Text>
                  )}
                </AnimatedActionButton>
              </View>
          </Pressable>
        </ModalMotionSurface>
      </ModalBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  cardContent: {
    width: '100%',
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});

const createThemeStyles = (isDark: boolean) => StyleSheet.create({
  card: { backgroundColor: isDark ? '#0f172a' : '#ffffff' },
  title: { color: isDark ? '#f8fafc' : '#0f172a' },
  message: { color: isDark ? '#cbd5e1' : '#64748b' },
  cancelButton: {
    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
    borderColor: isDark ? '#475569' : '#e2e8f0',
  },
  cancelButtonText: { color: isDark ? '#e2e8f0' : '#64748b' },
});
