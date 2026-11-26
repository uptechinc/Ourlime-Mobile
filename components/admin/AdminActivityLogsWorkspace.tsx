import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { toast } from 'sonner-native';
import AdminDialog from '@/components/admin/AdminDialog';
import { ADMIN_DATE_RANGE_LABELS, resolveAdminDateRange, type AdminDateRange, type AdminDateRangePreset } from '@/components/admin/AdminFilterSheet';
import AdminListRow from '@/components/admin/AdminListRow';
import AdminScreen, { type AdminScreenState } from '@/components/admin/AdminScreen';
import AdminState from '@/components/admin/AdminState';
import AdminToolbar from '@/components/admin/AdminToolbar';
import MobileAdminExportModal from '@/components/admin/MobileAdminExportModal';
import { readMultiFilter, type FilterValues, type MultiFilterGroup } from '@/components/ui/FilterSheet';
import { getAdminTone, radius, space, type, type AdminToneName } from '@/lib/admin/adminTokens';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { adminWorkspaceService } from '@/lib/services/AdminWorkspaceService';
import type { MobileExportColumn } from '@/lib/services/MobileExportService';

const MOBILE_LOG_COLUMNS: MobileExportColumn[] = [
  {
    header: 'Timestamp',
    key: 'timestamp',
    format: (v) => (v ? new Date(v as string).toLocaleString() : ''),
  },
  { header: 'Actor', key: 'username' },
  { header: 'Action', key: 'action' },
  { header: 'Resource', key: 'resource' },
  { header: 'Resource Name', key: 'resourceName' },
  {
    header: 'Location',
    key: 'location',
    format: (v, row) => {
      const ip = row.ipAddress as string;
      const isLocal = !ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost';
      if (isLocal) return 'Localhost';
      return (v as string) || 'Unknown';
    },
  },
  {
    header: 'IP Address',
    key: 'ipAddress',
    format: (v) => {
      const ip = v as string;
      if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return '127.0.0.1';
      return ip;
    },
  },
  { header: 'Details', key: 'details' },
];

const ACTION_OPTIONS = ['create', 'update', 'delete', 'restore', 'login_success', 'login_failed'] as const;
const DATE_PRESETS: AdminDateRangePreset[] = ['all', 'today', '24h', '7d', '30d', 'this_month'];

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

type LoadMode = 'initial' | 'refresh' | 'silent';

const SEARCH_DEBOUNCE_MS = 350;

const readText = (value: unknown): string => (typeof value === 'string' ? value : '');
const readRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

/** The API returns loosely typed rows; missing fields must not crash the list (e.g. `action.replace`). */
function toActivityLogItem(raw: Record<string, unknown>, index: number): ActivityLogItem {
  const changes = Array.isArray(raw.changes)
    ? raw.changes.flatMap((change): NonNullable<ActivityLogItem['changes']> => {
      const record = readRecord(change);
      return record && readText(record.field) ? [{ field: readText(record.field), oldValue: record.oldValue, newValue: record.newValue }] : [];
    })
    : undefined;
  return {
    id: readText(raw.id) || `log-${index}`,
    timestamp: readText(raw.timestamp),
    userId: readText(raw.userId) || undefined,
    username: readText(raw.username) || undefined,
    action: readText(raw.action) || 'unknown',
    resource: readText(raw.resource) || 'item',
    resourceName: readText(raw.resourceName) || undefined,
    details: readText(raw.details),
    ipAddress: readText(raw.ipAddress) || undefined,
    location: readText(raw.location) || undefined,
    platform: readText(raw.platform) || undefined,
    changes,
    previousData: readRecord(raw.previousData),
    newData: readRecord(raw.newData),
  };
}

function formatLogTime(timestamp: string): string {
  const time = new Date(timestamp);
  return Number.isNaN(time.getTime()) ? 'Unknown time' : time.toLocaleString();
}

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

const formatActionLabel = (action: string): string => action.replace(/_/g, ' ');

/** Delete and ban-like actions read as danger, approvals and restores as positive, role changes as pending. */
function getActionTone(action: string): AdminToneName {
  switch (action) {
    case 'create':
    case 'restore':
    case 'approve':
    case 'login_success':
      return 'positive';
    case 'delete':
    case 'ban':
    case 'login_failed':
    case 'status_change':
      return 'danger';
    case 'role_change':
      return 'pending';
    default:
      return 'neutral';
  }
}

