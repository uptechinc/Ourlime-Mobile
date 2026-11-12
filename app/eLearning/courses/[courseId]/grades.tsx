import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Award, BookOpen, CheckCircle2, Circle, TrendingUp } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import { CourseGradesSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { courseService, isActiveEnrollment } from '@/lib/services/CourseService';
import type { Course, CourseModule, Enrollment } from '@/lib/types/course';

const CONTENT_MAX_WIDTH = 760;

type EnrollmentDate = Enrollment['enrolledAt'] | undefined;

const toDate = (value: EnrollmentDate): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return Number.isNaN(Date.parse(value)) ? null : new Date(value);
  if (typeof value.toDate === 'function') return value.toDate();
  return typeof value.seconds === 'number' ? new Date(value.seconds * 1000) : null;
};

/** "My progress & grades" for one course, the app's version of the website's /eLearning/courses/[id]/grades. */
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
  const [scores, setScores] = useState<Map<string, number>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !activeUserId) return;
    setError(null);
    try {
      const [courseData, enrollmentData] = await Promise.all([courseService.getCourse(id), courseService.getEnrollmentStatus(activeUserId, id)]);
      setCourse(courseData);
      // Dropped or suspended enrollments do not open the course (only active/completed ones, like the rules).
      setEnrollment(isActiveEnrollment(enrollmentData) ? enrollmentData : null);
      if (!isActiveEnrollment(enrollmentData)) return;
      const [modules, lessonScores] = await Promise.all([
        courseService.getCourseCurriculum(id, 'enrolled'),
        courseService.getLessonScores(activeUserId, id).catch((scoreError: unknown) => {
          console.error('[CourseGradesScreen.load] Scores error:', scoreError instanceof Error ? scoreError.message : 'Unknown error');
          return new Map<string, number>();
        }),
      ]);
      setCurriculum(modules);
      setScores(lessonScores);
    } catch (loadError: unknown) {
      console.error('[CourseGradesScreen.load] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      setError('Your progress could not be loaded. Pull down to try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeUserId, id]);

  useEffect(() => { void load(); }, [load]);

  const lessons = curriculum.flatMap((module) => module.lessons ?? []);
  const enrolledOn = toDate(enrollment?.enrolledAt);
  const completed = new Set(enrollment?.completedLessons ?? []);
  const completedCount = lessons.filter((lesson) => completed.has(lesson.id)).length;
  // The enrollment's own progress is authoritative when lessons are hidden (preview fallback); otherwise count them.
  const completion = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : enrollment?.progress ?? 0;
  const scoredValues = [...scores.values()];
  const averageScore = scoredValues.length ? Math.round(scoredValues.reduce((sum, score) => sum + score, 0) / scoredValues.length) : null;
  const isWide = width >= 600;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="Progress & grades" onBackPress={() => router.back()} />
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.scroll}><CourseGradesSkeleton /></ScrollView>
      ) : !enrollment ? (
        <View style={styles.center}>
          <Text style={styles.centerText}>{error ?? 'Enroll in this course to track your progress and grades.'}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); void load(); }} tintColor={colors.accent} />}
        >
          <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
            <Text style={styles.title} numberOfLines={2}>{course?.title ?? 'Course'}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={[styles.stats, isWide && styles.statsWide]}>
              <View style={[styles.statCard, isWide && styles.statCardWide]}>
                <TrendingUp size={20} color="#16a34a" />
                <Text style={styles.statLabel}>Completion</Text>
                <Text style={styles.statValue}>{completion}%</Text>
                <Text style={styles.statHint}>{lessons.length ? `${completedCount} of ${lessons.length} lessons` : 'Lessons not available yet'}</Text>
              </View>
              <View style={[styles.statCard, isWide && styles.statCardWide]}>
                <Award size={20} color="#2563eb" />
                <Text style={styles.statLabel}>Average score</Text>
                <Text style={styles.statValue}>{averageScore === null ? '—' : `${averageScore}%`}</Text>
                <Text style={styles.statHint}>Based on quizzes and assignments</Text>
              </View>
              <View style={[styles.statCard, isWide && styles.statCardWide]}>
                <CheckCircle2 size={20} color="#7c3aed" />
                <Text style={styles.statLabel}>Status</Text>
                <Text style={[styles.statValue, styles.capitalize]}>{enrollment.status}</Text>
                <Text style={styles.statHint}>{enrolledOn ? `Enrolled ${enrolledOn.toLocaleDateString()}` : 'Enrolled'}</Text>
              </View>
            </View>

            <View style={styles.breakdown}>
              <Text style={styles.sectionTitle}>Learning path</Text>
              {curriculum.length === 0 ? <Text style={styles.muted}>No lessons are available to you in this course yet.</Text> : null}
              {curriculum.map((module) => (
                <View key={module.id} style={styles.module}>
                  <View style={styles.moduleHeader}>
                    <BookOpen size={14} color={colors.mutedText} />
                    <Text style={styles.moduleTitle} numberOfLines={2}>{module.title}</Text>
                    <Text style={styles.moduleCount}>{(module.lessons ?? []).filter((lesson) => completed.has(lesson.id)).length}/{(module.lessons ?? []).length}</Text>
                  </View>
                  {(module.lessons ?? []).map((lesson) => {
                    const isDone = completed.has(lesson.id);
                    const score = scores.get(lesson.id);
                    return (
                      <View key={lesson.id} style={styles.lessonRow}>
                        {isDone ? <CheckCircle2 size={18} color="#16a34a" /> : <Circle size={18} color={colors.border} />}
                        <View style={styles.flex}>
                          <Text style={styles.lessonTitle} numberOfLines={2}>{lesson.title}</Text>
                          <Text style={styles.muted}>{lesson.type.charAt(0).toUpperCase() + lesson.type.slice(1)}</Text>
                        </View>
                        <Text style={[styles.lessonResult, isDone && styles.lessonResultDone]}>
                          {score !== undefined ? `${score}%` : isDone ? 'Done' : 'Not started'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  centerText: { color: colors.text, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 10, padding: 10 },
  stats: { gap: 10 },
  statsWide: { flexDirection: 'row' },
  statCard: { padding: 16, gap: 4, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  statCardWide: { flex: 1 },
  statLabel: { marginTop: 6, color: colors.mutedText, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  statValue: { color: colors.text, fontSize: 28, fontWeight: '900' },
  capitalize: { textTransform: 'capitalize' },
  statHint: { color: colors.mutedText, fontSize: 12 },
  breakdown: { gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  module: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  moduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.control },
  moduleTitle: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '800' },
  moduleCount: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
  flex: { flex: 1 },
  lessonTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  lessonResult: { color: colors.mutedText, fontSize: 13, fontWeight: '700' },
  lessonResultDone: { color: '#16a34a' },
  muted: { color: colors.mutedText, fontSize: 12 },
});
