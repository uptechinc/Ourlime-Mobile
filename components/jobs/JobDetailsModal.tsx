import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { X } from 'lucide-react-native';
import JobDetailsBody from './JobDetailsBody';
import JobReportSheet from './JobReportSheet';
import { JobShareButton } from './JobCardActions';
import { JobDetailBottomBar } from './JobDetailBottomBar';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { auth } from '@/lib/firebaseConfig';
import { JobsService, type JobRecord } from '@/lib/job/JobsService';

type JobDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  job: JobRecord | null;
  isApplied?: boolean;
  isSaved?: boolean;
  onToggleSave?: (jobId: string) => void;
  /** Opens the application (the list checks identity verification first). */
  onApply: (job: JobRecord) => void;
};

const jobsService = JobsService.getInstance();
/** iOS can't present the application sheet (or push a route) while this page sheet is still sliding away. */
const AFTER_CLOSE_MS = 400;

/** Job details sheet with Share, Report, Save and Apply (web components/jobs/JobDetailsModal.tsx). */
export default function JobDetailsModal({ isOpen, onClose, job, isApplied = false, isSaved = false, onToggleSave, onApply }: JobDetailsModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [reportJob, setReportJob] = useState<JobRecord | null>(null);
  if (!isOpen || !job) return null;
  const isCreator = auth.currentUser?.uid === job.basic_info.userId;
  const isOpenForApplications = jobsService.isAcceptingApplications(job);
  const closeThen = (action: () => void) => { onClose(); setTimeout(action, AFTER_CLOSE_MS); };

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <View style={styles.header}>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>{job.basic_info.type === 'quickTask' ? 'Quick task' : 'Job details'}</Text>
          <JobShareButton jobId={job.id} jobTitle={job.basic_info.title} />
          <Pressable accessibilityRole="button" accessibilityLabel="Close job details" onPress={onClose} hitSlop={4} android_ripple={{ color: colors.control, borderless: true }} style={styles.closeBtn}><X size={22} color={colors.icon} /></Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <JobDetailsBody job={job} onReport={isCreator ? undefined : () => setReportJob(job)} />
        </ScrollView>
        <JobDetailBottomBar
          jobId={job.id}
          jobTitle={job.basic_info.title}
          isCreator={isCreator}
          isApplied={isApplied}
          isOpenForApplications={isOpenForApplications}
          isSaved={isSaved}
          onToggleSave={onToggleSave}
          onApply={() => closeThen(() => onApply(job))}
          onViewStatus={() => closeThen(() => router.push('/jobs/applications' as Href))}
          onManage={() => closeThen(() => router.push('/jobs/manage' as Href))}
        />
        <JobReportSheet job={reportJob} onClose={() => setReportJob(null)} />
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.canvas },
    header: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 16, paddingRight: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.surface },
    headerTitle: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '900' },
    closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
    scrollContent: { padding: 16, paddingBottom: 32 },
  });
}
