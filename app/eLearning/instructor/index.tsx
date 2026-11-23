import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { BookOpen, ClipboardCheck, Clock, Eye, EyeOff, GraduationCap, Plus, ShieldCheck, Trash2 } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import CustomModal from '@/components/ui/CustomModal';
import { InstructorDashboardSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { ELEARNING_ACTION_GREEN } from '@/components/eLearning/ELearningParts';
import { pluralize } from '@/components/eLearning/course/workspaceHelpers';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { instructorService, type InstructorCourse, type InstructorCourseStatus, type InstructorSettableStatus, type InstructorStatus } from '@/lib/services/InstructorService';

const CONTENT_MAX_WIDTH = 900;
const STATUS_LABEL: Record<InstructorCourseStatus, string> = { draft: 'Draft', pending_review: 'In review', published: 'Published', archived: 'Archived' };
const courseQuery = (course: InstructorCourse): string => `${encodeURIComponent(course.id)}?title=${encodeURIComponent(course.title)}`;

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
  const [error, setError] = useState<string | null>(null);
  const [workingCourseId, setWorkingCourseId] = useState<string | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<InstructorCourse | null>(null);

  const load = useCallback(async () => {
    if (!activeUserId) return;
    setError(null);
    try {
      const [instructorStatus, myCourses] = await Promise.all([instructorService.getStatus(activeUserId), instructorService.getMyCourses(activeUserId)]);
      setStatus(instructorStatus);
      setCourses(myCourses);
    } catch (loadError: unknown) {
      console.error('[InstructorDashboardScreen.load] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      setError('Your instructor dashboard could not be loaded. Pull down to try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeUserId]);

  // Reload on focus so counts and statuses are current after creating a course, quiz or assignment.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleSetStatus = async (course: InstructorCourse, next: InstructorSettableStatus) => {
    setWorkingCourseId(course.id);
    setError(null);
    try {
      await instructorService.setCourseStatus(course.id, next);
      setCourses((current) => current.map((item) => (item.id === course.id ? { ...item, status: next } : item)));
    } catch (statusError: unknown) {
      const message = statusError instanceof Error ? statusError.message : '';
      setError(message.includes('verify') ? 'An administrator must verify your instructor profile before you publish.' : 'The course could not be updated. Please try again.');
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
      setError('The course could not be deleted. Please try again.');
    } finally {
      setWorkingCourseId(null);
    }
  };

  const totalStudents = courses.reduce((sum, course) => sum + course.enrolledStudents, 0);
  const publishedCount = courses.filter((course) => course.status === 'published').length;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="Instructor" onBackPress={() => router.back()} />
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.scroll}><InstructorDashboardSkeleton /></ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); void load(); }} tintColor={colors.accent} />}>
          <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

            {status === 'none' ? (
              <View style={styles.hero}>
                <GraduationCap size={34} color={colors.accent} />
                <Text style={styles.heroTitle}>Teach on Ourlime</Text>
                <Text style={styles.heroText}>Share what you know with learners across Trinidad and Tobago. Apply once; an administrator verifies your profile before your courses go live.</Text>
                <Pressable accessibilityRole="button" onPress={() => router.push('/eLearning/instructor/register' as Href)} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Become an instructor</Text>
                </Pressable>
              </View>
            ) : (
              <View style={[styles.statusCard, status === 'verified' ? styles.statusVerified : styles.statusPending]}>
                {status === 'verified' ? <ShieldCheck size={22} color={colors.successText} /> : <Clock size={22} color={colors.warningText} />}
                <View style={styles.flex}>
                  <Text style={styles.statusTitle}>{status === 'verified' ? 'Verified instructor' : 'Application under review'}</Text>
                  <Text style={styles.muted}>{status === 'verified' ? 'You can publish courses and grade your learners.' : 'An administrator is reviewing your profile. Publishing opens once you are verified.'}</Text>
                </View>
              </View>
            )}

            {status !== 'none' || courses.length > 0 ? (
              <>
                {/* Three compact stats in one row on every phone (they used to stack into three tall cards below 640dp). */}
                <View style={styles.stats}>
                  <View style={styles.statCard}><Text numberOfLines={1} style={styles.statValue}>{courses.length}</Text><Text numberOfLines={1} style={styles.muted}>Courses</Text></View>
                  <View style={styles.statCard}><Text numberOfLines={1} style={styles.statValue}>{publishedCount}</Text><Text numberOfLines={1} style={styles.muted}>Published</Text></View>
                  <View style={styles.statCard}><Text numberOfLines={1} style={styles.statValue}>{totalStudents}</Text><Text numberOfLines={1} style={styles.muted}>Learners</Text></View>
                </View>

                <View style={styles.coursesHeader}>
                  <Text style={[styles.sectionTitle, styles.flex]}>My courses</Text>
                  <Pressable accessibilityRole="button" onPress={() => router.push('/eLearning/instructor/create' as Href)} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.createButton}>
                    <Plus size={16} color="#ffffff" /><Text numberOfLines={1} style={styles.createText}>New course</Text>
                  </Pressable>
                </View>
                {courses.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <BookOpen size={28} color={colors.mutedText} />
                    <Text style={styles.statusTitle}>No courses yet</Text>
                    <Text style={[styles.muted, styles.centerText]}>Create your first course, add modules and lessons, then publish it when it is ready.</Text>
                  </View>
                ) : null}
                {courses.map((course) => {
                  const isWorking = workingCourseId === course.id;
                  const statusStyle = course.status === 'published' ? styles.badgeLive : course.status === 'pending_review' ? styles.badgePending : styles.badgeDraft;
                  return (
                    <View key={course.id} style={styles.courseCard}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${course.title}, ${STATUS_LABEL[course.status]}`} onPress={() => router.push(`/eLearning/instructor/course/${courseQuery(course)}` as Href)} android_ripple={{ color: colors.control }} style={styles.courseTop}>
                        {course.image ? <Image source={{ uri: course.image }} contentFit="cover" style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbFallback]}><BookOpen size={22} color={colors.mutedText} /></View>}
                        <View style={styles.flex}>
                          <Text style={[styles.badge, statusStyle]}>{STATUS_LABEL[course.status]}</Text>
                          <Text style={styles.courseTitle} numberOfLines={2}>{course.title}</Text>
                          <Text style={styles.muted} numberOfLines={1}>
                            {[pluralize(course.enrolledStudents, 'learner', 'learners'), course.totalRatings > 0 ? `★ ${course.rating.toFixed(1)} (${course.totalRatings})` : null].filter(Boolean).join(' · ')}
                          </Text>
                          <Text style={styles.muted} numberOfLines={1}>{course.quizCount ?? '–'} quizzes · {course.assignmentCount ?? '–'} assignments</Text>
                        </View>
                      </Pressable>
                      <View style={styles.actions}>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Add a quiz to ${course.title}`} onPress={() => router.push(`/eLearning/instructor/quiz/${courseQuery(course)}` as Href)} android_ripple={{ color: colors.control }} style={styles.actionButton}>
                          <Text numberOfLines={1} style={styles.actionText}>+ Quiz</Text>
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Add an assignment to ${course.title}`} onPress={() => router.push(`/eLearning/instructor/assignment/${courseQuery(course)}` as Href)} android_ripple={{ color: colors.control }} style={styles.actionButton}>
                          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.actionText}>+ Assignment</Text>
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Grade ${course.title}`} onPress={() => router.push(`/eLearning/instructor/grading/${courseQuery(course)}` as Href)} android_ripple={{ color: colors.control }} style={styles.actionButton}>
                          <ClipboardCheck size={16} color={colors.text} /><Text numberOfLines={1} style={styles.actionText}>Grade</Text>
                        </Pressable>
                      </View>
                      <View style={styles.actions}>
                        {course.status === 'pending_review' ? (
                          <View style={[styles.actionButton, styles.pendingNote]}>
                            <Clock size={15} color={colors.warningText} /><Text numberOfLines={1} style={styles.pendingText}>Awaiting approval</Text>
                          </View>
                        ) : (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${course.status === 'published' ? 'Unpublish' : 'Publish'} ${course.title}`}
                            accessibilityState={{ busy: isWorking }}
                            disabled={isWorking}
                            onPress={() => void handleSetStatus(course, course.status === 'published' ? 'draft' : 'published')}
                            android_ripple={{ color: colors.control }}
                            style={[styles.actionButton, course.status !== 'published' && styles.publishButton, isWorking && styles.disabled]}
                          >
                            {course.status === 'published' ? <EyeOff size={16} color={colors.text} /> : <Eye size={16} color="#ffffff" />}
                            <Text numberOfLines={1} style={[styles.actionText, course.status !== 'published' && styles.publishText]}>{isWorking ? 'Saving…' : course.status === 'published' ? 'Unpublish' : 'Publish'}</Text>
                          </Pressable>
                        )}
                        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${course.title}`} onPress={() => setCourseToDelete(course)} android_ripple={{ color: colors.destructiveSurface }} style={[styles.actionButton, styles.deleteButton]}>
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
  flex: { flex: 1 },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: 16, gap: 14 },
  error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 10, padding: 10 },
  hero: { padding: 20, gap: 10, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'flex-start' },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
  heroText: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  statusCard: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16 },
  statusVerified: { backgroundColor: colors.successSurface },
  statusPending: { backgroundColor: colors.warningSurface },
  statusTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 12, gap: 2, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  centerText: { textAlign: 'center' },
  emptyCard: { alignItems: 'center', gap: 6, padding: 24, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  coursesHeader: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  createButton: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, backgroundColor: ELEARNING_ACTION_GREEN, overflow: 'hidden' },
  createText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  sectionTitle: { marginTop: 6, color: colors.text, fontSize: 18, fontWeight: '900' },
  muted: { color: colors.mutedText, fontSize: 12 },
  empty: { color: colors.mutedText, fontSize: 14, paddingVertical: 12 },
  courseCard: { padding: 12, gap: 8, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  courseTop: { flexDirection: 'row', gap: 12, paddingBottom: 4 },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  courseTitle: { color: colors.text, fontSize: 15, fontWeight: '800', lineHeight: 20 },
  badge: { alignSelf: 'flex-start', marginBottom: 2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden', fontSize: 12, fontWeight: '800' },
  badgeLive: { color: colors.successText, backgroundColor: colors.successSurface },
  badgeDraft: { color: colors.mutedText, backgroundColor: colors.control },
  badgePending: { color: colors.warningText, backgroundColor: colors.warningSurface },
  pendingNote: { borderColor: colors.warningSurface, backgroundColor: colors.warningSurface },
  pendingText: { color: colors.warningText, fontSize: 12, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1, minWidth: 0, minHeight: 48, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  deleteButton: { flex: 0, width: 48, borderColor: colors.destructiveSurface },
  publishButton: { backgroundColor: ELEARNING_ACTION_GREEN, borderColor: ELEARNING_ACTION_GREEN },
  publishText: { color: '#ffffff' },
  primaryButton: { minHeight: 48, marginTop: 6, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: ELEARNING_ACTION_GREEN, overflow: 'hidden' },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
});
