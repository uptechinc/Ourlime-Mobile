import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { BookOpen, ClipboardCheck, Clock, GraduationCap, ShieldCheck, Star, Trash2, Users } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import CustomModal from '@/components/ui/CustomModal';
import { CourseDetailSkeleton } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { instructorService, type InstructorCourse, type InstructorCourseStatus, type InstructorStatus } from '@/lib/services/InstructorService';

const CONTENT_MAX_WIDTH = 900;
const STATUS_LABEL: Record<InstructorCourseStatus, string> = { draft: 'Draft', published: 'Published', archived: 'Archived' };

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

  useEffect(() => { void load(); }, [load]);

  const handleSetStatus = async (course: InstructorCourse, next: InstructorCourseStatus) => {
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

  const totalStudents = courses.reduce((sum, course) => sum + course.totalStudents, 0);
  const publishedCount = courses.filter((course) => course.status === 'published').length;
  const isWide = width >= 640;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="Instructor" onBackPress={() => router.back()} />
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.padded}><CourseDetailSkeleton /></ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); void load(); }} tintColor={colors.accent} />}>
          <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

            {status === 'none' ? (
              <View style={styles.hero}>
                <GraduationCap size={34} color={colors.accent} />
                <Text style={styles.heroTitle}>Teach on Ourlime</Text>
                <Text style={styles.heroText}>Share what you know with learners across Trinidad and Tobago. Apply once; an administrator verifies your profile before your courses go live.</Text>
                <Pressable accessibilityRole="button" onPress={() => router.push('/eLearning/instructor/register' as Href)} style={styles.primaryButton}>
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
                <View style={[styles.stats, isWide && styles.statsWide]}>
                  <View style={styles.statCard}><BookOpen size={18} color={colors.accent} /><Text style={styles.statValue}>{courses.length}</Text><Text style={styles.muted}>Courses</Text></View>
                  <View style={styles.statCard}><ShieldCheck size={18} color={colors.accent} /><Text style={styles.statValue}>{publishedCount}</Text><Text style={styles.muted}>Published</Text></View>
                  <View style={styles.statCard}><Users size={18} color={colors.accent} /><Text style={styles.statValue}>{totalStudents}</Text><Text style={styles.muted}>Learners</Text></View>
                </View>

                <Text style={styles.sectionTitle}>My courses</Text>
                <Text style={styles.muted}>Create new courses on ourlime.com; manage and grade them here.</Text>
                {courses.length === 0 ? <Text style={styles.empty}>You have no courses yet.</Text> : null}
                {courses.map((course) => (
                  <View key={course.id} style={styles.courseCard}>
                    <View style={styles.courseTop}>
                      {course.image ? <Image source={{ uri: course.image }} contentFit="cover" style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbFallback]}><BookOpen size={22} color={colors.mutedText} /></View>}
                      <View style={styles.flex}>
                        <Text style={styles.courseTitle} numberOfLines={2}>{course.title}</Text>
                        <View style={styles.metaRow}>
                          <Text style={[styles.badge, course.status === 'published' ? styles.badgeLive : styles.badgeDraft]}>{STATUS_LABEL[course.status]}</Text>
                          <Users size={13} color={colors.mutedText} /><Text style={styles.muted}>{course.totalStudents}</Text>
                          <Star size={13} color="#f59e0b" /><Text style={styles.muted}>{course.rating.toFixed(1)} ({course.totalRatings})</Text>
                        </View>
                      </View>
                    </View>
                    <View style={styles.actions}>
                      <Pressable accessibilityRole="button" onPress={() => router.push(`/eLearning/instructor/grading/${encodeURIComponent(course.id)}?title=${encodeURIComponent(course.title)}` as Href)} style={styles.actionButton}>
                        <ClipboardCheck size={16} color={colors.text} /><Text style={styles.actionText}>Grade</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={workingCourseId === course.id}
                        onPress={() => void handleSetStatus(course, course.status === 'published' ? 'draft' : 'published')}
                        style={[styles.actionButton, workingCourseId === course.id && styles.disabled]}
                      >
                        <Text style={styles.actionText}>{workingCourseId === course.id ? 'Saving…' : course.status === 'published' ? 'Unpublish' : 'Publish'}</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${course.title}`} onPress={() => setCourseToDelete(course)} style={[styles.actionButton, styles.deleteButton]}>
                        <Trash2 size={16} color={colors.destructiveText} />
                      </Pressable>
                    </View>
                  </View>
                ))}
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
  padded: { padding: 16 },
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
  stats: { gap: 10 },
  statsWide: { flexDirection: 'row' },
  statCard: { flex: 1, padding: 14, gap: 2, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  statValue: { marginTop: 4, color: colors.text, fontSize: 24, fontWeight: '900' },
  sectionTitle: { marginTop: 6, color: colors.text, fontSize: 18, fontWeight: '900' },
  muted: { color: colors.mutedText, fontSize: 12 },
  empty: { color: colors.mutedText, fontSize: 14, paddingVertical: 12 },
  courseCard: { padding: 12, gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  courseTop: { flexDirection: 'row', gap: 12 },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  courseTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  metaRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  badge: { marginRight: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden', fontSize: 11, fontWeight: '800' },
  badgeLive: { color: colors.successText, backgroundColor: colors.successSurface },
  badgeDraft: { color: colors.mutedText, backgroundColor: colors.control },
  actions: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  deleteButton: { flex: 0, width: 46, borderColor: colors.destructiveSurface },
  primaryButton: { minHeight: 48, marginTop: 6, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent },
  primaryButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
});
