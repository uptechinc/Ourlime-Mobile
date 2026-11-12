import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import AdminWorkspaceShell from './AdminWorkspaceShell';
import AdminDialog from './AdminDialog';
import CustomModal from '@/components/ui/CustomModal';
import {
  adminJobsService,
  JOB_SUSPENSION_DAYS,
  type AdminJob,
  type JobSuspensionDays,
} from '@/lib/services/AdminJobsService';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

const ROWS_PER_PAGE = 20;

const STATUS_FILTERS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Draft' },
  { value: 'paused', label: 'Paused' },
  { value: 'closed', label: 'Closed' },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

const STATUS_LABELS: { [status: string]: string } = {
  pending_review: 'Pending Review',
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

const statusColors = (status: string, colors: AppThemeColors): { text: string; surface: string } => {
  if (status === 'published') return { text: colors.successText, surface: colors.successSurface };
  if (status === 'pending_review' || status === 'paused') return { text: colors.warningText, surface: colors.warningSurface };
  if (status === 'rejected' || status === 'closed') return { text: colors.destructiveText, surface: colors.destructiveSurface };
  return { text: colors.mutedText, surface: colors.control };
};

export default function AdminJobsWorkspace() {
  const { colors } = useAppTheme();
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<AdminJob | null>(null);
  const [actionJob, setActionJob] = useState<AdminJob | null>(null);
  const [action, setAction] = useState<JobAction | null>(null);
  const [reason, setReason] = useState('');
  const [suspendDays, setSuspendDays] = useState<JobSuspensionDays>(7);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setJobs(await adminJobsService.fetchJobs());
    } catch (loadError: unknown) {
      console.error('[AdminJobsWorkspace.load] Error:', loadError instanceof Error ? loadError.message : loadError);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  const stats = useMemo(() => adminJobsService.computeStats(jobs), [jobs]);
  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    return jobs.filter((job) => {
      const matchesSearch = !normalizedQuery
        || job.title.toLowerCase().includes(normalizedQuery)
        || job.posterName.toLowerCase().includes(normalizedQuery)
        || job.category.toLowerCase().includes(normalizedQuery);
      return matchesSearch && (statusFilter === 'all' || job.status === statusFilter);
    });
  }, [jobs, query, statusFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / ROWS_PER_PAGE));
  const paginatedJobs = filteredJobs.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  const updateJobStatus = (jobId: string, status: string): void => {
    setJobs((current) => current.map((job) => (job.id === jobId ? { ...job, status } : job)));
    setSelectedJob((current) => (current?.id === jobId ? { ...current, status } : current));
  };

  const handleApprove = async (job: AdminJob): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      await adminJobsService.approveJob(job.id);
      updateJobStatus(job.id, 'published');
      setMessage(`Job "${job.title}" approved and published!`);
    } catch (actionError: unknown) {
      console.error('[AdminJobsWorkspace.handleApprove] Error:', actionError instanceof Error ? actionError.message : actionError);
      setMessage('Failed to approve job');
    } finally {
      setBusy(false);
    }
  };

  const openAction = (job: AdminJob, nextAction: JobAction): void => {
    setActionJob(job);
    setAction(nextAction);
    setReason('');
    setSuspendDays(7);
    setSelectedJob(null);
  };

  const closeAction = (): void => {
    if (busy) return;
    setAction(null);
    setActionJob(null);
  };

  const handleConfirmAction = async (): Promise<void> => {
    if (!actionJob || !action || busy) return;
    setBusy(true);
    try {
      if (action === 'reject') {
        await adminJobsService.rejectJob(actionJob.id, reason);
        updateJobStatus(actionJob.id, 'rejected');
        setMessage('Job rejected.');
      } else if (action === 'remove') {
        await adminJobsService.removeListing(actionJob.id, reason);
        updateJobStatus(actionJob.id, 'rejected');
        setMessage('Listing Removed. The job listing has been rejected and hidden.');
      } else {
        await adminJobsService.suspendPoster(actionJob.userId, reason, suspendDays);
        setMessage('User Suspended. The user has been suspended from job posting and applying.');
      }
      setAction(null);
      setActionJob(null);
    } catch (actionError: unknown) {
      console.error('[AdminJobsWorkspace.handleConfirmAction] Error:', actionError instanceof Error ? actionError.message : actionError);
      setMessage(action === 'reject' ? 'Failed to reject job' : action === 'remove' ? 'Failed to remove listing' : 'Failed to suspend user');
    } finally {
      setBusy(false);
    }
  };

  const statCards = [
    { label: 'Total Jobs', value: stats.total, icon: 'briefcase', color: colors.text, surface: colors.control },
    { label: 'Pending Review', value: stats.pending, icon: 'shield', color: colors.warningText, surface: colors.warningSurface },
    { label: 'Published', value: stats.published, icon: 'check', color: colors.successText, surface: colors.successSurface },
    { label: 'Rejected', value: stats.rejected, icon: 'x', color: colors.destructiveText, surface: colors.destructiveSurface },
  ] as const;

  const inputStyle = {
    minHeight: 90,
    textAlignVertical: 'top' as const,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.input,
    color: colors.text,
  };

  const renderDetailRow = (label: string, value: string) => (
    <View key={label} style={{ width: '50%', paddingRight: 8, marginBottom: 12 }}>
      <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ marginTop: 3, color: colors.text, fontWeight: '700', textTransform: label === 'Type' ? 'capitalize' : 'none' }}>{value}</Text>
    </View>
  );

  return (
    <AdminWorkspaceShell
      title="Job Moderation"
      subtitle="Review and moderate job listings submitted by users."
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => void load(true)}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginBottom: 8 }}>
        {statCards.map((card) => (
          <View key={card.label} style={{ width: '50%', padding: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 13, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: card.surface }}>
                <Icon name={card.icon} size={18} color={card.color} />
              </View>
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.mutedText, fontSize: 11 }}>{card.label}</Text>
                <Text style={{ color: card.color, fontSize: 19, fontWeight: '900' }}>{card.value}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderRadius: 14, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12 }}>
        <Icon name="search" size={17} color={colors.mutedText} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by job title, poster, category..."
          placeholderTextColor={colors.mutedText}
          style={{ flex: 1, padding: 11, color: colors.text }}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {STATUS_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.value}
            onPress={() => setStatusFilter(filter.value)}
            style={{ marginRight: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: statusFilter === filter.value ? colors.accent : colors.control }}
          >
            <Text style={{ color: statusFilter === filter.value ? colors.onAccent : colors.secondaryText, fontSize: 12, fontWeight: '800' }}>{filter.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filteredJobs.length === 0 ? (
        <View style={{ paddingVertical: 50, alignItems: 'center' }}>
          <Icon name="briefcase" size={36} color={colors.mutedText} />
          <Text style={{ marginTop: 10, color: colors.text, fontWeight: '800' }}>No jobs found</Text>
          <Text style={{ marginTop: 4, color: colors.mutedText }}>Try adjusting your search or filter.</Text>
        </View>
      ) : (
        paginatedJobs.map((job) => {
          const tone = statusColors(job.status, colors);
          return (
            <View key={job.id} style={{ marginBottom: 10, padding: 14, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
              <TouchableOpacity onPress={() => setSelectedJob(job)} accessibilityRole="button" accessibilityLabel={`View details for ${job.title}`}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text numberOfLines={2} style={{ color: colors.text, fontWeight: '900', fontSize: 15 }}>{job.title}</Text>
                    <Text numberOfLines={1} style={{ marginTop: 2, color: colors.mutedText, fontSize: 12 }}>{job.category || 'Uncategorized'}</Text>
                  </View>
                  <Text style={{ overflow: 'hidden', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, fontSize: 10, fontWeight: '900', color: tone.text, backgroundColor: tone.surface }}>
                    {STATUS_LABELS[job.status] ?? STATUS_LABELS.draft}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                  <Text style={{ marginRight: 12, color: colors.secondaryText, fontSize: 12, textTransform: 'capitalize' }}>{job.type}</Text>
                  <Text style={{ marginRight: 12, color: colors.secondaryText, fontSize: 12 }}>{adminJobsService.formatPrice(job)}</Text>
                  <Text style={{ color: colors.secondaryText, fontSize: 12 }}>{job.posterName}{job.posterUsername ? ` · @${job.posterUsername}` : ''}</Text>
                </View>
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                <ActionChip icon="eye" label="View" color={colors.secondaryText} surface={colors.control} onPress={() => setSelectedJob(job)} />
                {job.status !== 'published' ? <ActionChip icon="check" label="Approve" color={colors.successText} surface={colors.successSurface} disabled={busy} onPress={() => void handleApprove(job)} /> : null}
                {job.status !== 'rejected' ? <ActionChip icon="x" label="Reject" color={colors.destructiveText} surface={colors.destructiveSurface} onPress={() => openAction(job, 'reject')} /> : null}
                <ActionChip icon="trash-2" label="Remove" color={colors.destructiveText} surface={colors.destructiveSurface} onPress={() => openAction(job, 'remove')} />
                <ActionChip icon="user-x" label="Suspend" color={colors.warningText} surface={colors.warningSurface} onPress={() => openAction(job, 'suspend')} />
              </View>
            </View>
          );
        })
      )}

      {filteredJobs.length > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ color: colors.mutedText, fontSize: 12 }}>
            Showing {paginatedJobs.length} of {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity disabled={page <= 1} onPress={() => setPage((current) => current - 1)} accessibilityLabel="Previous page" style={{ padding: 8, opacity: page <= 1 ? 0.4 : 1 }}>
              <Icon name="chevron-left" size={18} color={colors.icon} />
            </TouchableOpacity>
            <Text style={{ color: colors.secondaryText, fontWeight: '800', fontSize: 12 }}>{page} / {totalPages}</Text>
            <TouchableOpacity disabled={page >= totalPages} onPress={() => setPage((current) => current + 1)} accessibilityLabel="Next page" style={{ padding: 8, opacity: page >= totalPages ? 0.4 : 1 }}>
              <Icon name="chevron-right" size={18} color={colors.icon} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <AdminDialog
        visible={Boolean(selectedJob)}
        title={selectedJob ? `Job Details — ${selectedJob.title}` : ''}
        onClose={() => setSelectedJob(null)}
      >
        {selectedJob ? (
          <View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {renderDetailRow('Type', selectedJob.type)}
              {renderDetailRow('Category', selectedJob.category || 'N/A')}
              {renderDetailRow('Compensation', adminJobsService.formatPrice(selectedJob))}
              {renderDetailRow('Location', selectedJob.location)}
              {selectedJob.employmentType ? renderDetailRow('Employment Type', EMPLOYMENT_TYPE_LABELS[selectedJob.employmentType] ?? selectedJob.employmentType) : null}
              {selectedJob.experienceLevel ? renderDetailRow('Experience Level', EXPERIENCE_LEVEL_LABELS[selectedJob.experienceLevel] ?? selectedJob.experienceLevel) : null}
            </View>
            <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>Description</Text>
            <Text style={{ marginTop: 4, color: colors.secondaryText, lineHeight: 20 }}>{selectedJob.description || 'No description provided.'}</Text>
            {selectedJob.skills.length > 0 ? (
              <View style={{ marginTop: 12 }}>
                <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>Skills</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                  {selectedJob.skills.map((skill, skillIndex) => (
                    <Text key={`${skill}-${skillIndex}`} style={{ marginRight: 6, marginBottom: 6, overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, color: colors.successText, backgroundColor: colors.successSurface }}>{skill}</Text>
                  ))}
                </View>
              </View>
            ) : null}
            <Text style={{ marginTop: 12, color: colors.mutedText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>Posted by</Text>
            <Text style={{ marginTop: 3, color: colors.text, fontWeight: '800' }}>{selectedJob.posterName}</Text>
            <Text style={{ color: colors.mutedText }}>@{selectedJob.posterUsername}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 }}>
              {selectedJob.status !== 'published' ? (
                <ActionChip icon="check" label="Approve & Publish" color={colors.successText} surface={colors.successSurface} disabled={busy} onPress={() => { const job = selectedJob; setSelectedJob(null); void handleApprove(job); }} />
              ) : null}
              {selectedJob.status !== 'rejected' ? (
                <ActionChip icon="x" label="Reject Job" color={colors.destructiveText} surface={colors.destructiveSurface} onPress={() => openAction(selectedJob, 'reject')} />
              ) : null}
            </View>
          </View>
        ) : null}
      </AdminDialog>

      <AdminDialog
        visible={action === 'reject'}
        title="Reject Job Submission"
        description={`Provide a reason for rejecting "${actionJob?.title ?? ''}". This will be communicated to the poster.`}
        confirmLabel="Confirm Rejection"
        tone="danger"
        busy={busy}
        onConfirm={() => void handleConfirmAction()}
        onClose={closeAction}
      >
        <Text style={{ marginBottom: 6, color: colors.text, fontWeight: '700' }}>Rejection Reason</Text>
        <TextInput value={reason} onChangeText={setReason} multiline maxLength={2000} placeholder="Enter rejection reason..." placeholderTextColor={colors.mutedText} style={inputStyle} />
      </AdminDialog>

      <AdminDialog
        visible={action === 'remove'}
        title="Remove Job Listing"
        description={`This will reject and hide the listing "${actionJob?.title ?? ''}".`}
        confirmLabel="Remove Listing"
        tone="danger"
        busy={busy}
        confirmDisabled={!reason.trim()}
        onConfirm={() => void handleConfirmAction()}
        onClose={closeAction}
      >
        <Text style={{ marginBottom: 6, color: colors.text, fontWeight: '700' }}>Reason *</Text>
        <TextInput value={reason} onChangeText={setReason} multiline maxLength={2000} placeholder="Reason for removal..." placeholderTextColor={colors.mutedText} style={inputStyle} />
      </AdminDialog>

      <AdminDialog
        visible={action === 'suspend'}
        title="Suspend User from Jobs"
        description={`This will prevent ${actionJob?.posterUsername ? `@${actionJob.posterUsername}` : `${actionJob?.userId.slice(0, 8) ?? ''}...`} from posting or applying to jobs.`}
        confirmLabel="Suspend User"
        tone="pending"
        busy={busy}
        confirmDisabled={!reason.trim()}
        onConfirm={() => void handleConfirmAction()}
        onClose={closeAction}
      >
        <Text style={{ marginBottom: 6, color: colors.text, fontWeight: '700' }}>Reason *</Text>
        <TextInput value={reason} onChangeText={setReason} multiline maxLength={2000} placeholder="Reason for suspension..." placeholderTextColor={colors.mutedText} style={inputStyle} />
        <Text style={{ marginTop: 14, marginBottom: 6, color: colors.text, fontWeight: '700' }}>Duration</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {JOB_SUSPENSION_DAYS.map((days) => (
            <TouchableOpacity
              key={days}
              onPress={() => setSuspendDays(days)}
              style={{ marginRight: 8, marginBottom: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: suspendDays === days ? colors.accent : colors.control }}
            >
              <Text style={{ color: suspendDays === days ? colors.onAccent : colors.secondaryText, fontWeight: '800', fontSize: 12 }}>{days} {days === 1 ? 'day' : 'days'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </AdminDialog>

      <CustomModal visible={Boolean(message)} type="info" title="Job Moderation" message={message ?? ''} onClose={() => setMessage(null)} />
    </AdminWorkspaceShell>
  );
}

type ActionChipProps = {
  icon: string;
  label: string;
  color: string;
  surface: string;
  disabled?: boolean;
  onPress: () => void;
};

function ActionChip({ icon, label, color, surface, disabled = false, onPress }: ActionChipProps) {
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', marginRight: 7, marginBottom: 7, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: surface, opacity: disabled ? 0.5 : 1 }}
    >
      <Icon name={icon} size={14} color={color} />
      <Text style={{ marginLeft: 5, color, fontSize: 12, fontWeight: '800' }}>{label}</Text>
    </TouchableOpacity>
  );
}
