import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, BarChart2, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Circle, ClipboardList, HelpCircle, MessageSquareText } from 'lucide-react-native';
import { CourseGradesSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { ELearningEmptyState, ELearningHeader, ELEARNING_GUTTER, ProgressBar, StatusPill, formatWhen, roundProgress, type ELearningTone } from '@/components/eLearning/ELearningParts';
import { formatDate, lessonHref, pluralize } from '@/components/eLearning/course/workspaceHelpers';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { courseService, isActiveEnrollment } from '@/lib/services/CourseService';
import { settleAll } from '@/lib/utils/settleAll';
import type { AssignmentSubmission, Course, CourseModule, Enrollment, GradeRow, GradeStatus, QuizAttemptRecord } from '@/lib/types/course';

const CONTENT_MAX_WIDTH = 760;
const RIPPLE = { color: 'rgba(15,23,42,0.12)' };
/** Attempt history is read for at most this many quizzes per visit (20 attempts each), so the page stays bounded. */
const MAX_HISTORY_QUIZZES = 20;

const STATUS: Record<GradeStatus, { label: string; tone: ELearningTone }> = {
  not_started: { label: 'Not started', tone: 'neutral' },
  overdue: { label: 'Overdue', tone: 'danger' },
  attempted: { label: 'Attempted', tone: 'info' },
  submitted: { label: 'Waiting for grade', tone: 'warning' },
  graded: { label: 'Graded', tone: 'success' },
};

type Styles = ReturnType<typeof createStyles>;

/**
 * "Progress and grades" for one course: what is done, what counts, and the learner's own record. Quiz rows show the
 * best attempt (the one that counts) and the attempt history; assignment rows show the grade and the instructor's
 * feedback once it is published. Nothing here is computed from the answer key: scores come from the server.
 */
export default function CourseGradesScreen() {
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const id = typeof courseId === 'string' ? courseId : '';
  const { colors } = useAppTheme();
  const { activeUserId } = useAppData();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [course, setCourse] = useState<Course | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [curriculum, setCurriculum] = useState<CourseModule[]>([]);
  const [submissions, setSubmissions] = useState<Map<string, AssignmentSubmission>>(new Map());
  const [legacyScores, setLegacyScores] = useState<Map<string, number>>(new Map());
  const [history, setHistory] = useState<Map<string, QuizAttemptRecord[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !activeUserId) { setIsLoading(false); return; }
    setError(null);
    try {
      const [courseData, enrollmentData] = await Promise.all([courseService.getCourse(id), courseService.getEnrollmentStatus(activeUserId, id)]);
      setCourse(courseData);
      // Dropped or suspended enrollments do not open the course (only active/completed ones, like the rules).
      setEnrollment(isActiveEnrollment(enrollmentData) ? enrollmentData : null);
      if (!isActiveEnrollment(enrollmentData) || !enrollmentData) return;
      // The curriculum decides the page; submissions and older scores are extras that must not blank it.
      const [modules, extras] = await Promise.all([
        courseService.getCourseCurriculum(id, 'enrolled'),
        settleAll([courseService.getMySubmissions(activeUserId, id), courseService.getLessonScores(activeUserId, id)] as const),
      ]);
      const [submissionResult, scoreResult] = extras;
      if (submissionResult.status === 'rejected') console.warn('[CourseGradesScreen.load] Submissions unavailable:', submissionResult.reason instanceof Error ? submissionResult.reason.message : 'Unknown error');
      if (scoreResult.status === 'rejected') console.warn('[CourseGradesScreen.load] Older scores unavailable:', scoreResult.reason instanceof Error ? scoreResult.reason.message : 'Unknown error');
      setCurriculum(modules);
      setSubmissions(submissionResult.status === 'fulfilled' ? submissionResult.value : new Map());
      setLegacyScores(scoreResult.status === 'fulfilled' ? scoreResult.value : new Map());
      // Attempt history only for quizzes the learner has tried, bounded per visit.
      const triedQuizzes = courseService.flattenLessons(modules)
        .filter((lesson) => lesson.type === 'quiz' && (enrollmentData.quizSummary?.[lesson.id]?.attempts ?? 0) > 0)
        .slice(0, MAX_HISTORY_QUIZZES);
      const attempts = await settleAll(triedQuizzes.map((lesson) => courseService.getMyQuizAttempts(activeUserId, lesson.id)));
      const nextHistory = new Map<string, QuizAttemptRecord[]>();
      attempts.forEach((result, index) => {
        if (result.status === 'fulfilled') nextHistory.set(triedQuizzes[index].id, result.value);
        else console.warn('[CourseGradesScreen.load] Attempt history unavailable:', result.reason instanceof Error ? result.reason.message : 'Unknown error');
      });
      setHistory(nextHistory);
    } catch (loadError: unknown) {
      console.error('[CourseGradesScreen.load] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      setError('Your progress could not be loaded. Pull down to try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeUserId, id]);

  useEffect(() => { void load(); }, [load]);

  const completion = courseService.completion(curriculum, enrollment, submissions);
  const book = courseService.gradebook(curriculum, enrollment, submissions, legacyScores);
  const percentDone = completion.all.total > 0 ? Math.round((completion.all.done / completion.all.total) * 100) : roundProgress(enrollment?.progress);
  const waitingCount = book.rows.filter((row) => row.status === 'submitted').length;
  const overdueCount = book.rows.filter((row) => row.status === 'overdue').length;
  const toggle = (lessonId: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(lessonId)) next.delete(lessonId); else next.add(lessonId);
    return next;
  });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ELearningHeader title="Progress and grades" subtitle={course?.title} onBack={() => router.back()} />
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.scroll}><CourseGradesSkeleton /></ScrollView>
      ) : !enrollment ? (
        <View style={styles.centerFill}>
          {error ? (
            <ELearningEmptyState icon={<BarChart2 size={40} color={colors.mutedText} />} title="Your progress could not load" hint={error} actionLabel="Try again" onAction={() => { setIsLoading(true); void load(); }} />
          ) : (
            <ELearningEmptyState icon={<BarChart2 size={40} color={colors.mutedText} />} title="Not enrolled" hint="Enroll in this course to track your progress and grades." actionLabel="Back to course" onAction={() => router.back()} />
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); void load(); }} tintColor={colors.accent} />}>
          <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

            <View style={styles.card}>
              <View style={styles.summaryTop}>
                <View style={styles.flex}>
                  <Text style={styles.statLabel}>Course completion</Text>
                  <Text style={styles.statValue}>{percentDone}%</Text>
                </View>
                <StatusPill label={enrollment.status === 'completed' ? 'Completed' : 'In progress'} tone={enrollment.status === 'completed' ? 'success' : 'neutral'} />
              </View>
              <ProgressBar value={percentDone} height={8} accessibilityLabel="Course completion" />
              <Text style={styles.hint}>
                {completion.all.total ? `${completion.all.done} of ${pluralize(completion.all.total, 'item', 'items')} done` : 'No lessons are available to you yet'}
                {completion.quizzes.total ? ` · ${completion.quizzes.done}/${completion.quizzes.total} quizzes` : ''}
                {completion.assignments.total ? ` · ${completion.assignments.done}/${completion.assignments.total} assignments` : ''}
              </Text>
            </View>

            <View style={styles.statRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Average score</Text>
                <Text style={styles.statBoxValue}>{book.averagePercent === null ? '—' : `${book.averagePercent}%`}</Text>
                <Text style={styles.hint}>{book.scoredCount ? `Over ${pluralize(book.scoredCount, 'scored item', 'scored items')}` : 'Shows once something is scored'}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Waiting</Text>
                <Text style={styles.statBoxValue}>{waitingCount}</Text>
                <Text style={styles.hint}>{waitingCount === 1 ? 'Assignment to be graded' : 'Assignments to be graded'}</Text>
              </View>
            </View>
            {overdueCount > 0 ? (
              <View accessibilityRole="alert" style={styles.overdueBanner}>
                <AlertCircle size={16} color={colors.destructiveText} />
                <Text style={styles.overdueText}>{overdueCount === 1 ? 'One item is' : `${overdueCount} items are`} past the due date. Open it below to hand it in or take it.</Text>
              </View>
            ) : null}
            <Text style={styles.hint}>Quizzes: your best attempt counts. Assignments: the grade your instructor publishes counts. The average is a guide over scored work, not a final course grade.</Text>

            <Text accessibilityRole="header" style={styles.sectionTitle}>Quizzes and assignments</Text>
            {book.rows.length === 0 ? (
              <ELearningEmptyState icon={<ClipboardList size={36} color={colors.mutedText} />} title="Nothing graded in this course" hint="This course has no quizzes or assignments yet." />
            ) : book.rows.map((row) => (
              <GradeRowCard
                key={row.lessonId}
                row={row}
                attempts={history.get(row.lessonId) ?? []}
                isExpanded={expanded.has(row.lessonId)}
                onToggle={() => toggle(row.lessonId)}
                onOpen={() => router.push(lessonHref(id, row.lessonId))}
                styles={styles}
                colors={colors}
              />
            ))}

            <Text accessibilityRole="header" style={styles.sectionTitle}>Lessons</Text>
            {curriculum.map((module) => {
              const lessons = (module.lessons ?? []).filter((lesson) => lesson.type !== 'quiz' && lesson.type !== 'assignment');
              if (lessons.length === 0) return null;
              const done = lessons.filter((lesson) => enrollment.completedLessons?.includes(lesson.id)).length;
              return (
                <View key={module.id} style={styles.module}>
                  <View style={styles.moduleHeader}>
                    <Text style={styles.moduleTitle} numberOfLines={2}>{module.title}</Text>
                    <Text style={styles.moduleCount}>{done} of {lessons.length}</Text>
                  </View>
                  {lessons.map((lesson) => {
                    const isDone = Boolean(enrollment.completedLessons?.includes(lesson.id));
                    return (
                      <Pressable key={lesson.id} accessibilityRole="button" accessibilityLabel={`${lesson.title}, ${isDone ? 'completed' : 'not completed'}`} onPress={() => router.push(lessonHref(id, lesson.id))} android_ripple={RIPPLE} style={styles.lessonRow}>
                        {isDone ? <CheckCircle2 size={20} color={colors.successText} /> : <Circle size={20} color={colors.mutedText} />}
                        <Text style={[styles.lessonTitle, styles.flex]} numberOfLines={2}>{lesson.title}</Text>
                        <ChevronRight size={16} color={colors.mutedText} />
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

type GradeRowCardProps = { row: GradeRow; attempts: QuizAttemptRecord[]; isExpanded: boolean; onToggle: () => void; onOpen: () => void; styles: Styles; colors: AppThemeColors };

/** One quiz or assignment: status in words, the score that counts, attempts or feedback, and a way to open it. */
function GradeRowCard({ row, attempts, isExpanded, onToggle, onOpen, styles, colors }: GradeRowCardProps) {
  const status = STATUS[row.status];
  const Icon = row.kind === 'quiz' ? HelpCircle : ClipboardList;
  const scoreLine = row.kind === 'quiz'
    ? row.percent !== null ? `Best ${row.percent}%${row.latestPercent !== null && row.attempts > 1 ? ` · latest ${Math.round(row.latestPercent)}%` : ''}` : row.attempts > 0 ? 'Not scored' : null
    : row.status === 'graded' && row.score !== undefined ? `${row.score}${row.maxScore ? ` / ${row.maxScore}` : ''}${row.percent !== null ? ` (${row.percent}%)` : ''}` : null;
  const attemptLine = row.kind === 'quiz' && row.attempts > 0
    ? row.maxAttempts ? `${row.attempts} of ${row.maxAttempts} attempts used` : pluralize(row.attempts, 'attempt', 'attempts')
    : null;
  const label = [row.title, row.kind === 'quiz' ? 'Quiz' : 'Assignment', status.label, scoreLine, attemptLine].filter(Boolean).join(', ');
  return (
    <View style={styles.gradeCard}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}. Open`} onPress={onOpen} android_ripple={RIPPLE} style={styles.gradeMain}>
        <View style={styles.gradeIcon}><Icon size={20} color={colors.accentText} /></View>
        <View style={styles.flex}>
          <Text numberOfLines={2} style={styles.gradeTitle}>{row.title}</Text>
          <Text numberOfLines={1} style={styles.hint}>{row.moduleTitle}{row.dueDate ? ` · due ${formatDate(row.dueDate)}` : ''}</Text>
          <View style={styles.gradeMeta}>
            <StatusPill label={status.label} tone={status.tone} />
            {scoreLine ? <Text style={styles.gradeScore}>{scoreLine}</Text> : null}
          </View>
          {attemptLine ? <Text style={styles.hint}>{attemptLine}</Text> : null}
        </View>
        <ChevronRight size={18} color={colors.mutedText} />
      </Pressable>
      {row.feedback ? (
        <View style={styles.feedback}>
          <MessageSquareText size={16} color={colors.mutedText} />
          <View style={styles.flex}>
            <Text style={styles.feedbackLabel}>Instructor feedback</Text>
            <Text style={styles.feedbackText}>{row.feedback}</Text>
          </View>
        </View>
      ) : null}
      {attempts.length > 0 ? (
        <>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: isExpanded }} accessibilityLabel={`${isExpanded ? 'Hide' : 'Show'} ${pluralize(attempts.length, 'attempt', 'attempts')}`} onPress={onToggle} android_ripple={RIPPLE} style={styles.toggle}>
            <Text style={styles.toggleText}>{isExpanded ? 'Hide attempts' : `Show ${pluralize(attempts.length, 'attempt', 'attempts')}`}</Text>
            {isExpanded ? <ChevronUp size={16} color={colors.accentText} /> : <ChevronDown size={16} color={colors.accentText} />}
          </Pressable>
          {isExpanded ? attempts.map((attempt) => {
            const isBest = row.percent !== null && attempt.percent !== null && Math.round(attempt.percent) === row.percent;
            return (
              <View key={attempt.id} accessible accessibilityLabel={`Attempt ${attempt.attemptNumber}, ${attempt.percent === null ? 'not scored' : `${Math.round(attempt.percent)}%`}${isBest ? ', best' : ''}`} style={styles.attemptRow}>
                <Text numberOfLines={1} style={[styles.attemptLabel, styles.flex]}>Attempt {attempt.attemptNumber}{attempt.submittedAt ? <Text style={styles.hint}> · {formatWhen(attempt.submittedAt)}</Text> : null}</Text>
                {isBest ? <Text style={styles.bestTag}>Best</Text> : null}
                <Text style={styles.attemptScore}>{attempt.percent === null ? '—' : `${Math.round(attempt.percent)}%`}</Text>
              </View>
            );
          }) : null}
        </>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: ELEARNING_GUTTER, gap: 14 },
  centerFill: { flex: 1, justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 12, overflow: 'hidden', padding: 12 },
  card: { padding: 16, gap: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  statLabel: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  statValue: { color: colors.text, fontSize: 30, fontWeight: '800' },
  hint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  statRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, minWidth: 0, padding: 12, gap: 2, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  statBoxValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  overdueBanner: { padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, backgroundColor: colors.destructiveSurface },
  overdueText: { flex: 1, color: colors.destructiveText, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 4 },
  gradeCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  gradeMain: { minHeight: 72, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  gradeIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface },
  gradeTitle: { color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  gradeMeta: { marginTop: 6, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  gradeScore: { color: colors.text, fontSize: 14, fontWeight: '800' },
  feedback: { marginHorizontal: 14, marginBottom: 12, padding: 12, flexDirection: 'row', gap: 8, borderRadius: 12, backgroundColor: colors.control },
  feedbackLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  feedbackText: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 2 },
  toggle: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  toggleText: { color: colors.accentText, fontSize: 14, fontWeight: '700' },
  attemptRow: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  attemptLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  attemptScore: { color: colors.text, fontSize: 14, fontWeight: '800', minWidth: 44, textAlign: 'right' },
  bestTag: { overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.successSurface, color: colors.successText, fontSize: 12, fontWeight: '700' },
  module: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  moduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.control },
  moduleTitle: { flex: 1, minWidth: 0, color: colors.text, fontSize: 14, fontWeight: '700' },
  moduleCount: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  lessonRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  lessonTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
