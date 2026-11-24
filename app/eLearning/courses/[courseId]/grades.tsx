import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Award, BarChart2, BookOpen, CheckCircle2, Circle } from 'lucide-react-native';
import { CourseGradesSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { ELearningEmptyState, ELearningHeader, ELEARNING_GUTTER, ProgressBar, StatusPill, roundProgress } from '@/components/eLearning/ELearningParts';
import { lessonTypeLabel } from '@/components/eLearning/course/workspaceHelpers';
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
    if (!id || !activeUserId) { setIsLoading(false); return; }
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
  const statusWord = enrollment?.status === 'completed' ? 'Completed' : 'In progress';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ELearningHeader title="Progress and grades" subtitle={course?.title} onBack={() => router.back()} />
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.scroll}><CourseGradesSkeleton /></ScrollView>
      ) : !enrollment ? (
        <View style={styles.centerFill}>
          {error ? (
            <ELearningEmptyState icon={<BarChart2 size={40} color={colors.mutedText} />} title="Your progress could not load" hint={error} actionLabel="Try again" onAction={() => { setIsLoading(true); void load(); }} />
          ) : (
            <ELearningEmptyState icon={<BarChart2 size={40} color={colors.mutedText} />} title="Not enrolled" hint="Enroll in this course to track your progress and grades." actionLabel="Back to course" onAction={() => router.back()} />
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); void load(); }} tintColor={colors.accent} />}
        >
          <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

            <View style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <View style={styles.flex}>
                  <Text style={styles.statLabel}>Completion</Text>
                  <Text style={styles.statValue}>{roundProgress(completion)}%</Text>
                </View>
                <StatusPill label={statusWord} tone={enrollment.status === 'completed' ? 'success' : 'neutral'} />
              </View>
              <ProgressBar value={completion} height={8} accessibilityLabel="Course completion" />
              <Text style={styles.statHint}>{lessons.length ? `${completedCount} of ${lessons.length} lessons done` : 'Lessons not available yet'}{enrolledOn ? ` · enrolled ${enrolledOn.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</Text>
            </View>
            <View style={styles.statRow}>
              <Award size={20} color={colors.accentText} />
              <View style={styles.flex}>
                <Text style={styles.statRowLabel}>Average score</Text>
                <Text style={styles.statHint}>{averageScore === null ? 'Shows once a quiz or assignment is scored' : `Across ${scoredValues.length} scored ${scoredValues.length === 1 ? 'item' : 'items'}`}</Text>
              </View>
              <Text style={styles.statRowValue}>{averageScore === null ? '—' : `${averageScore}%`}</Text>
            </View>

            <View style={styles.breakdown}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Learning path</Text>
              {curriculum.length === 0 ? <Text style={styles.muted}>No lessons are available to you in this course yet.</Text> : null}
              {curriculum.map((module) => {
                const moduleLessons = module.lessons ?? [];
                const moduleDone = moduleLessons.filter((lesson) => completed.has(lesson.id)).length;
                return (
                  <View key={module.id} style={styles.module}>
                    <View style={styles.moduleHeader}>
                      <BookOpen size={16} color={colors.mutedText} />
                      <Text style={styles.moduleTitle} numberOfLines={2}>{module.title}</Text>
                      <Text style={styles.moduleCount}>{moduleDone} of {moduleLessons.length}</Text>
                    </View>
                    {moduleLessons.map((lesson) => {
                      const isDone = completed.has(lesson.id);
                      const score = scores.get(lesson.id);
                      const result = score !== undefined ? `Scored ${score}%` : isDone ? 'Completed' : 'Not started';
                      return (
                        <View key={lesson.id} accessible accessibilityLabel={`${lesson.title}, ${lessonTypeLabel(lesson.type)}, ${result}`} style={styles.lessonRow}>
                          {isDone ? <CheckCircle2 size={20} color={colors.successText} /> : <Circle size={20} color={colors.mutedText} />}
                          <View style={styles.flex}>
                            <Text style={styles.lessonTitle} numberOfLines={2}>{lesson.title}</Text>
                            <Text style={styles.muted}>{lessonTypeLabel(lesson.type)}</Text>
                          </View>
                          <Text style={[styles.lessonResult, (isDone || score !== undefined) && styles.lessonResultDone]}>{result}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
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
  column: { padding: ELEARNING_GUTTER, gap: 16 },
  centerFill: { flex: 1, justifyContent: 'center' },
  error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 12, overflow: 'hidden', padding: 12 },
  summaryCard: { padding: 16, gap: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  statLabel: { color: colors.mutedText, fontSize: 13, fontWeight: '600' },
  statValue: { color: colors.text, fontSize: 30, fontWeight: '800' },
  statHint: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  statRow: { minHeight: 64, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  statRowLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  statRowValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  breakdown: { gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  module: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  moduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.control },
  moduleTitle: { flex: 1, minWidth: 0, color: colors.text, fontSize: 14, fontWeight: '700' },
  moduleCount: { color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  lessonRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  flex: { flex: 1, minWidth: 0 },
  lessonTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  lessonResult: { maxWidth: 110, color: colors.mutedText, fontSize: 13, fontWeight: '600', textAlign: 'right' },
  lessonResultDone: { color: colors.successText },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
});
