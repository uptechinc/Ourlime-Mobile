import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { AlertCircle, BookOpen, ClipboardCheck, ClipboardList, Clock, Eye, EyeOff, GraduationCap, HelpCircle, Plus, ShieldCheck, Trash2 } from 'lucide-react-native';
import CustomModal from '@/components/ui/CustomModal';
import { InstructorDashboardSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { CourseRating, ELearningButton, ELearningEmptyState, ELearningHeader, ELearningHeaderButton, ELEARNING_ACTION_GREEN, ELEARNING_GUTTER, StatusPill, type ELearningTone } from '@/components/eLearning/ELearningParts';
import { pluralize } from '@/components/eLearning/course/workspaceHelpers';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { instructorService, type InstructorCourse, type InstructorCourseStatus, type InstructorSettableStatus, type InstructorStatus } from '@/lib/services/InstructorService';

const CONTENT_MAX_WIDTH = 900;
const THUMB_SIZE = 72;
const RIPPLE = { color: 'rgba(15,23,42,0.12)' };
const STATUS_LABEL: Record<InstructorCourseStatus, string> = { draft: 'Draft', pending_review: 'In review', published: 'Published', archived: 'Archived' };
const STATUS_TONE: Record<InstructorCourseStatus, ELearningTone> = { draft: 'neutral', pending_review: 'warning', published: 'success', archived: 'neutral' };
const courseQuery = (course: InstructorCourse): string => `${encodeURIComponent(course.id)}?title=${encodeURIComponent(course.title)}`;

/** "2 quizzes · 1 assignment", or nothing while the lessons can't be read (draft and in-review courses). */
const workLine = (course: InstructorCourse): string | null =>
  course.quizCount === null && course.assignmentCount === null ? null
    : [pluralize(course.quizCount ?? 0, 'quiz', 'quizzes'), pluralize(course.assignmentCount ?? 0, 'assignment', 'assignments')].join(' · ');

/** Instructor dashboard: application status, the instructor's own courses (publish, unpublish, delete) and grading. */
export default function InstructorDashboardScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { activeUserId } = useAppData();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [status, setStatus] = useState<InstructorStatus | null>(null);
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [workingCourseId, setWorkingCourseId] = useState<string | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<InstructorCourse | null>(null);

  const load = useCallback(async () => {
    if (!activeUserId) { setIsLoading(false); setStatus('none'); return; }
    setLoadError(null);
    try {
      const [instructorStatus, myCourses] = await Promise.all([instructorService.getStatus(activeUserId), instructorService.getMyCourses(activeUserId)]);
      setStatus(instructorStatus);
      setCourses(myCourses);
    } catch (loadFailure: unknown) {
      console.error('[InstructorDashboardScreen.load] Error:', loadFailure instanceof Error ? loadFailure.message : 'Unknown error');
      setLoadError('Your instructor dashboard could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeUserId]);

  // Reload on focus so counts and statuses are current after creating a course, quiz or assignment.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleSetStatus = async (course: InstructorCourse, next: InstructorSettableStatus) => {
    setWorkingCourseId(course.id);
    setActionError(null);
    try {
      await instructorService.setCourseStatus(course.id, next);
      setCourses((current) => current.map((item) => (item.id === course.id ? { ...item, status: next } : item)));
    } catch (statusError: unknown) {
      const message = statusError instanceof Error ? statusError.message : '';
      console.error('[InstructorDashboardScreen.handleSetStatus] Error:', message || 'Unknown error');
      setActionError(message.includes('verify') ? 'An administrator must verify your instructor profile before you publish.' : `"${course.title}" could not be updated. Please try again.`);
    } finally {
      setWorkingCourseId(null);
    }
  };

  const handleDelete = async () => {
    if (!courseToDelete) return;
    setWorkingCourseId(courseToDelete.id);
    try {
      await instructorService.deleteCourse(courseToDelete.id);
      setCourses((current) => current.filter((item) => item.id !== courseToDelete.id));
      setCourseToDelete(null);
    } catch (deleteError: unknown) {
      console.error('[InstructorDashboardScreen.handleDelete] Error:', deleteError instanceof Error ? deleteError.message : 'Unknown error');
      setCourseToDelete(null);
      setActionError('The course could not be deleted. Please try again.');
    } finally {
      setWorkingCourseId(null);
    }
  };

  const totalStudents = courses.reduce((sum, course) => sum + course.enrolledStudents, 0);
  const publishedCount = courses.filter((course) => course.status === 'published').length;
  const isInstructor = status === 'pending' || status === 'verified';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ELearningHeader
        title="Instructor"
        onBack={() => router.back()}
        right={isInstructor && courses.length > 0 ? (
          <ELearningHeaderButton accessibilityLabel="Grading: all courses" onPress={() => router.push('/eLearning/instructor/grading' as Href)}>
            <ClipboardCheck size={22} color={colors.icon} />
          </ELearningHeaderButton>
        ) : undefined}
      />
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.scroll}><InstructorDashboardSkeleton /></ScrollView>
      ) : loadError && courses.length === 0 ? (
        <View style={styles.centerFill}>
          <ELearningEmptyState icon={<GraduationCap size={40} color={colors.mutedText} />} title="Dashboard could not load" hint={loadError} actionLabel="Try again" onAction={() => { setIsLoading(true); void load(); }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); void load(); }} tintColor={colors.accent} />}>
          <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
            {actionError || loadError ? (
              <View accessibilityRole="alert" style={styles.errorBanner}>
                <AlertCircle size={16} color={colors.destructiveText} />
                <Text style={[styles.errorText, styles.flexText]}>{actionError ?? loadError}</Text>
              </View>
            ) : null}

            {status === 'none' ? (
              <View style={styles.hero}>
                <View style={styles.heroIcon}><GraduationCap size={28} color={colors.accentText} /></View>
                <Text accessibilityRole="header" style={styles.heroTitle}>Teach on Ourlime</Text>
                <Text style={styles.heroText}>Share what you know with learners across Trinidad and Tobago. Apply once; an administrator verifies your profile before your courses go live.</Text>
                <ELearningButton label="Become an instructor" onPress={() => router.push('/eLearning/instructor/register' as Href)} style={styles.stretch} />
              </View>
            ) : (
              <View style={[styles.statusCard, status === 'verified' ? styles.statusVerified : styles.statusPending]}>
                {status === 'verified' ? <ShieldCheck size={22} color={colors.successText} /> : <Clock size={22} color={colors.warningText} />}
                <View style={styles.flexText}>
                  <Text style={[styles.statusTitle, { color: status === 'verified' ? colors.successText : colors.warningText }]}>{status === 'verified' ? 'Verified instructor' : 'Application under review'}</Text>
                  <Text style={[styles.statusText, { color: status === 'verified' ? colors.successText : colors.warningText }]}>{status === 'verified' ? 'You can publish courses and grade your learners.' : 'An administrator is reviewing your profile. Publishing opens once you are verified.'}</Text>
                </View>
              </View>
            )}

            {isInstructor || courses.length > 0 ? (
              <>
                <View style={styles.stats}>
                  <View accessible accessibilityLabel={`${courses.length} courses`} style={styles.statCard}><Text numberOfLines={1} style={styles.statValue}>{courses.length}</Text><Text numberOfLines={1} style={styles.statLabel}>Courses</Text></View>
                  <View accessible accessibilityLabel={`${publishedCount} published`} style={styles.statCard}><Text numberOfLines={1} style={styles.statValue}>{publishedCount}</Text><Text numberOfLines={1} style={styles.statLabel}>Published</Text></View>
                  <View accessible accessibilityLabel={`${totalStudents} learners`} style={styles.statCard}><Text numberOfLines={1} style={styles.statValue}>{totalStudents}</Text><Text numberOfLines={1} style={styles.statLabel}>Learners</Text></View>
                </View>

                <View style={styles.coursesHeader}>
                  <Text accessibilityRole="header" style={[styles.sectionTitle, styles.flexText]}>My courses</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Create a new course" onPress={() => router.push('/eLearning/instructor/create' as Href)} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.createButton}>
                    <Plus size={18} color="#ffffff" /><Text numberOfLines={1} style={styles.createText}>New course</Text>
                  </Pressable>
                </View>
                {courses.length === 0 ? (
                  <ELearningEmptyState
                    icon={<BookOpen size={36} color={colors.mutedText} />}
                    title="No courses yet"
                    hint="Create your first course, add modules and lessons, then publish it when it is ready."
                    actionLabel="Create a course"
                    onAction={() => router.push('/eLearning/instructor/create' as Href)}
                  />
                ) : null}
                {courses.map((course) => {
                  const isWorking = workingCourseId === course.id;
                  const work = workLine(course);
                  const isPublished = course.status === 'published';
                  return (
                    <View key={course.id} style={styles.courseCard}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${course.title}, ${STATUS_LABEL[course.status]}`} onPress={() => router.push(`/eLearning/instructor/course/${courseQuery(course)}` as Href)} android_ripple={RIPPLE} style={styles.courseTop}>
                        <View style={styles.thumb}>
                          {course.image ? <Image source={{ uri: course.image }} contentFit="cover" style={{ width: THUMB_SIZE, height: THUMB_SIZE }} /> : <BookOpen size={22} color={colors.mutedText} />}
                        </View>
                        <View style={styles.courseCopy}>
                          <StatusPill label={STATUS_LABEL[course.status]} tone={STATUS_TONE[course.status]} />
                          <Text style={styles.courseTitle} numberOfLines={2}>{course.title}</Text>
                          <View style={styles.metaRow}>
                            <Text style={styles.muted} numberOfLines={1}>{pluralize(course.enrolledStudents, 'learner', 'learners')}</Text>
                            <CourseRating rating={course.rating} count={course.totalRatings} />
                          </View>
                          {work ? <Text style={styles.muted} numberOfLines={1}>{work}</Text> : null}
                        </View>
                      </Pressable>
                      <View style={styles.tiles}>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Add a quiz to ${course.title}`} onPress={() => router.push(`/eLearning/instructor/quiz/${courseQuery(course)}` as Href)} android_ripple={RIPPLE} style={styles.tile}>
                          <HelpCircle size={18} color={colors.icon} /><Text numberOfLines={2} style={styles.tileText}>Add quiz</Text>
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Add an assignment to ${course.title}`} onPress={() => router.push(`/eLearning/instructor/assignment/${courseQuery(course)}` as Href)} android_ripple={RIPPLE} style={styles.tile}>
                          <ClipboardList size={18} color={colors.icon} /><Text numberOfLines={2} style={styles.tileText}>Add assignment</Text>
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Grade work in ${course.title}`} onPress={() => router.push(`/eLearning/instructor/grading/${courseQuery(course)}` as Href)} android_ripple={RIPPLE} style={styles.tile}>
                          <ClipboardCheck size={18} color={colors.icon} /><Text numberOfLines={2} style={styles.tileText}>Grade work</Text>
                        </Pressable>
                      </View>
                      <View style={styles.actions}>
                        {course.status === 'pending_review' ? (
                          <View style={[styles.pendingNote, styles.flexText]}>
                            <Clock size={16} color={colors.warningText} /><Text numberOfLines={2} style={styles.pendingText}>Waiting for an administrator to approve it</Text>
                          </View>
                        ) : (
                          <ELearningButton
                            label={isPublished ? 'Unpublish' : 'Publish'}
                            accessibilityLabel={`${isPublished ? 'Unpublish' : 'Publish'} ${course.title}`}
                            variant={isPublished ? 'secondary' : 'primary'}
                            icon={isPublished ? <EyeOff size={18} color={colors.text} /> : <Eye size={18} color="#ffffff" />}
                            busyLabel="Saving…"
                            isBusy={isWorking}
                            onPress={() => void handleSetStatus(course, isPublished ? 'draft' : 'published')}
                            style={styles.flexText}
                          />
                        )}
                        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${course.title}`} disabled={isWorking} onPress={() => setCourseToDelete(course)} android_ripple={{ color: colors.destructiveSurface }} style={styles.deleteButton}>
                          <Trash2 size={18} color={colors.destructiveText} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : null}
          </View>
        </ScrollView>
      )}
      <CustomModal
        visible={Boolean(courseToDelete)}
        type="warning"
        title="Delete this course?"
        message={`"${courseToDelete?.title ?? ''}" and all of its modules, lessons and resources will be permanently removed. This cannot be undone.`}
        confirmText="Delete course"
        cancelText="Cancel"
        isLoading={Boolean(courseToDelete && workingCourseId === courseToDelete.id)}
        onConfirm={() => void handleDelete()}
        onCancel={() => setCourseToDelete(null)}
        onClose={() => setCourseToDelete(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flexText: { flex: 1, minWidth: 0 },
  stretch: { alignSelf: 'stretch', marginTop: 4 },
  centerFill: { flex: 1, justifyContent: 'center' },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: ELEARNING_GUTTER, gap: 16 },
  errorBanner: { padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 12, backgroundColor: colors.destructiveSurface },
  errorText: { color: colors.destructiveText, fontSize: 13, lineHeight: 18 },
  hero: { padding: 20, gap: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'flex-start' },
  heroIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface },
  heroTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  heroText: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  statusCard: { padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16 },
  statusVerified: { backgroundColor: colors.successSurface },
  statusPending: { backgroundColor: colors.warningSurface },
  statusTitle: { fontSize: 15, fontWeight: '800' },
  statusText: { marginTop: 2, fontSize: 13, lineHeight: 19 },
  stats: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 12, gap: 2, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.mutedText, fontSize: 12 },
  coursesHeader: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 10 },
  createButton: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, backgroundColor: ELEARNING_ACTION_GREEN, overflow: 'hidden' },
  createText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  muted: { flexShrink: 1, color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  courseCard: { padding: 12, gap: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  courseTop: { flexDirection: 'row', gap: 12, borderRadius: 12, overflow: 'hidden' },
  courseCopy: { flex: 1, minWidth: 0, gap: 4 },
  thumb: { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  courseTitle: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minWidth: 0, minHeight: 64, paddingHorizontal: 4, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, backgroundColor: colors.control, overflow: 'hidden' },
  tileText: { color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  pendingNote: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, backgroundColor: colors.warningSurface },
  pendingText: { flex: 1, color: colors.warningText, fontSize: 13, fontWeight: '700' },
  deleteButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
});
