import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import Icon from 'react-native-vector-icons/Feather';
import AdminWorkspaceShell from './AdminWorkspaceShell';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { pendingApprovalsService } from '@/lib/services/PendingApprovalsService';
import {
  PENDING_SECTION_LABELS,
  PENDING_SECTION_ORDER,
  filterPendingQueues,
  formatPendingAge,
  formatPendingCount,
  getPendingCategory,
  totalPending,
} from '@/lib/services/PendingApprovalsRules';
import type { PendingApprovalItem, PendingApprovalQueue, PendingApprovalSection, PendingApprovalsSnapshot } from '@/lib/types/pendingApprovals';

type SectionFilter = PendingApprovalSection | 'all';
type QueueCardProps = { queue: PendingApprovalQueue; colors: AppThemeColors; styles: WorkspaceStyles; nowMs: number; onOpen: (route: Href) => void };
type ItemRowProps = { item: PendingApprovalItem; styles: WorkspaceStyles; colors: AppThemeColors; nowMs: number; onOpen: (route: Href) => void };

const FILLED_BUTTON = '#047857';
const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

/** Every queue waiting for an administrator, grouped by section, with a few items each and a link to its review screen. */
export default function AdminPendingApprovalsWorkspace() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { authorization, loading: accessLoading } = usePageAccess();
  const [snapshot, setSnapshot] = useState<PendingApprovalsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<SectionFilter>('all');
  const [hideEmpty, setHideEmpty] = useState(false);
  const hasLoaded = useRef(false);

  const loadApprovals = useCallback(async (force: boolean) => {
    try {
      setSnapshot(await pendingApprovalsService.fetchDetails(force));
      setError(null);
      hasLoaded.current = true;
    } catch (loadError: unknown) {
      console.error(`[AdminPendingApprovalsWorkspace.loadApprovals] Error: ${loadError instanceof Error ? loadError.message : String(loadError)}`);
      setError(loadError instanceof Error ? loadError.message : 'Could not load pending approvals.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load on open, and reload (bypassing the short cache) when coming back from a review screen.
  useFocusEffect(useCallback(() => {
    if (accessLoading || !authorization.isAdmin) return;
    void loadApprovals(hasLoaded.current);
  }, [accessLoading, authorization.isAdmin, loadApprovals]));

  const handleRefresh = () => {
    setRefreshing(true);
    void loadApprovals(true);
  };

  const handleOpen = (route: Href) => router.push(route);

  const queues = snapshot?.queues ?? [];
  const visibleQueues = filterPendingQueues(queues, section, hideEmpty);
  const visibleTotal = totalPending(visibleQueues);
  const hasErrors = visibleQueues.some((queue) => queue.status === 'error');
  const nowMs = snapshot?.fetchedAtMs ?? Date.now();
  const subtitle = snapshot
    ? snapshot.total > 0 ? `${formatPendingCount(snapshot.total, snapshot.totalIsLowerBound)} waiting for review` : 'Nothing waiting for approval'
    : 'Everything waiting for review';

  const sectionCount = (value: SectionFilter): string => {
    const totals = totalPending(filterPendingQueues(queues, value, false));
    return totals.total > 0 ? formatPendingCount(totals.total, totals.totalIsLowerBound) : '';
  };

  return <AdminWorkspaceShell title="Pending approvals" subtitle={subtitle} loading={loading} refreshing={refreshing} error={error} onRefresh={handleRefresh}>
    <View style={styles.summary}>
      <View style={{ flex: 1 }}>
        <Text style={styles.summaryLabel}>{section === 'all' ? 'Waiting across all sections' : `Waiting in ${PENDING_SECTION_LABELS[section]}`}</Text>
        <Text style={styles.summaryTotal}>{formatPendingCount(visibleTotal.total, visibleTotal.totalIsLowerBound)}</Text>
      </View>
      <Icon name="check-square" size={30} color={colors.successText} />
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {(['all', ...PENDING_SECTION_ORDER] as const).map((value) => {
        const selected = section === value;
        const count = sectionCount(value);
        return <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected }} android_ripple={RIPPLE} onPress={() => setSection(value)} style={[styles.filter, selected ? styles.filterSelected : null]}>
          <Text style={[styles.filterText, selected ? styles.filterTextSelected : null]}>{value === 'all' ? 'All' : PENDING_SECTION_LABELS[value]}{count ? ` · ${count}` : ''}</Text>
        </Pressable>;
      })}
    </ScrollView>

    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>Hide empty</Text>
      <Switch accessibilityLabel="Hide queues with nothing waiting" value={hideEmpty} onValueChange={setHideEmpty} trackColor={{ false: colors.disabled, true: '#10b981' }} />
    </View>

    {visibleTotal.total === 0 && !hasErrors ? <View style={styles.emptyState}>
      <Icon name="check-circle" size={34} color={colors.successText} />
      <Text style={styles.emptyTitle}>Nothing waiting for approval</Text>
      <Text style={styles.emptyText}>Pull down to check again.</Text>
    </View> : null}

    {visibleQueues.map((queue) => <QueueCard key={queue.key} queue={queue} colors={colors} styles={styles} nowMs={nowMs} onOpen={handleOpen} />)}
  </AdminWorkspaceShell>;
}

function QueueCard({ queue, colors, styles, nowMs, onOpen }: QueueCardProps) {
  const category = getPendingCategory(queue.key);
  const reviewRoute = category.reviewRoute;
  const hasItems = queue.status === 'ready' && queue.count > 0;
  return <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={styles.cardIcon}><Icon name={category.icon} size={18} color={colors.successText} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{category.label}</Text>
        <Text style={styles.cardSection}>{PENDING_SECTION_LABELS[category.section]}</Text>
      </View>
      {queue.status === 'ready'
        ? <Text style={[styles.countBadge, queue.count > 0 ? styles.countBadgeActive : null]}>{formatPendingCount(queue.count, queue.countIsLowerBound)}</Text>
        : null}
    </View>

    {queue.status === 'error' ? <View style={styles.errorRow}>
      <Icon name="alert-triangle" size={15} color={colors.destructiveText} />
      <Text style={styles.errorText}>{queue.message}</Text>
    </View> : null}

    {queue.status === 'ready' && queue.count === 0 ? <Text style={styles.nothing}>Nothing waiting</Text> : null}

    {queue.status === 'ready' && queue.items.map((item) => <ItemRow key={item.id} item={item} styles={styles} colors={colors} nowMs={nowMs} onOpen={onOpen} />)}

    {queue.status === 'ready' && queue.count > queue.items.length && queue.items.length > 0
      ? <Text style={styles.more}>Showing {queue.items.length} of {formatPendingCount(queue.count, queue.countIsLowerBound)}</Text>
      : null}

    {hasItems && reviewRoute ? <Pressable accessibilityRole="button" accessibilityLabel={`Review all ${category.label}`} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} onPress={() => onOpen(reviewRoute)} style={styles.reviewButton}>
      <Text style={styles.reviewButtonText}>Review all</Text>
      <Icon name="arrow-right" size={16} color="#ffffff" />
    </Pressable> : null}
    {hasItems && !reviewRoute ? <Text style={styles.noScreen}>
      {queue.status === 'ready' && queue.items.some((item) => item.route) ? 'No review screen yet: open an item to review it' : 'No review screen yet'}
    </Text> : null}
  </View>;
}

