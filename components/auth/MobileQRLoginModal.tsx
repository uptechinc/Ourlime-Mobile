import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { qrLoginService } from '@/lib/services/QRLoginService';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';
import type { QRLoginSession } from '@/lib/types/qrLogin';

type MobileQRLoginModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function MobileQRLoginModal({ visible, onClose }: MobileQRLoginModalProps) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [session, setSession] = useState<{
    sessionId: string;
    shortCode: string;
    token: string;
    expiresAt: string;
    qrDataUrl: string;
  } | null>(null);
  const [status, setStatus] = useState<QRLoginSession['status']>('pending');
  const [timeLeft, setTimeLeft] = useState(60);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setStatus('pending');
      setTimeLeft(60);

      const res = await qrLoginService.initSession();
      setSession(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not generate QR code');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void initSession();
    }
  }, [visible, initSession]);

  // Countdown timer
  useEffect(() => {
    if (!visible || !session || status === 'confirmed' || status === 'expired') return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, session, status]);

  // Status Polling
  useEffect(() => {
    if (!visible || !session || status === 'confirmed' || status === 'expired' || status === 'rejected') return;

    const interval = setInterval(async () => {
      try {
        const res = await qrLoginService.getSessionStatus(session.sessionId, session.token);
        if (res.status) {
          setStatus(res.status);

          if (res.status === 'confirmed' && res.customToken) {
            clearInterval(interval);
            void interactionFeedbackService.play('success');
            await signInWithCustomToken(auth, res.customToken);
            onClose();
            router.replace('/(tabs)');
          }
        }
      } catch {
        // Retry
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [visible, session, status, onClose, router]);

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
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 4 }}>
          📱 Log In with QR Code
        </Text>
        <Text style={{ color: colors.mutedText, fontSize: 12, textAlign: 'center', marginBottom: 18 }}>
          Scan this QR code with an already logged-in device or enter the backup shortcode.
        </Text>

        {/* QR Container */}
        <View
          style={{
            width: 240,
            height: 240,
            backgroundColor: '#ffffff',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {loading ? (
            <View style={{ alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#10b981" />
              <Text style={{ color: '#64748b', fontSize: 11, marginTop: 8 }}>Generating QR...</Text>
            </View>
          ) : error ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <Text style={{ color: '#ef4444', fontSize: 12, textAlign: 'center' }}>{error}</Text>
              <TouchableOpacity
                onPress={() => void initSession()}
                style={{
                  marginTop: 10,
                  backgroundColor: '#10b981',
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 11 }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : status === 'expired' ? (
            <View style={{ alignItems: 'center', padding: 16 }}>
              <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 13, marginBottom: 8 }}>
                QR Code Expired
              </Text>
              <TouchableOpacity
                onPress={() => void initSession()}
                style={{
                  backgroundColor: '#10b981',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 12,
                }}
              >
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 12 }}>
                  Refresh QR Code
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            session && (
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Image
                  source={{ uri: session.qrDataUrl }}
                  style={{
                    width: 220,
                    height: 220,
                    opacity: status === 'scanned' ? 0.3 : 1,
                  }}
                  resizeMode="contain"
                />
                {status === 'scanned' && (
                  <View
                    style={{
                      position: 'absolute',
                      alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      padding: 12,
                      borderRadius: 14,
                    }}
                  >
                    <ActivityIndicator color="#10b981" />
                    <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 12, marginTop: 4 }}>
                      Scanned!
                    </Text>
                    <Text style={{ color: '#64748b', fontSize: 10 }}>Confirm on your device</Text>
                  </View>
                )}
              </View>
            )
          )}
        </View>

        {session && status !== 'expired' && (
          <View style={{ width: '100%', maxWidth: 240, marginTop: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: colors.mutedText, fontSize: 11 }}>Expires in:</Text>
              <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 11 }}>{timeLeft}s</Text>
            </View>
            <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' }}>
              <View
                style={{
                  height: '100%',
                  backgroundColor: '#10b981',
                  width: `${(timeLeft / 60) * 100}%`,
                }}
              />
            </View>

            <View style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: colors.mutedText, fontSize: 10 }}>Or enter code manually:</Text>
              <Text
                style={{
                  color: colors.text,
                  fontWeight: '900',
                  fontSize: 16,
                  letterSpacing: 2,
                  marginTop: 2,
                }}
              >
                {session.shortCode}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={onClose}
          style={{
            marginTop: 18,
            paddingVertical: 10,
            paddingHorizontal: 24,
            borderRadius: 14,
            backgroundColor: colors.control,
          }}
        >
          <Text style={{ color: colors.secondaryText, fontWeight: '700', fontSize: 12 }}>Cancel</Text>
        </TouchableOpacity>
      </SwipeDismissSurface>
    </Modal>
  );
}