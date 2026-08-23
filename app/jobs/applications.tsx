import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Briefcase, Building2, CalendarDays, ExternalLink, FileText, RotateCcw, XCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import PageHeader from '@/components/ui/PageHeader';
import AnimatedActionButton from '@/components/ui/AnimatedActionButton';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';
import { jobApplicationService, type JobApplicationStatus, type MyJobApplication } from '@/lib/services/JobApplicationService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const WITHDRAWABLE_STATUSES = new Set<JobApplicationStatus>(['pending', 'reviewing']);

export default function MyJobApplicationsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [applications, setApplications] = useState<MyJobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadApplications = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    setError('');
    try {
      setApplications(await jobApplicationService.fetchMyApplications());
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Your applications could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const handleWithdraw = (application: MyJobApplication) => {
    Alert.alert(
      'Withdraw application?',
      `Your application for ${application.jobTitle} will be marked as withdrawn and cannot be reopened.`,
      [
        { text: 'Keep application', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: () => {
            setWorkingId(application.id);
            setError('');
            void jobApplicationService.withdrawApplication(application.id)
              .then(async () => {
                await interactionFeedbackService.play('success');
                await loadApplications();
              })
              .catch((withdrawError: unknown) => {
                setError(withdrawError instanceof Error ? withdrawError.message : 'The application could not be withdrawn.');
              })
              .finally(() => setWorkingId(null));
          },
        },
      ],
    );
  };

  const handleOpenResume = async (resumeUrl: string) => {
    if (!(await Linking.canOpenURL(resumeUrl))) {
      setError('The resume link is no longer available.');
      return;
    }
    await Linking.openURL(resumeUrl);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <PageHeader title="My Applications" onBackPress={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadApplications(true)} tintColor={colors.accent} />}
      >
        <View style={styles.hero}>
          <Briefcase size={30} color="#052e16" />
          <View style={styles.flex}>
            <Text style={styles.heroTitle}>Track every opportunity</Text>
            <Text style={styles.heroText}>See progress and manage applications you have submitted.</Text>
          </View>
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {loading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /><Text style={styles.mutedText}>Loading applications…</Text></View> : null}
        {!loading && applications.length === 0 ? (
          <View style={styles.empty}>
            <FileText size={42} color={colors.mutedText} />
            <Text style={styles.emptyTitle}>No applications yet</Text>
            <Text style={styles.emptyText}>When you apply for a professional job or quick task, its progress will appear here.</Text>
            <AnimatedActionButton accessibilityLabel="Browse jobs" feedback="selection" onPress={() => router.replace('/jobs')} style={styles.browseButton}>
              <Text style={styles.browseText}>Browse opportunities</Text>
            </AnimatedActionButton>
          </View>
        ) : null}
        {!loading ? applications.map((application) => {
          const canWithdraw = WITHDRAWABLE_STATUSES.has(application.status);
          const statusColors = getStatusColors(application.status, colors);
          return (
            <View key={application.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.flex}>
                  <Text style={styles.jobTitle}>{application.jobTitle}</Text>
                  <Text style={styles.category}>{application.jobType === 'quickTask' ? 'Quick Task' : 'Professional'} · {application.jobCategory}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColors.backgroundColor }]}>
                  <Text style={[styles.statusText, { color: statusColors.color }]}>{formatStatus(application.status)}</Text>
                </View>
              </View>
              <View style={styles.metaRow}><Building2 size={15} color={colors.mutedText} /><Text numberOfLines={1} style={[styles.metaText, styles.flex]}>{application.employerName}</Text></View>
              <View style={styles.metaRow}><CalendarDays size={15} color={colors.mutedText} /><Text style={styles.metaText}>Applied {formatDate(application.createdAtMs)}</Text></View>
              {application.coverLetter ? <Text numberOfLines={3} style={styles.coverLetter}>{application.coverLetter}</Text> : null}
              <View style={styles.actions}>
                {application.resumeUrl ? (
                  <TouchableOpacity accessibilityRole="link" onPress={() => void handleOpenResume(application.resumeUrl)} style={styles.secondaryButton}>
                    <ExternalLink size={16} color={colors.accentText} /><Text style={styles.secondaryButtonText}>Resume</Text>
                  </TouchableOpacity>
                ) : null}
                {canWithdraw ? (
                  <AnimatedActionButton
                    accessibilityLabel={`Withdraw application for ${application.jobTitle}`}
                    feedback="warning"
                    disabled={workingId === application.id}
                    onPress={() => handleWithdraw(application)}
                    style={[styles.withdrawButton, workingId === application.id && styles.disabled]}
                  >
                    {workingId === application.id ? <ActivityIndicator size="small" color={colors.destructiveText} /> : <><XCircle size={16} color={colors.destructiveText} /><Text style={styles.withdrawText}>Withdraw</Text></>}
                  </AnimatedActionButton>
                ) : null}
              </View>
            </View>
          );
        }) : null}
        {!loading && applications.length > 0 ? (
          <TouchableOpacity accessibilityRole="button" onPress={() => void loadApplications(true)} style={styles.refreshButton}>
            <RotateCcw size={16} color={colors.accentText} /><Text style={styles.refreshText}>Refresh statuses</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const getStatusColors = (status: JobApplicationStatus, colors: ThemeColors): { backgroundColor: string; color: string } => {
  if (status === 'accepted') return { backgroundColor: colors.successSurface, color: colors.successText };
  if (status === 'rejected' || status === 'job_withdrawn') return { backgroundColor: colors.destructiveSurface, color: colors.destructiveText };
  if (status === 'withdrawn') return { backgroundColor: colors.control, color: colors.mutedText };
  if (status === 'interviewing' || status === 'offer') return { backgroundColor: colors.warningSurface, color: colors.warningText };
  return { backgroundColor: colors.successSurface, color: colors.accentText };
};

const formatStatus = (status: JobApplicationStatus): string => status === 'job_withdrawn' ? 'Job withdrawn' : status.charAt(0).toUpperCase() + status.slice(1);
const formatDate = (timestampMs: number): string => timestampMs > 0 ? new Date(timestampMs).toLocaleDateString() : 'Recently';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 18, paddingBottom: 48, gap: 14 },
  flex: { flex: 1 },
  hero: { padding: 18, borderRadius: 20, backgroundColor: '#34d399', flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroTitle: { color: '#052e16', fontSize: 20, fontWeight: '900' },
  heroText: { color: '#065f46', fontSize: 13, lineHeight: 18, marginTop: 3 },
  error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 12, padding: 12 },
  center: { alignItems: 'center', gap: 10, paddingVertical: 52 },
  mutedText: { color: colors.mutedText },
  empty: { alignItems: 'center', gap: 9, padding: 28, borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.surface },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  emptyText: { color: colors.mutedText, textAlign: 'center', lineHeight: 20 },
  browseButton: { minHeight: 44, borderRadius: 14, backgroundColor: colors.accent, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  browseText: { color: colors.onAccent, fontWeight: '800' },
  card: { gap: 11, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  jobTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  category: { color: colors.mutedText, fontSize: 12, marginTop: 3 },
  statusBadge: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontSize: 11, fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  metaText: { color: colors.mutedText, fontSize: 13 },
  coverLetter: { color: colors.secondaryText, fontSize: 13, lineHeight: 19, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9 },
  secondaryButton: { minHeight: 40, borderRadius: 12, paddingHorizontal: 13, backgroundColor: colors.successSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryButtonText: { color: colors.accentText, fontWeight: '800' },
  withdrawButton: { minHeight: 40, borderRadius: 12, paddingHorizontal: 13, backgroundColor: colors.destructiveSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  withdrawText: { color: colors.destructiveText, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  refreshButton: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, padding: 12 },
  refreshText: { color: colors.accentText, fontWeight: '800' },
});
