import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import AdminListRow from './AdminListRow';
import AdminScreen, { type AdminScreenState } from './AdminScreen';
import AdminSection from './AdminSection';
import AdminState from './AdminState';
import AdminStatCard from './AdminStatCard';
import AdminStatusPill from './AdminStatusPill';
import AdminToolbar from './AdminToolbar';
import { readMultiFilter, readSingleFilter, type AnyFilterGroup, type FilterValues } from '@/components/ui/FilterSheet';
import { space, type, type AdminIconName } from '@/lib/admin/adminTokens';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
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
import type { PendingApprovalQueue, PendingApprovalSection, PendingApprovalsSnapshot } from '@/lib/types/pendingApprovals';

type QueueSectionProps = { queue: PendingApprovalQueue; nowMs: number; onOpen: (route: Href) => void; onRetry: () => void };

/** Items previewed per queue when it has a review screen ("Review all" opens the rest). */
const QUEUE_PREVIEW_COUNT = 3;
const SHOW_ALL = 'all';
const SHOW_WAITING = 'waiting';

const isPendingSection = (value: string): value is PendingApprovalSection => PENDING_SECTION_ORDER.some((section) => section === value);

/** Every queue waiting for an administrator, grouped by section, with a few items each and a link to its review screen. */
export default function AdminPendingApprovalsWorkspace() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { authorization, loading: accessLoading } = usePageAccess();
  const [snapshot, setSnapshot] = useState<PendingApprovalsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // No section selected means every section.
  const [sections, setSections] = useState<PendingApprovalSection[]>([]);
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
  const inSelectedSections = (queue: PendingApprovalQueue): boolean => !sections.length || sections.includes(getPendingCategory(queue.key).section);
  const visibleQueues = filterPendingQueues(queues, 'all', hideEmpty).filter(inSelectedSections);
  const visibleTotal = totalPending(visibleQueues);
  const hasErrors = visibleQueues.some((queue) => queue.status === 'error');
  const nowMs = snapshot?.fetchedAtMs ?? Date.now();
  const subtitle = snapshot
    ? snapshot.total > 0 ? `${formatPendingCount(snapshot.total, snapshot.totalIsLowerBound)} waiting for review` : 'Nothing waiting for approval'
    : 'Everything waiting for review';

  const sectionCount = (section: PendingApprovalSection): string => {
    const totals = totalPending(filterPendingQueues(queues, section, false));
    return totals.total > 0 ? ` · ${formatPendingCount(totals.total, totals.totalIsLowerBound)}` : '';
  };

  const filterGroups: AnyFilterGroup[] = [
    { kind: 'multiple', key: 'section', label: 'Section', options: PENDING_SECTION_ORDER.map((section) => ({ value: section, label: `${PENDING_SECTION_LABELS[section]}${sectionCount(section)}` })), values: sections },
    { key: 'show', label: 'Queues', options: [{ value: SHOW_ALL, label: 'Show every queue' }, { value: SHOW_WAITING, label: 'Hide empty queues' }], value: hideEmpty ? SHOW_WAITING : SHOW_ALL, defaultValue: SHOW_ALL },
  ];
  const handleApplyFilters = (values: FilterValues) => {
    setSections(readMultiFilter(values, 'section').filter(isPendingSection));
    setHideEmpty(readSingleFilter(values, 'show') === SHOW_WAITING);
  };

  const summaryLabel = sections.length === 1
    ? `Waiting in ${PENDING_SECTION_LABELS[sections[0]]}`
    : sections.length > 1 ? `Waiting in ${sections.length} sections` : 'Waiting across all sections';

  const screenState: AdminScreenState = loading ? { kind: 'loading', variant: 'list' } : error ? { kind: 'error', message: error } : { kind: 'ready' };

  return (
    <AdminScreen
      title="Pending approvals"
      subtitle={subtitle}
      state={screenState}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      toolbar={<AdminToolbar filters={{ groups: filterGroups, onApply: handleApplyFilters, title: 'Filter approvals' }} />}
    >
      <View style={{ gap: space.md }}>
        <AdminStatCard label={summaryLabel} value={formatPendingCount(visibleTotal.total, visibleTotal.totalIsLowerBound)} icon="check-square" tone={visibleTotal.total > 0 ? 'pending' : 'neutral'} />

        {visibleTotal.total === 0 && !hasErrors ? (
          <AdminState kind="empty" icon="check-circle" title="Nothing waiting for approval" description="Pull down to check again." />
        ) : null}

        {visibleQueues.map((queue) => <QueueSection key={queue.key} queue={queue} nowMs={nowMs} onOpen={handleOpen} onRetry={handleRefresh} />)}

        {!visibleQueues.length && hideEmpty ? (
          <Text style={[type.meta, { color: colors.mutedText, textAlign: 'center' }]}>Empty queues are hidden. Change it in Filters.</Text>
        ) : null}
      </View>
    </AdminScreen>
  );
}

function QueueSection({ queue, nowMs, onOpen, onRetry }: QueueSectionProps) {
  const { colors } = useAppTheme();
  const category = getPendingCategory(queue.key);
  const reviewRoute = category.reviewRoute;
  const hasItems = queue.status === 'ready' && queue.count > 0;
  const countLabel = queue.status === 'ready' ? formatPendingCount(queue.count, queue.countIsLowerBound) : '';
  const items = queue.status === 'ready' ? (reviewRoute ? queue.items.slice(0, QUEUE_PREVIEW_COUNT) : queue.items) : [];

  return (
    <AdminSection
      title={category.label}
      description={PENDING_SECTION_LABELS[category.section]}
      action={hasItems && reviewRoute ? { label: `Review all (${countLabel})`, onPress: () => onOpen(reviewRoute) } : undefined}
    >
      {queue.status === 'error' ? <AdminState kind="inlineError" message={queue.message} onRetry={onRetry} /> : null}

      {queue.status === 'ready' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <AdminStatusPill label={queue.count > 0 ? `${countLabel} waiting` : 'Nothing waiting'} tone={queue.count > 0 ? 'pending' : 'neutral'} />
          {queue.count > items.length && items.length > 0 ? (
            <Text style={[type.meta, { color: colors.mutedText }]}>Showing {items.length} of {countLabel}</Text>
          ) : null}
        </View>
      ) : null}

      {items.map((item) => {
        const age = formatPendingAge(item.submittedAtMs, nowMs);
        const route = item.route;
        return (
          <AdminListRow
            key={item.id}
            title={item.title}
            subtitle={item.subtitle || undefined}
            meta={age || undefined}
            leading={{ kind: 'icon', name: category.icon as AdminIconName }}
            onPress={route ? () => onOpen(route) : undefined}
          />
        );
      })}

      {hasItems && !reviewRoute ? (
        <Text style={[type.meta, { color: colors.mutedText }]}>
          {queue.status === 'ready' && queue.items.some((item) => item.route) ? 'No review screen yet: open an item to review it' : 'No review screen yet'}
        </Text>
      ) : null}
    </AdminSection>
  );
}
