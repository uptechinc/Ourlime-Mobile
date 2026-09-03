import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  PlayCircle,
  FileText,
  HelpCircle,
  List,
  Sparkles,
} from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { courseService } from '@/lib/services/CourseService';
import type { Course, CourseModule, CourseLesson, Enrollment } from '@/lib/types/course';

export default function LessonScreen() {
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const id = courseId as string;
  const { colors, isDark } = useAppTheme();
  const { activeUserId } = useAppData();

  const [course, setCourse] = useState<Course | null>(null);
  const [curriculum, setCurriculum] = useState<CourseModule[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);

  const allLessons = useMemo(() => {
    const list: CourseLesson[] = [];
    for (const mod of curriculum) {
      if (mod.lessons) list.push(...mod.lessons);
    }
    return list;
  }, [curriculum]);

  const currentLesson = allLessons[currentLessonIndex] ?? null;

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [courseData, modulesData, enrollData] = await Promise.all([
        courseService.getCourse(id),
        courseService.getCourseCurriculum(id),
        activeUserId ? courseService.getEnrollmentStatus(activeUserId, id) : null,
      ]);

      setCourse(courseData);
      setCurriculum(modulesData);
      setEnrollment(enrollData);
    } catch (err) {
      console.error('[LessonScreen] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [id, activeUserId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const isCompleted = Boolean(
    currentLesson && enrollment?.completedLessons?.includes(currentLesson.id)
  );

  const handleToggleComplete = async () => {
    if (!enrollment || !currentLesson) return;
    await courseService.markLessonCompleted(enrollment.id, currentLesson.id, allLessons.length);
    const updated = await courseService.getEnrollmentStatus(enrollment.userId, id);
    setEnrollment(updated);
  };

  const handleNext = () => {
    if (currentLessonIndex < allLessons.length - 1) {
      setCurrentLessonIndex((idx) => idx + 1);
    }
  };

  const handlePrev = () => {
    if (currentLessonIndex > 0) {
      setCurrentLessonIndex((idx) => idx - 1);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.canvas }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {course?.title || 'Lesson'}
        </Text>
        <TouchableOpacity onPress={() => setShowDrawer((prev) => !prev)} style={styles.headerBtn}>
          <List size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={[styles.loadingText, { color: colors.mutedText }]}>Loading lesson content...</Text>
        </View>
      ) : !currentLesson ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>No lesson content found.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Video Placeholder / Player Box */}
          <View style={[styles.playerBox, { backgroundColor: isDark ? '#0f172a' : '#1e293b' }]}>
            {currentLesson.type === 'video' ? (
              <View style={styles.videoPlaceholder}>
                <PlayCircle size={56} color="#10b981" />
                <Text style={styles.videoPlaceholderText}>Interactive Video Lecture</Text>
                <Text style={styles.videoDuration}>{currentLesson.duration || 15} minutes</Text>
              </View>
            ) : currentLesson.type === 'quiz' ? (
              <View style={styles.videoPlaceholder}>
                <HelpCircle size={56} color="#f59e0b" />
                <Text style={styles.videoPlaceholderText}>Knowledge Assessment Quiz</Text>
              </View>
            ) : (
              <View style={styles.videoPlaceholder}>
                <FileText size={56} color="#3b82f6" />
                <Text style={styles.videoPlaceholderText}>Lecture Reading Material</Text>
              </View>
            )}
          </View>

          {/* Lesson Info */}
          <View style={styles.lessonBody}>
            <View style={styles.lessonMetaRow}>
              <View style={[styles.badge, { backgroundColor: '#10b98122' }]}>
                <Text style={styles.badgeText}>Lesson {currentLessonIndex + 1} of {allLessons.length}</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleToggleComplete}
                style={[
                  styles.completeToggleBtn,
                  isCompleted
                    ? { backgroundColor: '#10b981', borderColor: '#10b981' }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <CheckCircle2 size={16} color={isCompleted ? '#ffffff' : colors.mutedText} />
                <Text
                  style={[
                    styles.completeToggleText,
                    { color: isCompleted ? '#ffffff' : colors.text },
                  ]}
                >
                  {isCompleted ? 'Completed' : 'Mark as Done'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.lessonTitle, { color: colors.text }]}>{currentLesson.title}</Text>

            {/* Content Text */}
            <View style={[styles.contentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.contentText, { color: colors.text }]}>
                {currentLesson.content || 'Follow along with the lecture resources and key takeaways.'}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Bottom Navigation Controls */}
      <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={handlePrev}
          disabled={currentLessonIndex === 0}
          style={[
            styles.navBtn,
            currentLessonIndex === 0 && { opacity: 0.4 },
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ChevronLeft size={18} color={colors.text} />
          <Text style={[styles.navBtnText, { color: colors.text }]}>Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleNext}
          disabled={currentLessonIndex >= allLessons.length - 1}
          style={[
            styles.navBtn,
            styles.nextBtn,
            currentLessonIndex >= allLessons.length - 1 && { opacity: 0.4 },
          ]}
        >
          <Text style={styles.nextBtnText}>Next Lesson</Text>
          <ChevronRight size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>
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
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 16,
  },
  scrollContent: {
    paddingBottom: 90,
  },
  playerBox: {
    width: '100%',
    height: 230,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoPlaceholderText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  videoDuration: {
    color: '#94a3b8',
    fontSize: 13,
  },
  lessonBody: {
    padding: 18,
    gap: 14,
  },
  lessonMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '800',
  },
  completeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  completeToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  lessonTitle: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  contentCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 6,
  },
  contentText: {
    fontSize: 15,
    lineHeight: 24,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  navBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  nextBtn: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  nextBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