function ItemRow({ item, styles, colors, nowMs, onOpen }: ItemRowProps) {
  const age = formatPendingAge(item.submittedAtMs, nowMs);
  const content = <>
    <View style={{ flex: 1 }}>
      <Text numberOfLines={1} style={styles.itemTitle}>{item.title}</Text>
      {item.subtitle ? <Text numberOfLines={1} style={styles.itemSubtitle}>{item.subtitle}</Text> : null}
    </View>
    {age ? <Text style={styles.itemAge}>{age}</Text> : null}
    {item.route ? <Icon name="chevron-right" size={16} color={colors.mutedText} /> : null}
  </>;
  const route = item.route;
  if (!route) return <View style={styles.itemRow}>{content}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${item.title}${age ? `, ${age}` : ''}`} android_ripple={RIPPLE} onPress={() => onOpen(route)} style={styles.itemRow}>{content}</Pressable>;
}

type WorkspaceStyles = ReturnType<typeof createStyles>;

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  summaryLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  summaryTotal: { marginTop: 2, color: colors.text, fontSize: 30, fontWeight: '900' },
  filters: { gap: 8, paddingBottom: 10 },
  filter: { minHeight: 36, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  filterSelected: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  filterText: { color: colors.mutedText, fontSize: 13, fontWeight: '700' },
  filterTextSelected: { color: colors.successText },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginBottom: 8 },
  toggleLabel: { color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
  emptyState: { alignItems: 'center', gap: 6, marginBottom: 12, paddingVertical: 28, paddingHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emptyTitle: { marginTop: 6, color: colors.text, fontSize: 16, fontWeight: '900' },
  emptyText: { color: colors.mutedText, fontSize: 13 },
  card: { marginBottom: 12, padding: 14, gap: 4, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  cardIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  cardSection: { marginTop: 1, color: colors.mutedText, fontSize: 11, fontWeight: '700' },
  countBadge: { minWidth: 30, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', textAlign: 'center', fontSize: 12, fontWeight: '900', color: colors.mutedText, backgroundColor: colors.control },
  countBadgeActive: { color: '#ffffff', backgroundColor: FILLED_BUTTON },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  errorText: { color: colors.destructiveText, fontSize: 13, fontWeight: '700' },
  nothing: { paddingVertical: 4, color: colors.mutedText, fontSize: 13 },
  itemRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  itemTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  itemSubtitle: { marginTop: 2, color: colors.mutedText, fontSize: 12 },
  itemAge: { color: colors.mutedText, fontSize: 11, fontWeight: '700' },
  more: { paddingTop: 6, color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  reviewButton: { minHeight: 44, marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, backgroundColor: FILLED_BUTTON, overflow: 'hidden' },
  reviewButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  noScreen: { marginTop: 6, color: colors.mutedText, fontSize: 12, fontStyle: 'italic' },
});
