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

function getDeviceIcon(platform?: string, deviceType?: string): keyof typeof Ionicons.glyphMap {
  if (deviceType === 'tablet' || platform === 'ipad') return 'tablet-portrait-outline';
  if (platform === 'ios' || platform === 'android' || deviceType === 'mobile') return 'phone-portrait-outline';
  if (platform === 'desktop' || deviceType === 'desktop') return 'laptop-outline';
  return 'globe-outline';
}

function formatRelativeTime(isoDateString: string): string {
  try {
    const date = new Date(isoDateString);
    const now = Date.now();
    const diffSeconds = Math.floor((now - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Recently';
  }
}

export default function ActiveSessionsSection() {
  const { colors } = useAppTheme();
  const [sessions, setSessions] = useState<ActiveDeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
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
        setMessage('Device session logged out successfully.');
      } else {
        setMessage('Could not revoke session.');
      }
    } catch {
      setMessage('Error revoking session.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOther = async () => {
    try {
      setRevokingAll(true);
      setConfirmRevokeAll(false);
      const result = await qrLoginService.revokeAllOtherSessions();
      if (result.success) {
        setSessions((prev) => prev.filter((s) => s.isCurrentSession));
        setMessage(`Logged out ${result.revokedCount ?? 'all other'} device session(s).`);
      } else {
        setMessage('Could not revoke other sessions.');
      }
    } catch {
      setMessage('Error revoking other sessions.');
    } finally {
      setRevokingAll(false);
    }
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrentSession).length;

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
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          gap: 10,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14 }}>
            📱 Devices & QR Login
          </Text>
          <Text style={{ color: colors.mutedText, fontSize: 11, marginTop: 2, lineHeight: 15 }}>
            Manage all active devices and log in securely via QR code.
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
            flexShrink: 0,
          }}
        >
          <Ionicons name="qr-code-outline" size={16} color="#ffffff" />
          <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 11 }}>Scan QR</Text>
        </TouchableOpacity>
      </View>

      {/* Header & Bulk Revoke */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            color: colors.mutedText,
            fontSize: 10,
            fontWeight: '800',
            textTransform: 'uppercase',
          }}
        >
          Active Sessions ({sessions.length})
        </Text>

        {otherSessionsCount > 0 && (
          <TouchableOpacity
            onPress={() => setConfirmRevokeAll(true)}
            disabled={revokingAll}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: colors.destructiveSurface,
            }}
          >
            <Text style={{ color: colors.destructiveText, fontSize: 10, fontWeight: '700' }}>
              {revokingAll ? 'Logging Out...' : 'Log Out Others'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={{ paddingVertical: 14, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      ) : sessions.length === 0 ? (
        <Text style={{ color: colors.mutedText, fontSize: 12, paddingVertical: 8 }}>
          No active sessions recorded.
        </Text>
      ) : (
        sessions.map((item) => {
          const deviceLabel = item.deviceName || item.browser || item.platform.toUpperCase();
          const locationLabel = item.location && item.location !== 'Unknown' ? item.location : null;
          const ipLabel = item.ip && item.ip !== 'Unknown' ? item.ip : null;

          return (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 10,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: item.isCurrentSession ? 'rgba(16, 185, 129, 0.12)' : colors.control,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 10,
                    flexShrink: 0,
                  }}
                >
                  <Ionicons
                    name={getDeviceIcon(item.platform, item.deviceType)}
                    size={18}
                    color={item.isCurrentSession ? '#10b981' : colors.icon}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }} numberOfLines={1}>
                      {deviceLabel}
                    </Text>
                    {item.isCurrentSession && (
                      <View
                        style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          paddingHorizontal: 5,
                          paddingVertical: 1,
                          borderRadius: 4,
                        }}
                      >
                        <Text style={{ color: '#10b981', fontSize: 9, fontWeight: '800' }}>THIS DEVICE</Text>
                      </View>
                    )}
                    {item.loginMethod === 'qr_code' && (
                      <View
                        style={{
                          backgroundColor: 'rgba(99, 102, 241, 0.15)',
                          paddingHorizontal: 5,
                          paddingVertical: 1,
                          borderRadius: 4,
                        }}
                      >
                        <Text style={{ color: '#818cf8', fontSize: 9, fontWeight: '800' }}>QR LOGIN</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: colors.mutedText, fontSize: 10, marginTop: 2 }} numberOfLines={1}>
                    {locationLabel ? `${locationLabel} • ` : ''}
                    {ipLabel ? `${ipLabel} • ` : ''}
                    {formatRelativeTime(item.lastActiveAt)}
                  </Text>
                </View>
              </View>

              {!item.isCurrentSession && (
                <TouchableOpacity
                  onPress={() => void handleRevoke(item.id)}
                  disabled={revokingId === item.id}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: colors.destructiveSurface,
                    flexShrink: 0,
                  }}
                >
                  <Text style={{ color: colors.destructiveText, fontWeight: '700', fontSize: 11 }}>
                    {revokingId === item.id ? '...' : 'Log Out'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
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
        visible={confirmRevokeAll}
        title="Log Out All Other Devices?"
        message="This will sign out your account from all other browsers, mobile devices, and computers immediately."
        type="warning"
        confirmText="Log Out All"
        cancelText="Cancel"
        onConfirm={() => void handleRevokeAllOther()}
        onClose={() => setConfirmRevokeAll(false)}
      />

      <CustomModal
        visible={Boolean(message)}
        title="Session Management"
        message={message ?? ''}
        type="info"
        onClose={() => setMessage(null)}
      />
    </View>
  );
}