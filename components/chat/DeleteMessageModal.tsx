import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import AnimatedActionButton from '@/components/ui/AnimatedActionButton';
import { ModalBackdrop, ModalMotionSurface } from '@/components/ui/ModalMotion';

export type DeleteMessageModalProps = {
  visible: boolean;
  isOwnMessage: boolean;
  onDeleteForMe: () => void;
  onDeleteForEveryone?: () => void;
  onClose: () => void;
};

export function DeleteMessageModal({
  visible,
  isOwnMessage,
  onDeleteForMe,
  onDeleteForEveryone,
  onClose,
}: DeleteMessageModalProps) {
  const { colors, isDark } = useAppTheme();

  if (!visible) return null;

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
        <ModalMotionSurface
          variant="dialog"
          style={[
            styles.card,
            { backgroundColor: isDark ? '#0f172a' : '#ffffff', borderColor: colors.border },
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.cardContent}>
            {/* Animated Header Icon */}
            <Animated.View
              entering={ZoomIn.springify().damping(14).stiffness(260).delay(80)}
              style={styles.iconContainer}
            >
              <Icon name="trash-2" size={30} color="#ef4444" />
            </Animated.View>

            {/* Title & Description */}
            <Text style={[styles.title, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
              Delete Message?
            </Text>
            <Text style={[styles.description, { color: colors.mutedText }]}>
              {isOwnMessage
                ? 'Choose whether to delete this message for everyone or only on your device.'
                : 'This message will be removed from your chat history.'}
            </Text>

            {/* Action Buttons */}
            <View style={styles.actionsColumn}>
              {isOwnMessage && onDeleteForEveryone && (
                <AnimatedActionButton
                  onPress={() => {
                    onDeleteForEveryone();
                    onClose();
                  }}
                  feedback="warning"
                  accessibilityLabel="Delete for everyone"
                  style={[styles.button, styles.primaryDeleteBtn]}
                >
                  <Icon name="trash-2" size={16} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryDeleteText}>Delete for Everyone</Text>
                </AnimatedActionButton>
              )}

              <AnimatedActionButton
                onPress={() => {
                  onDeleteForMe();
                  onClose();
                }}
                feedback="selection"
                accessibilityLabel="Delete for me"
                style={[
                  styles.button,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    borderWidth: 1,
                  },
                ]}
              >
                <Icon
                  name="user-x"
                  size={16}
                  color={isDark ? '#e2e8f0' : '#475569'}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.secondaryDeleteText,
                    { color: isDark ? '#f8fafc' : '#334155' },
                  ]}
                >
                  Delete for Me
                </Text>
              </AnimatedActionButton>

              <AnimatedActionButton
                onPress={onClose}
                feedback="selection"
                accessibilityLabel="Cancel"
                style={[styles.button, styles.cancelBtn]}
              >
                <Text style={[styles.cancelText, { color: colors.mutedText }]}>Cancel</Text>
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
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
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
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  actionsColumn: {
    width: '100%',
    gap: 10,
  },
  button: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDeleteBtn: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryDeleteText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  secondaryDeleteText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
