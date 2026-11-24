import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { AlertCircle, BookOpen, ChevronRight, ClipboardCheck, ClipboardList, Clock, ExternalLink, Eye, EyeOff, HelpCircle, Lock, Megaphone, Send } from 'lucide-react-native';
import CustomModal from '@/components/ui/CustomModal';
import { InstructorCourseSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { CourseRating, ELearningButton, ELearningEmptyState, ELearningHeader, ELEARNING_GUTTER, StatusPill } from '@/components/eLearning/ELearningParts';
import LessonTypeIcon from '@/components/eLearning/course/LessonTypeIcon';
import { pluralize } from '@/components/eLearning/course/workspaceHelpers';
import { courseStagePresentation } from '@/components/eLearning/instructor/courseStatus';
import CourseInsightsCard from '@/components/eLearning/instructor/CourseInsightsCard';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { settleAll } from '@/lib/utils/settleAll';
import { instructorService, type CourseInsights, type InstructorCourseDetail, type InstructorCurriculum, type InstructorLesson, type InstructorStatus, type InstructorSubmission } from '@/lib/services/InstructorService';

const CONTENT_MAX_WIDTH = 860;
const RIPPLE = { color: 'rgba(15,23,42,0.12)' };
const UNAVAILABLE_TEXT = 'The modules and lessons could not be loaded. Pull down to try again.';

const lessonLabel = (lesson: InstructorLesson): string => {
  if (lesson.type === 'quiz') return `Quiz · ${lesson.questionCount} question${lesson.questionCount === 1 ? '' : 's'}`;
  if (lesson.type === 'assignment') {
    const due = lesson.dueDate ? ` · due ${new Date(lesson.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : '';
    return `Assignment${lesson.points !== undefined ? ` · ${lesson.points} pts` : ''}${due}`;
  }
  const kind = lesson.type === 'video' ? 'Video' : lesson.type === 'text' ? 'Reading' : 'Resource';
  return lesson.duration > 0 ? `${kind} · ${lesson.duration} min` : kind;
};

/** LessonTypeIcon knows the learner lesson types; the instructor's file types map to its resource icon. */
const iconType = (type: InstructorLesson['type']): 'video' | 'text' | 'quiz' | 'assignment' | 'resource' =>
  type === 'video' || type === 'text' || type === 'quiz' || type === 'assignment' ? type : 'resource';

/**
 * The instructor's own course in any state (draft, waiting for review, declined with the administrator's note,
 * published, archived): what the state means and the one action that moves it on, real numbers (enrollments, rating,
 * hand-ins waiting and graded), shortcuts to the quiz and assignment builders and grading, and the curriculum.
 */
export default function InstructorCourseScreen() {
  const router = useRouter();
  const { courseId, title: titleParam } = useLocalSearchParams<{ courseId: string; title?: string }>();
  const id = typeof courseId === 'string' ? courseId : '';
  const { colors } = useAppTheme();
  const { activeUserId } = useAppData();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [course, setCourse] = useState<InstructorCourseDetail | null>(null);
  const [curriculum, setCurriculum] = useState<InstructorCurriculum>({ kind: 'unavailable' });
  const [instructorStatus, setInstructorStatus] = useState<InstructorStatus | null>(null);
  const [submissions, setSubmissions] = useState<InstructorSubmission[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [insights, setInsights] = useState<CourseInsights | null>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(true);
  const [hasInsightsError, setHasInsightsError] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setIsLoading(false); setError('This course could not be found.'); return; }
    setError(null);
    try {
      const detail = await instructorService.getCourse(id);
      setCourse(detail);
      if (!detail) {
        setError('This course could not be found, or it belongs to another instructor.');
        return;
      }
      // The curriculum, the instructor's status (it decides "Publish" or "Submit for review") and the hand-ins are
      // read side by side; any of them failing leaves its section out instead of failing the page.
      const hasWork = detail.status === 'published' || detail.status === 'archived';
      const [curriculumResult, statusResult, submissionResult] = await settleAll([
        instructorService.getCurriculum(id),
        activeUserId ? instructorService.getStatus(activeUserId) : Promise.resolve<InstructorStatus>('none'),
        hasWork ? instructorService.getSubmissions(id) : Promise.resolve<InstructorSubmission[]>([]),
      ] as const);
      setCurriculum(curriculumResult.status === 'fulfilled' ? curriculumResult.value : { kind: 'unavailable' });
      setInstructorStatus(statusResult.status === 'fulfilled' ? statusResult.value : null);
      setSubmissions(submissionResult.status === 'fulfilled' ? submissionResult.value : null);
      if (submissionResult.status === 'rejected') console.warn('[InstructorCourseScreen.load] Submissions unavailable:', submissionResult.reason instanceof Error ? submissionResult.reason.message : 'Unknown error');
    } catch (loadError: unknown) {
      console.error('[InstructorCourseScreen.load] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      setError('The course could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeUserId, id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // Learner progress is a bounded server read, so it loads when the screen opens and on pull-to-refresh, not on every focus.
  const loadInsights = useCallback(async () => {
    if (!id) return;
    setIsInsightsLoading(true);
    setHasInsightsError(false);
    try {
      setInsights(await instructorService.getInsights(id));
    } catch (insightsError: unknown) {
      console.warn('[InstructorCourseScreen.loadInsights] Error:', insightsError instanceof Error ? insightsError.message : 'Unknown error');
      setHasInsightsError(true);
    } finally {
      setIsInsightsLoading(false);
    }
  }, [id]);
  useEffect(() => { void loadInsights(); }, [loadInsights]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    void load();
    void loadInsights();
  };

  const handleResubmit = async () => {
    if (!course) return;
    setIsWorking(true);
    setActionError(null);
    try {
      const next = await instructorService.resubmitCourse(course.id);
      setCourse({ ...course, status: next, reviewStatus: next === 'published' ? course.reviewStatus : 'resubmitted', reviewNote: next === 'published' ? course.reviewNote : undefined });
      void load();
    } catch (resubmitError: unknown) {
      console.error('[InstructorCourseScreen.handleResubmit] Error:', resubmitError instanceof Error ? resubmitError.message : 'Unknown error');
      setActionError('The course could not be sent. Check your connection and try again.');
    } finally {
      setIsWorking(false);
    }
  };

  const handleUnpublish = async () => {
    if (!course) return;
    setConfirmUnpublish(false);
    setIsWorking(true);
    setActionError(null);
    try {
      await instructorService.setCourseStatus(course.id, 'draft');
      // The outline stays readable: the rules let the course's instructor read it in every state.
      setCourse({ ...course, status: 'draft' });
    } catch (statusError: unknown) {
      console.error('[InstructorCourseScreen.handleUnpublish] Error:', statusError instanceof Error ? statusError.message : 'Unknown error');
      setActionError('The course could not be unpublished. Please try again.');
    } finally {
      setIsWorking(false);
    }
  };

  const query = course ? `${encodeURIComponent(course.id)}?title=${encodeURIComponent(course.title)}` : '';
  const columnWidth = Math.min(width, CONTENT_MAX_WIDTH);
  const coverWidth = columnWidth - ELEARNING_GUTTER * 2;
  const coverHeight = Math.min(240, Math.round(coverWidth * 9 / 16));
  const headerTitle = course?.title ?? (typeof titleParam === 'string' && titleParam ? titleParam : 'Course');
  const presentation = course ? courseStagePresentation(course, instructorStatus) : null;
  const summary = submissions ? instructorService.submissionSummary(submissions) : null;
  const canResubmit = presentation ? presentation.stage === 'draft' || presentation.stage === 'declined' || presentation.stage === 'archived' : false;
  const resubmitLabel = instructorStatus === 'verified' ? 'Publish course' : 'Submit for review';
  const meta = course ? [
    course.level ? course.level.charAt(0).toUpperCase() + course.level.slice(1) : null,
    course.price > 0 ? `$${course.price.toFixed(2)}` : 'Free',
    course.category ? (course.subcategory ? `${course.category} · ${course.subcategory}` : course.category) : null,
  ].filter(Boolean).join(' · ') : '';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ELearningHeader title={headerTitle} subtitle="Your course" onBack={() => router.back()} />
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.scroll}><InstructorCourseSkeleton /></ScrollView>
      ) : !course || !presentation ? (
        <View style={styles.centerFill}>
          <ELearningEmptyState icon={<BookOpen size={40} color={colors.mutedText} />} title="Course unavailable" hint={error ?? 'This course could not be found.'} actionLabel="Try again" onAction={() => { setIsLoading(true); void load(); }} secondaryActionLabel="Go back" onSecondaryAction={() => router.back()} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}>
          <View style={[styles.column, { width: columnWidth }]}>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {course.image ? <Image source={{ uri: course.image }} contentFit="cover" style={[styles.cover, { width: coverWidth, height: coverHeight }]} /> : null}
            <View style={styles.heading}>
              <StatusPill label={presentation.label} tone={presentation.tone} />
              <Text accessibilityRole="header" style={styles.title}>{course.title}</Text>
              {course.shortDescription ? <Text style={styles.subtitle}>{course.shortDescription}</Text> : null}
              {meta ? <Text style={styles.muted}>{meta}</Text> : null}
            </View>

            {/* What this state means, the administrator's note when declined, and the action that moves it on. */}
            <View style={[styles.stateCard, presentation.stage === 'declined' ? styles.stateDanger : presentation.stage === 'waiting' ? styles.stateWarning : null]}>
              <View style={styles.stateRow}>
                {presentation.stage === 'declined' ? <AlertCircle size={18} color={colors.destructiveText} /> : presentation.stage === 'waiting' ? <Clock size={18} color={colors.warningText} /> : presentation.stage === 'published' ? <Eye size={18} color={colors.successText} /> : <EyeOff size={18} color={colors.mutedText} />}
                <Text style={[styles.stateText, presentation.stage === 'declined' ? { color: colors.destructiveText } : presentation.stage === 'waiting' ? { color: colors.warningText } : null]}>{presentation.explanation}</Text>
              </View>
              {presentation.stage === 'declined' ? (
                <View accessible accessibilityLabel={`Administrator's note: ${course.reviewNote ?? 'No reason was given.'}`} style={styles.note}>
                  <Text style={styles.noteTitle}>Administrator’s note</Text>
                  <Text style={styles.noteText}>{course.reviewNote ?? 'No reason was given. Contact support if you are unsure what to change.'}</Text>
                </View>
              ) : null}
              {presentation.stage === 'waiting' ? <Text style={styles.stateHint}>You can still add quizzes and assignments while you wait.</Text> : null}
              {actionError ? <Text accessibilityRole="alert" style={styles.actionError}>{actionError}</Text> : null}
              {canResubmit ? (
                <ELearningButton
                  label={presentation.stage === 'declined' ? (instructorStatus === 'verified' ? 'Publish again' : 'Submit again') : resubmitLabel}
                  icon={instructorStatus === 'verified' ? <Eye size={18} color="#ffffff" /> : <Send size={18} color="#ffffff" />}
                  isBusy={isWorking}
                  busyLabel="Sending…"
                  onPress={() => void handleResubmit()}
                />
              ) : presentation.stage === 'published' ? (
                <ELearningButton
                  label="Unpublish"
                  variant="secondary"
                  icon={<EyeOff size={18} color={colors.text} />}
                  isBusy={isWorking}
                  busyLabel="Saving…"
                  onPress={() => (course.enrolledStudents > 0 ? setConfirmUnpublish(true) : void handleUnpublish())}
                />
              ) : null}
            </View>

            <View style={styles.stats}>
              <View accessible accessibilityLabel={pluralize(course.enrolledStudents, 'enrollment', 'enrollments')} style={styles.statCard}>
                <Text numberOfLines={1} style={styles.statValue}>{course.enrolledStudents}</Text>
                <Text numberOfLines={1} style={styles.statLabel}>{course.enrolledStudents === 1 ? 'Enrollment' : 'Enrollments'}</Text>
              </View>
              <View accessible accessibilityLabel={summary ? `${summary.waiting} hand-ins waiting for a grade` : 'Hand-ins not available'} style={[styles.statCard, summary && summary.waiting > 0 ? styles.statAlert : null]}>
                <Text numberOfLines={1} style={[styles.statValue, summary && summary.waiting > 0 ? { color: colors.warningText } : null]}>{summary ? summary.waiting : '—'}</Text>
                <Text numberOfLines={1} style={[styles.statLabel, summary && summary.waiting > 0 ? { color: colors.warningText } : null]}>To grade</Text>
              </View>
              <View accessible accessibilityLabel={summary ? `${summary.graded} graded` : 'Graded not available'} style={styles.statCard}>
                <Text numberOfLines={1} style={styles.statValue}>{summary ? summary.graded : '—'}</Text>
                <Text numberOfLines={1} style={styles.statLabel}>Graded</Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <CourseRating rating={course.rating} count={course.totalRatings} />
              {course.totalRatings === 0 ? <Text style={styles.muted}>No ratings yet</Text> : null}
              {summary && summary.total >= 200 ? <Text style={styles.muted}>Showing the latest 200 hand-ins</Text> : null}
            </View>

            <View style={styles.tiles}>
              <Pressable accessibilityRole="button" accessibilityLabel="Add a quiz" onPress={() => router.push(`/eLearning/instructor/quiz/${query}` as Href)} android_ripple={RIPPLE} style={styles.tile}>
                <HelpCircle size={20} color={colors.icon} /><Text numberOfLines={2} style={styles.tileText}>Add quiz</Text>
                {course.quizCount !== null ? <Text style={styles.tileMeta}>{course.quizCount} so far</Text> : null}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Add an assignment" onPress={() => router.push(`/eLearning/instructor/assignment/${query}` as Href)} android_ripple={RIPPLE} style={styles.tile}>
                <ClipboardList size={20} color={colors.icon} /><Text numberOfLines={2} style={styles.tileText}>Add assignment</Text>
                {course.assignmentCount !== null ? <Text style={styles.tileMeta}>{course.assignmentCount} so far</Text> : null}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={summary && summary.waiting > 0 ? `Grade work, ${summary.waiting} waiting` : 'Grade work'} onPress={() => router.push(`/eLearning/instructor/grading/${query}` as Href)} android_ripple={RIPPLE} style={styles.tile}>
                <ClipboardCheck size={20} color={colors.icon} /><Text numberOfLines={2} style={styles.tileText}>Grade work</Text>
                {summary && summary.waiting > 0 ? <Text style={[styles.tileMeta, { color: colors.warningText }]}>{summary.waiting} waiting</Text> : null}
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Course announcements" accessibilityHint="Post news for your enrolled learners" onPress={() => router.push(`/eLearning/instructor/announcements/${query}` as Href)} android_ripple={RIPPLE} style={styles.rowButton}>
              <Megaphone size={20} color={colors.icon} />
              <View style={styles.flexText}>
                <Text style={styles.rowButtonTitle}>Announcements</Text>
                <Text style={styles.muted}>Post news and reminders for enrolled learners</Text>
              </View>
              <ChevronRight size={18} color={colors.mutedText} />
            </Pressable>

            <CourseInsightsCard insights={insights} isLoading={isInsightsLoading} hasError={hasInsightsError} onRetry={() => void loadInsights()} />

            {course.status === 'published' ? (
              <Pressable accessibilityRole="link" onPress={() => router.push(`/eLearning/courses/${encodeURIComponent(course.id)}` as Href)} android_ripple={RIPPLE} style={styles.linkButton}>
                <ExternalLink size={16} color={colors.accentText} /><Text style={styles.linkText}>Open the learner view</Text>
              </Pressable>
            ) : null}

            {course.description ? (
              <View style={styles.card}>
                <Text accessibilityRole="header" style={styles.section}>About</Text>
                <Text style={styles.body}>{course.description}</Text>
              </View>
            ) : null}
            {course.learningObjectives.length > 0 || course.prerequisites.length > 0 ? (
              <View style={styles.card}>
                {course.learningObjectives.length > 0 ? (
                  <>
                    <Text accessibilityRole="header" style={styles.section}>What learners will learn</Text>
                    {course.learningObjectives.map((item) => <Text key={item} style={styles.body}>• {item}</Text>)}
                  </>
                ) : null}
                {course.prerequisites.length > 0 ? (
                  <>
                    <Text accessibilityRole="header" style={[styles.section, course.learningObjectives.length > 0 && styles.sectionGap]}>Prerequisites</Text>
                    {course.prerequisites.map((item) => <Text key={item} style={styles.body}>• {item}</Text>)}
                  </>
                ) : null}
                {course.tags.length > 0 ? <View style={styles.tags}>{course.tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}</View> : null}
              </View>
            ) : null}

            <Text accessibilityRole="header" style={styles.sectionTitle}>Curriculum</Text>
            {curriculum.kind === 'unavailable' ? (
              <View style={styles.lockedCard}>
                <Lock size={18} color={colors.mutedText} />
                <Text style={[styles.mutedBody, styles.flexText]}>{UNAVAILABLE_TEXT}</Text>
              </View>
            ) : curriculum.modules.length === 0 ? (
              <Text style={styles.mutedBody}>No modules yet.</Text>
            ) : curriculum.modules.map((module, index) => (
              <View key={module.id} style={styles.moduleCard}>
                <View style={styles.moduleHead}>
                  <Text style={styles.eyebrow}>Module {index + 1} · {pluralize(module.lessons.length, 'item', 'items')}</Text>
                  <Text style={styles.moduleTitle}>{module.title}</Text>
                  {module.description ? <Text style={styles.muted}>{module.description}</Text> : null}
                </View>
                {module.lessons.length === 0 ? <Text style={[styles.muted, styles.lessonPad]}>No lessons.</Text> : null}
                {module.lessons.map((lesson) => (
                  <View key={lesson.id} style={styles.lessonRow}>
                    <LessonTypeIcon type={iconType(lesson.type)} size={18} />
                    <View style={styles.flexText}>
                      <Text style={styles.lessonTitle} numberOfLines={2}>{lesson.title}</Text>
                      <Text style={styles.muted}>{lessonLabel(lesson)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
      <CustomModal
        visible={confirmUnpublish}
        type="warning"
        title="Unpublish this course?"
        message={`${pluralize(course?.enrolledStudents ?? 0, 'enrolled learner', 'enrolled learners')} can't open its lessons while it is unpublished. Their progress and grades are kept and come back when you publish it again.`}
        confirmText="Unpublish"
        cancelText="Keep published"
        onConfirm={() => void handleUnpublish()}
        onCancel={() => setConfirmUnpublish(false)}
        onClose={() => setConfirmUnpublish(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flexText: { flex: 1, minWidth: 0 },
  centerFill: { flex: 1, justifyContent: 'center' },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: ELEARNING_GUTTER, gap: 16 },
  error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 12, overflow: 'hidden', padding: 12 },
  cover: { borderRadius: 16 },
  heading: { gap: 6 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', lineHeight: 28 },
  subtitle: { color: colors.secondaryText, fontSize: 15, lineHeight: 21 },
  muted: { flexShrink: 1, color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  mutedBody: { color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: -6 },
  stateCard: { padding: 14, gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  stateDanger: { backgroundColor: colors.destructiveSurface, borderColor: colors.destructiveSurface },
  stateWarning: { backgroundColor: colors.warningSurface, borderColor: colors.warningSurface },
  stateRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stateText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  stateHint: { color: colors.warningText, fontSize: 13, lineHeight: 18 },
  note: { padding: 12, gap: 4, borderRadius: 12, backgroundColor: colors.surface },
  noteTitle: { color: colors.destructiveText, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  noteText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  actionError: { color: colors.destructiveText, fontSize: 13, lineHeight: 18 },
  stats: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 12, gap: 2, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  statAlert: { backgroundColor: colors.warningSurface, borderColor: colors.warningSurface },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.mutedText, fontSize: 12 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minWidth: 0, minHeight: 72, paddingHorizontal: 4, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  tileText: { color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  tileMeta: { color: colors.mutedText, fontSize: 11 },
  rowButton: { minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  rowButtonTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  linkButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginTop: -6 },
  linkText: { color: colors.accentText, fontSize: 14, fontWeight: '700' },
  card: { padding: 16, gap: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  section: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  sectionGap: { marginTop: 10 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 4 },
  body: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.control, color: colors.secondaryText, fontSize: 12, fontWeight: '600' },
  lockedCard: { padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  moduleCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  moduleHead: { padding: 14, gap: 4, backgroundColor: colors.control },
  eyebrow: { color: colors.mutedText, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  moduleTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  lessonPad: { padding: 14 },
  lessonRow: { minHeight: 56, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  lessonTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
