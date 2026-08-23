import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Archive, Briefcase, CalendarClock, CheckSquare, ChevronDown, ChevronUp, Edit3, ExternalLink, FileText, History, MapPin, RotateCcw, Search, Square, StickyNote, Trash2, XCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import PageHeader from '@/components/ui/PageHeader';
import { JobManagementAuditSheet, JobManagementEditSheet, JobManagementInterviewSheet, JobManagementNotesSheet } from '@/components/jobs/manage/JobManagementSheets';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import {
  jobManagementService,
  type ApplicationStatus,
  type ManagedJob,
  type ManagedJobApplication,
} from '@/lib/services/JobManagementService';
import { linkPresentationService } from '@/lib/services/LinkPresentationService';

type ApplicationFilter = 'all' | ApplicationStatus;
type ApplicationSort = 'newest' | 'oldest' | 'name';

const applicationStatuses: ApplicationStatus[] = ['reviewing', 'interviewing', 'offer', 'accepted', 'rejected'];
const applicationFilters: ApplicationFilter[] = ['all', 'pending', 'reviewing', 'interviewing', 'offer', 'accepted', 'rejected', 'withdrawn', 'job_withdrawn'];
const applicationSorts: ApplicationSort[] = ['newest', 'oldest', 'name'];

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
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<Set<string>>(new Set());
  const [expandedApplicationId, setExpandedApplicationId] = useState('');
  const [notesApplication, setNotesApplication] = useState<ManagedJobApplication | null>(null);
  const [interviewApplication, setInterviewApplication] = useState<ManagedJobApplication | null>(null);
  const [auditJob, setAuditJob] = useState<ManagedJob | null>(null);
  const [editJob, setEditJob] = useState<ManagedJob | null>(null);

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
    void jobManagementService.getCachedCurrentUserJobs().then((cachedJobs) => {
      if (active && cachedJobs?.length) {
        applyJobs(cachedJobs);
        setLoading(false);
      }
    }).finally(() => {
      if (active) void load();
    });
    return () => { active = false; };
  }, [applyJobs, load]);

  const selectedJob = useMemo(() => jobs.find((job) => job.id === selectedJobId) ?? null, [jobs, selectedJobId]);

  useEffect(() => {
    setSelectedApplicationIds(new Set());
    setExpandedApplicationId('');
  }, [selectedJobId]);

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

  const handleJobAction = async (jobId: string, action: 'close' | 'archive' | 'reopen' | 'delete') => {
    setWorkingId(jobId);
    setError('');
    try {
      if (action === 'delete') await jobManagementService.deleteJob(jobId);
      else await jobManagementService.changeJobState(jobId, action);
      await load();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : 'The job could not be updated.');
    } finally {
      setWorkingId(null);
    }
  };

  const handleDeleteJob = (job: ManagedJob) => {
    Alert.alert('Delete job?', `${job.title} and its associated data will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void handleJobAction(job.id, 'delete') },
    ]);
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

  const handleOpenLink = async (value: string) => {
    const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    if (!/^https?:\/\//i.test(url) || !(await Linking.canOpenURL(url))) {
      setError('This applicant link is not valid.');
      return;
    }
    await Linking.openURL(url);
  };

  const listHeader = <>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.jobSelector}>
      {jobs.map((job) => <TouchableOpacity key={job.id} onPress={() => setSelectedJobId(job.id)} style={[styles.jobChip, selectedJobId === job.id && styles.jobChipActive]}><Text numberOfLines={1} style={[styles.jobChipText, selectedJobId === job.id && styles.jobChipTextActive]}>{job.title}</Text><Text style={[styles.jobChipCount, selectedJobId === job.id && styles.jobChipTextActive]}>{job.applications.length}</Text></TouchableOpacity>)}
    </ScrollView>
    {selectedJob ? <View style={styles.jobCard}>
      <View style={styles.jobTitleRow}><View style={styles.flex}><Text style={styles.jobTitle}>{selectedJob.title}</Text><View style={styles.locationRow}><MapPin size={13} color={colors.mutedText} /><Text numberOfLines={1} ellipsizeMode="tail" style={[styles.meta, styles.flex]}>{linkPresentationService.compactUrlsInText(selectedJob.location)} · {selectedJob.type === 'quickTask' ? 'Quick Task' : 'Professional'} · {selectedJob.status}</Text></View></View><TouchableOpacity onPress={() => setAuditJob(selectedJob)} style={styles.iconButton}><History size={19} color={colors.successText} /></TouchableOpacity></View>
      <View style={styles.actions}><TouchableOpacity onPress={() => setEditJob(selectedJob)} style={styles.editAction}><Edit3 size={15} color={colors.icon} /><Text style={styles.editActionText}>Edit</Text></TouchableOpacity>{selectedJob.status === 'closed' || selectedJob.status === 'archived' ? <Action label="Reopen" icon="reopen" disabled={workingId === selectedJob.id} onPress={() => void handleJobAction(selectedJob.id, 'reopen')} /> : <Action label="Close" icon="close" disabled={workingId === selectedJob.id} onPress={() => void handleJobAction(selectedJob.id, 'close')} />}<Action label="Archive" icon="archive" disabled={workingId === selectedJob.id} onPress={() => void handleJobAction(selectedJob.id, 'archive')} /><Action label="Delete" icon="delete" danger disabled={workingId === selectedJob.id} onPress={() => handleDeleteJob(selectedJob)} /></View>
    </View> : null}
    <View style={styles.searchBox}><Search size={18} color={colors.mutedText} /><TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search applicants, cover letters, answers…" placeholderTextColor={colors.mutedText} style={styles.searchInput} /></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>{applicationFilters.map((filterOption) => <TouchableOpacity key={filterOption} onPress={() => setFilter(filterOption)} style={[styles.filterChip, filter === filterOption && styles.filterChipActive]}><Text style={[styles.filterText, filter === filterOption && styles.filterTextActive]}>{filterOption}</Text></TouchableOpacity>)}</ScrollView>
    <View style={styles.sortRow}><Text style={styles.sectionLabel}>{visibleApplications.length} applicant{visibleApplications.length === 1 ? '' : 's'}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortOptions}>{applicationSorts.map((sortOption) => <TouchableOpacity key={sortOption} onPress={() => setSort(sortOption)}><Text style={[styles.sortText, sort === sortOption && styles.sortTextActive]}>{sortOption}</Text></TouchableOpacity>)}</ScrollView></View>
    {selectedApplicationIds.size > 0 ? <View style={styles.bulkBar}><Text style={styles.bulkTitle}>{selectedApplicationIds.size} selected</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bulkActions}>{applicationStatuses.map((status) => <TouchableOpacity key={status} disabled={workingId === 'bulk'} onPress={() => void handleBulkStatus(status)} style={styles.bulkChip}><Text style={styles.bulkChipText}>{status}</Text></TouchableOpacity>)}</ScrollView></View> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </>;

  if (loading && jobs.length === 0) return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}><PageHeader title="Manage Jobs" onBackPress={() => router.back()} /><View style={styles.center}><ActivityIndicator size="large" color="#10b981" /><Text style={styles.meta}>Loading your jobs…</Text></View></SafeAreaView>;
  if (!loading && jobs.length === 0) return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}><PageHeader title="Manage Jobs" onBackPress={() => router.back()} /><View style={styles.center}><Briefcase size={42} color={colors.mutedText} /><Text style={styles.jobTitle}>No jobs published</Text><Text style={styles.meta}>Create an opportunity from the Jobs screen.</Text></View></SafeAreaView>;

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
    <PageHeader title="Manage Jobs" onBackPress={() => router.back()} />
    <FlatList
      data={visibleApplications}
      keyExtractor={(application) => application.id}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={<View style={styles.emptyApplications}><Text style={styles.jobTitle}>No matching applicants</Text><Text style={styles.meta}>Try another filter or search.</Text></View>}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#10b981" />}
      renderItem={({ item: application }) => <ApplicationCard
        application={application}
        selected={selectedApplicationIds.has(application.id)}
        expanded={expandedApplicationId === application.id}
        working={workingId === application.id}
        onToggleSelected={() => handleToggleSelected(application.id)}
        onToggleExpanded={() => setExpandedApplicationId((currentId) => currentId === application.id ? '' : application.id)}
        onStatus={(status) => void handleApplication(application, status)}
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
    <JobManagementAuditSheet job={auditJob} onClose={() => setAuditJob(null)} />
    <JobManagementEditSheet job={editJob} onClose={() => setEditJob(null)} onSaved={async () => { await load(); }} />
    <JobManagementInterviewSheet application={interviewApplication} job={selectedJob} onClose={() => setInterviewApplication(null)} onScheduled={async () => { await load(); }} />
  </SafeAreaView>;
}

type ApplicationCardProps = {
  application: ManagedJobApplication;
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

function ApplicationCard({ application, selected, expanded, working, onToggleSelected, onToggleExpanded, onStatus, onNotes, onInterview, onOpenLink }: ApplicationCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const answers = Object.entries(application.answers);
  const allowedStatuses = getAllowedApplicationStatuses(application.status);
  const canScheduleInterview = application.status === 'reviewing';
  return <View style={[styles.applicationCard, selected && styles.applicationSelected]}>
    <View style={styles.applicationHeader}><TouchableOpacity onPress={onToggleSelected} hitSlop={8}>{selected ? <CheckSquare size={22} color={colors.accent} /> : <Square size={22} color={colors.mutedText} />}</TouchableOpacity><TouchableOpacity style={styles.flex} onPress={onToggleExpanded}><Text style={styles.applicantName}>{application.applicant.name}</Text><Text style={styles.meta}>{application.applicant.email || 'No public email'} · Applied {formatDate(application.createdAtMs)}</Text></TouchableOpacity><TouchableOpacity onPress={onToggleExpanded}>{expanded ? <ChevronUp size={21} color={colors.icon} /> : <ChevronDown size={21} color={colors.icon} />}</TouchableOpacity></View>
    <View style={styles.applicationToolbar}><View style={styles.statusBadge}><Text style={styles.statusBadgeText}>{application.status}</Text></View><TouchableOpacity onPress={onNotes} style={styles.smallAction}><StickyNote size={15} color={colors.warningText} /><Text style={styles.noteActionText}>Notes</Text></TouchableOpacity><TouchableOpacity disabled={!canScheduleInterview} onPress={onInterview} style={[styles.smallAction, !canScheduleInterview && styles.disabled]}><CalendarClock size={15} color={colors.accentText} /><Text style={styles.interviewActionText}>Interview</Text></TouchableOpacity></View>
    {expanded ? <View style={styles.applicationDetails}>
      <Text style={styles.detailLabel}>Cover letter</Text><Text style={styles.detailBody}>{application.coverLetter || 'No cover letter provided.'}</Text>
      {answers.length ? <><Text style={styles.detailLabel}>Application answers</Text>{answers.map(([questionId, answer]) => <View key={questionId} style={styles.answerRow}><Text style={styles.answerQuestion}>{questionId}</Text><Text style={styles.detailBody}>{Array.isArray(answer) ? answer.join(', ') : answer}</Text></View>)}</> : null}
      {application.applicant.workExperience.length ? <><Text style={styles.detailLabel}>Experience</Text>{application.applicant.workExperience.slice(0, 4).map((experience) => <Text key={experience.id} style={styles.detailBody}>{experience.role || 'Role'} · {experience.company || 'Company'}</Text>)}</> : null}
      {application.applicant.education.length ? <><Text style={styles.detailLabel}>Education</Text>{application.applicant.education.slice(0, 4).map((education) => <Text key={education.id} style={styles.detailBody}>{education.degree || 'Study'} · {education.school || 'School'}</Text>)}</> : null}
      <View style={styles.linkRow}>{application.resumeUrl ? <LinkButton label="Resume" onPress={() => onOpenLink(application.resumeUrl)} /> : null}{application.portfolioLink ? <LinkButton label="Portfolio" onPress={() => onOpenLink(application.portfolioLink)} /> : null}</View>
      {allowedStatuses.length > 0 ? <><Text style={styles.detailLabel}>Update status</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statuses}>{allowedStatuses.map((status) => <TouchableOpacity key={status} disabled={working} onPress={() => onStatus(status)} style={styles.statusChip}><Text style={styles.statusText}>{status}</Text></TouchableOpacity>)}</ScrollView></> : <Text style={styles.terminalStatus}>This application is in a final state.</Text>}
    </View> : null}
  </View>;
}

type ActionProps = { label: string; icon: 'reopen' | 'close' | 'archive' | 'delete'; onPress: () => void; disabled: boolean; danger?: boolean };
function Action({ label, icon, onPress, disabled, danger = false }: ActionProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const Icon = icon === 'reopen' ? RotateCcw : icon === 'close' ? XCircle : icon === 'archive' ? Archive : Trash2;
  return <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.action, danger && styles.danger, disabled && styles.disabled]}><Icon size={15} color={danger ? colors.destructiveText : colors.successText} /><Text style={[styles.actionText, danger && styles.dangerText]}>{label}</Text></TouchableOpacity>;
}

function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <TouchableOpacity onPress={onPress} style={styles.linkButton}>{label === 'Resume' ? <FileText size={15} color={colors.successText} /> : <ExternalLink size={15} color={colors.successText} />}<Text style={styles.linkText}>{label}</Text></TouchableOpacity>;
}

function formatDate(timestampMs: number): string {
  if (!timestampMs) return 'recently';
  return new Date(timestampMs).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingBottom: 50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  flex: { flex: 1 },
  jobSelector: { gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  jobChip: { maxWidth: 190, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 9 },
  jobChipActive: { borderColor: colors.accent, backgroundColor: colors.successSurface },
  jobChipText: { maxWidth: 140, color: colors.secondaryText, fontSize: 12, fontWeight: '800' },
  jobChipTextActive: { color: colors.successText },
  jobChipCount: { color: colors.mutedText, fontSize: 11, fontWeight: '900' },
  jobCard: { marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: 15, gap: 12 },
  jobTitleRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  jobTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  meta: { color: colors.mutedText, fontSize: 11 },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.successSurface },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editAction: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, backgroundColor: colors.control, paddingHorizontal: 10, paddingVertical: 8 },
  editActionText: { color: colors.secondaryText, fontSize: 12, fontWeight: '800' },
  action: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.successSurface },
  danger: { backgroundColor: colors.destructiveSurface },
  actionText: { color: colors.successText, fontSize: 12, fontWeight: '800' },
  dangerText: { color: colors.destructiveText },
  disabled: { opacity: 0.5 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.input, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: colors.text, paddingVertical: 11 },
  filterRow: { gap: 7, paddingHorizontal: 16, paddingVertical: 11 },
  filterChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, backgroundColor: colors.surface, paddingHorizontal: 11, paddingVertical: 7 },
  filterChipActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  filterText: { color: colors.mutedText, fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  filterTextActive: { color: colors.onAccent },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 9 },
  sectionLabel: { flex: 1, color: colors.secondaryText, fontSize: 12, fontWeight: '900' },
  sortOptions: { gap: 12 },
  sortText: { color: colors.mutedText, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  sortTextActive: { color: colors.successText, textDecorationLine: 'underline' },
  bulkBar: { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, backgroundColor: colors.selectedControl, padding: 11, gap: 8 },
  bulkTitle: { color: colors.selectedText, fontSize: 12, fontWeight: '900' },
  bulkActions: { gap: 7 },
  bulkChip: { borderRadius: 999, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 6 },
  bulkChipText: { color: colors.successText, fontSize: 10, fontWeight: '900', textTransform: 'capitalize' },
  error: { marginHorizontal: 16, marginBottom: 10, color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 12, padding: 11 },
  applicationCard: { marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 17, backgroundColor: colors.surface, padding: 14 },
  applicationSelected: { borderColor: colors.accent, backgroundColor: colors.surface },
  applicationHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  applicantName: { color: colors.text, fontSize: 15, fontWeight: '900' },
  applicationToolbar: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  statusBadge: { borderRadius: 999, backgroundColor: colors.successSurface, paddingHorizontal: 9, paddingVertical: 5 },
  statusBadgeText: { color: colors.successText, fontSize: 10, fontWeight: '900', textTransform: 'capitalize' },
  smallAction: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: colors.canvas, paddingHorizontal: 9, paddingVertical: 6 },
  noteActionText: { color: colors.warningText, fontSize: 10, fontWeight: '900' },
  interviewActionText: { color: colors.accentText, fontSize: 10, fontWeight: '900' },
  applicationDetails: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 12, paddingTop: 12 },
  detailLabel: { color: colors.secondaryText, fontSize: 11, fontWeight: '900', marginTop: 9, marginBottom: 5, textTransform: 'uppercase' },
  detailBody: { color: colors.text, fontSize: 12, lineHeight: 18 },
  answerRow: { marginBottom: 7 },
  answerQuestion: { color: colors.mutedText, fontSize: 10, marginBottom: 2 },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 11 },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, backgroundColor: colors.successSurface, paddingHorizontal: 11, paddingVertical: 8 },
  linkText: { color: colors.successText, fontWeight: '800', fontSize: 12 },
  statuses: { gap: 7 },
  statusChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 },
  statusChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  statusText: { color: colors.mutedText, fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  statusTextActive: { color: colors.onAccent },
  terminalStatus: { color: colors.mutedText, fontSize: 12, fontStyle: 'italic', marginTop: 10 },
  emptyApplications: { alignItems: 'center', gap: 6, paddingVertical: 45 },
});
