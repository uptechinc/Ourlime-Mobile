import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  CheckCircle2,
  TrendingUp,
  Clock,
} from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { courseService } from '@/lib/services/CourseService';
import type { Enrollment } from '@/lib/types/course';

export default function MyLearningScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { activeUserId } = useAppData();

  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'in_progress' | 'completed'>('in_progress');

  const loadEnrollments = useCallback(async () => {
    if (!activeUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await courseService.getMyEnrollments(activeUserId);
      setEnrollments(data);
    } catch {
      setEnrollments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeUserId]);

  useEffect(() => {
    void loadEnrollments();
  }, [loadEnrollments]);

  const inProgressCourses = enrollments.filter((e) => (e.progress || 0) < 100);
  const completedCourses = enrollments.filter((e) => (e.progress || 0) >= 100);

  const displayedList = tab === 'in_progress' ? inProgressCourses : completedCourses;

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

        {/* Tab Toggle */}
        <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => setTab('in_progress')}
            style={[styles.tabItem, tab === 'in_progress' && { backgroundColor: '#10b981' }]}
          >
            <Text
              style={[
                styles.tabItemText,
                { color: tab === 'in_progress' ? '#ffffff' : colors.text },
              ]}
            >
              In Progress ({inProgressCourses.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab('completed')}
            style={[styles.tabItem, tab === 'completed' && { backgroundColor: '#10b981' }]}
          >
            <Text
              style={[
                styles.tabItemText,
                { color: tab === 'completed' ? '#ffffff' : colors.text },
              ]}
            >
              Completed ({completedCourses.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Course List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        ) : displayedList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <BookOpen size={48} color={colors.mutedText} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {tab === 'in_progress' ? 'No active courses' : 'No completed courses yet'}
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
                  <Image source={{ uri: item.course.image }} style={styles.cardImage} resizeMode="cover" />
                ) : null}

                <View style={styles.cardInfo}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                    {item.course?.title || 'Enrolled Course'}
                  </Text>
                  <Text style={[styles.instructorText, { color: colors.mutedText }]}>
                    by {item.course?.instructor.name || 'Instructor'}
                  </Text>

                  {/* Progress Bar */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressHeader}>
                      <Text style={[styles.progressLabel, { color: colors.mutedText }]}>Progress</Text>
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
                    <PlayCircle size={16} color="#ffffff" />
                    <Text style={styles.resumeBtnText}>
                      {item.progress >= 100 ? 'Review Lessons' : 'Resume Learning'}
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
