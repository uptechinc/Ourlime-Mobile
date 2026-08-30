import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { qrLoginService } from '@/lib/services/QRLoginService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import type { QRLoginSession } from '@/lib/types/qrLogin';

type QRLoginConfirmModalProps = {
  visible: boolean;
  session: QRLoginSession | null;
  onClose: () => void;
  onSuccess: () => void;
};

export default function QRLoginConfirmModal({
  visible,
  session,
  onClose,
  onSuccess,
}: QRLoginConfirmModalProps) {
  const { colors } = useAppTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return null;

  const handleApprove = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await qrLoginService.confirmLogin(session.sessionId);
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to approve login');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error approving login');
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = async () => {
    try {
      setLoading(true);
      await qrLoginService.rejectLogin(session.sessionId, 'User declined authorization');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SwipeDismissSurface
        visible={visible}
        onDismiss={onClose}
        handleColor={colors.border}
        style={{
          marginTop: 'auto',
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          padding: 24,
        }}
      >
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: '#ecfdf5',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <Ionicons name="shield-checkmark" size={28} color="#10b981" />
          </View>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center' }}>
            Log in to Ourlime?
          </Text>
          <Text style={{ color: colors.mutedText, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
            A new device is requesting access to your account.
          </Text>
        </View>

        {error && (
          <View
            style={{
              padding: 10,
              borderRadius: 12,
              backgroundColor: '#fef2f2',
              borderColor: '#fecaca',
              borderWidth: 1,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: '#dc2626', fontSize: 11, textAlign: 'center', fontWeight: '700' }}>
              {error}
            </Text>
          </View>
        )}

        {/* Device Information Card */}
        <View
          style={{
            backgroundColor: colors.control,
            borderRadius: 16,
            padding: 14,
            marginBottom: 20,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.mutedText, fontSize: 11 }}>Platform:</Text>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>
              {session.deviceInfo?.platform === 'web' ? '💻 Web Browser' : '📱 Mobile App'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.mutedText, fontSize: 11 }}>Browser / Client:</Text>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>
              {session.deviceInfo?.browser || 'Browser'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.mutedText, fontSize: 11 }}>Location / IP:</Text>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>
              {session.deviceInfo?.location || session.deviceInfo?.ip || 'Local Network'}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ gap: 10 }}>
          <TouchableOpacity
            onPress={() => void handleApprove()}
            disabled={loading}
            style={{
              backgroundColor: '#10b981',
              paddingVertical: 14,
              borderRadius: 14,
              alignItems: 'center',
            }}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 14 }}>
                Yes, Log In Device
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => void handleDeny()}
            disabled={loading}
            style={{
              backgroundColor: '#f1f5f9',
              paddingVertical: 12,
              borderRadius: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#64748b', fontWeight: '800', fontSize: 13 }}>
              Deny / Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </SwipeDismissSurface>
    </Modal>
  );
}