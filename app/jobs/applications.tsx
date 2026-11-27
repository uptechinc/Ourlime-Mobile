import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ExternalLink, FileText, RotateCcw, XCircle } from 'lucide-react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import PageHeader from '@/components/ui/PageHeader';
import CustomModal from '@/components/ui/CustomModal';
import { ApplicationsSkeleton } from '@/components/jobs/JobsSkeletons';
import { JOBS_ACTION_GREEN, JOBS_CARD_RADIUS, JobStatusPill, formatShortDate, getApplicationStatusPresentation } from '@/components/jobs/JobCardParts';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';
import { jobApplicationService, type JobApplicationStatus, type MyJobApplication } from '@/lib/services/JobApplicationService';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

const WITHDRAWABLE_STATUSES = new Set<JobApplicationStatus>(['pending', 'reviewing']);
const ACTIVE_STATUSES = new Set<JobApplicationStatus>(['pending', 'reviewing', 'interviewing', 'offer']);
const TIMELINE_STEPS = ['Submitted', 'In review', 'Decision'];

/** Where an application sits on Submitted → In review → Decision, or null once it was withdrawn. */
const getTimelineIndex = (status: JobApplicationStatus): number | null => {
  if (status === 'withdrawn' || status === 'job_withdrawn') return null;
  if (status === 'pending') return 0;
  if (status === 'accepted' || status === 'rejected') return 2;
  return 1;
};

const formatDate = (timestampMs: number): string => timestampMs > 0 ? formatShortDate(timestampMs) : 'recently';

