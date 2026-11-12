import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { BookOpen, ChevronRight, FileText, GraduationCap, HelpCircle } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import { InstructorDashboardSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { instructorService, type InstructorCourse, type InstructorStatus } from '@/lib/services/InstructorService';

const CONTENT_MAX_WIDTH = 820;

/** The website's /eLearning/instructor/grading: pick one of your courses, then grade its quiz and assignment submissions. */
export default function InstructorGradingCoursesScreen() {
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

  const load = useCallback(async () => {
    if (!activeUserId) { setIsLoading(false); setStatus('none'); return; }
    setError(null);
    try {
      const [instructorStatus, myCourses] = await Promise.all([instructorService.getStatus(activeUserId), instructorService.getMyCourses(activeUserId)]);
      setStatus(instructorStatus);
      setCourses(myCourses);
    } catch (loadError: unknown) {
      console.error('[InstructorGradingCoursesScreen.load] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      setError('Your courses could not be loaded. Pull down to try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeUserId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const openCourse = (course: InstructorCourse) => router.push(`/eLearning/instructor/grading/${encodeURIComponent(course.id)}?title=${encodeURIComponent(course.title)}` as Href);

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="Grading" onBackPress={() => router.back()} />
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.scroll}><InstructorDashboardSkeleton /></ScrollView>
      ) : status === 'none' ? (
        <View style={styles.center}>
          <GraduationCap size={44} color={colors.accent} />
          <Text style={styles.centerTitle}>Instructor access required</Text>
          <Text style={styles.centerText}>You need to register as an instructor to access instructor features.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/eLearning/instructor/register' as Href)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Become an instructor</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); void load(); }} tintColor={colors.accent} />}>
          <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
            <Text style={styles.title}>Courses</Text>
            <Text style={styles.muted}>Select a course to view its quizzes, assignments and submissions.</Text>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {!error && courses.length === 0 ? (
              <View style={styles.empty}>
                <BookOpen size={36} color={colors.mutedText} />
                <Text style={styles.emptyTitle}>No courses found</Text>
                <Pressable accessibilityRole="button" onPress={() => router.push('/eLearning/instructor/create' as Href)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Create course</Text></Pressable>
              </View>
            ) : null}
            {courses.map((course) => (
              <Pressable key={course.id} accessibilityRole="button" accessibilityLabel={`Grade ${course.title}`} onPress={() => openCourse(course)} style={styles.card}>
                {course.image ? <Image source={{ uri: course.image }} contentFit="cover" style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbFallback]}><BookOpen size={20} color={colors.mutedText} /></View>}
                <View style={styles.flex}>
                  <Text style={styles.courseTitle} numberOfLines={2}>{course.title}</Text>
                  <View style={styles.metaRow}>
                    <HelpCircle size={13} color="#8b5cf6" /><Text style={styles.muted}>{course.quizCount ?? '–'} quizzes</Text>
                    <FileText size={13} color="#f97316" /><Text style={styles.muted}>{course.assignmentCount ?? '–'} assignments</Text>
                  </View>
                </View>
                <ChevronRight size={18} color={colors.mutedText} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: 16, gap: 10 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  muted: { color: colors.mutedText, fontSize: 12 },
  error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 10, padding: 10 },
  empty: { alignItems: 'center', gap: 8, padding: 28, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  card: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  thumb: { width: 56, height: 56, borderRadius: 10 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  courseTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  metaRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  centerTitle: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  centerText: { color: colors.secondaryText, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  primaryButton: { minHeight: 48, marginTop: 6, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent },
  primaryButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
});
