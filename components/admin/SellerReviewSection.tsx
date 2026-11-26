import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { toast } from 'sonner-native';
import AdminButton from '@/components/admin/AdminButton';
import AdminDialog from '@/components/admin/AdminDialog';
import AdminListRow from '@/components/admin/AdminListRow';
import AdminOverflowMenu from '@/components/admin/AdminOverflowMenu';
import { AdminReasonField } from '@/components/admin/AdminReviewCard';
import AdminScreen, { type AdminScreenState } from '@/components/admin/AdminScreen';
import AdminSection from '@/components/admin/AdminSection';
import AdminState from '@/components/admin/AdminState';
import AdminStatusPill from '@/components/admin/AdminStatusPill';
import AdminToolbar from '@/components/admin/AdminToolbar';
import { readSingleFilter, type FilterGroup, type FilterValues } from '@/components/ui/FilterSheet';
import { space, type, type AdminIconName, type AdminToneName } from '@/lib/admin/adminTokens';
import type { AdminOverflowItem } from '@/lib/admin/adminTypes';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { sellerVerificationService } from '@/lib/services/SellerVerificationService';
import type { SellerApplication, SellerFileKind, SellerReviewDecision } from '@/lib/types/reliability';

type QueueStatus = SellerApplication['status'];
type DecisionStatus = SellerReviewDecision['status'];

const QUEUE_STATUSES = ['submitted', 'approved', 'changes_requested', 'rejected', 'suspended'] as const;

const STATUS_LABELS: { [status in QueueStatus]: string } = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

const STATUS_TONES: { [status in QueueStatus]: AdminToneName } = {
  draft: 'neutral',
  submitted: 'pending',
  approved: 'positive',
  changes_requested: 'pending',
  rejected: 'danger',
  suspended: 'danger',
};

const FILE_KIND_LABELS: { [kind in SellerFileKind]: string } = {
  governmentId: 'Government ID',
  proofOfAddress: 'Proof of address',
  businessRegistration: 'Business registration',
  logo: 'Logo',
};

const DECISION_COPY: { [status in DecisionStatus]: { label: string; title: string; description: string; tone: 'positive' | 'pending' | 'danger'; icon: AdminIconName } } = {
  approved: { label: 'Approve', title: 'Approve this seller?', description: 'The store is verified and can sell on the market.', tone: 'positive', icon: 'check' },
  changes_requested: { label: 'Request changes', title: 'Request changes?', description: 'The applicant is asked to update and resubmit the application.', tone: 'pending', icon: 'edit-3' },
  rejected: { label: 'Reject', title: 'Reject this application?', description: 'The application is declined. The reason is kept in the decision history.', tone: 'danger', icon: 'x' },
  suspended: { label: 'Suspend', title: 'Suspend this seller?', description: 'The seller loses verified status until approved again.', tone: 'danger', icon: 'slash' },
};

const isQueueStatus = (value: string | undefined): value is (typeof QUEUE_STATUSES)[number] => QUEUE_STATUSES.some((status) => status === value);

const formatDecidedAt = (value: string): string => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : value;
};

/** Decisions the reviewer may take on an application in its current status. */
const availableDecisions = (status: QueueStatus): DecisionStatus[] => {
  if (status === 'approved') return ['suspended'];
  if (status === 'submitted') return ['approved', 'changes_requested', 'rejected'];
  return [];
};

