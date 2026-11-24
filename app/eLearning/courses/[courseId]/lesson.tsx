import RichBlogContent from '@/components/blog/RichBlogContent';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import CustomModal from '@/components/ui/CustomModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  ListOrdered,
  PlayCircle,
} from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { LessonContentSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { courseService, isActiveEnrollment } from '@/lib/services/CourseService';
import CustomVideoPlayer from '@/components/media/CustomVideoPlayer';
import LessonQuiz from '@/components/eLearning/LessonQuiz';
import LessonAssignment from '@/components/eLearning/LessonAssignment';
import LessonOutlineSheet from '@/components/eLearning/LessonOutlineSheet';
import AssignmentDetails from '@/components/eLearning/course/AssignmentDetails';
import { courseHref, lessonTypeLabel } from '@/components/eLearning/course/workspaceHelpers';
import { ELEARNING_ACTION_GREEN, ELEARNING_GUTTER, ProgressBar, formatMinutes, roundProgress } from '@/components/eLearning/ELearningParts';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import type { Course, CourseModule, CourseLesson, Enrollment, QuizAttemptRecord, QuizAttemptResult } from '@/lib/types/course';

// Some lessons are typed "video" but hold a PDF or Word file; only real video files go to the player.
const VIDEO_FILE = /\.(mp4|m4v|mov|webm|m3u8|3gp|mkv)$/i;
const isVideoFile = (url: string | undefined): boolean => {
  if (!url) return false;
  const path = decodeURIComponent(url.split('?')[0] ?? '');
  return VIDEO_FILE.test(path) || !/\.[a-z0-9]{2,5}$/i.test(path);
};

export default function LessonScreen() {
  const router = useRouter();
  // lessonId opens one lesson (web /lesson/[id], /quiz/[id], /assignment/[id]); without it the next unfinished lesson opens.
  const { courseId, lessonId } = useLocalSearchParams<{ courseId: string; lessonId?: string }>();
  const id = typeof courseId === 'string' ? courseId : '';
  const requestedLessonId = typeof lessonId === 'string' && lessonId ? lessonId : null;
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const { activeUserId } = useAppData();

  const [course, setCourse] = useState<Course | null>(null);
  const [curriculum, setCurriculum] = useState<CourseModule[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingCompletion, setSavingCompletion] = useState(false);
  // Not enrolled: only the course's preview lessons open, and progress is not saved.
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isAssignmentSubmitted, setIsAssignmentSubmitted] = useState(false);
  const [quizHistory, setQuizHistory] = useState<{ lessonId: string; attempts: QuizAttemptRecord[] } | null>(null);
  // `action` turns the dialog's button into a next step (open the work still left, or the grades) with a "Not now" choice.
  const [dialogState, setDialogState] = useState<{
    visible: boolean;
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
    action?: { label: string; onPress: () => void };
  }>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });
  const loadGenerationRef = useRef(0);

  const allLessons = useMemo(() => {
    const list: CourseLesson[] = [];
    for (const mod of curriculum) {
      if (mod.lessons) list.push(...mod.lessons);
    }
    return list;
  }, [curriculum]);

  const currentLesson = allLessons[currentLessonIndex] ?? null;

  const loadData = useCallback(async () => {
    if (!id) return;
    const loadGeneration = ++loadGenerationRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const [courseData, enrollData] = await Promise.all([
        courseService.getCourse(id),
        activeUserId ? courseService.getEnrollmentStatus(activeUserId, id) : null,
      ]);
      const isEnrolled = isActiveEnrollment(enrollData);
      const modulesData = courseData ? await courseService.getCourseCurriculum(id, isEnrolled ? 'enrolled' : 'preview') : [];
      if (loadGeneration !== loadGenerationRef.current) return;
      const lessons = courseService.flattenLessons(modulesData);
      const requestedIndex = requestedLessonId ? lessons.findIndex((lesson) => lesson.id === requestedLessonId) : -1;
      setCourse(courseData);
      setEnrollment(isEnrolled ? enrollData : null);
      setIsPreviewMode(!isEnrolled);
      if (!isEnrolled && (lessons.length === 0 || (requestedLessonId && requestedIndex < 0))) {
        setCurriculum([]);
        setLoadError(enrollData ? `Your enrollment is ${enrollData.status}. Lessons open again once it is active.` : 'Enroll in this course before opening its lessons.');
        return;
      }
      setCurriculum(modulesData);
      const nextLessonId = courseService.nextLesson(modulesData, isEnrolled ? enrollData : null)?.lesson.id;
      const resumeIndex = nextLessonId ? lessons.findIndex((lesson) => lesson.id === nextLessonId) : 0;
      setCurrentLessonIndex(requestedIndex >= 0 ? requestedIndex : Math.max(0, resumeIndex));
      if (requestedLessonId && requestedIndex < 0) {
        setDialogState({ visible: true, type: 'info', title: 'Lesson unavailable', message: 'That lesson is not published or was removed. Showing your next lesson instead.' });
      }
    } catch (err) {
      console.error('[LessonScreen] Error:', err);
      if (loadGeneration !== loadGenerationRef.current) return;
      setLoadError('Lesson content could not be loaded. Check your connection and try again.');
    } finally {
      if (loadGeneration === loadGenerationRef.current) setLoading(false);
    }
  }, [id, activeUserId, requestedLessonId]);

  useEffect(() => {
    void loadData();
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [loadData]);

  const isCompleted = Boolean(
    currentLesson && enrollment?.completedLessons?.includes(currentLesson.id)
  );

  useEffect(() => { setIsAssignmentSubmitted(false); }, [currentLesson?.id]);

  const enrollmentId = enrollment?.id ?? null;
  // The learner's past attempts at the open quiz (extra: the quiz works without them).
  const loadQuizHistory = useCallback(async (lessonId: string) => {
    if (!activeUserId) return;
    try {
      const attempts = await courseService.getMyQuizAttempts(activeUserId, lessonId);
      setQuizHistory({ lessonId, attempts });
    } catch (error: unknown) {
      console.warn('[LessonScreen.loadQuizHistory] Attempt history unavailable:', error instanceof Error ? error.message : 'Unknown error');
    }
  }, [activeUserId]);

  useEffect(() => {
    if (currentLesson?.type === 'quiz' && enrollmentId && !isPreviewMode) void loadQuizHistory(currentLesson.id);
  }, [currentLesson?.id, currentLesson?.type, enrollmentId, isPreviewMode, loadQuizHistory]);

  const handleToggleComplete = async () => {
    if (!enrollment || !currentLesson || isCompleted || savingCompletion) return;
    setSavingCompletion(true);
    try {
      await courseService.markLessonCompleted(enrollment.id, currentLesson.id, allLessons.length);
      const updated = await courseService.getEnrollmentStatus(enrollment.userId, id);
      setEnrollment(updated);
      // Like the website, completing a lesson moves on to the next one.
      if (currentLessonIndex < allLessons.length - 1) {
        setCurrentLessonIndex((index) => index + 1);
      } else {
        showEndOfCourse(updated);
      }
    } catch (error) {
      console.error('[LessonScreen] Completion failed:', error);
      setDialogState({
        visible: true,
        type: 'error',
        title: 'Progress not saved',
        message: 'Your lesson progress could not be confirmed. Please try again.',
      });
    } finally {
      setSavingCompletion(false);
    }
  };

  /**
   * At the last lesson: "finished" only when every lesson really is done; otherwise name the first open item and offer
   * to jump to it, because reaching the end of the list is not the same as finishing the course.
   */
  const showEndOfCourse = (latest: Enrollment | null) => {
    const step = courseService.nextStep(curriculum, latest ?? enrollment);
    if (step.kind === 'lesson' || step.kind === 'overdue') {
      const remaining = courseService.completion(curriculum, latest ?? enrollment);
      const left = remaining.all.total - remaining.all.done;
      const targetId = step.lesson.id;
      setDialogState({
        visible: true, type: 'info', title: 'Last lesson reached',
        message: `${left === 1 ? 'One item is' : `${left} items are`} still open, starting with "${step.lesson.title}".`,
        action: { label: 'Open it', onPress: () => handleSelectLesson(targetId) },
      });
      return;
    }
    setDialogState({
      visible: true, type: 'success', title: 'You finished the course',
      message: 'Every lesson is done. Your quiz scores and assignment feedback are on your grades page.',
      action: { label: 'See grades', onPress: () => router.push(courseHref(id, 'grades')) },
    });
  };

  const handleSubmitQuiz = async (answers: number[], operationId: string): Promise<QuizAttemptResult | null> => {
    if (!enrollment || !currentLesson) throw new Error('Enroll in this course before taking the quiz.');
    const lessonId = currentLesson.id;
    try {
      return await courseService.submitQuiz(enrollment.id, lessonId, answers, operationId);
    } finally {
      // Progress, attempts used and the best score come back on the enrollment, refused or not.
      void courseService.getEnrollmentStatus(enrollment.userId, id).then((updated) => { if (updated) setEnrollment(updated); }).catch(() => undefined);
      void loadQuizHistory(lessonId);
    }
  };

  const handleOpenMaterial = () => {
    if (!currentLesson?.mediaUrl) return;
    void Linking.openURL(currentLesson.mediaUrl).catch((error: unknown) => {
      console.error('[LessonScreen.handleOpenMaterial] Error:', error instanceof Error ? error.message : 'Unknown error');
      setDialogState({ visible: true, type: 'error', title: 'Could not open', message: 'This lesson material could not be opened on this device.' });
    });
  };

  const handleNext = () => {
    if (currentLessonIndex < allLessons.length - 1) {
      setCurrentLessonIndex((idx) => idx + 1);
    }
  };

  const handlePrev = () => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex((idx) => idx - 1);
    }
  };

  const handleSelectLesson = (lessonId: string) => {
    const index = allLessons.findIndex((lesson) => lesson.id === lessonId);
    if (index >= 0) setCurrentLessonIndex(index);
    setShowDrawer(false);
  };

  // At the end of the course the primary button leads back instead of turning into a dead "Next" button.
  const handleBackToCourse = () => {
    if (router.canGoBack()) router.back();
    else router.replace(courseHref(id));
  };

  const hasNext = currentLessonIndex < allLessons.length - 1;
  const hasPrevious = currentLessonIndex > 0;
  // A quiz with questions is completed by submitting it and an assignment by handing it in (the server completes both);
  // everything else is marked done by hand.
  const isQuizWithQuestions = currentLesson?.type === 'quiz' && (currentLesson.quizQuestions?.length ?? 0) > 0;
  const isAssignment = currentLesson?.type === 'assignment';
  const canMarkComplete = Boolean(currentLesson) && !isPreviewMode && !isQuizWithQuestions && !isAssignment && !isCompleted;
  const isVideoLesson = currentLesson?.type === 'video' && (isVideoFile(currentLesson.mediaUrl) || !currentLesson.mediaUrl);
  const courseProgress = enrollment ? roundProgress(enrollment.progress) : allLessons.length ? Math.round(((currentLessonIndex + 1) / allLessons.length) * 100) : 0;
  const playerHeight = Math.min(520, Math.round(width * 9 / 16));
  const primaryLabel = canMarkComplete ? (savingCompletion ? 'Saving…' : 'Mark complete') : hasNext ? 'Next lesson' : 'Back to course';
  const handlePrimary = () => {
    if (canMarkComplete) { void handleToggleComplete(); return; }
    if (hasNext) { handleNext(); return; }
    handleBackToCourse();
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      {/* Thin top bar: back, "Lesson 3 of 12" with the course name, the outline, and the course progress underneath. */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={styles.iconButton}>
          <ArrowLeft size={22} color={colors.icon} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.headerTitle}>{currentLesson ? `Lesson ${currentLessonIndex + 1} of ${allLessons.length}` : 'Lesson'}</Text>
          {course?.title ? <Text numberOfLines={1} style={styles.headerSubtitle}>{course.title}</Text> : null}
        </View>
        <Pressable onPress={() => setShowDrawer(true)} disabled={allLessons.length === 0} accessibilityRole="button" accessibilityLabel="Course outline" style={styles.iconButton}>
          <ListOrdered size={22} color={allLessons.length ? colors.icon : colors.disabledText} />
        </Pressable>
      </View>
      {currentLesson ? <ProgressBar value={courseProgress} height={3} accessibilityLabel={enrollment ? 'Course progress' : 'Position in course'} /> : null}

      {loading ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <LessonContentSkeleton />
        </ScrollView>
      ) : !currentLesson ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{loadError ?? 'This course does not have published lessons yet.'}</Text>
          {loadError ? (
            <Pressable onPress={() => void loadData()} style={styles.retryButton} accessibilityRole="button">
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        // KeyboardSafeView shrinks the page above the keyboard so inline inputs low in it stay visible.
        <KeyboardSafeView style={styles.flex}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Content first: only video lessons get the full-width player area; reading, quiz and file lessons start with their text. */}
            {isVideoLesson ? (
              <View style={[styles.playerBox, { height: playerHeight }]}>
                {isVideoFile(currentLesson.mediaUrl) ? (
                  // key: a new lesson gets a fresh player instead of keeping the previous video's position.
                  <CustomVideoPlayer key={currentLesson.id} url={currentLesson.mediaUrl ?? ''} autoPlay={false} showSpeed />
                ) : (
                  <View style={styles.videoPlaceholder}>
                    <PlayCircle size={48} color={colors.accent} />
                    <Text style={styles.videoPlaceholderText}>The video for this lesson is not available yet</Text>
                  </View>
                )}
              </View>
            ) : null}

            <View style={styles.lessonBody}>
              <View style={styles.titleBlock}>
                <Text accessibilityRole="header" style={styles.lessonTitle}>{currentLesson.title}</Text>
                <View style={styles.metaRow}>
                  <Text numberOfLines={1} style={styles.lessonMeta}>
                    {[lessonTypeLabel(currentLesson.type), currentLesson.duration ? formatMinutes(currentLesson.duration) : null].filter(Boolean).join(' · ')}
                  </Text>
                  {isCompleted ? (
                    <View style={styles.doneTag}><CheckCircle2 size={14} color={colors.successText} /><Text style={styles.doneTagText}>Completed</Text></View>
                  ) : null}
                </View>
              </View>

              {isPreviewMode ? (
                <View style={styles.previewBanner}>
                  <Eye size={16} color={colors.accentText} />
                  <Text style={styles.previewText}>Preview lesson. Enroll in this course to save progress and unlock every lesson.</Text>
                </View>
              ) : null}


              {currentLesson.type === 'quiz' && isPreviewMode ? (
                <View style={styles.contentCard}>
                  <Text style={styles.contentText}>Enroll in this course to take this quiz.</Text>
                </View>
              ) : currentLesson.type === 'quiz' ? (
                <LessonQuiz
                  key={currentLesson.id}
                  questions={currentLesson.quizQuestions ?? []}
                  isCompleted={isCompleted}
                  maxAttempts={currentLesson.maxAttempts ?? null}
                  summary={enrollment?.quizSummary?.[currentLesson.id] ?? null}
                  history={quizHistory?.lessonId === currentLesson.id ? quizHistory.attempts : []}
                  allowanceText={(used, max) => courseService.attemptAllowanceText(used, max)}
                  onSubmit={handleSubmitQuiz}
                  continueLabel={hasNext ? 'Next lesson' : 'Back to course'}
                  onContinue={hasNext ? handleNext : handleBackToCourse}
                />
              ) : (
                <View style={styles.contentCard}>
                  {/* Instructors write lesson text in the web's rich editor, so it is HTML there. RichBlogContent turns it into
                      native headings, lists, links and images (no WebView, nothing runs); plain lessons stay plain text. */}
                  {currentLesson.contentHtml ? (
                    <RichBlogContent content={currentLesson.contentHtml} />
                  ) : (
                    <Text style={styles.contentText}>
                      {currentLesson.content || currentLesson.description || (currentLesson.mediaUrl ? 'Open the lesson material below.' : 'No text content was provided for this lesson.')}
                    </Text>
                  )}
                </View>
              )}

              {/* Assignment order: instructions (above), then points, due date and reference files, then the submission. */}
              {currentLesson.type === 'assignment' ? (
                <AssignmentDetails
                  lesson={currentLesson}
                  isSubmitted={isAssignmentSubmitted || isCompleted}
                  onOpenError={() => setDialogState({ visible: true, type: 'error', title: 'Could not open', message: 'This file could not be opened on this device.' })}
                />
              ) : null}

              {currentLesson.mediaUrl && currentLesson.type !== 'quiz' && !(currentLesson.type === 'video' && isVideoFile(currentLesson.mediaUrl)) ? (
                <Pressable accessibilityRole="link" onPress={handleOpenMaterial} android_ripple={{ color: colors.control }} style={styles.materialButton}>
                  <FileText size={18} color={colors.accentText} />
                  <Text numberOfLines={1} style={styles.materialButtonText}>Open lesson material</Text>
                  <ChevronRight size={18} color={colors.mutedText} />
                </Pressable>
              ) : null}

              {currentLesson.type === 'assignment' && enrollment && activeUserId ? (
                <LessonAssignment
                  key={currentLesson.id}
                  userId={activeUserId}
                  courseId={id}
                  lessonId={currentLesson.id}
                  onSubmitted={() => void courseService.getEnrollmentStatus(enrollment.userId, id).then(setEnrollment).catch(() => undefined)}
                  onSubmissionChange={(submission) => setIsAssignmentSubmitted(Boolean(submission))}
                />
              ) : null}
            </View>
          </ScrollView>
        </KeyboardSafeView>
      )}

      {/* Sticky bottom bar inside the safe area: Previous · Mark complete (or Next) · Next. */}
      {currentLesson && !loading ? (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.bottomBar}>
          {hasNext && allLessons[currentLessonIndex + 1] ? (
            <Text numberOfLines={1} style={styles.upNext}>Next: {allLessons[currentLessonIndex + 1].title}</Text>
          ) : null}
          <View style={styles.bottomRow}>
            <Pressable
              onPress={handlePrev}
              disabled={!hasPrevious}
              accessibilityRole="button"
              accessibilityLabel="Previous lesson"
              accessibilityState={{ disabled: !hasPrevious }}
              style={[styles.navButton, !hasPrevious && styles.navButtonDisabled]}
            >
              <ChevronLeft size={22} color={hasPrevious ? colors.text : colors.disabledText} />
            </Pressable>
            <Pressable
              onPress={handlePrimary}
              disabled={savingCompletion}
              accessibilityRole="button"
              accessibilityState={{ busy: savingCompletion }}
              android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
              style={styles.primaryButton}
            >
              {savingCompletion ? <ActivityIndicator size="small" color="#ffffff" /> : canMarkComplete ? <Check size={18} color="#ffffff" strokeWidth={2.6} /> : null}
              <Text numberOfLines={1} style={styles.primaryButtonText}>{primaryLabel}</Text>
              {!canMarkComplete && hasNext ? <ChevronRight size={18} color="#ffffff" /> : null}
            </Pressable>
            {canMarkComplete && hasNext ? (
              <Pressable onPress={handleNext} accessibilityRole="button" accessibilityLabel="Skip to next lesson" style={styles.navButton}>
                <ChevronRight size={22} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
        </SafeAreaView>
      ) : null}

      <LessonOutlineSheet
        visible={showDrawer}
        modules={curriculum}
        currentLessonId={currentLesson?.id ?? null}
        completedLessonIds={enrollment?.completedLessons ?? []}
        onSelect={handleSelectLesson}
        onClose={() => setShowDrawer(false)}
      />

      <CustomModal
        visible={dialogState.visible}
        type={dialogState.type}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.action?.label ?? 'OK'}
        cancelText={dialogState.action ? 'Not now' : undefined}
        onConfirm={dialogState.action ? () => {
          const action = dialogState.action;
          setDialogState((prev) => ({ ...prev, visible: false, action: undefined }));
          action?.onPress();
        } : undefined}
        onClose={() => setDialogState((prev) => ({ ...prev, visible: false, action: undefined }))}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, backgroundColor: colors.surface },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  headerCopy: { flex: 1, minWidth: 0, alignItems: 'center' },
  headerTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  headerSubtitle: { color: colors.mutedText, fontSize: 12, marginTop: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorText: { color: colors.text, fontSize: 16, textAlign: 'center' },
  retryButton: { minHeight: 48, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: ELEARNING_ACTION_GREEN },
  retryButtonText: { color: '#ffffff', fontWeight: '800' },
  scrollContent: { paddingBottom: 24 },
  playerBox: { width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  videoPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  videoPlaceholderText: { color: '#e2e8f0', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  lessonBody: { padding: ELEARNING_GUTTER, gap: 16 },
  titleBlock: { gap: 6 },
  lessonTitle: { color: colors.text, fontSize: 22, fontWeight: '800', lineHeight: 28 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  lessonMeta: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  doneTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.successSurface },
  doneTagText: { color: colors.successText, fontSize: 12, fontWeight: '700' },
  previewBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, backgroundColor: colors.control },
  previewText: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  materialButton: { minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  materialButtonText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  contentCard: { padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  contentText: { color: colors.text, fontSize: 16, lineHeight: 25 },
  bottomBar: { backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  bottomRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: ELEARNING_GUTTER, paddingVertical: 12 },
  upNext: { paddingHorizontal: ELEARNING_GUTTER, paddingTop: 8, marginBottom: -6, color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  navButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  navButtonDisabled: { backgroundColor: colors.control, borderColor: colors.control },
  primaryButton: { flex: 1, minWidth: 0, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: ELEARNING_ACTION_GREEN, overflow: 'hidden' },
  primaryButtonText: { flexShrink: 1, color: '#ffffff', fontSize: 16, fontWeight: '800' },
});
