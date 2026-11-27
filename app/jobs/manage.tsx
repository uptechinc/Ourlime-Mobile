import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Archive, Briefcase, CalendarClock, CheckSquare, ChevronDown, ChevronUp, Edit3, ExternalLink, FileText, History, MapPin, PauseCircle, PlayCircle, RotateCcw, Search, Square, StickyNote, Trash2, XCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import PageHeader from '@/components/ui/PageHeader';
import CustomModal from '@/components/ui/CustomModal';
import FilterSheet, { readSingleFilter, type FilterGroup, type FilterValues } from '@/components/ui/FilterSheet';
import FilterBar from '@/components/ui/FilterBar';
import { JobManagementSkeleton } from '@/components/jobs/JobsSkeletons';
import { JOBS_ACTION_GREEN, JOBS_CARD_RADIUS, JobStatusPill, getApplicationStatusPresentation, getListingStatusPresentation } from '@/components/jobs/JobCardParts';
import JobDeleteModal, { type JobDeleteMode } from '@/components/jobs/manage/JobDeleteModal';
import { JobManagementAuditSheet, JobManagementEditSheet, JobManagementInterviewSheet, JobManagementNotesSheet } from '@/components/jobs/manage/JobManagementSheets';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import {
  jobManagementService,
  type ApplicationStatus,
  type JobStateAction,
  type ManagedJob,
  type ManagedJobApplication,
} from '@/lib/services/JobManagementService';
import { linkPresentationService } from '@/lib/services/LinkPresentationService';

type ApplicationFilter = 'all' | ApplicationStatus;
type ApplicationSort = 'newest' | 'oldest' | 'name';
/** An action that is hard to undo or that the applicant sees, waiting for "Are you sure?". */
type PendingConfirm =
  | { kind: 'job'; job: ManagedJob; action: 'close' | 'archive' }
  | { kind: 'application'; application: ManagedJobApplication; status: ApplicationStatus }
  | { kind: 'bulk'; status: ApplicationStatus; count: number };
type ConfirmCopy = { title: string; message: string; confirmText: string; type: 'warning' | 'danger' };

/** Pressable feedback; NativeWind drops Pressable style functions, so styles stay static. */
const RIPPLE = { color: 'rgba(15,23,42,0.12)' };
/** Statuses an applicant can't be moved out of (see getAllowedApplicationStatuses). */
const FINAL_APPLICATION_STATUSES: ApplicationStatus[] = ['accepted', 'rejected'];

