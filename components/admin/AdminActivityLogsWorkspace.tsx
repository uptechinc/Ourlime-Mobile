import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import AdminWorkspaceShell from './AdminWorkspaceShell';
import { adminWorkspaceService } from '@/lib/services/AdminWorkspaceService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const ACTION_FILTERS = [
  'all',
  'create',
  'update',
  'delete',
  'restore',
  'login_success',
  'login_failed',
] as const;

type ActivityLogItem = {
  id: string;
  timestamp: string;
  userId?: string;
  username?: string;
  action: string;
  resource: string;
  resourceName?: string;
  details: string;
  ipAddress?: string;
  location?: string;
  platform?: string;
  changes?: { field: string; oldValue?: unknown; newValue?: unknown }[];
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
};

function formatLocationAndIp(location?: string, ipAddress?: string): string {
  const isLocal =
    !ipAddress ||
    ipAddress === '::1' ||
    ipAddress === '127.0.0.1' ||
    ipAddress === '::ffff:127.0.0.1' ||
    ipAddress === 'localhost';

  if (isLocal) {
    return 'Localhost (127.0.0.1)';
  }
  if (location && ipAddress) {
    return `${location} • ${ipAddress}`;
  }
  return location || ipAddress || 'Unknown';
}

export default function AdminActivityLogsWorkspace() {
  const { colors } = useAppTheme();
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<ActivityLogItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const rawLogs = await adminWorkspaceService.fetchActivityLogs(
          query,
          selectedAction,
          'all'
        );
        setLogs(rawLogs as unknown as ActivityLogItem[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activity logs');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [query, selectedAction]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const handleRestore = (log: ActivityLogItem) => {
    Alert.alert(
      'Restore Deleted Item',
      `Are you sure you want to restore this ${log.resource}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'default',
          onPress: async () => {
            setRestoringId(log.id);
            try {
              await adminWorkspaceService.restoreActivityLog(log.id);
              Alert.alert('Success', `Successfully restored ${log.resource}.`);
              await load(true);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to restore');
            } finally {
              setRestoringId(null);
            }
          },
        },
      ]
    );
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
      case 'restore':
      case 'login_success':
        return '#16a34a';
      case 'delete':
      case 'login_failed':
      case 'status_change':
        return '#dc2626';
      case 'update':
        return '#2563eb';
      case 'role_change':
        return '#d97706';
      default:
        return '#64748b';
    }
  };

  return (
    <AdminWorkspaceShell
      title="Activity Logs & Audit"
      subtitle="Immutable cross-platform audit trail of all actions and modifications"
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => void load(true)}
    >
      <View style={{ gap: 12, paddingBottom: 24 }}>
        {/* Search Input */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 12,
            minHeight: 44,
          }}
        >
          <Icon name="search" size={16} color={colors.mutedText} style={{ marginRight: 8 }} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by actor or keyword..."
            placeholderTextColor={colors.mutedText}
            style={{ flex: 1, color: colors.text, fontSize: 13 }}
          />
        </View>

        {/* Action Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {ACTION_FILTERS.map((action) => {
            const active = selectedAction === action;
            return (
              <TouchableOpacity
                key={action}
                onPress={() => setSelectedAction(action)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: active ? colors.accent : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.accent : colors.border,
                }}
              >
                <Text
                  style={{
                    color: active ? '#ffffff' : colors.text,
                    fontSize: 11,
                    fontWeight: '600',
                    textTransform: 'uppercase',
                  }}
                >
                  {action.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Log Entries List */}
        {logs.length === 0 && !loading ? (
          <View
            style={{
              padding: 32,
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Icon name="clock" size={28} color={colors.mutedText} style={{ marginBottom: 8 }} />
            <Text style={{ color: colors.mutedText, fontSize: 13 }}>No activity logs recorded yet.</Text>
          </View>
        ) : (
          logs.map((log) => {
            const isDelete = log.action === 'delete';
            const actionColor = getActionColor(log.action);
            const isRestoringThis = restoringId === log.id;

            return (
              <View
                key={log.id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 14,
                  gap: 8,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 11, color: colors.mutedText, fontFamily: 'monospace' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                      backgroundColor: `${actionColor}20`,
                      borderWidth: 1,
                      borderColor: `${actionColor}40`,
                    }}
                  >
                    <Text
                      style={{
                        color: actionColor,
                        fontSize: 10,
                        fontWeight: '700',
                        textTransform: 'uppercase',
                      }}
                    >
                      {log.action.replace('_', ' ')}
                    </Text>
                  </View>
                </View>

                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                    {log.username || 'System Actor'}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.mutedText, marginTop: 2 }}>{log.details}</Text>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 8,
                    paddingTop: 6,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <Text style={{ fontSize: 11, color: colors.mutedText }}>
                    Resource: <Text style={{ fontWeight: '600', color: colors.text }}>{log.resource}</Text>
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.mutedText }}>
                    • {formatLocationAndIp(log.location, log.ipAddress)}
                  </Text>
                  {Boolean(log.platform) && (
                    <Text style={{ fontSize: 11, color: colors.mutedText, textTransform: 'uppercase' }}>
                      • {log.platform}
                    </Text>
                  )}
                </View>

                {/* Actions */}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                  {isDelete && Boolean(log.previousData) && (
                    <TouchableOpacity
                      onPress={() => handleRestore(log)}
                      disabled={isRestoringThis}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: '#16a34a20',
                        borderWidth: 1,
                        borderColor: '#16a34a50',
                      }}
                    >
                      <Icon name="rotate-ccw" size={12} color="#16a34a" />
                      <Text style={{ color: '#16a34a', fontSize: 11, fontWeight: '700' }}>
                        {isRestoringThis ? 'Restoring...' : 'Restore'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => setSelectedLog(log)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: colors.canvas,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Icon name="file-text" size={12} color={colors.text} />
                    <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }}>Inspect Diff</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Diff / Snapshot Modal */}
      {selectedLog && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setSelectedLog(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                maxHeight: '80%',
                padding: 18,
                gap: 12,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Activity Details & Diff</Text>
                <TouchableOpacity onPress={() => setSelectedLog(null)}>
                  <Icon name="x" size={20} color={colors.mutedText} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ gap: 10 }}>
                <Text style={{ fontSize: 12, color: colors.mutedText }}>{selectedLog.details}</Text>

                {selectedLog.changes && selectedLog.changes.length > 0 && (
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Changes</Text>
                    {selectedLog.changes.map((c, i) => (
                      <View key={i} style={{ padding: 8, borderRadius: 8, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent }}>{c.field}</Text>
                        <Text style={{ fontSize: 10, color: '#dc2626' }}>- {JSON.stringify(c.oldValue)}</Text>
                        <Text style={{ fontSize: 10, color: '#16a34a' }}>+ {JSON.stringify(c.newValue)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {selectedLog.previousData && (
                  <View style={{ gap: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>Previous Snapshot</Text>
                    <View style={{ padding: 10, borderRadius: 8, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ fontFamily: 'monospace', fontSize: 10, color: colors.text }}>
                        {JSON.stringify(selectedLog.previousData, null, 2)}
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </AdminWorkspaceShell>
  );
}
