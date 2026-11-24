import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { BookOpen, ChevronRight, ClipboardCheck, GraduationCap } from 'lucide-react-native';
import { InstructorDashboardSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { ELearningEmptyState, ELearningHeader, ELEARNING_GUTTER, StatusPill } from '@/components/eLearning/ELearningParts';
import { pluralize } from '@/components/eLearning/course/workspaceHelpers';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { instructorService, type InstructorCourse, type InstructorStatus } from '@/lib/services/InstructorService';
import { courseStagePresentation } from '@/components/eLearning/instructor/courseStatus';

const CONTENT_MAX_WIDTH = 820;
const THUMB_WIDTH = 72;
const THUMB_HEIGHT = 48;

/** "Quizzes and assignments" counts when the course's lessons can be read; nothing invented when they can't. */
const workLine = (course: InstructorCourse): string => {
  if (course.quizCount === null && course.assignmentCount === null) return 'Quizzes and assignments show once the course is published';
  return [pluralize(course.quizCount ?? 0, 'quiz', 'quizzes'), pluralize(course.assignmentCount ?? 0, 'assignment', 'assignments')].join(' · ');
};

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
  const [waitingCounts, setWaitingCounts] = useState<Map<string, number>>(new Map());

  const load = useCallback(async () => {
    if (!activeUserId) { setIsLoading(false); setStatus('none'); return; }
    setError(null);
    try {
      const [instructorStatus, myCourses] = await Promise.all([instructorService.getStatus(activeUserId), instructorService.getMyCourses(activeUserId)]);
      setStatus(instructorStatus);
      setCourses(myCourses);
      // Counts are a guide for where to start; the list works without them.
      setWaitingCounts(await instructorService.getWaitingCounts(myCourses));
    } catch (loadError: unknown) {
      console.error('[InstructorGradingCoursesScreen.load] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      setError('Your courses could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeUserId]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const totalWaiting = waitingCounts.size > 0 ? [...waitingCounts.values()].reduce((sum, count) => sum + count, 0) : null;
  const orderedCourses = [...courses].sort((left, right) => (waitingCounts.get(right.id) ?? 0) - (waitingCounts.get(left.id) ?? 0));

  const openCourse = (course: InstructorCourse) => router.push(`/eLearning/instructor/grading/${encodeURIComponent(course.id)}?title=${encodeURIComponent(course.title)}` as Href);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ELearningHeader title="Grading" subtitle="Choose a course" onBack={() => router.back()} />
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.scroll}><InstructorDashboardSkeleton /></ScrollView>
      ) : status === 'none' ? (
        <View style={styles.centerFill}>
          <ELearningEmptyState
            icon={<GraduationCap size={44} color={colors.accentText} />}
            title="Instructor access required"
            hint="Register as an instructor to create courses and grade your learners' work."
            actionLabel="Become an instructor"
            onAction={() => router.replace('/eLearning/instructor/register' as Href)}
          />
        </View>
      ) : error && courses.length === 0 ? (
        <View style={styles.centerFill}>
          <ELearningEmptyState icon={<ClipboardCheck size={40} color={colors.mutedText} />} title="Your courses could not load" hint={error} actionLabel="Try again" onAction={() => { setIsLoading(true); void load(); }} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); void load(); }} tintColor={colors.accent} />}>
          <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
            {courses.length === 0 ? (
              <ELearningEmptyState
                icon={<BookOpen size={40} color={colors.mutedText} />}
                title="No courses yet"
                hint="Create a course and add quizzes or assignments; student work to grade shows up here."
                actionLabel="Create a course"
                onAction={() => router.push('/eLearning/instructor/create' as Href)}
              />
            ) : (
              <>
                <Text style={styles.intro}>
                  {totalWaiting === null ? 'Pick a course to see its submissions.' : totalWaiting === 0 ? 'Nothing is waiting for a grade. Courses are listed so you can review graded work.' : `${pluralize(totalWaiting, 'hand-in is', 'hand-ins are')} waiting for a grade. Courses with work to grade come first.`}
                </Text>
                {orderedCourses.map((course) => {
                  const presentation = courseStagePresentation(course, status);
                  const waiting = waitingCounts.get(course.id);
                  const waitingLabel = waiting === undefined ? null : waiting === 0 ? 'All graded' : `${waiting} to grade`;
                  return (
                    <Pressable key={course.id} accessibilityRole="button" accessibilityLabel={[`Grade ${course.title}`, presentation.label, waitingLabel, workLine(course)].filter(Boolean).join(', ')} onPress={() => openCourse(course)} android_ripple={{ color: colors.control }} style={styles.card}>
                      <View style={styles.thumb}>
                        {course.image ? <Image source={{ uri: course.image }} contentFit="cover" style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }} /> : <BookOpen size={20} color={colors.mutedText} />}
                      </View>
                      <View style={styles.flexText}>
                        <Text style={styles.courseTitle} numberOfLines={2}>{course.title}</Text>
                        <Text style={styles.muted} numberOfLines={2}>{workLine(course)}</Text>
                        <View style={styles.pills}>
                          <StatusPill label={presentation.label} tone={presentation.tone} />
                          {waitingLabel ? <StatusPill label={waitingLabel} tone={waiting ? 'warning' : 'success'} /> : null}
                        </View>
                      </View>
                      <ChevronRight size={20} color={colors.mutedText} />
                    </Pressable>
                  );
                })}
              </>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flexText: { flex: 1, minWidth: 0, gap: 4 },
  centerFill: { flex: 1, justifyContent: 'center' },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: ELEARNING_GUTTER, gap: 12 },
  intro: { color: colors.secondaryText, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  card: { minHeight: 72, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  thumb: { width: THUMB_WIDTH, height: THUMB_HEIGHT, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  courseTitle: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
