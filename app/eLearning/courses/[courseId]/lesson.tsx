import RichBlogContent from '@/components/blog/RichBlogContent';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import CustomModal from '@/components/ui/CustomModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  PlayCircle,
  FileText,
  HelpCircle,
  List,
  Eye,
  X,
} from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { LessonContentSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { courseService, isActiveEnrollment } from '@/lib/services/CourseService';
import CustomVideoPlayer from '@/components/media/CustomVideoPlayer';
import LessonQuiz from '@/components/eLearning/LessonQuiz';
import LessonAssignment from '@/components/eLearning/LessonAssignment';
import AssignmentDetails from '@/components/eLearning/course/AssignmentDetails';
import { lessonTypeLabel } from '@/components/eLearning/course/workspaceHelpers';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import type { Course, CourseModule, CourseLesson, Enrollment } from '@/lib/types/course';

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
  const { colors, isDark } = useAppTheme();
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
  const [dialogState, setDialogState] = useState<{
    visible: boolean;
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
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
        setDialogState({ visible: true, type: 'success', title: 'Course complete', message: 'You reached the last lesson. Check your progress and grades from the course home.' });
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

  const handleSubmitQuiz = async (answers: number[]): Promise<number | null> => {
    if (!enrollment || !currentLesson) throw new Error('Enroll in this course before taking the quiz.');
    const score = await courseService.submitQuiz(enrollment.id, currentLesson.id, answers);
    const updated = await courseService.getEnrollmentStatus(enrollment.userId, id);
    setEnrollment(updated);
    return score;
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

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.canvas }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {course?.title || 'Lesson'}
        </Text>
        <TouchableOpacity onPress={() => setShowDrawer((prev) => !prev)} style={styles.headerBtn}>
          <List size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <LessonContentSkeleton />
        </ScrollView>
      ) : !currentLesson ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>{loadError ?? 'This course does not have published lessons yet.'}</Text>
          {loadError ? (
            <TouchableOpacity onPress={() => void loadData()} style={styles.retryButton} accessibilityRole="button">
              <Text style={styles.retryButtonText}>Try again</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        // KeyboardSafeView shrinks the page above the keyboard so inline inputs low in it stay visible.
        <KeyboardSafeView style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Video Placeholder / Player Box */}
          <View style={[styles.playerBox, { backgroundColor: isDark ? '#0f172a' : '#1e293b' }]}>
            {currentLesson.type === 'video' && isVideoFile(currentLesson.mediaUrl) ? (
              // key: a new lesson gets a fresh player instead of keeping the previous video's position.
              <CustomVideoPlayer key={currentLesson.id} url={currentLesson.mediaUrl ?? ''} autoPlay={false} showSpeed />
            ) : currentLesson.type === 'video' && !currentLesson.mediaUrl ? (
              <View style={styles.videoPlaceholder}>
                <PlayCircle size={56} color="#10b981" />
                <Text style={styles.videoPlaceholderText}>Video lesson</Text>
                {currentLesson.duration ? <Text style={styles.videoDuration}>{currentLesson.duration} minutes</Text> : null}
              </View>
            ) : currentLesson.type === 'quiz' ? (
              <View style={styles.videoPlaceholder}>
                <HelpCircle size={56} color="#f59e0b" />
                <Text style={styles.videoPlaceholderText}>Quiz</Text>
              </View>
            ) : (
              <View style={styles.videoPlaceholder}>
                <FileText size={56} color="#3b82f6" />
                <Text style={styles.videoPlaceholderText}>Lesson material</Text>
              </View>
            )}
          </View>

          {/* Lesson Info */}
          <View style={styles.lessonBody}>
            <View style={styles.lessonMetaRow}>
              <View style={[styles.badge, { backgroundColor: '#10b98122' }]}>
                <Text style={styles.badgeText}>Lesson {currentLessonIndex + 1} of {allLessons.length}</Text>
              </View>
              {/* A quiz with questions is completed by submitting it; everything else is marked done by hand. */}
              {isPreviewMode || (currentLesson.type === 'quiz' && (currentLesson.quizQuestions?.length ?? 0) > 0) ? null : (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleToggleComplete}
                disabled={isCompleted || savingCompletion}
                style={[
                  styles.completeToggleBtn,
                  isCompleted
                    ? { backgroundColor: '#10b981', borderColor: '#10b981' }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <CheckCircle2 size={16} color={isCompleted ? '#ffffff' : colors.mutedText} />
                <Text
                  style={[
                    styles.completeToggleText,
                    { color: isCompleted ? '#ffffff' : colors.text },
                  ]}
                >
                  {isCompleted ? 'Completed' : savingCompletion ? 'Saving…' : 'Mark as Done'}
                </Text>
              </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.lessonTitle, { color: colors.text }]}>{currentLesson.title}</Text>
            <Text style={[styles.lessonType, { color: colors.mutedText }]}>
              {[lessonTypeLabel(currentLesson.type), currentLesson.duration ? `${currentLesson.duration} min` : null].filter(Boolean).join(' · ')}
            </Text>

            {isPreviewMode ? (
              <View style={[styles.previewBanner, { backgroundColor: colors.control }]}>
                <Eye size={16} color={colors.accentText} />
                <Text style={[styles.previewText, { color: colors.text }]}>Preview lesson. Enroll in this course to save progress and unlock every lesson.</Text>
              </View>
            ) : null}

            {currentLesson.type === 'assignment' ? (
              <AssignmentDetails
                lesson={currentLesson}
                isSubmitted={isAssignmentSubmitted || isCompleted}
                onOpenError={() => setDialogState({ visible: true, type: 'error', title: 'Could not open', message: 'This file could not be opened on this device.' })}
              />
            ) : null}

            {currentLesson.type === 'quiz' && isPreviewMode ? (
              <View style={[styles.contentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.contentText, { color: colors.text }]}>Enroll in this course to take this quiz.</Text>
              </View>
            ) : currentLesson.type === 'quiz' ? (
              <LessonQuiz key={currentLesson.id} questions={currentLesson.quizQuestions ?? []} isCompleted={isCompleted} onSubmit={handleSubmitQuiz} />
            ) : (
              <View style={[styles.contentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {/* Instructors write lesson text in the web's rich editor, so it is HTML there (rendered with dangerouslySetInnerHTML). */}
                {currentLesson.content && /<[a-z][\s\S]*>/i.test(currentLesson.content) ? (
                  <RichBlogContent content={currentLesson.content} />
                ) : (
                  <Text style={[styles.contentText, { color: colors.text }]}>
                    {currentLesson.content || currentLesson.description || (currentLesson.mediaUrl ? 'Open the lesson material below.' : 'No text content was provided for this lesson.')}
                  </Text>
                )}
              </View>
            )}

            {currentLesson.mediaUrl && currentLesson.type !== 'quiz' && !(currentLesson.type === 'video' && isVideoFile(currentLesson.mediaUrl)) ? (
              <TouchableOpacity accessibilityRole="link" onPress={handleOpenMaterial} style={[styles.materialButton, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <FileText size={18} color="#10b981" />
                <Text style={[styles.materialButtonText, { color: colors.text }]}>Open lesson material</Text>
                <ChevronRight size={18} color={colors.mutedText} />
              </TouchableOpacity>
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

      {/* Bottom Navigation Controls */}
      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={handlePrev}
          disabled={currentLessonIndex === 0}
          style={[
            styles.navBtn,
            currentLessonIndex === 0 && { opacity: 0.4 },
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ChevronLeft size={18} color={colors.text} />
          <Text style={[styles.navBtnText, { color: colors.text }]}>Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleNext}
          disabled={currentLessonIndex >= allLessons.length - 1}
          style={[
            styles.navBtn,
            styles.nextBtn,
            currentLessonIndex >= allLessons.length - 1 && { opacity: 0.4 },
          ]}
        >
          <Text style={styles.nextBtnText}>Next Lesson</Text>
          <ChevronRight size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Lesson List Drawer / Modal */}
      <Modal visible={showDrawer} animationType="slide" transparent onRequestClose={() => setShowDrawer(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', padding: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Course Lessons ({allLessons.length})</Text>
              <TouchableOpacity onPress={() => setShowDrawer(false)} style={{ padding: 4 }}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {allLessons.map((lesson, idx) => {
                const isActive = idx === currentLessonIndex;
                const isCompleted = enrollment?.completedLessons?.includes(lesson.id);
                return (
                  <TouchableOpacity
                    key={lesson.id || idx}
                    onPress={() => {
                      setCurrentLessonIndex(idx);
                      setShowDrawer(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      backgroundColor: isActive ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5') : 'transparent',
                      marginBottom: 6,
                    }}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={18} color="#10b981" style={{ marginRight: 10 }} />
                    ) : (
                      <PlayCircle size={18} color={isActive ? '#10b981' : colors.mutedText} style={{ marginRight: 10 }} />
                    )}
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: isActive ? '800' : '600', color: isActive ? '#10b981' : colors.text }} numberOfLines={1}>
                      {idx + 1}. {lesson.title}
                    </Text>
                    {lesson.duration ? (
                      <Text style={{ fontSize: 12, color: colors.mutedText, marginLeft: 8 }}>{lesson.duration}m</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <CustomModal
        visible={dialogState.visible}
        type={dialogState.type}
        title={dialogState.title}
        message={dialogState.message}
        onClose={() => setDialogState((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#10b981',
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  scrollContent: {
    paddingBottom: 90,
  },
  playerBox: {
    width: '100%',
    // 16:9 like the video itself, capped so a tablet in portrait keeps the lesson text in view.
    aspectRatio: 16 / 9,
    maxHeight: 520,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoPlaceholderText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  videoDuration: {
    color: '#94a3b8',
    fontSize: 13,
  },
  lessonBody: {
    padding: 18,
    gap: 14,
  },
  lessonMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '800',
  },
  completeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  completeToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  lessonTitle: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  lessonType: { fontSize: 13, fontWeight: '600', marginTop: -6 },
  previewBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12 },
  previewText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  materialButton: { marginTop: 12, minHeight: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1 },
  materialButtonText: { flex: 1, fontSize: 15, fontWeight: '700' },
  contentCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 6,
  },
  contentText: {
    fontSize: 15,
    lineHeight: 24,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  navBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  nextBtn: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  nextBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
