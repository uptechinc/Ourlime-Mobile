import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { qrLoginService } from '@/lib/services/QRLoginService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import QRScannerModal from '@/components/settings/QRScannerModal';
import CustomModal from '@/components/ui/CustomModal';
import type { ActiveDeviceSession } from '@/lib/types/qrLogin';

export default function ActiveSessionsSection() {
  const { colors } = useAppTheme();
  const [sessions, setSessions] = useState<ActiveDeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await qrLoginService.getActiveSessions();
      setSessions(data);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleRevoke = async (sessionId: string) => {
    try {
      setRevokingId(sessionId);
      const success = await qrLoginService.revokeSession(sessionId);
      if (success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setMessage('Device logged out successfully.');
      } else {
        setMessage('Could not revoke session.');
      }
    } catch {
      setMessage('Error revoking session.');
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <View
      style={{
        backgroundColor: colors.elevated,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 20,
        padding: 16,
        marginVertical: 8,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>
            📱 Devices & QR Login
          </Text>
          <Text style={{ color: colors.mutedText, fontSize: 11, marginTop: 2 }}>
            Log in to another phone or computer via QR code.
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setScannerOpen(true)}
          style={{
            backgroundColor: '#10b981',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 12,
          }}
        >
          <Ionicons name="qr-code-outline" size={16} color="#ffffff" />
          <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 11 }}>Scan QR</Text>
        </TouchableOpacity>
      </View>

      {/* Active Sessions */}
      <Text
        style={{
          color: colors.mutedText,
          fontSize: 10,
          fontWeight: '800',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Active Sessions ({sessions.length})
      </Text>

      {loading ? (
        <View style={{ paddingVertical: 14, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      ) : sessions.length === 0 ? (
        <Text style={{ color: colors.mutedText, fontSize: 12, paddingVertical: 8 }}>
          No active remote sessions recorded.
        </Text>
      ) : (
        sessions.map((item) => (
          <View
            key={item.id}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingVertical: 10,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: colors.control,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                }}
              >
                <Ionicons
                  name={item.platform === 'ios' || item.platform === 'android' ? 'phone-portrait-outline' : 'laptop-outline'}
                  size={18}
                  color={colors.icon}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>
                  {item.browser || item.platform.toUpperCase()}
                </Text>
                <Text style={{ color: colors.mutedText, fontSize: 10, marginTop: 1 }}>
                  {item.location || item.ip || 'Unknown'} • {new Date(item.lastActiveAt).toLocaleDateString()}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => void handleRevoke(item.id)}
              disabled={revokingId === item.id}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: '#fef2f2',
              }}
            >
              <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 11 }}>
                {revokingId === item.id ? '...' : 'Log Out'}
              </Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <QRScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onSuccess={() => {
          setMessage('Device authorized and logged in successfully!');
          void loadSessions();
        }}
      />

      <CustomModal
        visible={Boolean(message)}
        title="QR & Session Management"
        message={message ?? ''}
        type="info"
        onClose={() => setMessage(null)}
      />
    </View>
  );
}