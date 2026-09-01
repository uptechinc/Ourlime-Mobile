import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { qrLoginService } from '@/lib/services/QRLoginService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import QRLoginConfirmModal from '@/components/settings/QRLoginConfirmModal';
import type { QRLoginSession } from '@/lib/types/qrLogin';

type QRScannerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function QRScannerModal({ visible, onClose, onSuccess }: QRScannerModalProps) {
  const { colors } = useAppTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmSession, setConfirmSession] = useState<QRLoginSession | null>(null);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (!scanning || loading) return;
    setScanning(false);
    setLoading(true);
    setError(null);

    try {
      const res = await qrLoginService.scanPayload(data);
      if (res.success && res.session) {
        setConfirmSession(res.session);
      } else {
        setError(res.error || 'Invalid or expired QR code.');
        setScanning(true);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process QR code');
      setScanning(true);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualCode.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await qrLoginService.scanShortCode(manualCode);
      if (res.success && res.session) {
        setConfirmSession(res.session);
      } else {
        setError(res.error || 'Invalid code.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={[styles.container, { backgroundColor: colors.canvas }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.icon} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Scan QR Login</Text>
          <View style={{ width: 32 }} />
        </View>

        {/* Camera Area */}
        <View style={styles.cameraContainer}>
          {!permission?.granted ? (
            <View style={styles.permissionBox}>
              <Ionicons name="camera-outline" size={48} color={colors.mutedText} />
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14, marginTop: 12 }}>
                Camera Permission Required
              </Text>
              <Text style={{ color: colors.mutedText, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                We need access to your camera to scan the QR login code on your other device.
              </Text>
              <TouchableOpacity
                onPress={() => void requestPermission()}
                style={styles.permissionBtn}
              >
                <Text style={styles.permissionBtnText}>Grant Camera Access</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanning ? handleBarcodeScanned : undefined}
            >
              <View style={styles.overlay}>
                <View style={styles.scanFrame} />
                <Text style={styles.scanHint}>Point camera at QR code on your computer</Text>
              </View>
            </CameraView>
          )}

          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#10b981" />
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 12, marginTop: 8 }}>
                Verifying session…
              </Text>
            </View>
          )}
        </View>

        {/* Manual Shortcode Fallback */}
        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          {error && (
            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
              {error}
            </Text>
          )}

          <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>
            Or enter the 6-character backup code:
          </Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="e.g. OL-AB12"
              placeholderTextColor={colors.mutedText}
              autoCapitalize="characters"
              style={{
                flex: 1,
                backgroundColor: colors.input,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.text,
                fontSize: 13,
                fontWeight: '800',
                letterSpacing: 1.5,
              }}
            />
            <TouchableOpacity
              onPress={() => void handleManualSubmit()}
              disabled={loading || !manualCode.trim()}
              style={{
                backgroundColor: '#10b981',
                paddingHorizontal: 18,
                borderRadius: 12,
                justifyContent: 'center',
                opacity: loading || !manualCode.trim() ? 0.5 : 1,
              }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 12 }}>Verify</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Confirmation Modal */}
        <QRLoginConfirmModal
          visible={Boolean(confirmSession)}
          session={confirmSession}
          onClose={() => {
            setConfirmSession(null);
            setScanning(true);
          }}
          onSuccess={() => {
            onSuccess();
            onClose();
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  cameraContainer: { flex: 1, position: 'relative', overflow: 'hidden' },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  permissionBtn: {
    marginTop: 18,
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 14,
  },
  permissionBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: '#10b981',
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  scanHint: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 18,
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
});