export default function AdminActivityLogsWorkspace() {
  const { colors } = useAppTheme();
  const positive = getAdminTone(colors, 'positive');
  const danger = getAdminTone(colors, 'danger');
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [dateRange, setDateRange] = useState<AdminDateRange>({ preset: 'all' });
  const [restoreTarget, setRestoreTarget] = useState<ActivityLogItem | null>(null);
  const hasLoadedRef = useRef(false);
  const requestIdRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<ActivityLogItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportModalVisible, setExportModalVisible] = useState(false);

  // One selected action is filtered on the server; several are fetched together and filtered here.
  const serverAction = selectedActions.length === 1 ? selectedActions[0] : 'all';

  // Only the first load shows the skeleton. Search, filter and focus reloads keep the toolbar mounted
  // (the search box keeps focus and the keyboard stays open) and show an inline spinner instead.
  const load = useCallback(
    async (mode: LoadMode) => {
      const requestId = ++requestIdRef.current;
      if (mode === 'initial') setLoading(true);
      else if (mode === 'refresh') setRefreshing(true);
      else setListLoading(true);
      setError(null);
      try {
        const rawLogs = await adminWorkspaceService.fetchActivityLogs(debouncedQuery, serverAction, 'all');
        if (requestId !== requestIdRef.current) return;
        setLogs(rawLogs.map(toActivityLogItem));
        hasLoadedRef.current = true;
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        console.error('[AdminActivityLogsWorkspace.load] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load activity logs');
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
          setListLoading(false);
        }
      }
    },
    [debouncedQuery, serverAction]
  );

  useFocusEffect(
    useCallback(() => {
      void load(hasLoadedRef.current ? 'silent' : 'initial');
    }, [load])
  );

  const handleConfirmRestore = async () => {
    const log = restoreTarget;
    if (!log || restoringId) return;
    setRestoringId(log.id);
    try {
      await adminWorkspaceService.restoreActivityLog(log.id);
      setRestoreTarget(null);
      toast.success(`Restored ${log.resourceName || log.resource}.`);
      await load('silent');
    } catch (err) {
      console.error('[AdminActivityLogsWorkspace.handleConfirmRestore] Error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to restore');
    } finally {
      setRestoringId(null);
    }
  };

  const { startDate, endDate } = resolveAdminDateRange(dateRange);
  const filteredLogs = logs.filter((log: ActivityLogItem) => {
    if (selectedActions.length > 1 && !selectedActions.includes(log.action)) return false;
    if (!startDate && !endDate) return true;
    const logMs = new Date(log.timestamp).getTime();
    const startMs = startDate ? startDate.getTime() : 0;
    const endMs = endDate ? endDate.getTime() : Infinity;
    return logMs >= startMs && logMs <= endMs;
  });

  const actionGroup: MultiFilterGroup = {
    kind: 'multiple',
    key: 'action',
    label: 'Action type',
    options: ACTION_OPTIONS.map((action) => ({ value: action, label: formatActionLabel(action).replace(/^\w/, (letter) => letter.toUpperCase()) })),
    values: selectedActions,
  };

  const isFiltered = Boolean(debouncedQuery) || selectedActions.length > 0 || dateRange.preset !== 'all';

  const handleApplyFilters = (values: FilterValues) => {
    setSelectedActions(readMultiFilter(values, 'action'));
  };

  const handleClearFilters = () => {
    setSelectedActions([]);
    setDateRange({ preset: 'all' });
    setDebouncedQuery('');
  };

  const screenState: AdminScreenState = loading
    ? { kind: 'loading', variant: 'list' }
    : error && logs.length === 0
      ? { kind: 'error', message: error }
      : filteredLogs.length === 0
        ? isFiltered
          ? { kind: 'empty', title: 'No activity logs match these filters.', filtered: true, onClearFilters: handleClearFilters }
          : { kind: 'empty', title: 'No activity logs recorded yet.', icon: 'clock' }
        : { kind: 'ready' };

  return (
    <>
      <AdminScreen
        title="Activity logs"
        subtitle="Cross-platform audit trail of admin actions"
        state={screenState}
        onRefresh={() => load('refresh')}
        refreshing={refreshing}
        overflowActions={[{ key: 'export', label: 'Export', icon: 'download', description: `${filteredLogs.length} records · ${ADMIN_DATE_RANGE_LABELS[dateRange.preset]}`, onPress: () => setExportModalVisible(true) }]}
        toolbar={
          <AdminToolbar
            search={{ value: debouncedQuery, placeholder: 'Search by actor or keyword', onChange: (next) => setDebouncedQuery(next.trim()), debounceMs: SEARCH_DEBOUNCE_MS, loading: listLoading }}
            filters={{
              title: 'Filter activity',
              groups: [actionGroup],
              onApply: handleApplyFilters,
              dateRange: { value: dateRange, onChange: setDateRange, presets: DATE_PRESETS },
            }}
            resultSummary={logs.length ? `${filteredLogs.length} of ${logs.length} entries` : undefined}
          />
        }
      >
        <View style={{ gap: space.sm }}>
          {error ? <AdminState kind="inlineError" message={error} onRetry={() => void load('silent')} retrying={listLoading} /> : null}
          {filteredLogs.map((log) => {
            const canRestore = log.action === 'delete' && Boolean(log.previousData);
            const meta = [formatLogTime(log.timestamp), log.resource, formatLocationAndIp(log.location, log.ipAddress), log.platform?.toUpperCase()].filter(Boolean).join(' · ');
            return (
              <AdminListRow
                key={log.id}
                title={log.username || 'System actor'}
                leading={log.userId ? { kind: 'avatar', name: log.username || 'Member', userId: log.userId } : { kind: 'icon', name: 'cpu' }}
                subtitle={log.details || undefined}
                meta={meta}
                status={{ label: formatActionLabel(log.action), tone: getActionTone(log.action) }}
                onPress={() => setSelectedLog(log)}
                accessibilityHint="Opens the change details"
                inlineAction={{ key: 'inspect', label: 'Inspect', icon: 'file-text', tone: 'neutral', onPress: () => setSelectedLog(log) }}
                overflowActions={canRestore
                  ? [{ key: 'restore', label: restoringId === log.id ? 'Restoring…' : 'Restore', icon: 'rotate-ccw', disabled: Boolean(restoringId), description: 'Restores the item from its saved snapshot', onPress: () => setRestoreTarget(log) }]
                  : undefined}
              />
            );
          })}
        </View>
      </AdminScreen>

      {/* Dialogs and the export sheet live outside the screen body so they also work in the empty and error states. */}
      <AdminDialog
        visible={Boolean(selectedLog)}
        title="Activity details"
        description={selectedLog?.details || undefined}
        icon="file-text"
        onClose={() => setSelectedLog(null)}
      >
        {selectedLog ? (
          <View style={{ gap: space.md }}>
            <Text style={[type.meta, { color: colors.mutedText }]}>
              {formatLogTime(selectedLog.timestamp)} · {selectedLog.username || 'System actor'} · {selectedLog.resourceName || selectedLog.resource}
            </Text>
            {selectedLog.changes && selectedLog.changes.length > 0 ? (
              <View style={{ gap: space.sm }}>
                <Text style={[type.label, { color: colors.mutedText }]}>Changes</Text>
                {selectedLog.changes.map((change, changeIndex) => (
                  <View key={`${change.field}-${changeIndex}`} style={{ gap: space.xs, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas }}>
                    <Text style={[type.bodyStrong, { color: colors.text }]}>{change.field}</Text>
                    <Text selectable style={[type.meta, { color: danger.text }]}>- {JSON.stringify(change.oldValue)}</Text>
                    <Text selectable style={[type.meta, { color: positive.text }]}>+ {JSON.stringify(change.newValue)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {selectedLog.previousData ? (
              <View style={{ gap: space.sm }}>
                <Text style={[type.label, { color: colors.mutedText }]}>Previous snapshot</Text>
                <View style={{ padding: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas }}>
                  <Text selectable style={[type.meta, { fontFamily: 'monospace', color: colors.text }]}>
                    {JSON.stringify(selectedLog.previousData, null, 2)}
                  </Text>
                </View>
              </View>
            ) : null}
            {!selectedLog.changes?.length && !selectedLog.previousData ? (
              <Text style={[type.body, { color: colors.mutedText }]}>No field changes or snapshot were recorded for this entry.</Text>
            ) : null}
          </View>
        ) : null}
      </AdminDialog>

      <AdminDialog
        visible={Boolean(restoreTarget)}
        title="Restore deleted item?"
        description={restoreTarget ? `This restores the ${restoreTarget.resourceName || restoreTarget.resource} from its saved snapshot.` : undefined}
        confirmLabel="Restore"
        tone="pending"
        icon="rotate-ccw"
        stage={restoringId ? 'busy' : 'idle'}
        busyTitle="Restoring…"
        busyMessage="Please wait while the item is restored."
        onConfirm={() => void handleConfirmRestore()}
        onClose={() => setRestoreTarget(null)}
      />

      <MobileAdminExportModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        filename="activity-logs"
        title="Activity Logs Audit Report"
        columns={MOBILE_LOG_COLUMNS}
        data={filteredLogs as unknown as Record<string, unknown>[]}
        periodLabel={ADMIN_DATE_RANGE_LABELS[dateRange.preset]}
        sheetName="Activity Logs"
      />
    </>
  );
}
