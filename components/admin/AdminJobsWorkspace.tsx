import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { toast } from 'sonner-native';
import AdminButton from './AdminButton';
import AdminDialog from './AdminDialog';
import AdminListRow from './AdminListRow';
import AdminScreen, { type AdminScreenState } from './AdminScreen';
import AdminState from './AdminState';
import AdminStatCard, { AdminStatGrid } from './AdminStatCard';
import AdminStatusPill from './AdminStatusPill';
import AdminToolbar from './AdminToolbar';
import { AdminChoiceList, AdminReasonField } from './AdminReviewCard';
import { readSingleFilter, type FilterGroup, type FilterValues } from '@/components/ui/FilterSheet';
import {
  adminJobsService,
  JOB_SUSPENSION_DAYS,
  type AdminJob,
  type JobSuspensionDays,
} from '@/lib/services/AdminJobsService';
import { ADMIN_JOBS_FETCH_LIMIT, describeJobActionError } from '@/lib/services/AdminJobsRules';
import { space, type, type AdminToneName } from '@/lib/admin/adminTokens';
import type { AdminOverflowItem } from '@/lib/admin/adminTypes';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const ROWS_PER_PAGE = 20;

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Draft' },
  { value: 'paused', label: 'Paused' },
  { value: 'closed', label: 'Closed' },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
] as const;
type SortOrder = (typeof SORT_OPTIONS)[number]['value'];

const STATUS_LABELS: { [status: string]: string } = {
  pending_review: 'Pending review',
  published: 'Published',
  draft: 'Draft',
  paused: 'Paused',
  closed: 'Closed',
  rejected: 'Rejected',
  archived: 'Archived',
};

const EMPLOYMENT_TYPE_LABELS: { [type: string]: string } = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  temporary: 'Temporary',
};

const EXPERIENCE_LEVEL_LABELS: { [level: string]: string } = {
  entry: 'Entry level',
  mid: 'Mid level',
  senior: 'Senior',
  executive: 'Executive',
};

type JobAction = 'reject' | 'remove' | 'suspend';

const statusTone = (status: string): AdminToneName => {
  if (status === 'published') return 'positive';
  if (status === 'pending_review' || status === 'paused') return 'pending';
  if (status === 'rejected' || status === 'closed') return 'danger';
  return 'neutral';
};

const isStatusFilter = (value: string | undefined): value is StatusFilter => STATUS_FILTERS.some((option) => option.value === value);
const isSortOrder = (value: string | undefined): value is SortOrder => SORT_OPTIONS.some((option) => option.value === value);

