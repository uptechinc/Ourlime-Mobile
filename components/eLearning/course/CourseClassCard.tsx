import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarClock, Users } from 'lucide-react-native';
import ClassPickerSheet from '@/components/eLearning/course/ClassPickerSheet';
import SessionRow from '@/components/eLearning/course/SessionRow';
import { cohortJoinProblem } from '@/lib/services/AssignmentPolicy';
import { formatDate } from '@/components/eLearning/course/workspaceHelpers';
import { courseService } from '@/lib/services/CourseService';
import { serverMessage } from '@/lib/services/TeachingWorkflowService';
import { settleAll } from '@/lib/utils/settleAll';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { CourseCohort, CourseSession, Enrollment } from '@/lib/types/course';

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };
const UPCOMING_LIMIT = 5;

type CourseClassCardProps = {
  courseId: string;
  enrollment: Enrollment;
  /** Called after joining a class so the course page reloads the enrollment. */
  onJoined: () => void;
  onOpenError: () => void;
};

/**
 * The enrolled learner's class (cohort) and upcoming sessions on the course home: their class name and dates, "Join a
 * class" when they have none and one is open, and the next live classes, office hours and deadlines with Join links.
 * Nothing here lists other learners. Self-paced courses with no classes or sessions show nothing.
 */
export default function CourseClassCard({ courseId, enrollment, onJoined, onOpenError }: CourseClassCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [cohorts, setCohorts] = useState<CourseCohort[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [cohortResult, sessionResult] = await settleAll([courseService.getCohorts(courseId), courseService.getUpcomingSessions(courseId)] as const);
    if (cohortResult.status === 'fulfilled') setCohorts(cohortResult.value);
    else console.warn('[CourseClassCard.load] Classes unavailable:', cohortResult.reason instanceof Error ? cohortResult.reason.message : 'Unknown error');
    if (sessionResult.status === 'fulfilled') setSessions(sessionResult.value);
    else console.warn('[CourseClassCard.load] Sessions unavailable:', sessionResult.reason instanceof Error ? sessionResult.reason.message : 'Unknown error');
    setIsLoading(false);
  }, [courseId]);

  useEffect(() => { void load(); }, [load, enrollment.cohortId]);

  const myClass = enrollment.cohortId ? cohorts.find((cohort) => cohort.id === enrollment.cohortId) : undefined;
  const now = new Date();
  const hasOpenClass = cohorts.some((cohort) => cohortJoinProblem(cohort, now) === null);
  const upcoming = sessions.slice(0, UPCOMING_LIMIT);

  const handleJoin = async (cohortId: string) => {
    if (!cohortId) { setIsPickerOpen(false); return; }
    setIsJoining(true);
    setJoinError(null);
    try {
      await courseService.joinCohort(courseId, cohortId);
      setIsPickerOpen(false);
      onJoined();
    } catch (error: unknown) {
      console.error('[CourseClassCard.handleJoin] Error:', error instanceof Error ? error.message : 'Unknown error');
      setJoinError(serverMessage(error, 'You could not join this class. Please try again.'));
    } finally {
      setIsJoining(false);
    }
  };

  if (isLoading) return <View style={styles.card}><ActivityIndicator color={colors.accent} /></View>;
  if (!enrollment.cohortId && cohorts.length === 0 && sessions.length === 0) return null;

  return (
    <View style={styles.card}>
      {enrollment.cohortId ? (
        <View style={styles.row}>
          <View style={styles.icon}><Users size={18} color={colors.accentText} /></View>
          <View style={styles.flexText}>
            <Text style={styles.label}>Your class</Text>
            <Text style={styles.title}>{myClass?.name ?? 'Your class'}</Text>
            {myClass ? (
              <Text style={styles.muted}>
                {[
                  myClass.startsAt ? `Starts ${formatDate(myClass.startsAt)}` : null,
                  myClass.endsAt ? `Ends ${formatDate(myClass.endsAt)}` : null,
                  myClass.assistants.length ? `Assistants: ${myClass.assistants.map((assistant) => assistant.name).join(', ')}` : null,
                ].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
        </View>
      ) : hasOpenClass ? (
        <View style={styles.row}>
          <View style={styles.icon}><Users size={18} color={colors.accentText} /></View>
          <View style={styles.flexText}>
            <Text style={styles.title}>Learn with a class</Text>
            <Text style={styles.muted}>You are studying at your own pace. Join a class for set dates, live sessions and an assistant who grades your work.</Text>
          </View>
          <Pressable accessibilityRole="button" android_ripple={RIPPLE} onPress={() => { setJoinError(null); setIsPickerOpen(true); }} style={styles.button}>
            <Text style={styles.buttonText}>Join a class</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.upcomingHeader}>
        <CalendarClock size={18} color={colors.text} />
        <Text accessibilityRole="header" style={styles.heading}>Upcoming</Text>
      </View>
      {upcoming.length === 0 ? <Text style={styles.muted}>No sessions scheduled. Live classes, office hours and deadlines appear here.</Text>
        : upcoming.map((session) => <SessionRow key={session.id} session={session} onOpenError={onOpenError} />)}

      <ClassPickerSheet
        visible={isPickerOpen}
        title="Join a class"
        cohorts={cohorts}
        allowSelfPaced={false}
        confirmLabel="Join class"
        isBusy={isJoining}
        error={joinError}
        onConfirm={(cohortId) => void handleJoin(cohortId)}
        onClose={() => setIsPickerOpen(false)}
      />
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 12, padding: 16, gap: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  flexText: { flex: 1, minWidth: 0, gap: 2 },
  label: { color: colors.mutedText, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  heading: { color: colors.text, fontSize: 16, fontWeight: '800' },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  upcomingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  button: { minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.accent, overflow: 'hidden' },
  buttonText: { color: colors.accentText, fontSize: 14, fontWeight: '700' },
});
