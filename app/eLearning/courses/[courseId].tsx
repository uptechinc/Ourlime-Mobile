import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import CustomModal from '@/components/ui/CustomModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Star,
  Clock,
  Users,
  CheckCircle2,
  Lock,
  Eye,
  BookOpen,
  ArrowRight,
  Share2,
  Info,
} from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import CourseReviews from '@/components/eLearning/CourseReviews';
import StudentCourseDashboard from '@/components/eLearning/course/StudentCourseDashboard';
import ModuleResources from '@/components/eLearning/course/ModuleResources';
import LessonTypeIcon from '@/components/eLearning/course/LessonTypeIcon';
import { formatDate, lessonHref, pluralize } from '@/components/eLearning/course/workspaceHelpers';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { CourseDetailPageSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { courseService, isActiveEnrollment } from '@/lib/services/CourseService';
import { useCourseWorkspace } from '@/lib/hooks/useCourseWorkspace';
import { OURLIME_SITE_URL } from '@/lib/constants/site';

type CourseTab = 'home' | 'overview' | 'syllabus' | 'instructor';
type DialogState = { visible: boolean; type: 'error' | 'warning' | 'info' | 'success'; title: string; message: string };

const TAB_LABELS: Record<CourseTab, string> = { home: 'Home', overview: 'Overview', syllabus: 'Syllabus', instructor: 'Instructor' };

/** The callable's error as a sentence the learner can act on (never just a console line). */
const enrollErrorMessage = (error: unknown): string => {
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : '';
  const message = error instanceof Error ? error.message : '';
  if (code.endsWith('failed-precondition') || /payment/i.test(message)) return 'Payments are unavailable for this course in the app.';
  if (code.endsWith('not-found')) return 'This course is no longer available for enrollment.';
  if (code.endsWith('permission-denied') || code.endsWith('unauthenticated')) return 'E-Learning is not available for your account right now.';
  if (code.endsWith('unavailable') || code.endsWith('deadline-exceeded') || /network/i.test(message)) return 'You appear to be offline. Check your connection and try again.';
  if (/could not be confirmed/i.test(message)) return 'Your enrollment was sent but could not be confirmed yet. Pull down to refresh.';
  return 'Enrollment could not be completed. Please try again.';
};

export default function CourseDetailScreen() {
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const id = typeof courseId === 'string' ? courseId : '';
  const { colors } = useAppTheme();
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

  const tabs: CourseTab[] = isEnrolled ? ['home', 'overview', 'syllabus', 'instructor'] : ['overview', 'syllabus', 'instructor'];
  const lessonCount = curriculum.reduce((total, courseModule) => total + (courseModule.lessons?.length ?? 0), 0);
  const nextItem = courseService.nextLesson(curriculum, enrollment);
  const firstLesson = courseService.flattenLessons(curriculum)[0];

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
      await Share.share({ title: course.title, message: `${course.title}\n${url}`, url });
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
    if (isEnrolled) {
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
    setEnrolling(true);
    try {
      await courseService.enrollInCourse(activeUserId, id);
      await refresh(true);
      setDialogState({ visible: true, type: 'success', title: 'You’re enrolled', message: `Welcome to ${course.title}. Your course home shows what to do next.` });
    } catch (enrollError: unknown) {
      console.error('[CourseDetailScreen.handleEnrollOrResume] Error:', enrollError instanceof Error ? enrollError.message : 'Unknown error');
      setDialogState({ visible: true, type: 'error', title: 'Enrollment failed', message: enrollErrorMessage(enrollError) });
    } finally {
      setEnrolling(false);
    }
  };

  const ctaLabel = isEnrolled
    ? (lessonCount > 0 && !nextItem ? 'Review Course' : (enrollment?.progress ?? 0) > 0 ? 'Continue Learning' : 'Start Learning')
    : enrollment ? `Enrollment ${enrollment.status}` : course && course.price > 0 ? 'Payments unavailable' : 'Enroll for Free';
  const ctaDisabled = enrolling || (!isEnrolled && !enrollment && Boolean(course && course.price > 0)) || (isEnrolled && lessonCount === 0);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.canvas }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Go back">
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {course?.title || 'Course Details'}
        </Text>
        <TouchableOpacity onPress={() => void handleShare()} disabled={!course} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="Share course">
          <Share2 size={21} color={course ? colors.text : colors.disabledText} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <CourseDetailPageSkeleton />
      ) : !course ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>{loadError ?? 'Course not found.'}</Text>
          <TouchableOpacity onPress={() => void refresh()} style={styles.retryButton} accessibilityRole="button">
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // KeyboardSafeView shrinks the page above the keyboard so inline inputs low in it stay visible.
        <KeyboardSafeView style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.accent} />}
        >
          {course.image ? <Image source={{ uri: course.image }} style={styles.heroImage} resizeMode="cover" /> : null}

          <View style={styles.mainContent}>
            <View style={styles.badgeRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{course.category.toUpperCase()}</Text>
              </View>
              <View style={styles.ratingRow}>
                <Star size={15} color="#f59e0b" fill="#f59e0b" />
                <Text style={[styles.ratingText, { color: colors.text }]}>
                  {course.rating.toFixed(1)} ({pluralize(course.totalRatings, 'rating', 'ratings')})
                </Text>
              </View>
            </View>

            <Text style={[styles.courseTitle, { color: colors.text }]}>{course.title}</Text>
            {course.shortDescription ? <Text style={[styles.bodyText, { color: colors.mutedText }]}>{course.shortDescription}</Text> : null}

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Clock size={15} color="#10b981" />
                <Text style={[styles.metaText, { color: colors.text }]}>{pluralize(course.duration, 'hour', 'hours')}</Text>
              </View>
              <View style={styles.metaItem}>
                <Users size={15} color="#10b981" />
                <Text style={[styles.metaText, { color: colors.text }]}>{pluralize(course.enrolledStudents, 'student', 'students')}</Text>
              </View>
              <View style={styles.metaItem}>
                <BookOpen size={15} color="#10b981" />
                <Text style={[styles.metaText, { color: colors.text }]}>
                  {isEnrolled ? pluralize(lessonCount, 'lesson', 'lessons') : pluralize(curriculum.length, 'module', 'modules')}
                </Text>
              </View>
            </View>

            {enrollment && !isEnrolled ? (
              <View style={[styles.notice, { backgroundColor: colors.warningSurface }]}>
                <Info size={16} color={colors.warningText} />
                <Text style={[styles.noticeText, { color: colors.warningText }]}>Your enrollment is {enrollment.status}. Lessons stay locked until it is active again.</Text>
              </View>
            ) : null}

            <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === tab }}
                  style={[styles.tabItem, activeTab === tab && { backgroundColor: '#10b981' }]}
                >
                  <Text style={[styles.tabItemText, { color: activeTab === tab ? '#ffffff' : colors.text }]}>{TAB_LABELS[tab]}</Text>
                </TouchableOpacity>
              ))}
            </View>

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

            {activeTab === 'overview' ? (
              <View style={styles.tabContent}>
                <Text style={[styles.sectionHeading, { color: colors.text }]}>Description</Text>
                <Text style={[styles.bodyText, { color: colors.text }]}>{course.description}</Text>

                {course.learningObjectives && course.learningObjectives.length > 0 ? (
                  <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>What you'll learn</Text>
                    {course.learningObjectives.map((objective, objectiveIndex) => (
                      <View key={`objective-${objectiveIndex}`} style={styles.objectiveRow}>
                        <CheckCircle2 size={16} color="#10b981" />
                        <Text style={[styles.objectiveText, { color: colors.text }]}>{objective}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Includes</Text>
                  {[`${pluralize(course.duration, 'hour', 'hours')} on-demand content`, 'Downloadable resources', 'Practice quizzes', 'Certificate of completion'].map((item) => (
                    <View key={item} style={styles.objectiveRow}>
                      <CheckCircle2 size={16} color={colors.mutedText} />
                      <Text style={[styles.objectiveText, { color: colors.text }]}>{item}</Text>
                    </View>
                  ))}
                </View>

                {course.prerequisites && course.prerequisites.length > 0 ? (
                  <View style={[styles.card, { backgroundColor: colors.control, borderColor: colors.border }]}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>Prerequisites</Text>
                    {course.prerequisites.map((prerequisite, prerequisiteIndex) => (
                      <Text key={`prerequisite-${prerequisiteIndex}`} style={[styles.objectiveText, { color: colors.text }]}>• {prerequisite}</Text>
                    ))}
                  </View>
                ) : null}

                {course.tags.length > 0 ? (
                  <View style={styles.tagsWrap}>
                    {course.tags.map((tag) => (
                      <View key={tag} style={[styles.tag, { backgroundColor: colors.successSurface }]}>
                        <Text style={[styles.tagText, { color: colors.successText }]}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={[styles.factsGrid, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {[
                    { label: 'Duration', value: pluralize(course.duration, 'hour', 'hours') },
                    { label: 'Language', value: course.language || 'English' },
                    { label: 'Updated', value: formatDate(course.updatedAt as string | undefined, 'Recently') },
                    { label: 'Difficulty', value: course.difficulty ? `${course.difficulty}/5` : course.level },
                    { label: 'Level', value: course.level },
                    { label: 'Access', value: course.price === 0 ? 'Free Course' : `$${course.price}` },
                  ].map((fact) => (
                    <View key={fact.label} style={styles.fact}>
                      <Text style={[styles.factLabel, { color: colors.mutedText }]}>{fact.label.toUpperCase()}</Text>
                      <Text style={[styles.factValue, { color: colors.text }]}>{fact.value}</Text>
                    </View>
                  ))}
                </View>

                {/* Enrolled learners rate the course from their course home. */}
                {!isEnrolled ? <CourseReviews courseId={id} currentUserId={activeUserId} canReview={false} /> : null}
              </View>
            ) : null}

            {activeTab === 'syllabus' ? (
              <View style={styles.tabContent}>
                <Text style={[styles.sectionHeading, { color: colors.text }]}>Course Curriculum</Text>
                {!isEnrolled ? (
                  <View style={[styles.notice, { backgroundColor: colors.control }]}>
                    <Lock size={15} color={colors.mutedText} />
                    {/* The rules only release non-preview lessons to enrolled learners, so the outline lists the preview lessons. */}
                    <Text style={[styles.noticeText, { color: colors.mutedText }]}>Preview lessons are open to everyone. Enroll to unlock every lesson in each module.</Text>
                  </View>
                ) : null}
                {curriculum.length === 0 ? <Text style={[styles.bodyText, { color: colors.mutedText }]}>The curriculum will appear when the instructor publishes it.</Text> : null}
                {curriculum.map((courseModule, moduleIndex) => {
                  const isExpanded = Boolean(expandedModules[courseModule.id]);
                  const moduleLessons = courseModule.lessons ?? [];
                  const completedInModule = moduleLessons.filter((lesson) => enrollment?.completedLessons?.includes(lesson.id)).length;
                  return (
                    <View key={courseModule.id} style={[styles.moduleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <TouchableOpacity activeOpacity={0.7} onPress={() => toggleModule(courseModule.id)} style={styles.moduleHeader} accessibilityRole="button" accessibilityState={{ expanded: isExpanded }}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.moduleTitle, { color: colors.text }]}>Module {moduleIndex + 1}: {courseModule.title}</Text>
                          <Text style={[styles.moduleLessonsCount, { color: colors.mutedText }]}>
                            {isEnrolled
                              ? `${completedInModule} / ${pluralize(moduleLessons.length, 'lesson', 'lessons')} completed`
                              : moduleLessons.length ? pluralize(moduleLessons.length, 'preview lesson', 'preview lessons') : 'Lessons unlock when you enroll'}
                          </Text>
                        </View>
                        {isExpanded ? <ChevronUp size={20} color={colors.text} /> : <ChevronDown size={20} color={colors.text} />}
                      </TouchableOpacity>

                      {isExpanded ? (
                        <View style={[styles.lessonsList, { borderTopColor: colors.border }]}>
                          {courseModule.description ? <Text style={[styles.lessonDuration, { color: colors.mutedText, paddingVertical: 6 }]}>{courseModule.description}</Text> : null}
                          {moduleLessons.map((lesson) => {
                            const isCompleted = enrollment?.completedLessons?.includes(lesson.id);
                            const isPreview = Boolean(lesson.isFree);
                            return (
                              <TouchableOpacity key={lesson.id} activeOpacity={0.7} onPress={() => handleOpenLesson(lesson.id, isPreview)} style={[styles.lessonItem, { borderBottomColor: colors.border }]}>
                                <LessonTypeIcon type={lesson.type} />
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.lessonTitle, { color: colors.text }]}>{lesson.title}</Text>
                                  {lesson.description ? <Text style={[styles.lessonDuration, { color: colors.mutedText }]} numberOfLines={2}>{lesson.description}</Text> : null}
                                  <Text style={[styles.lessonDuration, { color: colors.mutedText }]}>
                                    {[lesson.duration ? `${lesson.duration} min` : null, lesson.type === 'quiz' || lesson.type === 'assignment' ? `${lesson.points ?? 0} pts` : null].filter(Boolean).join(' · ')}
                                  </Text>
                                </View>
                                {isCompleted ? <CheckCircle2 size={16} color="#10b981" />
                                  : isEnrolled ? <ArrowRight size={14} color={colors.mutedText} />
                                  : isPreview ? <Eye size={15} color={colors.accentText} />
                                  : <Lock size={14} color={colors.mutedText} />}
                              </TouchableOpacity>
                            );
                          })}
                          {isEnrolled && moduleLessons.length === 0 ? <Text style={[styles.lessonDuration, { color: colors.mutedText, paddingVertical: 10 }]}>No content available in this module yet.</Text> : null}
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
                <View style={[styles.instructorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <UserAvatar profileImage={course.instructor.avatar} firstName={course.instructor.name} size={64} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.instructorName, { color: colors.text }]}>{course.instructor.name}</Text>
                    <Text style={[styles.instructorRole, { color: colors.accentText }]}>{course.instructor.role || 'Instructor'}</Text>
                    {course.instructor.bio ? <Text style={[styles.lessonDuration, { color: colors.mutedText }]}>{course.instructor.bio}</Text> : null}
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
        </KeyboardSafeView>
      )}

      {course ? (
        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View>
            <Text style={[styles.priceLabel, { color: colors.mutedText }]}>{isEnrolled ? 'Progress' : 'Access'}</Text>
            <Text style={[styles.priceValue, { color: colors.text }]}>
              {isEnrolled ? `${Math.round(enrollment?.progress ?? 0)}%` : course.price === 0 ? 'Free' : `$${course.price}`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => void handleEnrollOrResume()}
            disabled={ctaDisabled}
            accessibilityRole="button"
            style={[styles.enrollBtn, { backgroundColor: '#10b981', opacity: ctaDisabled ? 0.55 : 1 }]}
          >
            {enrolling ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Text style={styles.enrollBtnText}>{ctaLabel}</Text>
                <ArrowRight size={16} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <CustomModal
        visible={dialogState.visible}
        type={dialogState.type}
        title={dialogState.title}
        message={dialogState.message}
        onClose={() => setDialogState((previous) => ({ ...previous, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerBtn: { padding: 6, minWidth: 36, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', flex: 1, textAlign: 'center' },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorText: { fontSize: 16, textAlign: 'center' },
  retryButton: { minHeight: 44, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#10b981' },
  retryButtonText: { color: '#ffffff', fontWeight: '800' },
  scrollContent: { paddingBottom: 100 },
  heroImage: { width: '100%', height: 220 },
  mainContent: { padding: 18, gap: 14 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  categoryBadge: { backgroundColor: '#10b981', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  categoryBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, fontWeight: '700' },
  courseTitle: { fontSize: 22, fontWeight: '900', lineHeight: 28 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 4, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, fontWeight: '600' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  tabBar: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 4, marginVertical: 6 },
  tabItem: { flex: 1, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  tabItemText: { fontSize: 13, fontWeight: '800' },
  tabContent: { gap: 14, marginTop: 6 },
  sectionHeading: { fontSize: 18, fontWeight: '800' },
  bodyText: { fontSize: 15, lineHeight: 24 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  objectiveRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  objectiveText: { flex: 1, fontSize: 14, lineHeight: 20 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tagText: { fontSize: 12, fontWeight: '700' },
  factsGrid: { flexDirection: 'row', flexWrap: 'wrap', borderRadius: 16, borderWidth: 1, padding: 12, rowGap: 12 },
  fact: { width: '50%', paddingHorizontal: 4, gap: 2 },
  factLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  factValue: { fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
  moduleCard: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 10 },
  moduleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  moduleTitle: { fontSize: 15, fontWeight: '800' },
  moduleLessonsCount: { fontSize: 12, marginTop: 2 },
  lessonsList: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  lessonItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  lessonTitle: { fontSize: 14, fontWeight: '600' },
  lessonDuration: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  instructorCard: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 18, borderWidth: 1, gap: 14 },
  instructorName: { fontSize: 17, fontWeight: '800' },
  instructorRole: { fontSize: 13, marginTop: 2, fontWeight: '700' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1 },
  priceLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  priceValue: { fontSize: 17, fontWeight: '900' },
  enrollBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14 },
  enrollBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
