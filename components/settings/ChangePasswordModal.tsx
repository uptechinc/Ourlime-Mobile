import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Feather';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';

type ChangePasswordModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ChangePasswordModal({ visible, onClose, onSuccess }: ChangePasswordModalProps) {
  const { colors, isDark } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const swipeDismiss = useSwipeDismiss({
    visible,
    onDismiss: () => {
      resetForm();
      onClose();
    },
    disabled: loading,
  });

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  };

  const handleUpdatePassword = async () => {
    setError('');
    const user = auth.currentUser;
    if (!user || !user.email) {
      setError('You must be signed in with an email account to change your password.');
      return;
    }

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // Re-authenticate user first
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      // Update password
      await updatePassword(user, newPassword);
      resetForm();
      onSuccess();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Current password is incorrect.');
      } else if (code === 'auth/requires-recent-login') {
        setError('Please sign out and sign back in before changing your password.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to update password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={swipeDismiss.dismissWithAnimation}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.sheet, swipeDismiss.animatedStyle]}>
          <SwipeDismissHandle gesture={swipeDismiss.gesture} color={colors.border} animatedStyle={swipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close password update" />
          
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <Icon name="lock" size={20} color="#10b981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Change Password</Text>
              <Text style={styles.subtitle}>Enter your current and new password below</Text>
            </View>
            <TouchableOpacity onPress={() => { resetForm(); onClose(); }} style={{ padding: 4 }}>
              <Icon name="x" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Icon name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Current Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Current Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrent}
                placeholder="Enter current password"
                placeholderTextColor={colors.mutedText}
                style={styles.input}
              />
              <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)} style={styles.eyeBtn}>
                <Icon name={showCurrent ? 'eye-off' : 'eye'} size={18} color={colors.mutedText} />
              </TouchableOpacity>
            </View>
          </View>

          {/* New Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.mutedText}
                style={styles.input}
              />
              <TouchableOpacity onPress={() => setShowNew(!showNew)} style={styles.eyeBtn}>
                <Icon name={showNew ? 'eye-off' : 'eye'} size={18} color={colors.mutedText} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm New Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                placeholder="Re-enter new password"
                placeholderTextColor={colors.mutedText}
                style={styles.input}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeBtn}>
                <Icon name={showConfirm ? 'eye-off' : 'eye'} size={18} color={colors.mutedText} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={() => { resetForm(); onClose(); }} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void handleUpdatePassword()} disabled={loading} style={styles.saveBtn}>
              {loading ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.saveBtnText}>Update Password</Text>}
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppThemeColors, isDark: boolean) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: colors.modalScrim, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 40,
      gap: 14,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? '#064e3b' : '#d1fae5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontSize: 17, fontWeight: '900', color: colors.text },
    subtitle: { fontSize: 12, color: colors.mutedText, marginTop: 1 },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#fef2f2',
      borderWidth: 1,
      borderColor: '#fecaca',
      padding: 10,
      borderRadius: 12,
    },
    errorText: { color: '#ef4444', fontSize: 12, fontWeight: '600', flex: 1 },
    fieldGroup: { gap: 6 },
    label: { fontSize: 12, fontWeight: '700', color: colors.mutedText },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.control,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 44,
    },
    input: { flex: 1, fontSize: 14, color: colors.text },
    eyeBtn: { padding: 6 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
    cancelBtn: {
      flex: 1,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtnText: { color: colors.text, fontWeight: '700' },
    saveBtn: {
      flex: 1.2,
      height: 44,
      borderRadius: 12,
      backgroundColor: '#10b981',
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnText: { color: '#ffffff', fontWeight: '800' },
  });
