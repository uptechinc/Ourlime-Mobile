import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle2, Send, X } from 'lucide-react-native';
import JobDetailsBody from './JobDetailsBody';
import JobReportSheet from './JobReportSheet';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { auth } from '@/lib/firebaseConfig';
import { JobsService, type JobRecord } from '@/lib/job/JobsService';
import { formatJobPrice, getJobCompanyName } from '@/lib/job/JobPresentation';

type JobDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  job: JobRecord | null;
  isApplied?: boolean;
  /** Opens the application (the list checks identity verification first). */
  onApply: (job: JobRecord) => void;
};

const jobsService = JobsService.getInstance();
/** iOS can't present the application sheet while this page sheet is still sliding away. */
const APPLY_AFTER_CLOSE_MS = 400;

/** Job details sheet with Report listing, Close and Apply now (web components/jobs/JobDetailsModal.tsx). */
export default function JobDetailsModal({ isOpen, onClose, job, isApplied = false, onApply }: JobDetailsModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [reportJob, setReportJob] = useState<JobRecord | null>(null);
  if (!isOpen || !job) return null;
  const isCreator = auth.currentUser?.uid === job.basic_info.userId;
  const isOpenForApplications = jobsService.isAcceptingApplications(job);

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text numberOfLines={2} style={styles.headerTitle}>{job.basic_info.title}</Text>
            <Text numberOfLines={1} style={styles.headerSubtitle}>{getJobCompanyName(job)}</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close job details" onPress={onClose} style={styles.closeBtn}><X size={22} color={colors.text} /></TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <JobDetailsBody job={job} onReport={isCreator ? undefined : () => setReportJob(job)} />
        </ScrollView>
        <View style={styles.bottomBar}>
          <View style={styles.priceColumn}>
            <Text style={styles.priceLabel}>Compensation</Text>
            <Text style={styles.priceValue}>{formatJobPrice(job)}</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={onClose} style={styles.secondaryBtn}><Text style={styles.secondaryText}>Close</Text></TouchableOpacity>
          {isCreator ? null : isApplied ? (
            <View style={[styles.applyBtn, styles.appliedBtn]}><CheckCircle2 size={16} color={colors.mutedText} /><Text style={[styles.applyText, { color: colors.mutedText }]}>Applied</Text></View>
          ) : isOpenForApplications ? (
            <TouchableOpacity accessibilityRole="button" onPress={() => { onClose(); setTimeout(() => onApply(job), APPLY_AFTER_CLOSE_MS); }} style={styles.applyBtn}><Send size={16} color={colors.onAccent} /><Text style={styles.applyText}>Apply now</Text></TouchableOpacity>
          ) : (
            <View style={[styles.applyBtn, styles.appliedBtn]}><Text style={[styles.applyText, { color: colors.mutedText }]}>Closed</Text></View>
          )}
        </View>
        <JobReportSheet job={reportJob} onClose={() => setReportJob(null)} />
      </SafeAreaView>
    </Modal>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  headerSubtitle: { color: colors.mutedText, fontSize: 13, marginTop: 2 },
  closeBtn: { padding: 4 },
  scrollContent: { padding: 16, paddingBottom: 30 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  priceColumn: { flex: 1, minWidth: 0 },
  priceLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '700' },
  priceValue: { color: colors.text, fontSize: 15, fontWeight: '900' },
  secondaryBtn: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.text, fontWeight: '800' },
  applyBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.accent },
  appliedBtn: { backgroundColor: colors.control, borderWidth: 1, borderColor: colors.border },
  applyText: { color: colors.onAccent, fontWeight: '900' },
});