const applicationStatuses: ApplicationStatus[] = ['reviewing', 'interviewing', 'offer', 'accepted', 'rejected'];
const applicationFilters: { value: ApplicationFilter; label: string }[] = [
  { value: 'all', label: 'Any status' }, { value: 'pending', label: 'Pending' }, { value: 'reviewing', label: 'Reviewing' },
  { value: 'interviewing', label: 'Interviewing' }, { value: 'offer', label: 'Offer' }, { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' }, { value: 'withdrawn', label: 'Withdrawn' }, { value: 'job_withdrawn', label: 'Job withdrawn' },
];
const applicationSorts: { value: ApplicationSort; label: string }[] = [
  { value: 'newest', label: 'Newest' }, { value: 'oldest', label: 'Oldest' }, { value: 'name', label: 'Name A–Z' },
];

const formatApplicationStatus = (status: ApplicationStatus): string => getApplicationStatusPresentation(status, 'poster').label;

const getAllowedApplicationStatuses = (status: ApplicationStatus): ApplicationStatus[] => {
  if (status === 'pending') return ['reviewing', 'rejected'];
  if (status === 'reviewing') return ['interviewing', 'accepted', 'rejected'];
  if (status === 'interviewing' || status === 'offer') return ['accepted', 'rejected'];
  return [];
};

export default function ManageJobsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [jobs, setJobs] = useState<ManagedJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ApplicationFilter>('all');
  const [sort, setSort] = useState<ApplicationSort>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<Set<string>>(new Set());
  const [expandedApplicationId, setExpandedApplicationId] = useState('');
  const [notesApplication, setNotesApplication] = useState<ManagedJobApplication | null>(null);
  const [interviewApplication, setInterviewApplication] = useState<ManagedJobApplication | null>(null);
  const [auditJob, setAuditJob] = useState<ManagedJob | null>(null);
  const [editJob, setEditJob] = useState<ManagedJob | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ job: ManagedJob; mode: JobDeleteMode } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  const applyJobs = useCallback((nextJobs: ManagedJob[]) => {
    setJobs(nextJobs);
    setSelectedJobId((currentJobId) => nextJobs.some((job) => job.id === currentJobId) ? currentJobId : nextJobs[0]?.id ?? '');
  }, []);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    setError('');
    try {
      applyJobs(await jobManagementService.listCurrentUserJobs());
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Your jobs could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyJobs]);

  useEffect(() => {
    let active = true;
    // No .finally: the runtime Promise can lack it (see lib/shims/promiseFinally.ts).
    const loadFresh = (): void => { if (active) void load(); };
    void jobManagementService.getCachedCurrentUserJobs().then((cachedJobs) => {
      if (active && cachedJobs?.length) {
        applyJobs(cachedJobs);
        setLoading(false);
      }
    }).then(loadFresh, loadFresh);
    return () => { active = false; };
  }, [applyJobs, load]);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) ?? null, [jobs, selectedJobId]);
  const newApplicationCount = selectedJob ? selectedJob.applications.filter((application) => application.status === 'pending').length : 0;
  const questionTextById = useMemo(() => new Map((selectedJob?.questions ?? []).map((question) => [question.id, question.question])), [selectedJob]);

  useEffect(() => {
    setSelectedApplicationIds(new Set());
    setExpandedApplicationId('');
  }, [selectedJobId]);

  // Bulk moves offer only statuses every selected applicant can move to, so accepted or rejected applicants
  // (final) are never offered a way back.
  const bulkStatuses = useMemo(() => {
    const selectedApplications = (selectedJob?.applications ?? []).filter((application) => selectedApplicationIds.has(application.id));
    return applicationStatuses.filter((status) => selectedApplications.every((application) => (
      application.status === status || getAllowedApplicationStatuses(application.status).includes(status)
    )) && selectedApplications.some((application) => application.status !== status));
  }, [selectedJob, selectedApplicationIds]);

  const visibleApplications = useMemo(() => {
    if (!selectedJob) return [];
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredApplications = selectedJob.applications.filter((application) => {
      if (filter !== 'all' && application.status !== filter) return false;
      if (!normalizedQuery) return true;
      const answerText = Object.values(application.answers).flat().join(' ').toLowerCase();
      return application.applicant.name.toLowerCase().includes(normalizedQuery)
        || application.applicant.email.toLowerCase().includes(normalizedQuery)
        || application.coverLetter.toLowerCase().includes(normalizedQuery)
        || answerText.includes(normalizedQuery);
    });
    return filteredApplications.sort((leftApplication, rightApplication) => {
      if (sort === 'oldest') return leftApplication.createdAtMs - rightApplication.createdAtMs;
      if (sort === 'name') return leftApplication.applicant.name.localeCompare(rightApplication.applicant.name);
      return rightApplication.createdAtMs - leftApplication.createdAtMs;
    });
  }, [filter, searchQuery, selectedJob, sort]);

  const handleJobAction = async (jobId: string, action: JobStateAction | 'delete'): Promise<boolean> => {
    setWorkingId(jobId);
    setError('');
    try {
      if (action === 'delete') await jobManagementService.deleteJob(jobId);
      else await jobManagementService.changeJobState(jobId, action);
      await load();
      return true;
    } catch (actionError: unknown) {
      console.error('[ManageJobsScreen.handleJobAction] Error:', actionError);
      setError(actionError instanceof Error ? actionError.message : 'The job could not be updated.');
      return false;
    } finally {
      setWorkingId(null);
    }
  };

  // Web /profile/jobs/delete: a live listing is closed first so its applications are preserved; closed, draft and
  // archived listings can then be deleted once their title is typed (applications become "Job withdrawn").
  const handleDeleteJob = (job: ManagedJob) => {
    const isLive = job.status === 'published' || job.status === 'pending_review' || job.status === 'active' || job.status === 'paused';
    setDeleteTarget({ job, mode: isLive ? 'close' : 'delete' });
  };

  const handleConfirmDeleteAction = async (action: 'close' | 'delete') => {
    if (!deleteTarget) return;
    const succeeded = await handleJobAction(deleteTarget.job.id, action);
    if (succeeded) setDeleteTarget(null);
  };

  const handleApplication = async (application: ManagedJobApplication, status: ApplicationStatus) => {
    if (!selectedJob) return;
    setWorkingId(application.id);
    setError('');
    try {
      await jobManagementService.updateApplication(application.id, status, { jobId: selectedJob.id, previousStatus: application.status });
      await load();
    } catch (applicationError: unknown) {
      setError(applicationError instanceof Error ? applicationError.message : 'The application could not be updated.');
    } finally {
      setWorkingId(null);
    }
  };

  const handleBulkStatus = async (status: ApplicationStatus) => {
    if (!selectedJob || selectedApplicationIds.size === 0) return;
    setWorkingId('bulk');
    setError('');
    try {
      await jobManagementService.bulkUpdateApplications(selectedJob.id, [...selectedApplicationIds], status);
      setSelectedApplicationIds(new Set());
      await load();
    } catch (bulkError: unknown) {
      setError(bulkError instanceof Error ? bulkError.message : 'The selected applications could not be updated.');
    } finally {
      setWorkingId(null);
    }
  };

  const handleToggleSelected = (applicationId: string) => {
    setSelectedApplicationIds((currentSelection) => {
      const nextSelection = new Set(currentSelection);
      if (nextSelection.has(applicationId)) nextSelection.delete(applicationId);
      else nextSelection.add(applicationId);
      return nextSelection;
    });
  };

  /** Final statuses (the applicant sees them and they can't be changed) ask first; others apply straight away. */
  const handleRequestApplicationStatus = (application: ManagedJobApplication, status: ApplicationStatus) => {
    if (FINAL_APPLICATION_STATUSES.includes(status)) setPendingConfirm({ kind: 'application', application, status });
    else void handleApplication(application, status);
  };

  const getConfirmCopy = (confirm: PendingConfirm): ConfirmCopy => {
    if (confirm.kind === 'job') {
      const count = confirm.job.applications.length;
      const kept = count > 0 ? ` Its ${count} application${count === 1 ? ' stays' : 's stay'} here for review.` : '';
      return confirm.action === 'close'
        ? { type: 'warning', title: 'Close this listing?', confirmText: 'Close listing', message: `“${confirm.job.title}” will stop accepting applications.${kept} You can reopen it later.` }
        : { type: 'warning', title: 'Archive this listing?', confirmText: 'Archive', message: `“${confirm.job.title}” will come off the job board and stop accepting applications.${kept} You can reopen it later.` };
    }
    const label = formatApplicationStatus(confirm.status);
    const applicantLabel = getApplicationStatusPresentation(confirm.status, 'applicant').label;
    const isFinal = FINAL_APPLICATION_STATUSES.includes(confirm.status);
    const finalNote = isFinal ? ` ${label} is a final status, so it can't be changed afterwards.` : '';
    if (confirm.kind === 'application') {
      return {
        type: confirm.status === 'rejected' ? 'danger' : 'warning',
        title: `${confirm.status === 'rejected' ? 'Reject' : 'Accept'} ${confirm.application.applicant.name}?`,
        confirmText: confirm.status === 'rejected' ? 'Reject' : 'Accept',
        message: `They'll see “${applicantLabel}” in My applications.${finalNote}`,
      };
    }
    const people = `${confirm.count} applicant${confirm.count === 1 ? '' : 's'}`;
    return {
      type: confirm.status === 'rejected' ? 'danger' : 'warning',
      title: `Mark ${people} as ${label}?`,
      confirmText: `Mark ${confirm.count} as ${label}`,
      message: `Each of them will see “${applicantLabel}” in My applications.${finalNote}`,
    };
  };

  const handleConfirmPending = async () => {
    const confirm = pendingConfirm;
    if (!confirm) return;
    if (confirm.kind === 'job') await handleJobAction(confirm.job.id, confirm.action);
    else if (confirm.kind === 'application') await handleApplication(confirm.application, confirm.status);
    else await handleBulkStatus(confirm.status);
    setPendingConfirm(null);
  };

  const confirmCopy = pendingConfirm ? getConfirmCopy(pendingConfirm) : null;
  const isConfirmWorking = pendingConfirm !== null && workingId !== null;

  const handleOpenLink = async (value: string) => {
    const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    if (!/^https?:\/\//i.test(url) || !(await Linking.canOpenURL(url))) {
      setError('This applicant link is not valid.');
      return;
    }
    await Linking.openURL(url);
  };

  const filterGroups: FilterGroup[] = [
    { key: 'status', label: 'Application status', options: applicationFilters, value: filter, defaultValue: 'all' },
    { key: 'sort', label: 'Sort by', options: applicationSorts, value: sort, defaultValue: 'newest' },
  ];
  const handleApplyFilters = (values: FilterValues): void => {
    const nextFilter = applicationFilters.find((option) => option.value === readSingleFilter(values, 'status'));
    if (nextFilter) setFilter(nextFilter.value);
    const nextSort = applicationSorts.find((option) => option.value === readSingleFilter(values, 'sort'));
    if (nextSort) setSort(nextSort.value);
  };
  const handleClearFilter = (groupKey: string): void => {
    if (groupKey === 'status') setFilter('all');
    if (groupKey === 'sort') setSort('newest');
  };

  const listHeader = <>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.jobSelector}>
      {jobs.map((job) => <Pressable android_ripple={RIPPLE}key={job.id} accessibilityRole="button" accessibilityLabel={`${job.title}, ${job.applications.length} applicants`} accessibilityState={{ selected: selectedJobId === job.id }} onPress={() => setSelectedJobId(job.id)} style={[styles.jobChip, selectedJobId === job.id && styles.jobChipActive]}><Text numberOfLines={1} style={[styles.jobChipText, selectedJobId === job.id && styles.jobChipTextActive]}>{job.title}</Text><View style={[styles.jobChipCountBox, selectedJobId === job.id && styles.jobChipCountBoxActive]}><Text style={[styles.jobChipCount, selectedJobId === job.id && styles.jobChipTextActive]}>{job.applications.length}</Text></View></Pressable>)}
    </ScrollView>
    {selectedJob ? <View style={styles.jobCard}>
      <View style={styles.jobTitleRow}>
        <View style={styles.flex}>
          <Text numberOfLines={2} style={styles.jobTitle}>{selectedJob.title}</Text>
          <View style={styles.locationRow}><MapPin size={14} color={colors.mutedText} /><Text numberOfLines={1} ellipsizeMode="tail" style={[styles.meta, styles.flex]}>{linkPresentationService.compactUrlsInText(selectedJob.location)} · {selectedJob.type === 'quickTask' ? 'Quick task' : 'Professional'}</Text></View>
        </View>
        <Pressable android_ripple={RIPPLE}accessibilityRole="button" accessibilityLabel="Listing activity history" onPress={() => setAuditJob(selectedJob)} style={styles.iconButton}><History size={20} color={colors.successText} /></Pressable>
      </View>
      <View style={styles.jobStatsRow}>
        <JobStatusPill presentation={getListingStatusPresentation(selectedJob.status)} />
        <Text numberOfLines={1} style={styles.jobStats}><Text style={styles.jobStatsStrong}>{selectedJob.applications.length}</Text> {selectedJob.applications.length === 1 ? 'applicant' : 'applicants'}{newApplicationCount ? <Text> · <Text style={styles.jobStatsNew}>{newApplicationCount} new</Text></Text> : null}</Text>
      </View>
      <View style={styles.actions}><Pressable android_ripple={RIPPLE}accessibilityRole="button" onPress={() => setEditJob(selectedJob)} style={styles.editAction}><Edit3 size={16} color={colors.icon} /><Text style={styles.editActionText}>Edit</Text></Pressable>{selectedJob.status === 'draft' ? <Action label="Publish" icon="reopen" disabled={workingId === selectedJob.id} onPress={() => void handleJobAction(selectedJob.id, 'publish')} /> : selectedJob.status === 'closed' || selectedJob.status === 'archived' || selectedJob.status === 'active' ? <Action label="Reopen" icon="reopen" disabled={workingId === selectedJob.id} onPress={() => void handleJobAction(selectedJob.id, 'reopen')} /> : null}{selectedJob.status === 'published' ? <Action label="Pause" icon="pause" disabled={workingId === selectedJob.id} onPress={() => void handleJobAction(selectedJob.id, 'pause')} /> : selectedJob.status === 'paused' ? <Action label="Resume" icon="resume" disabled={workingId === selectedJob.id} onPress={() => void handleJobAction(selectedJob.id, 'resume')} /> : null}{selectedJob.status !== 'closed' && selectedJob.status !== 'archived' && selectedJob.status !== 'draft' ? <Action label="Close" icon="close" disabled={workingId === selectedJob.id} onPress={() => setPendingConfirm({ kind: 'job', job: selectedJob, action: 'close' })} /> : null}{selectedJob.status !== 'archived' ? <Action label="Archive" icon="archive" disabled={workingId === selectedJob.id} onPress={() => setPendingConfirm({ kind: 'job', job: selectedJob, action: 'archive' })} /> : null}<Action label="Delete" icon="delete" danger disabled={workingId === selectedJob.id} onPress={() => handleDeleteJob(selectedJob)} /></View>
    </View> : null}
    <View style={styles.searchBox}><Search size={18} color={colors.mutedText} /><TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search applicants" placeholderTextColor={colors.mutedText} accessibilityLabel="Search applicants, cover letters and answers" style={styles.searchInput} /></View>
    <View style={styles.filterBar}><FilterBar groups={filterGroups} onOpen={() => setFiltersOpen(true)} onClear={handleClearFilter} /></View>
    <Text style={[styles.sectionLabel, styles.applicantCount]}>{visibleApplications.length === (selectedJob?.applications.length ?? 0) ? `${visibleApplications.length} applicant${visibleApplications.length === 1 ? '' : 's'}` : `Showing ${visibleApplications.length} of ${selectedJob?.applications.length ?? 0} applicants`}</Text>
    {selectedApplicationIds.size > 0 ? <View style={styles.bulkBar}><View style={styles.bulkHeader}><Text style={styles.bulkTitle}>{selectedApplicationIds.size} selected · move to</Text><Pressable android_ripple={RIPPLE}accessibilityRole="button" onPress={() => setSelectedApplicationIds(new Set())} hitSlop={8}><Text style={styles.bulkClear}>Clear</Text></Pressable></View>{bulkStatuses.length === 0 ? <Text style={styles.bulkClear}>These applicants are at different or final stages. Select applicants at the same stage to move them together.</Text> : null}<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bulkActions}>{bulkStatuses.map((status) => <Pressable android_ripple={RIPPLE}key={status} accessibilityRole="button" accessibilityLabel={`Mark ${selectedApplicationIds.size} selected as ${formatApplicationStatus(status)}`} disabled={workingId === 'bulk'} onPress={() => setPendingConfirm({ kind: 'bulk', status, count: selectedApplicationIds.size })} style={[styles.bulkChip, workingId === 'bulk' && styles.disabled]}><Text style={styles.bulkChipText}>{formatApplicationStatus(status)}</Text></Pressable>)}</ScrollView></View> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </>;

  if (loading && jobs.length === 0) {
    return (
      <SafeAreaView /* discipline-exempt safe-area-edges: the header above applies the top inset */ edges={['left', 'right']} style={styles.safeArea}>
        <PageHeader title="Manage Jobs" onBackPress={() => router.back()} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <JobManagementSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }
  if (!loading && jobs.length === 0) return <SafeAreaView /* discipline-exempt safe-area-edges: the header above applies the top inset */ edges={['left', 'right']} style={styles.safeArea}><PageHeader title="Manage Jobs" onBackPress={() => router.back()} /><View style={styles.center}><View style={styles.emptyIcon}><Briefcase size={32} color={colors.mutedText} /></View><Text style={styles.jobTitle}>No listings yet</Text><Text style={styles.emptyText}>Post a job or quick task and its applicants will show up here.</Text><Pressable android_ripple={RIPPLE}accessibilityRole="button" onPress={() => router.replace('/jobs')} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Go to Jobs</Text></Pressable></View></SafeAreaView>;

  return <SafeAreaView /* discipline-exempt safe-area-edges: the header above applies the top inset */ edges={['left', 'right']} style={styles.safeArea}>
    <PageHeader title="Manage Jobs" onBackPress={() => router.back()} />
    <FlatList
      data={visibleApplications}
      keyExtractor={(application) => application.id}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={<View style={styles.emptyApplications}><Text style={styles.jobTitle}>No matching applicants</Text><Text style={styles.meta}>Try another filter or search.</Text></View>}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}
      renderItem={({ item: application }) => <ApplicationCard
        application={application}
        questionTextById={questionTextById}
        selected={selectedApplicationIds.has(application.id)}
        expanded={expandedApplicationId === application.id}
        working={workingId === application.id}
        onToggleSelected={() => handleToggleSelected(application.id)}
        onToggleExpanded={() => setExpandedApplicationId((currentId) => currentId === application.id ? '' : application.id)}
        onStatus={(status) => handleRequestApplicationStatus(application, status)}
        onNotes={() => setNotesApplication(application)}
        onInterview={() => setInterviewApplication(application)}
        onOpenLink={(url) => void handleOpenLink(url)}
      />}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews
    />
    <JobManagementNotesSheet application={notesApplication} jobId={selectedJob?.id ?? ''} onClose={() => setNotesApplication(null)} />
    <FilterSheet visible={filtersOpen} title="Filter applicants" groups={filterGroups} applyLabel="Show applicants" onApply={handleApplyFilters} onClose={() => setFiltersOpen(false)} />
    <JobManagementAuditSheet job={auditJob} onClose={() => setAuditJob(null)} />
    <JobManagementEditSheet job={editJob} onClose={() => setEditJob(null)} onSaved={async () => { await load(); }} />
    <JobDeleteModal
      visible={Boolean(deleteTarget)}
      mode={deleteTarget?.mode ?? 'delete'}
      jobTitle={deleteTarget?.job.title ?? ''}
      applicationCount={deleteTarget?.job.applications.length ?? 0}
      isProcessing={Boolean(deleteTarget && workingId === deleteTarget.job.id)}
      onDelete={() => void handleConfirmDeleteAction('delete')}
      onCloseJob={() => void handleConfirmDeleteAction('close')}
      onDismiss={() => setDeleteTarget(null)}
    />
    <JobManagementInterviewSheet application={interviewApplication} job={selectedJob} onClose={() => setInterviewApplication(null)} onScheduled={async () => { await load(); }} />
    <CustomModal
      visible={confirmCopy !== null}
      type={confirmCopy?.type ?? 'warning'}
      title={confirmCopy?.title ?? ''}
      message={confirmCopy?.message ?? ''}
      confirmText={confirmCopy?.confirmText}
      cancelText="Cancel"
      isLoading={isConfirmWorking}
      onConfirm={() => void handleConfirmPending()}
      onCancel={() => setPendingConfirm(null)}
      onClose={() => { if (!isConfirmWorking) setPendingConfirm(null); }}
    />
  </SafeAreaView>;
}

