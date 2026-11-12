import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, ChevronLeft, Send } from 'lucide-react-native';
import JobApplicationModal from '@/components/jobs/applyJobs/JobApplicationModal';
import JobDetailsBody from '@/components/jobs/JobDetailsBody';
import JobReportSheet from '@/components/jobs/JobReportSheet';
import IdentityVerificationModal from '@/components/jobs/IdentityVerificationModal';
import { JobCardActions } from '@/components/jobs/JobCardActions';
import { JobDetailBottomBarSkeleton, JobDetailSkeleton } from '@/components/jobs/JobsSkeletons';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useJobsViewer } from '@/lib/hooks/useJobsViewer';
import { JobsService, type JobRecord } from '@/lib/job/JobsService';
import { formatJobPrice } from '@/lib/job/JobPresentation';

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
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.headerBtn}><ChevronLeft size={24} color={colors.text} /></TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{job?.basic_info.title || 'Job Opportunity'}</Text>
        {job ? <JobCardActions jobId={job.id} jobTitle={job.basic_info.title} isSaved={viewer.savedJobIds.has(job.id)} onToggleSave={(savedJobId) => void viewer.toggleSave(savedJobId)} /> : <View style={styles.headerSpacer} />}
      </View>

      {loading ? (
        <View style={styles.flex}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}><JobDetailSkeleton /></ScrollView>
          <JobDetailBottomBarSkeleton />
        </View>
      ) : error || !job ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error || 'Job not found.'}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.replace('/jobs')} style={styles.backToJobsBtn}><Text style={styles.backToJobsText}>Browse All Jobs</Text></TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <JobDetailsBody job={job} onReport={isCreator ? undefined : () => setReportJob(job)} />
          </ScrollView>
          <View style={styles.bottomBar}>
            <View style={styles.flex}>
              <Text style={styles.priceLabel}>Compensation</Text>
              <Text style={styles.priceValue}>{formatJobPrice(job)}</Text>
            </View>
            {isCreator ? (
              <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/jobs/manage')} style={styles.applyBtn}><Text style={styles.applyText}>Manage listing</Text></TouchableOpacity>
            ) : isApplied ? (
              <View style={[styles.applyBtn, styles.mutedBtn]}><CheckCircle2 size={16} color={colors.mutedText} /><Text style={[styles.applyText, { color: colors.mutedText }]}>Applied</Text></View>
            ) : isOpenForApplications ? (
              <TouchableOpacity accessibilityRole="button" onPress={handleApply} style={styles.applyBtn}><Send size={16} color={colors.onAccent} /><Text style={styles.applyText}>Apply Now</Text></TouchableOpacity>
            ) : (
              <View style={[styles.applyBtn, styles.mutedBtn]}><Text style={[styles.applyText, { color: colors.mutedText }]}>No longer accepting applications</Text></View>
            )}
          </View>
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

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, minWidth: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  headerBtn: { padding: 4 },
  headerTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '800' },
  headerSpacer: { width: 88 },
  scrollContent: { padding: 16, paddingBottom: 30 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  errorText: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  backToJobsBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11 },
  backToJobsText: { color: colors.onAccent, fontWeight: '800' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  priceLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '700' },
  priceValue: { color: colors.text, fontSize: 16, fontWeight: '900' },
  applyBtn: { minHeight: 44, maxWidth: '62%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.accent },
  mutedBtn: { backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border },
  applyText: { color: colors.onAccent, fontWeight: '900', flexShrink: 1 },
});
