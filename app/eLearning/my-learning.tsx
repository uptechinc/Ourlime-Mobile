import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import {
  ChevronLeft,
  BookOpen,
  Award,
  PlayCircle,
  TrendingUp,
  Clock,
  CheckCircle2,
} from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { MyLearningListSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { courseService, isActiveEnrollment } from '@/lib/services/CourseService';
import type { Enrollment, MyLearningSort, MyLearningStatus } from '@/lib/types/course';

const STATUS_FILTERS: MyLearningStatus[] = ['All', 'In progress', 'Not started', 'Completed'];
const SORTS: { value: MyLearningSort; label: string }[] = [{ value: 'recent', label: 'Most recent' }, { value: 'progress', label: 'Progress' }];

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

export default function MyLearningScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { activeUserId, nativeSession, retryNativeSession } = useAppData();

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<MyLearningStatus>('All');
  const [sort, setSort] = useState<MyLearningSort>('recent');
  const [loadError, setLoadError] = useState<string | null>(null);
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

  const inProgressCourses = enrollments.filter((enrollment) => progressStatus(enrollment) === 'In progress');
  const completedCourses = enrollments.filter((enrollment) => progressStatus(enrollment) === 'Completed');
  const filtered = status === 'All' ? enrollments : enrollments.filter((enrollment) => progressStatus(enrollment) === status);
  const displayedList = [...filtered].sort((left, right) => sort === 'progress' ? right.progress - left.progress : lastActivity(right) - lastActivity(left));

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.canvas }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My Learning</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadEnrollments();
            }}
            tintColor="#10b981"
          />
        }
      >
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TrendingUp size={22} color="#10b981" />
            <Text style={[styles.statValue, { color: colors.text }]}>{inProgressCourses.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedText }]}>In Progress</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Award size={22} color="#3b82f6" />
            <Text style={[styles.statValue, { color: colors.text }]}>{completedCourses.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedText }]}>Completed</Text>
          </View>
        </View>

        {/* Status filter and sort (web My Learning selects) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {STATUS_FILTERS.map((option) => (
            <TouchableOpacity
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: status === option }}
              onPress={() => setStatus(option)}
              style={[styles.chip, status === option ? { backgroundColor: '#10b981', borderColor: '#10b981' } : { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.chipText, { color: status === option ? '#ffffff' : colors.text }]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.sortRow}>
          <Text style={[styles.sortLabel, { color: colors.mutedText }]}>Sort</Text>
          {SORTS.map((option) => (
            <TouchableOpacity
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: sort === option.value }}
              onPress={() => setSort(option.value)}
              style={[styles.sortChip, sort === option.value && { backgroundColor: colors.control }]}
            >
              <Text style={[styles.sortText, { color: sort === option.value ? colors.accentText : colors.mutedText }]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Course List */}
        {loading ? (
          <MyLearningListSkeleton />
        ) : loadError ? (
          <View style={[styles.emptyContainer, { backgroundColor: colors.destructiveSurface }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>My Learning could not load</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedText }]}>{loadError}</Text>
            <TouchableOpacity
              onPress={() => nativeSession.status === 'retryable_failure' ? retryNativeSession() : void loadEnrollments()}
              style={styles.browseBtn}
            >
              <Text style={styles.browseBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : displayedList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <BookOpen size={48} color={colors.mutedText} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {status === 'All' ? 'No courses yet' : status === 'Completed' ? 'No completed courses yet' : `No ${status.toLowerCase()} courses`}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedText }]}>
              Explore our curriculum to start learning today.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/eLearning/courses' as Href)}
              style={styles.browseBtn}
            >
              <Text style={styles.browseBtnText}>Browse Courses</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {displayedList.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.85}
                onPress={() => router.push(`/eLearning/courses/${item.courseId}` as Href)}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                {item.course?.image ? (
                  <View>
                    <Image source={{ uri: item.course.image }} style={styles.cardImage} resizeMode="cover" />
                    {lastActivity(item) ? (
                      <View style={styles.dateBadge}>
                        <Clock size={12} color="#ffffff" />
                        <Text style={styles.dateBadgeText}>{new Date(lastActivity(item)).toLocaleDateString()}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.cardInfo}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.course?.title ?? 'Course unavailable'}
                  </Text>
                  {item.course ? <Text style={[styles.instructorText, { color: colors.mutedText }]}>by {item.course.instructor.name}</Text> : <Text style={[styles.instructorText, { color: colors.mutedText }]}>This course is no longer available in the catalog.</Text>}

                  {/* Progress Bar */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressHeader}>
                      <Text style={[styles.progressLabel, { color: colors.mutedText }]}>
                        {progressStatus(item)}{!item.course?.image && lastActivity(item) ? ` · ${new Date(lastActivity(item)).toLocaleDateString()}` : ''}
                      </Text>
                      <Text style={[styles.progressPercent, { color: '#10b981' }]}>
                        {item.progress || 0}%
                      </Text>
                    </View>
                    <View style={[styles.progressBarTrack, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
                      <View
                        style={[styles.progressBarFill, { width: `${Math.min(100, item.progress || 0)}%` }]}
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => router.push(`/eLearning/courses/${item.courseId}/lesson` as Href)}
                    style={styles.resumeBtn}
                  >
                    {item.status === 'completed' ? <CheckCircle2 size={16} color="#ffffff" /> : <PlayCircle size={16} color="#ffffff" />}
                    <Text style={styles.resumeBtnText}>
                      {item.status === 'completed' ? 'Review' : item.progress > 0 ? 'Resume' : 'Start'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '700' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortLabel: { fontSize: 12, fontWeight: '700', marginRight: 4 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  sortText: { fontSize: 13, fontWeight: '800' },
  dateBadge: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.6)' },
  dateBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '800',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 260,
  },
  browseBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 10,
  },
  browseBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  list: {
    gap: 16,
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
  },
  cardImage: {
    width: '100%',
    height: 140,
  },
  cardInfo: {
    padding: 16,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  instructorText: {
    fontSize: 13,
  },
  progressSection: {
    gap: 6,
    marginVertical: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  resumeBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
});
