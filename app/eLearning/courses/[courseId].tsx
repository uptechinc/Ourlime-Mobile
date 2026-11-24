import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import CustomModal from '@/components/ui/CustomModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Info,
  Lock,
  Share2,
} from 'lucide-react-native';
import CachedImage from '@/components/ui/CachedImage';
import UserAvatar from '@/components/ui/UserAvatar';
import CourseReviews from '@/components/eLearning/CourseReviews';
import StudentCourseDashboard from '@/components/eLearning/course/StudentCourseDashboard';
import ModuleResources from '@/components/eLearning/course/ModuleResources';
import CourseWorkPreview from '@/components/eLearning/course/CourseWorkPreview';
import LessonTypeIcon from '@/components/eLearning/course/LessonTypeIcon';
import { formatDate, lessonHref, lessonTypeLabel, pluralize } from '@/components/eLearning/course/workspaceHelpers';
import {
  CourseRating,
  ELearningHeader,
  ELearningHeaderButton,
  ELEARNING_ACTION_GREEN,
  ELEARNING_GUTTER,
  ProgressBar,
  courseMetaLine,
  formatCoursePrice,
  formatMinutes,
  roundProgress,
} from '@/components/eLearning/ELearningParts';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { CourseDetailPageSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { courseService, isActiveEnrollment } from '@/lib/services/CourseService';
import { useCourseWorkspace } from '@/lib/hooks/useCourseWorkspace';
import { OURLIME_SITE_URL } from '@/lib/constants/site';
import { contentShareService } from '@/lib/services/ContentShareService';
import CourseClassCard from '@/components/eLearning/course/CourseClassCard';
import ClassPickerSheet from '@/components/eLearning/course/ClassPickerSheet';
import { serverMessage } from '@/lib/services/TeachingWorkflowService';
import type { CourseCohort, CourseLesson, PrerequisiteStatus } from '@/lib/types/course';
import CourseCertificateCard from '@/components/eLearning/course/CourseCertificateCard';
import PrerequisiteCoursesCard from '@/components/eLearning/course/PrerequisiteCoursesCard';
import { learningDepthService } from '@/lib/services/LearningDepthService';
import { prerequisiteBlockMessage } from '@/lib/services/LearningDepthRules';

const LANGUAGE_NAMES: { [code: string]: string } = { en: 'English', es: 'Spanish', fr: 'French', pt: 'Portuguese', hi: 'Hindi', zh: 'Chinese' };

/** "en" or "EN" reads as "English"; full names pass through. */
function readLanguageName(language: string | undefined): string {
  const trimmed = language?.trim() ?? '';
  if (!trimmed) return 'English';
  return LANGUAGE_NAMES[trimmed.toLowerCase()] ?? trimmed;
}

type CourseTab = 'home' | 'overview' | 'syllabus' | 'work' | 'reviews' | 'instructor';
type DialogState = { visible: boolean; type: 'error' | 'warning' | 'info' | 'success'; title: string; message: string };

// One to two words each so the tab row fits a 360dp phone without a long scroll.
const TAB_LABELS: Record<CourseTab, string> = { home: 'Home', overview: 'Overview', syllabus: 'Syllabus', work: 'Coursework', reviews: 'Reviews', instructor: 'Instructor' };
const HERO_MAX_HEIGHT = 280;

/** The callable's error as a sentence the learner can act on (never just a console line). */
const enrollErrorMessage = (error: unknown): string => {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : '';
  const message = error instanceof Error ? error.message : '';
  // Class problems (full, closed, a class is required) come back in words the learner can act on.
  if (code.endsWith('failed-precondition') && /class/i.test(message)) return serverMessage(error, 'This class cannot be joined right now.');
  if (/payment/i.test(message)) return 'Payments are unavailable for this course in the app.';
  // A required course not completed yet (and other refusals) come back in words the learner can act on.
  if (code.endsWith('failed-precondition')) return serverMessage(error, 'Enrollment could not be completed. Please try again.');
  if (code.endsWith('not-found')) return 'This course is no longer available for enrollment.';
  if (code.endsWith('permission-denied') || code.endsWith('unauthenticated')) return 'E-Learning is not available for your account right now.';
  if (code.endsWith('unavailable') || code.endsWith('deadline-exceeded') || /network/i.test(message)) return 'You appear to be offline. Check your connection and try again.';
  if (/could not be confirmed/i.test(message)) return 'Your enrollment was sent but could not be confirmed yet. Pull down to refresh.';
  return 'Enrollment could not be completed. Please try again.';
};

/** "5 lessons · 42m" for a module header (the duration only when lessons have one). */
const moduleSummary = (lessons: CourseLesson[], label: { one: string; many: string }): string => {
  const minutes = lessons.reduce((total, lesson) => total + (lesson.duration ?? 0), 0);
  return [pluralize(lessons.length, label.one, label.many), minutes > 0 ? formatMinutes(minutes) : null].filter(Boolean).join(' · ');
};

export default function CourseDetailScreen() {
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const id = typeof courseId === 'string' ? courseId : '';
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const { activeUserId } = useAppData();
  const { workspace, loading, refreshing, error: loadError, refresh } = useCourseWorkspace(id);
  const course = workspace?.course ?? null;
  const curriculum = useMemo(() => workspace?.modules ?? [], [workspace]);
  const enrollment = workspace?.enrollment ?? null;
  const isEnrolled = isActiveEnrollment(enrollment);

  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<CourseTab>('overview');
  const [enrolling, setEnrolling] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>({ visible: false, type: 'info', title: '', message: '' });
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerCohorts, setPickerCohorts] = useState<CourseCohort[]>([]);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [prerequisiteStatus, setPrerequisiteStatus] = useState<PrerequisiteStatus | null>(null);
  const prerequisiteLinks = course?.prerequisiteCourses ?? [];
  const hasPrerequisites = prerequisiteLinks.length > 0;

  // Which prerequisite courses the learner already completed (the server reads their own enrollments).
  useEffect(() => {
    if (!id || !activeUserId || !hasPrerequisites || isEnrolled) return;
    let isActive = true;
    learningDepthService.getPrerequisiteStatus(id)
      .then((status) => { if (isActive) setPrerequisiteStatus(status); })
      .catch((statusError: unknown) => console.warn('[CourseDetailScreen.prerequisites] Unavailable:', statusError instanceof Error ? statusError.message : 'Unknown error'));
    return () => { isActive = false; };
  }, [id, activeUserId, hasPrerequisites, isEnrolled]);

  // Visitors get the website's About / Curriculum / Quizzes & Assignments / Reviews tabs; enrolled learners reach their
  // quizzes, assignments and the review form from the course home.
  const tabs: CourseTab[] = isEnrolled ? ['home', 'overview', 'syllabus', 'instructor'] : ['overview', 'syllabus', 'work', 'reviews', 'instructor'];
  const lessonCount = curriculum.reduce((total, courseModule) => total + (courseModule.lessons?.length ?? 0), 0);
  const isOwnCourse = Boolean(course && activeUserId && course.instructor.id === activeUserId);
  // What the course really contains, from its syllabus (no blanket claims such as certificates or downloads). Before
  // enrolling only the preview lessons can be read, so they are counted as previews rather than as the whole course.
  const includedItems = useMemo(() => {
    const lessons = curriculum.flatMap((courseModule) => courseModule.lessons ?? []);
    const countOf = (type: string) => lessons.filter((lesson) => lesson.type === type).length;
    const fileCount = countOf('document') + countOf('resource');
    const durationLine = course && course.duration > 0 ? `${pluralize(course.duration, 'hour', 'hours')} of content (instructor's estimate)` : null;
    if (!isEnrolled) {
      return [
        durationLine,
        curriculum.length > 0 ? pluralize(curriculum.length, 'module', 'modules') : null,
        lessons.length > 0 ? `${pluralize(lessons.length, 'preview lesson', 'preview lessons')} you can open now` : null,
      ].filter((item): item is string => Boolean(item));
    }
    return [
      durationLine,
      lessons.length > 0 ? pluralize(lessons.length, 'lesson', 'lessons') : null,
      countOf('video') > 0 ? pluralize(countOf('video'), 'video', 'videos') : null,
      countOf('quiz') > 0 ? pluralize(countOf('quiz'), 'quiz', 'quizzes') : null,
      countOf('assignment') > 0 ? pluralize(countOf('assignment'), 'assignment', 'assignments') : null,
      fileCount > 0 ? pluralize(fileCount, 'downloadable resource', 'downloadable resources') : null,
    ].filter((item): item is string => Boolean(item));
  }, [course, curriculum, isEnrolled]);
  const nextItem = courseService.nextLesson(curriculum, enrollment);
  const firstLesson = courseService.flattenLessons(curriculum)[0];
  const progress = roundProgress(enrollment?.progress);

  // Enrolled learners land on their course home, like the website's StudentCourseDashboard.
  useEffect(() => { setActiveTab(isEnrolled ? 'home' : 'overview'); }, [isEnrolled]);
  useEffect(() => {
    if (curriculum.length > 0) setExpandedModules((current) => (Object.keys(current).length ? current : { [curriculum[0].id]: true }));
  }, [curriculum]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((previous) => ({ ...previous, [moduleId]: !previous[moduleId] }));
  };

  const showOpenError = () => setDialogState({ visible: true, type: 'error', title: 'Could not open', message: 'This file could not be opened on this device.' });

  const handleShare = async () => {
    if (!course) return;
    const url = `${OURLIME_SITE_URL}/eLearning/courses/${encodeURIComponent(course.id)}`;
    try {
      await Share.share(contentShareService.buildNativeShareContent({ title: course.title, message: course.title, url }));
    } catch (shareError: unknown) {
      console.error('[CourseDetailScreen.handleShare] Error:', shareError instanceof Error ? shareError.message : 'Unknown error');
    }
  };

  const handleOpenLesson = (lessonId: string, isPreview: boolean) => {
    if (isEnrolled || isPreview) {
      router.push(lessonHref(id, lessonId));
      return;
    }
    setDialogState({ visible: true, type: 'info', title: 'Lesson locked', message: 'Enroll in this course to open this lesson.' });
  };

  const handleEnrollOrResume = async () => {
    if (!course) return;
    if (isOwnCourse && !isEnrolled) {
      router.push(`/eLearning/instructor/course/${encodeURIComponent(course.id)}?title=${encodeURIComponent(course.title)}` as Href);
      return;
    }
    if (isEnrolled) {
      if (lessonCount === 0) {
        setDialogState({ visible: true, type: 'info', title: 'Lessons are on the way', message: 'The instructor has not published lessons yet. You will find them here once they do.' });
        return;
      }
      // Resume where the learner left off: the first lesson they have not completed (or the first lesson to review).
      router.push(lessonHref(id, nextItem?.lesson.id ?? firstLesson?.id));
      return;
    }
    if (enrollment) {
      setDialogState({ visible: true, type: 'warning', title: `Enrollment ${enrollment.status}`, message: 'Your enrollment in this course is not active. Contact the instructor or support to restore access.' });
      return;
    }
    if (!activeUserId) {
      router.push('/login' as Href);
      return;
    }
    if (course.price > 0) {
      setDialogState({ visible: true, type: 'info', title: 'Payments unavailable', message: 'Paid course enrollment is not available in this release.' });
      return;
    }
    // Required courses first (the server refuses the enrollment too, with the same words).
    if (prerequisiteStatus && prerequisiteStatus.missingRequired.length > 0) {
      setDialogState({ visible: true, type: 'info', title: 'Take another course first', message: prerequisiteBlockMessage(prerequisiteStatus.missingRequired) });
      return;
    }
    setEnrolling(true);
    // A course taught in classes asks which one to join first (or offers self-paced study unless a class is required).
    const cohorts = await courseService.getCohorts(id).catch((cohortError: unknown) => {
      console.warn('[CourseDetailScreen.handleEnrollOrResume] Classes unavailable:', cohortError instanceof Error ? cohortError.message : 'Unknown error');
      return [] as CourseCohort[];
    });
    if (course.cohortRequired || cohorts.some((cohort) => cohort.status === 'active')) {
      setPickerCohorts(cohorts);
      setPickerError(null);
      setIsPickerOpen(true);
      setEnrolling(false);
      return;
    }
    await enroll('');
  };

  /** cohortId '' enrolls without a class (self-paced). */
  const enroll = async (cohortId: string) => {
    if (!course || !activeUserId) return;
    setEnrolling(true);
    try {
      await courseService.enrollInCourse(activeUserId, id, activeUserId + '_' + id, cohortId);
      setIsPickerOpen(false);
      await refresh(true);
      setDialogState({ visible: true, type: 'success', title: 'You’re enrolled', message: `Welcome to ${course.title}. Your course home shows ${cohortId ? 'your class and ' : ''}what to do next.` });
    } catch (enrollError: unknown) {
      console.error('[CourseDetailScreen.enroll] Error:', enrollError instanceof Error ? enrollError.message : 'Unknown error');
      if (isPickerOpen) setPickerError(enrollErrorMessage(enrollError));
      else setDialogState({ visible: true, type: 'error', title: 'Enrollment failed', message: enrollErrorMessage(enrollError) });
    } finally {
      setEnrolling(false);
    }
  };

  // Short labels (1–3 words) so the bar never truncates on a 360dp phone. Paid and empty courses stay tappable and
  // explain why instead of showing a dead, greyed-out button.
  const ctaLabel = isOwnCourse && !isEnrolled ? 'Manage course'
    : isEnrolled
      ? (lessonCount > 0 && !nextItem ? 'Review course' : progress > 0 ? 'Continue' : 'Start learning')
      : enrollment ? `Enrollment ${enrollment.status}` : course && course.price > 0 ? 'Not in app yet' : 'Enroll for free';
  const isCtaMuted = !isOwnCourse && ((!isEnrolled && (Boolean(enrollment) || Boolean(course && course.price > 0))) || (isEnrolled && lessonCount === 0));
  const heroHeight = Math.min(HERO_MAX_HEIGHT, Math.round(width * 9 / 16));

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <ELearningHeader
        title={course?.title || 'Course'}
        onBack={() => router.back()}
        right={<ELearningHeaderButton accessibilityLabel="Share course" disabled={!course} onPress={() => void handleShare()}>
          <Share2 size={20} color={course ? colors.icon : colors.disabledText} />
        </ELearningHeaderButton>}
      />

      {loading ? (
        <CourseDetailPageSkeleton />
      ) : !course ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{loadError ?? 'Course not found.'}</Text>
          <Pressable onPress={() => void refresh()} style={styles.retryButton} accessibilityRole="button">
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {/* KeyboardSafeView shrinks the page above the keyboard so inline inputs low in it stay visible. */}
          <KeyboardSafeView style={styles.flex}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.accent} />}
            >
              {course.image || course.thumbnail ? (
                <CachedImage uri={course.image || course.thumbnail || ''} style={{ width, height: heroHeight }} accessibilityLabel={course.title} />
              ) : null}

              <View style={styles.mainContent}>
                <View style={styles.hero}>
                  {course.category ? <Text numberOfLines={1} style={styles.eyebrow}>{course.subcategory ? `${course.category} · ${course.subcategory}` : course.category}</Text> : null}
                  <Text accessibilityRole="header" style={styles.courseTitle}>{course.title}</Text>
                  {course.shortDescription ? <Text style={styles.promise}>{course.shortDescription}</Text> : null}
                  <Text numberOfLines={1} style={styles.byline}>by <Text style={styles.bylineName}>{course.instructor.name}</Text></Text>
                  <View style={styles.heroMetaRow}>
                    <CourseRating rating={course.rating} count={course.totalRatings} />
                    <Text numberOfLines={2} style={styles.heroMeta}>
                      {[courseMetaLine(course, isEnrolled ? lessonCount : undefined), course.enrolledStudents > 0 ? pluralize(course.enrolledStudents, 'learner', 'learners') : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {isEnrolled ? (
                    <View style={styles.heroProgress}>
                      <ProgressBar value={progress} accessibilityLabel="Course progress" />
                      <Text style={styles.heroProgressText}>{progress}% complete</Text>
                    </View>
                  ) : null}
                </View>

                {enrollment && !isEnrolled ? (
                  <View style={[styles.notice, { backgroundColor: colors.warningSurface }]}>
                    <Info size={16} color={colors.warningText} />
                    <Text style={[styles.noticeText, { color: colors.warningText }]}>Your enrollment is {enrollment.status}. Lessons stay locked until it is active again.</Text>
                  </View>
                ) : null}

                {isOwnCourse && !isEnrolled ? (
                  <View style={[styles.notice, { backgroundColor: colors.control }]}>
                    <Info size={16} color={colors.text} />
                    <Text style={[styles.noticeText, { color: colors.text }]}>This is your course, shown as learners see it before they enroll. Manage lessons, quizzes and grading from the instructor workspace.</Text>
                  </View>
                ) : null}

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                      <Pressable
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isActive }}
                        style={[styles.tabItem, isActive && styles.tabItemActive]}
                      >
                        <Text numberOfLines={1} style={[styles.tabItemText, isActive && styles.tabItemTextActive]}>{TAB_LABELS[tab]}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {activeTab === 'home' && isEnrolled && enrollment ? (
                  <CourseClassCard courseId={id} enrollment={enrollment} onJoined={() => void refresh(true)} onOpenError={showOpenError} />
                ) : null}

                {activeTab === 'home' && isEnrolled && (course.status === 'deleted' || course.status === 'archived') ? (
                  <View style={styles.retiredNote}>
                    <Text style={styles.retiredText}>
                      {course.status === 'deleted'
                        ? 'This course was removed by its instructor. You can still read it and see your grades and certificate, but nothing new can be saved.'
                        : 'This course is closed to new learners. You can keep studying it.'}
                    </Text>
                  </View>
                ) : null}

                {activeTab === 'home' && isEnrolled && enrollment && workspace ? (
                  <StudentCourseDashboard
                    course={course}
                    enrollment={enrollment}
                    modules={curriculum}
                    submissions={workspace.submissions}
                    currentUserId={activeUserId}
                    onOpenError={showOpenError}
                  />
                ) : null}

                {activeTab === 'home' && isEnrolled && enrollment && lessonCount > 0 ? (
                  <CourseCertificateCard courseId={id} enrollment={enrollment} />
                ) : null}

                {activeTab === 'overview' ? (
                  <View style={styles.tabContent}>
                    {course.learningObjectives && course.learningObjectives.length > 0 ? (
                      <View style={styles.card}>
                        <Text style={styles.cardTitle}>What you'll learn</Text>
                        {course.learningObjectives.map((objective, objectiveIndex) => (
                          <View key={`objective-${objectiveIndex}`} style={styles.objectiveRow}>
                            <Check size={16} color={colors.accentText} strokeWidth={2.6} />
                            <Text style={styles.objectiveText}>{objective}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    <View style={styles.section}>
                      <Text style={styles.sectionHeading}>About this course</Text>
                      <Text style={styles.bodyText}>{course.description}</Text>
                    </View>

                    {includedItems.length > 0 ? <View style={styles.card}>
                      <Text style={styles.cardTitle}>Includes</Text>
                      {includedItems.map((item) => (
                        <View key={item} style={styles.objectiveRow}>
                          <CheckCircle2 size={16} color={colors.mutedText} />
                          <Text style={styles.objectiveText}>{item}</Text>
                        </View>
                      ))}
                    </View> : null}

                    {!isEnrolled && hasPrerequisites ? <PrerequisiteCoursesCard links={prerequisiteLinks} status={prerequisiteStatus} /> : null}

                    {/* No hidden rules: what counts towards finishing, as the server applies it, and what finishing earns. */}
                    <View style={styles.card}>
                      <Text style={styles.cardTitle}>How you finish this course</Text>
                      {[
                        'Open and complete every lesson. Your progress saves as you go and resumes where you stopped.',
                        'Quizzes count once you submit an attempt. Your best score is the one that counts.',
                        'Assignments count once you hand them in. Your instructor grades them and adds feedback.',
                      ].map((rule) => (
                        <View key={rule} style={styles.objectiveRow}>
                          <CheckCircle2 size={16} color={colors.mutedText} />
                          <Text style={styles.objectiveText}>{rule}</Text>
                        </View>
                      ))}
                      <Text style={styles.mutedBody}>When you finish, Ourlime checks your work and issues a verified completion certificate you can share. It is an Ourlime course completion, not an accredited qualification.</Text>
                    </View>

                    {course.prerequisites && course.prerequisites.length > 0 ? (
                      <View style={styles.card}>
                        <Text style={styles.cardTitle}>Prerequisites</Text>
                        {course.prerequisites.map((prerequisite, prerequisiteIndex) => (
                          <Text key={`prerequisite-${prerequisiteIndex}`} style={styles.objectiveText}>• {prerequisite}</Text>
                        ))}
                      </View>
                    ) : null}

                    <View style={styles.factsGrid}>
                      {[
                        ...(course.duration > 0 ? [{ label: 'Duration', value: pluralize(course.duration, 'hour', 'hours') }] : []),
                        { label: 'Language', value: readLanguageName(course.language) },
                        { label: 'Updated', value: formatDate(course.updatedAt as string | undefined, 'Recently') },
                        { label: 'Difficulty', value: course.difficulty ? `${course.difficulty}/5` : course.level },
                        { label: 'Level', value: course.level },
                        { label: 'Access', value: course.price === 0 ? 'Free course' : formatCoursePrice(course.price) },
                      ].map((fact) => (
                        <View key={fact.label} style={styles.fact}>
                          <Text style={styles.factLabel}>{fact.label}</Text>
                          <Text numberOfLines={1} style={styles.factValue}>{fact.value}</Text>
                        </View>
                      ))}
                    </View>

                    {course.tags.length > 0 ? (
                      <View style={styles.tagsWrap}>
                        {course.tags.map((tag) => (
                          <View key={tag} style={styles.tag}><Text numberOfLines={1} style={styles.tagText}>{tag}</Text></View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}

                {activeTab === 'work' && !isEnrolled ? (
                  <View style={styles.tabContent}>
                    <CourseWorkPreview modules={curriculum} onOpenLesson={handleOpenLesson} />
                  </View>
                ) : null}

                {activeTab === 'reviews' && !isEnrolled ? (
                  <View style={styles.tabContent}>
                    {/* Enrolled learners rate the course from their course home; visitors read the reviews. */}
                    <View style={[styles.notice, { backgroundColor: colors.control }]}>
                      <Info size={16} color={colors.mutedText} />
                      <Text style={[styles.noticeText, { color: colors.mutedText }]}>Only enrolled students can rate or review this course.</Text>
                    </View>
                    <CourseReviews courseId={id} currentUserId={activeUserId} canReview={false} />
                  </View>
                ) : null}

                {activeTab === 'syllabus' ? (
                  <View style={styles.tabContent}>
                    <Text style={styles.sectionHeading}>Course curriculum</Text>
                    {!isEnrolled ? (
                      <View style={[styles.notice, { backgroundColor: colors.control }]}>
                        <Lock size={15} color={colors.mutedText} />
                        {/* The rules only release non-preview lessons to enrolled learners, so the outline lists the preview lessons. */}
                        <Text style={[styles.noticeText, { color: colors.mutedText }]}>Preview lessons are open to everyone. Enroll to unlock every lesson in each module.</Text>
                      </View>
                    ) : null}
                    {curriculum.length === 0 ? <Text style={styles.mutedBody}>The curriculum will appear when the instructor publishes it.</Text> : null}
                    {curriculum.map((courseModule, moduleIndex) => {
                      const isExpanded = Boolean(expandedModules[courseModule.id]);
                      const moduleLessons = courseModule.lessons ?? [];
                      const completedInModule = moduleLessons.filter((lesson) => enrollment?.completedLessons?.includes(lesson.id)).length;
                      const summary = isEnrolled
                        ? `${completedInModule} of ${moduleSummary(moduleLessons, { one: 'lesson', many: 'lessons' })} done`
                        : moduleLessons.length ? moduleSummary(moduleLessons, { one: 'preview lesson', many: 'preview lessons' }) : 'Lessons unlock when you enroll';
                      return (
                        <View key={courseModule.id} style={styles.moduleCard}>
                          <Pressable android_ripple={{ color: colors.control }} onPress={() => toggleModule(courseModule.id)} style={styles.moduleHeader} accessibilityRole="button" accessibilityLabel={`Module ${moduleIndex + 1}, ${courseModule.title}, ${summary}`} accessibilityState={{ expanded: isExpanded }}>
                            <View style={styles.flex}>
                              <Text style={styles.moduleEyebrow}>Module {moduleIndex + 1}</Text>
                              <Text numberOfLines={2} style={styles.moduleTitle}>{courseModule.title}</Text>
                              <Text numberOfLines={1} style={styles.moduleSummary}>{summary}</Text>
                            </View>
                            {isExpanded ? <ChevronUp size={20} color={colors.icon} /> : <ChevronDown size={20} color={colors.icon} />}
                          </Pressable>

                          {isExpanded ? (
                            <View style={styles.lessonsList}>
                              {courseModule.description ? <Text style={styles.moduleDescription}>{courseModule.description}</Text> : null}
                              {moduleLessons.map((lesson) => {
                                const isCompleted = Boolean(enrollment?.completedLessons?.includes(lesson.id));
                                const isPreview = Boolean(lesson.isFree);
                                const isLocked = !isEnrolled && !isPreview;
                                const stateLabel = isCompleted ? 'Completed' : isLocked ? 'Locked' : !isEnrolled ? 'Preview' : '';
                                const meta = [lessonTypeLabel(lesson.type), lesson.duration ? formatMinutes(lesson.duration) : null, lesson.type === 'quiz' || lesson.type === 'assignment' ? `${lesson.points ?? 0} pts` : null].filter(Boolean).join(' · ');
                                return (
                                  <Pressable key={lesson.id} android_ripple={{ color: colors.control }} accessibilityRole="button" accessibilityLabel={[lesson.title, meta, stateLabel].filter(Boolean).join(', ')} onPress={() => handleOpenLesson(lesson.id, isPreview)} style={styles.lessonItem}>
                                    <LessonTypeIcon type={lesson.type} />
                                    <View style={styles.flex}>
                                      <Text numberOfLines={2} style={[styles.lessonTitle, isLocked && { color: colors.secondaryText }]}>{lesson.title}</Text>
                                      <Text numberOfLines={1} style={styles.lessonMeta}>{meta}</Text>
                                    </View>
                                    {isCompleted ? <CheckCircle2 size={18} color={colors.accent} />
                                      : isEnrolled ? <ArrowRight size={16} color={colors.mutedText} />
                                      : isPreview ? <View style={styles.previewTag}><Eye size={13} color={colors.accentText} /><Text style={styles.previewTagText}>Preview</Text></View>
                                      : <Lock size={15} color={colors.mutedText} />}
                                  </Pressable>
                                );
                              })}
                              {isEnrolled && moduleLessons.length === 0 ? <Text style={styles.moduleDescription}>No content available in this module yet.</Text> : null}
                              <ModuleResources resources={courseModule.resources ?? []} onOpenError={showOpenError} />
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {activeTab === 'instructor' ? (
                  <View style={styles.tabContent}>
                    <View style={styles.instructorCard}>
                      <View style={styles.instructorRow}>
                        <UserAvatar profileImage={course.instructor.avatar} firstName={course.instructor.name} size={56} />
                        <View style={styles.flex}>
                          <Text numberOfLines={2} style={styles.instructorName}>{course.instructor.name}</Text>
                          <Text numberOfLines={1} style={styles.instructorRole}>{course.instructor.role || 'Instructor'}</Text>
                        </View>
                      </View>
                      {course.instructor.bio ? <Text style={styles.bodyText}>{course.instructor.bio}</Text> : null}
                    </View>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </KeyboardSafeView>

          {/* The sticky bar takes its own space under the page (inside the bottom safe area) instead of covering it. */}
          <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.bottomBar}>
            <View style={styles.bottomRow}>
              <View style={styles.priceColumn}>
                <Text numberOfLines={1} style={styles.priceLabel}>{isEnrolled ? 'Progress' : 'Price'}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.priceValue, !isEnrolled && course.price === 0 && { color: colors.accentText }]}>
                  {isEnrolled ? `${progress}%` : formatCoursePrice(course.price)}
                </Text>
              </View>
              <Pressable
                onPress={() => void handleEnrollOrResume()}
                disabled={enrolling}
                accessibilityRole="button"
                accessibilityState={{ busy: enrolling }}
                android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
                style={[styles.enrollBtn, isCtaMuted && styles.enrollBtnMuted]}
              >
                {enrolling ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Text numberOfLines={1} style={[styles.enrollBtnText, isCtaMuted && styles.enrollBtnTextMuted]}>{ctaLabel}</Text>
                    {isCtaMuted ? null : <ArrowRight size={18} color="#ffffff" />}
                  </>
                )}
              </Pressable>
            </View>
          </SafeAreaView>
        </>
      )}

      <CustomModal
        visible={dialogState.visible}
        type={dialogState.type}
        title={dialogState.title}
        message={dialogState.message}
        onClose={() => setDialogState((previous) => ({ ...previous, visible: false }))}
      />
      <ClassPickerSheet
        visible={isPickerOpen}
        title="Choose how to take this course"
        cohorts={pickerCohorts}
        allowSelfPaced={course?.cohortRequired !== true}
        confirmLabel="Enroll for free"
        isBusy={enrolling}
        error={pickerError}
        onConfirm={(cohortId) => void enroll(cohortId)}
        onClose={() => setIsPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, minWidth: 0 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorText: { color: colors.text, fontSize: 16, textAlign: 'center' },
  retryButton: { minHeight: 48, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: ELEARNING_ACTION_GREEN },
  retryButtonText: { color: '#ffffff', fontWeight: '800' },
  scrollContent: { paddingBottom: 24 },
  mainContent: { padding: ELEARNING_GUTTER, gap: 16 },
  hero: { gap: 6 },
  eyebrow: { color: colors.accentText, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  courseTitle: { color: colors.text, fontSize: 24, fontWeight: '800', lineHeight: 30 },
  promise: { color: colors.secondaryText, fontSize: 15, lineHeight: 22 },
  byline: { color: colors.mutedText, fontSize: 14 },
  bylineName: { color: colors.text, fontWeight: '700' },
  heroMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4 },
  heroMeta: { flexShrink: 1, color: colors.mutedText, fontSize: 13 },
  heroProgress: { marginTop: 6, gap: 6 },
  heroProgressText: { color: colors.accentText, fontSize: 13, fontWeight: '700' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  tabBar: { flexGrow: 0, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  tabBarContent: { flexGrow: 1, padding: 4, gap: 4 },
  tabItem: { flexGrow: 1, minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  tabItemActive: { backgroundColor: ELEARNING_ACTION_GREEN },
  tabItemText: { color: colors.secondaryText, fontSize: 14, fontWeight: '600' },
  tabItemTextActive: { color: '#ffffff', fontWeight: '700' },
  tabContent: { gap: 16 },
  section: { gap: 8 },
  sectionHeading: { color: colors.text, fontSize: 18, fontWeight: '800' },
  bodyText: { color: colors.text, fontSize: 15, lineHeight: 23 },
  mutedBody: { color: colors.mutedText, fontSize: 14, lineHeight: 21 },
  retiredNote: { marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: colors.warningSurface },
  retiredText: { color: colors.warningText, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  card: { padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, gap: 10 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  objectiveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  objectiveText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.successSurface },
  tagText: { color: colors.successText, fontSize: 12, fontWeight: '700' },
  factsGrid: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, padding: 12, rowGap: 12 },
  fact: { width: '50%', paddingHorizontal: 4, gap: 2 },
  factLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  factValue: { color: colors.text, fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  moduleCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  moduleHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  moduleEyebrow: { color: colors.mutedText, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  moduleTitle: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  moduleSummary: { color: colors.mutedText, fontSize: 12, marginTop: 2 },
  moduleDescription: { color: colors.mutedText, fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  lessonsList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: 16, paddingBottom: 8 },
  lessonItem: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  lessonTitle: { color: colors.text, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  lessonMeta: { color: colors.mutedText, fontSize: 12, marginTop: 2 },
  previewTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.successSurface },
  previewTagText: { color: colors.accentText, fontSize: 12, fontWeight: '700' },
  instructorCard: { padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, gap: 12 },
  instructorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  instructorName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  instructorRole: { color: colors.accentText, fontSize: 13, marginTop: 2, fontWeight: '700' },
  bottomBar: { backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  bottomRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: ELEARNING_GUTTER, paddingVertical: 12 },
  priceColumn: { flexShrink: 1, minWidth: 64, maxWidth: '36%' },
  priceLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  priceValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  enrollBtn: { flex: 1, minWidth: 0, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: ELEARNING_ACTION_GREEN, overflow: 'hidden' },
  enrollBtnMuted: { backgroundColor: colors.control },
  enrollBtnText: { flexShrink: 1, color: '#ffffff', fontSize: 16, fontWeight: '800' },
  enrollBtnTextMuted: { color: colors.secondaryText },
});