export default function MyJobApplicationsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [applications, setApplications] = useState<MyJobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<MyJobApplication | null>(null);
  const [error, setError] = useState('');

  const loadApplications = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    setError('');
    try {
      setApplications(await jobApplicationService.fetchMyApplications());
    } catch (loadError: unknown) {
      console.error('[MyJobApplicationsScreen.loadApplications] Error:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Your applications could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const handleConfirmWithdraw = () => {
    const application = withdrawTarget;
    if (!application) return;
    setWorkingId(application.id);
    setError('');
    void jobApplicationService.withdrawApplication(application.id)
      .then(async () => {
        setWithdrawTarget(null);
        await interactionFeedbackService.play('success');
        await loadApplications();
      })
      .catch((withdrawError: unknown) => {
        console.error('[MyJobApplicationsScreen.handleConfirmWithdraw] Error:', withdrawError);
        setWithdrawTarget(null);
        setError(withdrawError instanceof Error ? withdrawError.message : 'The application could not be withdrawn.');
      })
      .then(() => setWorkingId(null));
  };

  const handleOpenResume = async (resumeUrl: string) => {
    if (!(await Linking.canOpenURL(resumeUrl))) {
      setError('The resume link is no longer available.');
      return;
    }
    await Linking.openURL(resumeUrl);
  };

  const activeCount = applications.filter((application) => ACTIVE_STATUSES.has(application.status)).length;
  const acceptedCount = applications.filter((application) => application.status === 'accepted').length;

  return (
    <SafeAreaView /* discipline-exempt safe-area-edges: the header above applies the top inset */ edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="My Applications" onBackPress={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadApplications(true)} tintColor={colors.accent} />}
      >
        {!loading && applications.length > 0 ? (
          <View style={styles.summary}>
            {[{ label: 'Total', value: applications.length }, { label: 'In progress', value: activeCount }, { label: 'Accepted', value: acceptedCount }].map((stat) => (
              <View key={stat.label} accessible accessibilityLabel={`${stat.value} ${stat.label}`} style={styles.stat}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text numberOfLines={1} style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {loading ? <ApplicationsSkeleton /> : null}
        {!loading && !error && applications.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><FileText size={32} color={colors.mutedText} /></View>
            <Text style={styles.emptyTitle}>No applications yet</Text>
            <Text style={styles.emptyText}>When you apply for a job or quick task, you can follow its progress here.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/jobs')} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.browseButton}>
              <Text style={styles.browseText}>Browse jobs</Text>
            </Pressable>
          </View>
        ) : null}
        {!loading ? applications.map((application) => {
          const canWithdraw = WITHDRAWABLE_STATUSES.has(application.status);
          const isWorking = workingId === application.id;
          const timelineIndex = getTimelineIndex(application.status);
          const statusPresentation = getApplicationStatusPresentation(application.status, 'applicant');
          const wasUpdated = application.updatedAtMs > 0 && Math.floor(application.updatedAtMs / 1000) !== Math.floor(application.createdAtMs / 1000);
          return (
            <View key={application.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text numberOfLines={2} style={styles.jobTitle}>{application.jobTitle}</Text>
                <Text numberOfLines={1} style={styles.employer}>{application.employerName} · {application.jobType === 'quickTask' ? 'Quick task' : 'Professional'}{application.jobCategory ? ` · ${application.jobCategory}` : ''}</Text>
              </View>
              <View style={styles.statusRow}>
                <JobStatusPill presentation={statusPresentation} />
                <Text numberOfLines={1} style={styles.dates}>Applied {formatDate(application.createdAtMs)}{wasUpdated ? ` · Updated ${formatDate(application.updatedAtMs)}` : ''}</Text>
              </View>
              {timelineIndex !== null ? (
                <View accessible accessibilityLabel={`Progress: ${TIMELINE_STEPS[timelineIndex]}`} style={styles.timeline}>
                  {TIMELINE_STEPS.map((stepLabel, stepIndex) => {
                    const isReached = stepIndex <= timelineIndex;
                    const isRejectedDecision = stepIndex === 2 && application.status === 'rejected';
                    const dotColor = !isReached ? colors.border : isRejectedDecision ? colors.destructiveText : colors.accent;
                    return <View key={stepLabel} style={styles.timelineStep}>
                      <View style={styles.timelineTrack}>
                        <View style={[styles.timelineLine, stepIndex === 0 && styles.hidden, { backgroundColor: isReached ? colors.accent : colors.border }]} />
                        <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
                        <View style={[styles.timelineLine, stepIndex === TIMELINE_STEPS.length - 1 && styles.hidden, { backgroundColor: stepIndex < timelineIndex ? colors.accent : colors.border }]} />
                      </View>
                      <Text numberOfLines={1} style={[styles.timelineLabel, isReached && styles.timelineLabelReached]}>{stepIndex === 2 && timelineIndex === 2 ? statusPresentation.label : stepIndex === 1 && (application.status === 'interviewing' || application.status === 'offer') ? statusPresentation.label : stepLabel}</Text>
                    </View>;
                  })}
                </View>
              ) : <Text style={styles.withdrawnNote}>{application.status === 'job_withdrawn' ? 'The poster removed this listing, so the application was closed.' : 'You withdrew this application.'}</Text>}
              {application.coverLetter ? <Text numberOfLines={2} style={styles.coverLetter}>{application.coverLetter}</Text> : null}
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" accessibilityLabel={`View job ${application.jobTitle}`} onPress={() => router.push(`/jobs/${encodeURIComponent(application.jobId)}` as Href)} android_ripple={{ color: colors.control }} style={styles.secondaryButton}>
                  <ExternalLink size={16} color={colors.accentText} /><Text numberOfLines={1} style={styles.secondaryButtonText}>View job</Text>
                </Pressable>
                {application.resumeUrl ? (
                  <Pressable accessibilityRole="link" accessibilityLabel="Open the resume you sent" onPress={() => void handleOpenResume(application.resumeUrl)} android_ripple={{ color: colors.control }} style={styles.secondaryButton}>
                    <FileText size={16} color={colors.accentText} /><Text numberOfLines={1} style={styles.secondaryButtonText}>Resume</Text>
                  </Pressable>
                ) : null}
                {canWithdraw ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Withdraw application for ${application.jobTitle}`} accessibilityState={{ disabled: isWorking, busy: isWorking }} disabled={isWorking} onPress={() => setWithdrawTarget(application)} android_ripple={{ color: colors.control }} style={[styles.withdrawButton, isWorking && styles.disabled]}>
                    {isWorking ? <ActivityIndicator size="small" color={colors.destructiveText} /> : <><XCircle size={16} color={colors.destructiveText} /><Text numberOfLines={1} style={styles.withdrawText}>Withdraw</Text></>}
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        }) : null}
        {!loading && applications.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => void loadApplications(true)} style={styles.refreshButton}>
            <RotateCcw size={16} color={colors.accentText} /><Text style={styles.refreshText}>Refresh statuses</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <CustomModal
        visible={withdrawTarget !== null}
        type="danger"
        title="Withdraw application?"
        message={withdrawTarget ? `Your application for ${withdrawTarget.jobTitle} will be marked as withdrawn and cannot be reopened.` : ''}
        confirmText="Withdraw"
        cancelText="Keep application"
        isLoading={Boolean(withdrawTarget && workingId === withdrawTarget.id)}
        onConfirm={handleConfirmWithdraw}
        onCancel={() => setWithdrawTarget(null)}
        onClose={() => { if (!workingId) setWithdrawTarget(null); }}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.canvas },
    content: { padding: 16, paddingBottom: 48, gap: 12 },
    summary: { flexDirection: 'row', gap: 8 },
    stat: { flex: 1, minWidth: 0, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
    statValue: { color: colors.text, fontSize: 20, fontWeight: '900' },
    statLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
    error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 12, padding: 12 },
    empty: { alignItems: 'center', gap: 8, padding: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: JOBS_CARD_RADIUS, backgroundColor: colors.surface },
    emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control, marginBottom: 4 },
    emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
    emptyText: { color: colors.mutedText, fontSize: 13, textAlign: 'center', lineHeight: 19 },
    browseButton: { minHeight: 48, overflow: 'hidden', borderRadius: 12, backgroundColor: JOBS_ACTION_GREEN, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
    browseText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
    card: { gap: 12, padding: 16, borderRadius: JOBS_CARD_RADIUS, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
    cardTop: { gap: 4 },
    jobTitle: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: '800' },
    employer: { color: colors.mutedText, fontSize: 13 },
    statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    dates: { flexShrink: 1, color: colors.mutedText, fontSize: 12 },
    timeline: { flexDirection: 'row' },
    timelineStep: { flex: 1, minWidth: 0, alignItems: 'center', gap: 4 },
    timelineTrack: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center' },
    timelineLine: { flex: 1, height: 2 },
    hidden: { opacity: 0 },
    timelineDot: { width: 10, height: 10, borderRadius: 5 },
    timelineLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '600' },
    timelineLabelReached: { color: colors.text, fontWeight: '800' },
    withdrawnNote: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
    coverLetter: { color: colors.secondaryText, fontSize: 13, lineHeight: 19, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    secondaryButton: { flexGrow: 1, minHeight: 44, overflow: 'hidden', borderRadius: 12, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    secondaryButtonText: { color: colors.accentText, fontSize: 13, fontWeight: '800' },
    withdrawButton: { flexGrow: 1, minHeight: 44, overflow: 'hidden', borderRadius: 12, paddingHorizontal: 12, backgroundColor: colors.destructiveSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    withdrawText: { color: colors.destructiveText, fontSize: 13, fontWeight: '800' },
    disabled: { opacity: 0.55 },
    refreshButton: { alignSelf: 'center', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
    refreshText: { color: colors.accentText, fontWeight: '800' },
  });
}
