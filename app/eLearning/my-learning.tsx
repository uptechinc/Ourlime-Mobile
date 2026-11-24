import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { BookOpen, PlayCircle } from 'lucide-react-native';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { MyLearningListSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { ELearningChip, ELearningEmptyState, ELearningHeader, ELEARNING_ACTION_GREEN, ELEARNING_GUTTER, ProgressBar, roundProgress } from '@/components/eLearning/ELearningParts';
import { lessonHref } from '@/components/eLearning/course/workspaceHelpers';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { courseService, isActiveEnrollment } from '@/lib/services/CourseService';
import type { Enrollment, MyLearningSort, MyLearningStatus } from '@/lib/types/course';
import MyCertificatesSection from '@/components/eLearning/course/MyCertificatesSection';

const STATUS_FILTERS: MyLearningStatus[] = ['All', 'In progress', 'Not started', 'Completed'];
const SORTS: { value: MyLearningSort; label: string }[] = [{ value: 'recent', label: 'Recent' }, { value: 'progress', label: 'Progress' }];
const THUMB_WIDTH = 96;
const THUMB_HEIGHT = 54;

/** Completed by enrollment status (like the website), otherwise in progress once any progress is recorded. */
const progressStatus = (enrollment: Enrollment): Exclude<MyLearningStatus, 'All'> =>
  enrollment.status === 'completed' ? 'Completed' : enrollment.progress > 0 ? 'In progress' : 'Not started';

const toTime = (value: Enrollment['lastAccessed']): number => {
  if (!value) return 0;
  if (typeof value === 'string') return Date.parse(value) || 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  return typeof value.seconds === 'number' ? value.seconds * 1000 : 0;
};
const lastActivity = (enrollment: Enrollment): number => toTime(enrollment.lastAccessed) || toTime(enrollment.enrolledAt);

/**
 * My Learning: "Continue where you left off" first (the most recent unfinished course with its next lesson and a
 * Resume button), then the filtered list as compact rows with a progress bar and the percentage as text.
 */
export default function MyLearningScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const { activeUserId, nativeSession, retryNativeSession } = useAppData();

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<MyLearningStatus>('All');
  const [sort, setSort] = useState<MyLearningSort>('recent');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nextLessonTitle, setNextLessonTitle] = useState<{ courseId: string; lessonId: string; title: string } | null>(null);
  const [certificateReloadKey, setCertificateReloadKey] = useState(0);
  const loadGenerationRef = useRef(0);

  const loadEnrollments = useCallback(async () => {
    if (!activeUserId) {
      loadGenerationRef.current += 1;
      setEnrollments([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (nativeSession.status !== 'ready' || nativeSession.uid !== activeUserId) {
      setLoading(true);
      return;
    }
    const loadGeneration = ++loadGenerationRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await courseService.getMyEnrollments(activeUserId);
      if (loadGeneration !== loadGenerationRef.current) return;
      // Dropped or suspended enrollments no longer open the course, so they are not listed here.
      setEnrollments(data.filter((enrollment) => isActiveEnrollment(enrollment)));
    } catch {
      if (loadGeneration !== loadGenerationRef.current) return;
      setLoadError('Your courses could not be loaded. Check your connection and try again.');
    } finally {
      if (loadGeneration === loadGenerationRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [activeUserId, nativeSession.status, nativeSession.uid]);

  useEffect(() => {
    void loadEnrollments();
    return () => {
      loadGenerationRef.current += 1;
    };
  }, [loadEnrollments]);

  // The most recently touched course that is not finished (and still in the catalog).
  const continueEnrollment = useMemo(() => [...enrollments]
    .filter((enrollment) => enrollment.course && progressStatus(enrollment) !== 'Completed')
    .sort((left, right) => lastActivity(right) - lastActivity(left))[0] ?? null, [enrollments]);

  // Only the continue card names its next lesson: one curriculum read, not one per course.
  useEffect(() => {
    if (!continueEnrollment) { setNextLessonTitle(null); return; }
    let isActive = true;
    void courseService.getCourseCurriculum(continueEnrollment.courseId, 'enrolled')
      .then((modules) => {
        const next = courseService.nextLesson(modules, continueEnrollment);
        if (isActive) setNextLessonTitle(next ? { courseId: continueEnrollment.courseId, lessonId: next.lesson.id, title: next.lesson.title } : null);
      })
      .catch((curriculumError: unknown) => {
        console.warn('[MyLearningScreen.nextLesson] Curriculum unavailable:', curriculumError instanceof Error ? curriculumError.message : 'Unknown error');
        if (isActive) setNextLessonTitle(null);
      });
    return () => { isActive = false; };
  }, [continueEnrollment]);

  const inProgressCount = enrollments.filter((enrollment) => progressStatus(enrollment) === 'In progress').length;
  const completedCount = enrollments.filter((enrollment) => progressStatus(enrollment) === 'Completed').length;
  const filtered = status === 'All' ? enrollments : enrollments.filter((enrollment) => progressStatus(enrollment) === status);
  const displayedList = [...filtered].sort((left, right) => sort === 'progress' ? right.progress - left.progress : lastActivity(right) - lastActivity(left));
  const heroImageWidth = width - ELEARNING_GUTTER * 2;
  const heroImageHeight = Math.min(200, Math.round(heroImageWidth * 9 / 16));
  const continueNext = continueEnrollment && nextLessonTitle?.courseId === continueEnrollment.courseId ? nextLessonTitle : null;

  const handleResume = (enrollment: Enrollment, lessonId?: string) => router.push(lessonHref(enrollment.courseId, lessonId));

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <ELearningHeader title="My learning" onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setCertificateReloadKey((key) => key + 1); void loadEnrollments(); }} tintColor={colors.accent} />}
      >
        {loading ? (
          <MyLearningListSkeleton />
        ) : loadError ? (
          <ELearningEmptyState
            icon={<BookOpen size={40} color={colors.mutedText} />}
            title="My learning could not load"
            hint={loadError}
            actionLabel="Try again"
            onAction={() => (nativeSession.status === 'retryable_failure' ? retryNativeSession() : void loadEnrollments())}
          />
        ) : enrollments.length === 0 ? (
          <ELearningEmptyState
            icon={<BookOpen size={40} color={colors.mutedText} />}
            title="No courses yet"
            hint="Courses you enroll in appear here with your progress."
            actionLabel="Browse courses"
            onAction={() => router.push('/eLearning/courses' as Href)}
          />
        ) : (
          <>
            {continueEnrollment?.course ? (
              <View style={styles.continueCard}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Open ${continueEnrollment.course.title}`} onPress={() => router.push(`/eLearning/courses/${continueEnrollment.courseId}` as Href)} android_ripple={{ color: colors.control }}>
                  {continueEnrollment.course.image || continueEnrollment.course.thumbnail ? (
                    <CachedImage uri={continueEnrollment.course.image || continueEnrollment.course.thumbnail || ''} style={{ width: heroImageWidth, height: heroImageHeight }} />
                  ) : null}
                  <View style={styles.continueBody}>
                    <Text style={styles.eyebrow}>Continue where you left off</Text>
                    <Text numberOfLines={2} style={styles.continueTitle}>{continueEnrollment.course.title}</Text>
                    {continueNext ? <Text numberOfLines={1} style={styles.muted}>Next: {continueNext.title}</Text> : null}
                    <View style={styles.progressRow}>
                      <View style={styles.flex}><ProgressBar value={continueEnrollment.progress} accessibilityLabel={`${continueEnrollment.course.title} progress`} /></View>
                      <Text style={styles.progressPercent}>{roundProgress(continueEnrollment.progress)}%</Text>
                    </View>
                  </View>
                </Pressable>
                <View style={styles.continueFooter}>
                  <Pressable accessibilityRole="button" onPress={() => handleResume(continueEnrollment, continueNext?.lessonId)} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.resumeButton}>
                    <PlayCircle size={18} color="#ffffff" />
                    <Text numberOfLines={1} style={styles.resumeButtonText}>{continueEnrollment.progress > 0 ? 'Resume' : 'Start'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <Text style={styles.summary}>{inProgressCount} in progress · {completedCount} completed</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {STATUS_FILTERS.map((option) => <ELearningChip key={option} label={option} isSelected={status === option} onPress={() => setStatus(option)} />)}
            </ScrollView>
            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>Sort</Text>
              {SORTS.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityLabel={`Sort by ${option.label}`}
                  accessibilityState={{ selected: sort === option.value }}
                  onPress={() => setSort(option.value)}
                  style={[styles.sortChip, sort === option.value && styles.sortChipActive]}
                >
                  <Text style={[styles.sortText, sort === option.value && styles.sortTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>

            {displayedList.length === 0 ? (
              <ELearningEmptyState
                icon={<BookOpen size={36} color={colors.mutedText} />}
                title={status === 'Completed' ? 'No completed courses yet' : `No ${status.toLowerCase()} courses`}
                hint="Try another filter."
                actionLabel="Show all"
                onAction={() => setStatus('All')}
              />
            ) : (
              <View style={styles.list}>
                {displayedList.map((item) => {
                  const itemStatus = progressStatus(item);
                  const progress = roundProgress(item.progress);
                  const image = item.course?.image || item.course?.thumbnail;
                  return (
                    <View key={item.id} style={styles.row}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${item.course?.title ?? 'Course unavailable'}, ${itemStatus}, ${progress}%`}
                        onPress={() => router.push(`/eLearning/courses/${item.courseId}` as Href)}
                        android_ripple={{ color: colors.control }}
                        style={styles.rowMain}
                      >
                        <View style={styles.thumb}>
                          {image ? <CachedImage uri={image} style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }} /> : <BookOpen size={22} color={colors.mutedText} />}
                        </View>
                        <View style={styles.flex}>
                          <Text numberOfLines={2} style={styles.rowTitle}>{item.course?.title ?? 'Course unavailable'}</Text>
                          <Text numberOfLines={1} style={styles.muted}>{item.course ? item.course.instructor.name : 'No longer in the catalog'}</Text>
                        </View>
                      </Pressable>
                      <View style={styles.rowFooter}>
                        <View style={styles.flex}>
                          <ProgressBar value={progress} accessibilityLabel={`${item.course?.title ?? 'Course'} progress`} />
                          <Text numberOfLines={1} style={styles.rowStatus}>{itemStatus} · {progress}%</Text>
                        </View>
                        <Pressable accessibilityRole="button" accessibilityLabel={`${item.status === 'completed' ? 'Review' : item.progress > 0 ? 'Resume' : 'Start'} ${item.course?.title ?? 'course'}`} onPress={() => handleResume(item)} android_ripple={{ color: colors.control }} style={styles.rowAction}>
                          <Text numberOfLines={1} style={styles.rowActionText}>{item.status === 'completed' ? 'Review' : item.progress > 0 ? 'Resume' : 'Start'}</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
        {!loading && activeUserId ? <MyCertificatesSection reloadKey={certificateReloadKey} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  scrollContent: { padding: ELEARNING_GUTTER, paddingBottom: 48, gap: 16 },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  muted: { color: colors.mutedText, fontSize: 13 },
  eyebrow: { color: colors.accentText, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  continueCard: { borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  continueBody: { padding: 16, paddingBottom: 8, gap: 6 },
  continueTitle: { color: colors.text, fontSize: 18, fontWeight: '800', lineHeight: 24 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  progressPercent: { color: colors.accentText, fontSize: 14, fontWeight: '800' },
  continueFooter: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 },
  resumeButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, backgroundColor: ELEARNING_ACTION_GREEN, overflow: 'hidden' },
  resumeButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  summary: { color: colors.text, fontSize: 16, fontWeight: '700' },
  chips: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -8 },
  sortLabel: { color: colors.mutedText, fontSize: 13, fontWeight: '600', marginRight: 4 },
  sortChip: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10 },
  sortChipActive: { backgroundColor: colors.control },
  sortText: { color: colors.mutedText, fontSize: 14, fontWeight: '600' },
  sortTextActive: { color: colors.accentText, fontWeight: '700' },
  list: { gap: 12 },
  row: { borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  thumb: { width: THUMB_WIDTH, height: THUMB_HEIGHT, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  rowFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 12 },
  rowStatus: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  rowAction: { minHeight: 44, minWidth: 84, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.accent, overflow: 'hidden' },
  rowActionText: { color: colors.accentText, fontSize: 14, fontWeight: '700' },
});