/** Seller verification review: its own /admin/seller-review screen (the queue, then one application at a time). */
export default function SellerReviewSection() {
  const { authorization, profile } = usePageAccess();
  const { colors } = useAppTheme();
  const [queue, setQueue] = useState<SellerApplication[]>([]);
  const [selected, setSelected] = useState<SellerApplication | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ownerId = profile?.uid ?? '';
  const [filter, setFilter] = useState<QueueStatus>('submitted');
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<SellerReviewDecision[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<DecisionStatus | null>(null);
  const busyRef = useRef(false);
  const generation = useRef(0);

  const refresh = useCallback(async (nextCursor: string | null = null) => {
    if (!authorization.isAdmin || !ownerId) return;
    const current = ++generation.current;
    setLoading(true);
    try {
      const result = await sellerVerificationService.queue(ownerId, filter, nextCursor);
      if (current !== generation.current) return;
      setQueue((previous) => (nextCursor ? [...previous, ...result.applications] : result.applications));
      setCursor(result.cursor);
      setError('');
    } catch (failure: unknown) {
      if (current !== generation.current) return;
      console.error('[SellerReviewSection.refresh] Error:', failure instanceof Error ? failure.message : failure);
      setError(failure instanceof Error ? failure.message : 'Review queue unavailable.');
    } finally {
      if (current === generation.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [authorization.isAdmin, ownerId, filter]);

  useEffect(() => {
    const requests = generation;
    setSelected(null);
    setQueue([]);
    void refresh();
    return () => { ++requests.current; };
  }, [refresh]);

  const loadHistory = useCallback(async (sellerId: string, nextCursor: string | null, isActive: () => boolean) => {
    setHistoryLoading(true);
    try {
      const result = await sellerVerificationService.history(ownerId, sellerId, nextCursor);
      if (!isActive()) return;
      setHistory((previous) => (nextCursor ? [...previous, ...result.decisions] : result.decisions));
      setHistoryCursor(result.cursor);
    } catch (failure: unknown) {
      if (!isActive()) return;
      console.error('[SellerReviewSection.loadHistory] Error:', failure instanceof Error ? failure.message : failure);
      setError(nextCursor ? 'History could not be loaded. Retry.' : 'Review history could not be loaded. Reopen the application to retry.');
    } finally {
      if (isActive()) setHistoryLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    let active = true;
    setHistory([]);
    setHistoryCursor(null);
    if (selected) void loadHistory(selected.ownerId, null, () => active);
    return () => { active = false; };
  }, [loadHistory, selected]);

  const handleOpenApplication = (application: SellerApplication) => {
    setSelected(application);
    setReason('');
    setError('');
  };

  const handleOpenDecision = (status: DecisionStatus) => {
    setPendingDecision(status);
    setDecisionError(null);
  };

  const decide = async () => {
    const status = pendingDecision;
    if (!selected || !status || busyRef.current) return;
    if (!reason.trim()) {
      setDecisionError('Enter the reason for this decision first.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setDecisionError(null);
    try {
      await sellerVerificationService.review(ownerId, selected, status, reason);
      toast.success(`${selected.storeName}: ${STATUS_LABELS[status].toLowerCase()}.`);
      setPendingDecision(null);
      setSelected(null);
      setReason('');
      await refresh();
    } catch (failure: unknown) {
      console.error('[SellerReviewSection.decide] Error:', failure instanceof Error ? failure.message : failure);
      setDecisionError(failure instanceof Error ? failure.message : 'Decision failed. Refresh the revision before retrying.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleViewFile = (fileId: string) => {
    void sellerVerificationService.view(ownerId, fileId)
      .then((url) => Linking.openURL(url))
      .catch((failure: unknown) => {
        console.error('[SellerReviewSection.handleViewFile] Error:', failure instanceof Error ? failure.message : failure);
        toast.error('Private document could not be opened. Access may have expired.');
      });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (selected) {
      void loadHistory(selected.ownerId, null, () => true).finally(() => setRefreshing(false));
      return;
    }
    void refresh();
  };

  const filterGroups: FilterGroup[] = [
    { key: 'status', label: 'Status', options: QUEUE_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })), value: filter, defaultValue: 'submitted' },
  ];
  const handleApplyFilters = (values: FilterValues) => {
    const next = readSingleFilter(values, 'status');
    setFilter(isQueueStatus(next) ? next : 'submitted');
  };

  const filterLabel = STATUS_LABELS[filter];
  const isOwnApplication = Boolean(selected && selected.ownerId === ownerId);
  const decisions = selected ? availableDecisions(selected.status) : [];
  const [primaryDecision, ...otherDecisions] = decisions;
  const pendingCopy = pendingDecision ? DECISION_COPY[pendingDecision] : null;

  // Queue view: skeleton on the first load of a filter, a full error only when nothing is listed, the right empty copy.
  const queueState: AdminScreenState = loading && !queue.length
    ? { kind: 'loading', variant: 'list' }
    : error && !queue.length
      ? { kind: 'error', message: error }
      : !queue.length
        ? { kind: 'empty', icon: 'user-check', title: `No ${filterLabel.toLowerCase()} applications.`, description: filter === 'submitted' ? 'New seller applications appear here for review.' : undefined }
        : { kind: 'ready' };

  if (selected) {
    const overflowItems: AdminOverflowItem[] = otherDecisions.map((status) => ({
      key: status,
      label: `${DECISION_COPY[status].label}…`,
      icon: DECISION_COPY[status].icon,
      tone: DECISION_COPY[status].tone === 'danger' ? 'danger' : 'neutral',
      disabled: busy || isOwnApplication,
      onPress: () => handleOpenDecision(status),
    }));
    return (
      <AdminScreen
        title={selected.storeName}
        subtitle={`Revision ${selected.revision} · ${STATUS_LABELS[selected.status]}`}
        backFallback="/admin"
        state={{ kind: 'ready' }}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        footer={primaryDecision ? (
          <>
            <AdminButton
              label={DECISION_COPY[primaryDecision].label}
              icon={DECISION_COPY[primaryDecision].icon}
              tone={DECISION_COPY[primaryDecision].tone}
              emphasis="primary"
              disabled={busy || isOwnApplication}
              onPress={() => handleOpenDecision(primaryDecision)}
              style={{ flex: 1 }}
            />
            {overflowItems.length ? <AdminOverflowMenu items={overflowItems} trigger="row" title="Other decisions" triggerLabel="Other decisions" /> : null}
          </>
        ) : undefined}
      >
        <View style={{ gap: space.lg }}>
          <AdminButton label="Back to queue" icon="arrow-left" tone="neutral" emphasis="ghost" onPress={() => setSelected(null)} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
          {error ? <AdminState kind="inlineError" message={error} /> : null}
          {isOwnApplication ? <AdminState kind="inlineError" message="This is your own application. Another administrator has to review it." /> : null}

          <AdminSection title="Applicant">
            <AdminStatusPill label={STATUS_LABELS[selected.status]} tone={STATUS_TONES[selected.status]} />
            {[
              { label: 'Store', value: selected.storeName },
              { label: 'Applicant', value: selected.name },
              { label: 'Email', value: selected.email },
              { label: 'Phone', value: selected.phone },
              { label: 'Seller type', value: selected.isBusiness ? 'Business' : 'Individual' },
              { label: 'Categories', value: selected.categories.join(', ') },
              { label: 'Description', value: selected.description },
            ].filter((detail) => detail.value.trim()).map((detail) => (
              <View key={detail.label} style={{ gap: space.xs }}>
                <Text style={[type.label, { color: colors.mutedText }]}>{detail.label}</Text>
                <Text selectable style={[type.body, { color: colors.text }]}>{detail.value}</Text>
              </View>
            ))}
          </AdminSection>

          <AdminSection title="Documents" description="Opened privately; links expire.">
            {selected.files.length ? selected.files.map((file) => (
              <AdminListRow
                key={file.id}
                title={FILE_KIND_LABELS[file.kind] ?? file.kind}
                subtitle={file.name}
                leading={{ kind: 'icon', name: 'file-text' }}
                inlineAction={{ key: 'open', label: 'Open', icon: 'external-link', tone: 'neutral', onPress: () => handleViewFile(file.id) }}
              />
            )) : <Text style={[type.meta, { color: colors.mutedText }]}>No documents attached.</Text>}
          </AdminSection>

          {!decisions.length ? (
            <Text style={[type.meta, { color: colors.mutedText }]}>No decision can be taken on an application that is {STATUS_LABELS[selected.status].toLowerCase()}.</Text>
          ) : null}

          <AdminSection title="Decision history">
            {historyLoading && !history.length ? <AdminState kind="loading" variant="list" rows={2} /> : null}
            {!historyLoading && !history.length ? <Text style={[type.meta, { color: colors.mutedText }]}>No earlier decisions.</Text> : null}
            {history.map((decision) => (
              <AdminListRow
                key={decision.id}
                title={`${STATUS_LABELS[decision.status]} · Revision ${decision.applicationRevision}`}
                subtitle={decision.reason || undefined}
                meta={formatDecidedAt(decision.decidedAt)}
                leading={{ kind: 'icon', name: DECISION_COPY[decision.status].icon, tone: DECISION_COPY[decision.status].tone }}
              />
            ))}
            {historyCursor ? (
              <AdminButton label="Older decisions" icon="chevron-down" tone="neutral" busy={historyLoading} fullWidth onPress={() => void loadHistory(selected.ownerId, historyCursor, () => true)} />
            ) : null}
          </AdminSection>
        </View>

        <AdminDialog
          visible={Boolean(pendingDecision)}
          title={pendingCopy?.title ?? ''}
          description={pendingCopy ? `${selected.storeName}, revision ${selected.revision}. ${pendingCopy.description}` : undefined}
          confirmLabel={pendingCopy?.label}
          tone={pendingCopy?.tone ?? 'positive'}
          icon={pendingCopy?.icon}
          busy={busy}
          confirmDisabled={!reason.trim() || isOwnApplication}
          onConfirm={() => void decide()}
          onClose={() => {
            if (!busy) setPendingDecision(null);
          }}
        >
          <AdminReasonField
            label="Decision reason (required)"
            value={reason}
            onChangeText={(next) => {
              setReason(next);
              if (decisionError) setDecisionError(null);
            }}
            editable={!busy}
            placeholder="Shown in the decision history"
            error={decisionError}
          />
        </AdminDialog>
      </AdminScreen>
    );
  }

  return (
    <AdminScreen
      title="Seller review"
      subtitle="Verify seller applications"
      state={queueState}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      toolbar={(
        <AdminToolbar
          filters={{ groups: filterGroups, onApply: handleApplyFilters, title: 'Filter applications' }}
          resultSummary={queue.length ? `${filterLabel} · ${queue.length}${cursor ? '+' : ''}` : filterLabel}
        />
      )}
    >
      <View style={{ gap: space.sm }}>
        {error ? <AdminState kind="inlineError" message={error} onRetry={() => void refresh()} /> : null}
        {queue.map((application) => (
          <AdminListRow
            key={application.ownerId}
            title={application.storeName}
            subtitle={[application.name, application.email].filter(Boolean).join(' · ')}
            meta={`Revision ${application.revision}`}
            status={{ label: STATUS_LABELS[application.status], tone: STATUS_TONES[application.status] }}
            leading={{ kind: 'avatar', name: application.name || application.storeName, userId: application.ownerId }}
            onPress={() => handleOpenApplication(application)}
            accessibilityHint="Opens the application"
          />
        ))}
        {cursor ? (
          <AdminButton label={loading ? 'Loading…' : 'Load more applications'} icon="chevron-down" tone="neutral" busy={loading} fullWidth onPress={() => void refresh(cursor)} />
        ) : null}
      </View>
    </AdminScreen>
  );
}