export default function AdminJobsWorkspace() {
  const { colors } = useAppTheme();
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [visibleCount, setVisibleCount] = useState(ROWS_PER_PAGE);
  const [selectedJob, setSelectedJob] = useState<AdminJob | null>(null);
  const [actionJob, setActionJob] = useState<AdminJob | null>(null);
  const [action, setAction] = useState<JobAction | null>(null);
  const [reason, setReason] = useState('');
  const [suspendDays, setSuspendDays] = useState<JobSuspensionDays>(7);
  const [busy, setBusy] = useState(false);
  const [approvingJobId, setApprovingJobId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  // Synchronous guard: two quick taps both see `busy === false` before React re-renders.
  const busyRef = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await adminJobsService.fetchJobs();
      setJobs(result.jobs);
      setIsTruncated(result.isTruncated);
    } catch (loadError: unknown) {
      console.error('[AdminJobsWorkspace.load] Error:', loadError instanceof Error ? loadError.message : loadError);
      setError(describeJobActionError(loadError, 'Failed to load jobs'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A new search, filter or sort starts again from the first page.
  useEffect(() => {
    setVisibleCount(ROWS_PER_PAGE);
  }, [query, statusFilter, sortOrder]);

  const stats = useMemo(() => adminJobsService.computeStats(jobs), [jobs]);
  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    const matching = jobs.filter((job) => {
      const matchesSearch = !normalizedQuery
        || job.title.toLowerCase().includes(normalizedQuery)
        || job.posterName.toLowerCase().includes(normalizedQuery)
        || job.category.toLowerCase().includes(normalizedQuery);
      return matchesSearch && (statusFilter === 'all' || job.status === statusFilter);
    });
    // The service returns newest first; only "oldest" needs a reorder.
    return sortOrder === 'oldest' ? [...matching].sort((first, second) => first.createdAtSeconds - second.createdAtSeconds) : matching;
  }, [jobs, query, statusFilter, sortOrder]);
  const visibleJobs = filteredJobs.slice(0, visibleCount);
  const hasMore = filteredJobs.length > visibleJobs.length;

  const updateJobStatus = (jobId: string, status: string): void => {
    setJobs((current) => current.map((job) => (job.id === jobId ? { ...job, status } : job)));
    setSelectedJob((current) => (current?.id === jobId ? { ...current, status } : current));
  };

  const withAuditNote = (text: string, auditLogged: boolean): string => (
    auditLogged ? text : `${text} The change was saved, but the audit log entry could not be written.`
  );

  const handleApprove = async (job: AdminJob): Promise<void> => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setApprovingJobId(job.id);
    try {
      const result = await adminJobsService.approveJob(job.id);
      updateJobStatus(job.id, 'published');
      toast.success(withAuditNote(`"${job.title}" approved and published.`, result.auditLogged));
    } catch (approveError: unknown) {
      console.error('[AdminJobsWorkspace.handleApprove] Error:', approveError instanceof Error ? approveError.message : approveError);
      toast.error(describeJobActionError(approveError, 'Failed to approve job'));
    } finally {
      busyRef.current = false;
      setBusy(false);
      setApprovingJobId(null);
    }
  };

  const openAction = (job: AdminJob, nextAction: JobAction): void => {
    setActionJob(job);
    setAction(nextAction);
    setReason('');
    setSuspendDays(7);
    setActionError(null);
    setSelectedJob(null);
  };

  const closeAction = (): void => {
    if (busy) return;
    setAction(null);
    setActionJob(null);
  };

  const handleConfirmAction = async (): Promise<void> => {
    if (!actionJob || !action || busyRef.current) return;
    // The reason is required for every action (the service checks it too).
    if (!reason.trim()) {
      setActionError('Enter a reason first.');
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setActionError(null);
    try {
      if (action === 'reject') {
        const result = await adminJobsService.rejectJob(actionJob.id, reason);
        updateJobStatus(actionJob.id, 'rejected');
        toast.success(withAuditNote('Job rejected.', result.auditLogged));
      } else if (action === 'remove') {
        const result = await adminJobsService.removeListing(actionJob.id, reason);
        const removedJobId = actionJob.id;
        setJobs((current) => current.filter((job) => job.id !== removedJobId));
        setSelectedJob((current) => (current?.id === removedJobId ? null : current));
        toast.success(withAuditNote('Listing removed. The job has been taken down and removed from this list.', result.auditLogged));
      } else {
        const result = await adminJobsService.suspendPoster(actionJob.userId, reason, suspendDays);
        toast.success(withAuditNote('User suspended from job posting and applying.', result.auditLogged));
      }
      setAction(null);
      setActionJob(null);
    } catch (confirmError: unknown) {
      console.error('[AdminJobsWorkspace.handleConfirmAction] Error:', confirmError instanceof Error ? confirmError.message : confirmError);
      const fallback = action === 'reject' ? 'Failed to reject job' : action === 'remove' ? 'Failed to remove listing' : 'Failed to suspend user';
      setActionError(describeJobActionError(confirmError, fallback));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const filterGroups: FilterGroup[] = [
    { key: 'status', label: 'Status', options: STATUS_FILTERS.map((option) => ({ value: option.value, label: option.label })), value: statusFilter, defaultValue: 'all' },
    { key: 'sort', label: 'Sort', options: SORT_OPTIONS.map((option) => ({ value: option.value, label: option.label })), value: sortOrder, defaultValue: 'newest' },
  ];
  const handleApplyFilters = (values: FilterValues): void => {
    const nextStatus = readSingleFilter(values, 'status');
    const nextSort = readSingleFilter(values, 'sort');
    setStatusFilter(isStatusFilter(nextStatus) ? nextStatus : 'all');
    setSortOrder(isSortOrder(nextSort) ? nextSort : 'newest');
  };
  const hasActiveFilters = Boolean(query.trim()) || statusFilter !== 'all';
  const handleClearFilters = (): void => {
    setQuery('');
    setStatusFilter('all');
  };

  const buildOverflow = (job: AdminJob): AdminOverflowItem[] => [
    ...(job.status !== 'published' && job.status !== 'pending_review'
      ? [{ key: 'approve', label: 'Approve & publish', icon: 'check' as const, disabled: busy, onPress: () => void handleApprove(job) }]
      : []),
    { key: 'view', label: 'View details', icon: 'eye', onPress: () => setSelectedJob(job) },
    ...(job.status !== 'rejected' ? [{ key: 'reject', label: 'Reject…', icon: 'x' as const, tone: 'danger' as const, onPress: () => openAction(job, 'reject') }] : []),
    { key: 'remove', label: 'Remove listing…', icon: 'trash-2', tone: 'danger', onPress: () => openAction(job, 'remove') },
    { key: 'suspend', label: 'Suspend poster…', icon: 'user-x', tone: 'danger', onPress: () => openAction(job, 'suspend') },
  ];

  const screenState: AdminScreenState = loading ? { kind: 'loading', variant: 'list' } : error ? { kind: 'error', message: error } : { kind: 'ready' };

  const renderDetailRow = (label: string, value: string) => (
    <View key={label} style={{ width: '50%', paddingRight: space.sm, marginBottom: space.md, gap: space.xs }}>
      <Text style={[type.label, { color: colors.mutedText }]}>{label}</Text>
      <Text style={[type.bodyStrong, { color: colors.text, textTransform: label === 'Type' ? 'capitalize' : 'none' }]}>{value}</Text>
    </View>
  );

  const suspendTarget = actionJob?.posterUsername ? `@${actionJob.posterUsername}` : `${actionJob?.userId.slice(0, 8) ?? ''}...`;
  const actionCopy = action === 'reject'
    ? { title: 'Reject job submission', description: `Provide a reason for rejecting "${actionJob?.title ?? ''}". This will be communicated to the poster.`, confirm: 'Confirm rejection', label: 'Rejection reason', placeholder: 'Enter rejection reason...' }
    : action === 'remove'
      ? { title: 'Remove job listing', description: `This will reject and hide the listing "${actionJob?.title ?? ''}".`, confirm: 'Remove listing', label: 'Reason', placeholder: 'Reason for removal...' }
      : { title: 'Suspend user from jobs', description: `This will prevent ${suspendTarget} from posting or applying to jobs.`, confirm: 'Suspend user', label: 'Reason', placeholder: 'Reason for suspension...' };

  return (
    <AdminScreen
      title="Job moderation"
      subtitle="Review and moderate job listings submitted by users."
      state={screenState}
      refreshing={refreshing}
      onRefresh={() => load(true)}
      toolbar={(
        <AdminToolbar
          search={{ value: query, placeholder: 'Search by title, poster, category', onChange: setQuery }}
          filters={{ groups: filterGroups, onApply: handleApplyFilters, title: 'Filter jobs' }}
          resultSummary={loading || error ? undefined : `${visibleJobs.length} of ${filteredJobs.length} ${filteredJobs.length === 1 ? 'job' : 'jobs'}`}
        />
      )}
    >
      <View style={{ gap: space.md }}>
        <AdminStatGrid>
          <AdminStatCard label="Total jobs" value={stats.total} icon="briefcase" compact onPress={() => setStatusFilter('all')} />
          <AdminStatCard label="Pending review" value={stats.pending} icon="clock" tone="pending" compact onPress={() => setStatusFilter('pending_review')} />
          <AdminStatCard label="Published" value={stats.published} icon="check" tone="positive" compact onPress={() => setStatusFilter('published')} />
          <AdminStatCard label="Rejected" value={stats.rejected} icon="x" tone="danger" compact onPress={() => setStatusFilter('rejected')} />
        </AdminStatGrid>

        {isTruncated ? (
          <Text style={[type.meta, { color: colors.mutedText }]}>
            Showing the newest {ADMIN_JOBS_FETCH_LIMIT} jobs. Totals above count only these.
          </Text>
        ) : null}

        {filteredJobs.length === 0 ? (
          <AdminState
            kind="empty"
            icon="briefcase"
            title="No jobs found"
            description={hasActiveFilters ? undefined : 'Job listings submitted by members appear here.'}
            filtered={hasActiveFilters}
            onClearFilters={handleClearFilters}
          />
        ) : (
          <View style={{ gap: space.sm }}>
            {visibleJobs.map((job) => (
              <AdminListRow
                key={job.id}
                title={job.title}
                subtitle={`${job.posterName}${job.posterUsername ? ` · @${job.posterUsername}` : ''}`}
                leading={{ kind: 'avatar', name: job.posterName || job.title, userId: job.userId || undefined }}
                meta={[job.category || 'Uncategorized', adminJobsService.formatPrice(job), job.type].filter(Boolean).join(' · ')}
                status={{ label: STATUS_LABELS[job.status] ?? STATUS_LABELS.draft, tone: statusTone(job.status) }}
                onPress={() => setSelectedJob(job)}
                accessibilityHint="Opens the job details"
                inlineAction={job.status === 'pending_review'
                  ? { key: 'approve', label: 'Approve', icon: 'check', tone: 'positive', busy: approvingJobId === job.id, disabled: busy, onPress: () => void handleApprove(job) }
                  : undefined}
                overflowActions={buildOverflow(job)}
              />
            ))}
            {hasMore ? (
              <AdminButton
                label={`Load more (${filteredJobs.length - visibleJobs.length} left)`}
                icon="chevron-down"
                tone="neutral"
                fullWidth
                onPress={() => setVisibleCount((current) => current + ROWS_PER_PAGE)}
              />
            ) : null}
          </View>
        )}
      </View>

      <AdminDialog
        visible={Boolean(selectedJob)}
        title={selectedJob?.title ?? ''}
        icon={null}
        confirmLabel={selectedJob && selectedJob.status !== 'published' ? 'Approve & publish' : undefined}
        tone="positive"
        busy={busy}
        onConfirm={selectedJob && selectedJob.status !== 'published' ? () => { const job = selectedJob; setSelectedJob(null); void handleApprove(job); } : undefined}
        onClose={() => setSelectedJob(null)}
      >
        {selectedJob ? (
          <View style={{ gap: space.md }}>
            <AdminStatusPill label={STATUS_LABELS[selectedJob.status] ?? STATUS_LABELS.draft} tone={statusTone(selectedJob.status)} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {renderDetailRow('Type', selectedJob.type)}
              {renderDetailRow('Category', selectedJob.category || 'N/A')}
              {renderDetailRow('Compensation', adminJobsService.formatPrice(selectedJob))}
              {renderDetailRow('Location', selectedJob.location)}
              {selectedJob.employmentType ? renderDetailRow('Employment type', EMPLOYMENT_TYPE_LABELS[selectedJob.employmentType] ?? selectedJob.employmentType) : null}
              {selectedJob.experienceLevel ? renderDetailRow('Experience level', EXPERIENCE_LEVEL_LABELS[selectedJob.experienceLevel] ?? selectedJob.experienceLevel) : null}
            </View>
            <View style={{ gap: space.xs }}>
              <Text style={[type.label, { color: colors.mutedText }]}>Description</Text>
              <Text style={[type.body, { color: colors.secondaryText }]}>{selectedJob.description || 'No description provided.'}</Text>
            </View>
            {selectedJob.skills.length > 0 ? (
              <View style={{ gap: space.xs }}>
                <Text style={[type.label, { color: colors.mutedText }]}>Skills</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                  {selectedJob.skills.map((skill, skillIndex) => (
                    <AdminStatusPill key={`${skill}-${skillIndex}`} label={skill} tone="neutral" />
                  ))}
                </View>
              </View>
            ) : null}
            <View style={{ gap: space.xs }}>
              <Text style={[type.label, { color: colors.mutedText }]}>Posted by</Text>
              <Text style={[type.bodyStrong, { color: colors.text }]}>{selectedJob.posterName}</Text>
              {selectedJob.posterUsername ? <Text style={[type.meta, { color: colors.mutedText }]}>@{selectedJob.posterUsername}</Text> : null}
            </View>
            {selectedJob.status !== 'rejected' ? (
              <AdminButton label="Reject job…" icon="x" tone="danger" emphasis="ghost" onPress={() => openAction(selectedJob, 'reject')} style={{ alignSelf: 'flex-start' }} />
            ) : null}
          </View>
        ) : null}
      </AdminDialog>

      <AdminDialog
        visible={Boolean(action)}
        title={actionCopy.title}
        description={actionCopy.description}
        confirmLabel={actionCopy.confirm}
        tone={action === 'suspend' ? 'pending' : 'danger'}
        busy={busy}
        confirmDisabled={!reason.trim()}
        onConfirm={() => void handleConfirmAction()}
        onClose={closeAction}
      >
        <View style={{ gap: space.lg }}>
          <AdminReasonField
            label={`${actionCopy.label} (required)`}
            value={reason}
            onChangeText={(next) => {
              setReason(next);
              if (actionError) setActionError(null);
            }}
            editable={!busy}
            placeholder={actionCopy.placeholder}
            error={actionError}
          />
          {action === 'suspend' ? (
            <AdminChoiceList
              label="Duration"
              value={suspendDays}
              disabled={busy}
              onChange={setSuspendDays}
              options={JOB_SUSPENSION_DAYS.map((days) => ({ value: days, label: `${days} ${days === 1 ? 'day' : 'days'}` }))}
            />
          ) : null}
        </View>
      </AdminDialog>
    </AdminScreen>
  );
}