type ApplicationCardProps = {
  application: ManagedJobApplication;
  questionTextById: Map<string, string>;
  selected: boolean;
  expanded: boolean;
  working: boolean;
  onToggleSelected: () => void;
  onToggleExpanded: () => void;
  onStatus: (status: ApplicationStatus) => void;
  onNotes: () => void;
  onInterview: () => void;
  onOpenLink: (url: string) => void;
};

function ApplicationCard({ application, questionTextById, selected, expanded, working, onToggleSelected, onToggleExpanded, onStatus, onNotes, onInterview, onOpenLink }: ApplicationCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const answers = Object.entries(application.answers);
  const allowedStatuses = getAllowedApplicationStatuses(application.status);
  const canScheduleInterview = application.status === 'reviewing';
  return <View style={[styles.applicationCard, selected && styles.applicationSelected]}>
    <View style={styles.applicationHeader}><Pressable android_ripple={RIPPLE}accessibilityRole="checkbox" accessibilityLabel={`Select ${application.applicant.name}`} accessibilityState={{ checked: selected }} onPress={onToggleSelected} style={styles.checkboxButton}>{selected ? <CheckSquare size={22} color={colors.accent} /> : <Square size={22} color={colors.mutedText} />}</Pressable><Pressable android_ripple={RIPPLE}accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${application.applicant.name}, ${formatApplicationStatus(application.status)}. ${expanded ? 'Hide' : 'Show'} application`} style={styles.flex} onPress={onToggleExpanded}><Text numberOfLines={1} style={styles.applicantName}>{application.applicant.name}</Text><Text numberOfLines={1} style={styles.meta}>{application.applicant.email || 'No public email'}</Text><Text numberOfLines={1} style={styles.meta}>Applied {formatDate(application.createdAtMs)}</Text></Pressable><Pressable android_ripple={RIPPLE}accessibilityRole="button" accessibilityLabel={expanded ? 'Hide application' : 'Show application'} onPress={onToggleExpanded} style={styles.chevronButton}>{expanded ? <ChevronUp size={22} color={colors.icon} /> : <ChevronDown size={22} color={colors.icon} />}</Pressable></View>
    <View style={styles.applicationToolbar}><View style={styles.flex}><JobStatusPill presentation={getApplicationStatusPresentation(application.status, 'poster')} /></View><Pressable android_ripple={RIPPLE}accessibilityRole="button" accessibilityLabel={`Notes on ${application.applicant.name}`} onPress={onNotes} style={styles.smallAction}><StickyNote size={16} color={colors.warningText} /><Text style={styles.noteActionText}>Notes</Text></Pressable>{canScheduleInterview ? <Pressable android_ripple={RIPPLE}accessibilityRole="button" accessibilityLabel={`Schedule an interview with ${application.applicant.name}`} onPress={onInterview} style={styles.smallAction}><CalendarClock size={16} color={colors.accentText} /><Text style={styles.interviewActionText}>Interview</Text></Pressable> : null}</View>
    {expanded ? <View style={styles.applicationDetails}>
      <Text style={styles.detailLabel}>Cover letter</Text><Text style={styles.detailBody}>{application.coverLetter || 'No cover letter provided.'}</Text>
      {answers.length ? <><Text style={styles.detailLabel}>Application answers</Text>{answers.map(([questionId, answer]) => <View key={questionId} style={styles.answerRow}><Text style={styles.answerQuestion}>{questionTextById.get(questionId) || 'Question'}</Text><Text style={styles.detailBody}>{Array.isArray(answer) ? answer.join(', ') : answer}</Text></View>)}</> : null}
      {application.applicant.workExperience.length ? <><Text style={styles.detailLabel}>Experience</Text>{application.applicant.workExperience.slice(0, 4).map((experience) => <Text key={experience.id} style={styles.detailBody}>{experience.role || 'Role'} · {experience.company || 'Company'}</Text>)}</> : null}
      {application.applicant.education.length ? <><Text style={styles.detailLabel}>Education</Text>{application.applicant.education.slice(0, 4).map((education) => <Text key={education.id} style={styles.detailBody}>{education.degree || 'Study'} · {education.school || 'School'}</Text>)}</> : null}
      <View style={styles.linkRow}>{application.resumeUrl ? <LinkButton label="Resume" onPress={() => onOpenLink(application.resumeUrl)} /> : null}{application.portfolioLink ? <LinkButton label="Portfolio" onPress={() => onOpenLink(application.portfolioLink)} /> : null}</View>
      {allowedStatuses.length > 0 ? <><Text style={styles.detailLabel}>Update status</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statuses}>{allowedStatuses.map((status) => <Pressable android_ripple={RIPPLE}key={status} accessibilityRole="button" accessibilityLabel={`Mark as ${formatApplicationStatus(status)}`} disabled={working} onPress={() => onStatus(status)} style={[styles.statusChip, status === 'rejected' && styles.statusChipDanger, working && styles.disabled]}><Text style={[styles.statusText, status === 'rejected' && styles.statusTextDanger]}>{formatApplicationStatus(status)}</Text></Pressable>)}</ScrollView></> : <Text style={styles.terminalStatus}>This application is in a final state.</Text>}
    </View> : null}
  </View>;
}

type ActionProps = { label: string; icon: 'reopen' | 'close' | 'archive' | 'delete' | 'pause' | 'resume'; onPress: () => void; disabled: boolean; danger?: boolean };
function Action({ label, icon, onPress, disabled, danger = false }: ActionProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const Icon = icon === 'reopen' ? RotateCcw : icon === 'close' ? XCircle : icon === 'archive' ? Archive : icon === 'pause' ? PauseCircle : icon === 'resume' ? PlayCircle : Trash2;
  return <Pressable android_ripple={RIPPLE}accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} disabled={disabled} style={[styles.action, danger && styles.danger, disabled && styles.disabled]}><Icon size={16} color={danger ? colors.destructiveText : colors.successText} /><Text style={[styles.actionText, danger && styles.dangerText]}>{label}</Text></Pressable>;
}

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Pressable android_ripple={RIPPLE}accessibilityRole="link" accessibilityLabel={`Open ${label.toLowerCase()}`} onPress={onPress} style={styles.linkButton}>{label === 'Resume' ? <FileText size={16} color={colors.successText} /> : <ExternalLink size={15} color={colors.successText} />}<Text style={styles.linkText}>{label}</Text></Pressable>;
}

function formatDate(timestampMs: number): string {
  if (!timestampMs) return 'recently';
  return new Date(timestampMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control, marginBottom: 4 },
  emptyText: { color: colors.mutedText, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyButton: { overflow: 'hidden', marginTop: 8, minHeight: 48, justifyContent: 'center', borderRadius: 12, backgroundColor: JOBS_ACTION_GREEN, paddingHorizontal: 24 },
  emptyButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  flex: { flex: 1, minWidth: 0 },
  jobSelector: { gap: 8, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  jobChip: { overflow: 'hidden', maxWidth: 220, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.surface, paddingLeft: 14, paddingRight: 8 },
  jobChipActive: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  jobChipText: { flexShrink: 1, color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
  jobChipTextActive: { color: colors.successText, fontWeight: '800' },
  jobChipCountBox: { minWidth: 24, height: 24, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.control },
  jobChipCountBoxActive: { backgroundColor: colors.surface },
  jobChipCount: { color: colors.mutedText, fontSize: 12, fontWeight: '900' },
  jobCard: { marginHorizontal: 16, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: JOBS_CARD_RADIUS, backgroundColor: colors.surface, padding: 16, gap: 12 },
  jobTitleRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  jobTitle: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  meta: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  jobStatsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  jobStats: { flexShrink: 1, color: colors.mutedText, fontSize: 13 },
  jobStatsStrong: { color: colors.text, fontWeight: '900' },
  jobStatsNew: { color: colors.successText, fontWeight: '800' },
  iconButton: { overflow: 'hidden', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.successSurface },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  editAction: { overflow: 'hidden', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, backgroundColor: colors.control, paddingHorizontal: 12 },
  editActionText: { color: colors.secondaryText, fontSize: 13, fontWeight: '800' },
  action: { overflow: 'hidden', minHeight: 44, flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.successSurface },
  danger: { backgroundColor: colors.destructiveSurface },
  actionText: { color: colors.successText, fontSize: 13, fontWeight: '800' },
  dangerText: { color: colors.destructiveText },
  disabled: { opacity: 0.5 },
  searchBox: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.input, paddingHorizontal: 12 },
  searchInput: { flex: 1, minHeight: 44, color: colors.text, fontSize: 14 },
  filterBar: { paddingHorizontal: 16, paddingVertical: 12 },
  applicantCount: { flex: 0, paddingHorizontal: 16, marginBottom: 8 },
  sectionLabel: { flex: 1, color: colors.secondaryText, fontSize: 13, fontWeight: '800' },
  bulkBar: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, backgroundColor: colors.successSurface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.accent, padding: 12, gap: 8 },
  bulkHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bulkTitle: { flexShrink: 1, color: colors.successText, fontSize: 13, fontWeight: '900' },
  bulkClear: { color: colors.secondaryText, fontSize: 13, fontWeight: '800' },
  bulkActions: { gap: 8 },
  bulkChip: { overflow: 'hidden', minHeight: 40, justifyContent: 'center', borderRadius: 999, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: 14 },
  bulkChipText: { color: colors.successText, fontSize: 13, fontWeight: '800' },
  error: { marginHorizontal: 16, marginBottom: 12, color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 12, padding: 12 },
  applicationCard: { marginHorizontal: 16, marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: JOBS_CARD_RADIUS, backgroundColor: colors.surface, padding: 12 },
  applicationSelected: { borderColor: colors.accent, borderWidth: 1 },
  applicationHeader: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkboxButton: { overflow: 'hidden', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chevronButton: { overflow: 'hidden', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  applicantName: { color: colors.text, fontSize: 15, fontWeight: '900' },
  applicationToolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 4 },
  smallAction: { overflow: 'hidden', minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, paddingHorizontal: 12 },
  noteActionText: { color: colors.warningText, fontSize: 13, fontWeight: '800' },
  interviewActionText: { color: colors.accentText, fontSize: 13, fontWeight: '800' },
  applicationDetails: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 12, paddingTop: 4, paddingHorizontal: 4 },
  detailLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '800', marginTop: 12, marginBottom: 4 },
  detailBody: { color: colors.text, fontSize: 14, lineHeight: 20 },
  answerRow: { marginBottom: 8 },
  answerQuestion: { color: colors.mutedText, fontSize: 12, marginBottom: 2 },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  linkButton: { overflow: 'hidden', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, backgroundColor: colors.successSurface, paddingHorizontal: 14 },
  linkText: { color: colors.successText, fontWeight: '800', fontSize: 13 },
  statuses: { gap: 8 },
  statusChip: { overflow: 'hidden', minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.accent, borderRadius: 12, paddingHorizontal: 14, backgroundColor: colors.surface },
  statusChipDanger: { borderColor: colors.destructiveText },
  statusText: { color: colors.accentText, fontSize: 13, fontWeight: '800' },
  statusTextDanger: { color: colors.destructiveText },
  terminalStatus: { color: colors.mutedText, fontSize: 13, marginTop: 12 },
  emptyApplications: { alignItems: 'center', gap: 6, paddingVertical: 40 },
});
