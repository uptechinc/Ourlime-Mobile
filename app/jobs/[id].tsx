import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ArrowLeft, SearchX } from 'lucide-react-native';
import JobApplicationModal from '@/components/jobs/applyJobs/JobApplicationModal';
import JobDetailsBody from '@/components/jobs/JobDetailsBody';
import JobReportSheet from '@/components/jobs/JobReportSheet';
import IdentityVerificationModal from '@/components/jobs/IdentityVerificationModal';
import { JobShareButton } from '@/components/jobs/JobCardActions';
import { JobDetailBottomBar } from '@/components/jobs/JobDetailBottomBar';
import { JOBS_ACTION_GREEN } from '@/components/jobs/JobCardParts';
import { JobDetailBottomBarSkeleton, JobDetailSkeleton } from '@/components/jobs/JobsSkeletons';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useJobsViewer } from '@/lib/hooks/useJobsViewer';
import { JobsService, type JobRecord } from '@/lib/job/JobsService';

const jobsService = JobsService.getInstance();

/** A shared job link (web app/jobs/[id] → /jobs?apply=<id>): the job's details with Apply, Save, Share and Report. */
export default function JobDetailScreen() {
  const router = useRouter();
  const { id, apply } = useLocalSearchParams<{ id: string; apply?: string }>();
  const jobId = typeof id === 'string' ? id : '';
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const viewer = useJobsViewer();
  const [job, setJob] = useState<JobRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);
  const [reportJob, setReportJob] = useState<JobRecord | null>(null);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  const loadJob = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const found = await jobsService.getJobById(jobId);
      if (found) setJob(found);
      else setError('Job posting not found or has expired.');
    } catch (loadError: unknown) {
      console.error('[JobDetailScreen.loadJob] Error:', loadError);
      setError('Could not load job details.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { void loadJob(); }, [loadJob]);

  const isCreator = Boolean(job && viewer.userId === job.basic_info.userId);
  const isApplied = Boolean(job && viewer.appliedJobIds.has(job.id));
  const isOpenForApplications = Boolean(job && jobsService.isAcceptingApplications(job));

  const handleApply = useCallback(() => {
    if (!viewer.isVerified) { setIsVerificationOpen(true); return; }
    setIsApplyOpen(true);
  }, [viewer.isVerified]);

  // /jobs/<id>?apply=1 opens the application straight away, like the website's share link.
  useEffect(() => {
    if (!apply || hasAutoOpened || !job || !viewer.isViewerLoaded || isCreator || isApplied || !isOpenForApplications) return;
    setHasAutoOpened(true);
    handleApply();
  }, [apply, handleApply, hasAutoOpened, isApplied, isCreator, isOpenForApplications, job, viewer.isViewerLoaded]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} hitSlop={4} android_ripple={{ color: colors.control, borderless: true }} style={styles.headerBtn}><ArrowLeft size={22} color={colors.icon} /></Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{job ? (job.basic_info.type === 'quickTask' ? 'Quick task' : 'Job details') : 'Job opportunity'}</Text>
        {job ? <JobShareButton jobId={job.id} jobTitle={job.basic_info.title} /> : <View style={styles.headerSpacer} />}
      </View>

      {loading ? (
        <View style={styles.flex}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}><JobDetailSkeleton /></ScrollView>
          <JobDetailBottomBarSkeleton />
        </View>
      ) : error || !job ? (
        <SafeAreaView edges={['bottom']} style={styles.centerContainer}>
          <View style={styles.errorIcon}><SearchX size={30} color={colors.mutedText} /></View>
          <Text style={styles.errorText}>{error || 'Job not found.'}</Text>
          <Text style={styles.errorHint}>It may have been filled, closed or removed by the poster.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/jobs')} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.backToJobsBtn}><Text style={styles.backToJobsText}>Browse jobs</Text></Pressable>
        </SafeAreaView>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <JobDetailsBody job={job} onReport={isCreator ? undefined : () => setReportJob(job)} />
          </ScrollView>
          <JobDetailBottomBar
            jobId={job.id}
            jobTitle={job.basic_info.title}
            isCreator={isCreator}
            isApplied={isApplied}
            isOpenForApplications={isOpenForApplications}
            isSaved={viewer.savedJobIds.has(job.id)}
            onToggleSave={(savedJobId) => void viewer.toggleSave(savedJobId)}
            onApply={handleApply}
            onViewStatus={() => router.push('/jobs/applications' as Href)}
            onManage={() => router.push('/jobs/manage' as Href)}
          />
        </>
      )}

      {job && isApplyOpen ? (
        <JobApplicationModal isOpen job={job} jobType={job.basic_info.type} onClose={() => setIsApplyOpen(false)} onApplied={() => viewer.markApplied(job.id)} />
      ) : null}
      <IdentityVerificationModal isOpen={isVerificationOpen} onClose={() => setIsVerificationOpen(false)} verificationStatus={viewer.verificationStatus} />
      <JobReportSheet job={reportJob} onClose={() => setReportJob(null)} />
    </SafeAreaView>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.canvas },
    flex: { flex: 1, minWidth: 0 },
    header: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface },
    headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
    headerTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '800', paddingHorizontal: 4 },
    headerSpacer: { width: 44 },
    scrollContent: { padding: 16, paddingBottom: 32 },
    centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
    errorIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control, marginBottom: 4 },
    errorText: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
    errorHint: { color: colors.mutedText, fontSize: 13, lineHeight: 19, textAlign: 'center' },
    backToJobsBtn: { marginTop: 8, minHeight: 48, justifyContent: 'center', overflow: 'hidden', backgroundColor: JOBS_ACTION_GREEN, borderRadius: 12, paddingHorizontal: 24 },
    backToJobsText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  });
}
