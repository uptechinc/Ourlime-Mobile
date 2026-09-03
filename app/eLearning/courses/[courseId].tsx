import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Star,
  Clock,
  Users,
  CheckCircle2,
  PlayCircle,
  FileText,
  HelpCircle,
  Lock,
  Unlock,
  BookOpen,
  ArrowRight,
} from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { courseService } from '@/lib/services/CourseService';
import type { Course, CourseModule, Enrollment } from '@/lib/types/course';

export default function CourseDetailScreen() {
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const id = courseId as string;
  const { colors, isDark } = useAppTheme();
  const { activeUserId } = useAppData();

  const [course, setCourse] = useState<Course | null>(null);
  const [curriculum, setCurriculum] = useState<CourseModule[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'syllabus' | 'instructor'>('overview');
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);

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

      // Expand first module by default
      if (modulesData.length > 0) {
        setExpandedModules({ [modulesData[0].id]: true });
      }
    } catch (err) {
      console.error('[CourseDetailScreen] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [id, activeUserId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const toggleModule = (modId: string) => {
    setExpandedModules((prev) => ({ ...prev, [modId]: !prev[modId] }));
  };

  const handleEnrollOrResume = async () => {
    if (enrollment) {
      // Resume first lesson
      router.push(`/eLearning/courses/${id}/lesson` as Href);
      return;
    }

    if (!activeUserId) {
      router.push('/login' as Href);
      return;
    }

    setEnrolling(true);
    try {
      const newEnroll = await courseService.enrollInCourse(activeUserId, id);
      setEnrollment(newEnroll);
      router.push(`/eLearning/courses/${id}/lesson` as Href);
    } catch (err) {
      console.error('[handleEnroll] Error:', err);
    } finally {
      setEnrolling(false);
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
          {course?.title || 'Course Details'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={[styles.loadingText, { color: colors.mutedText }]}>Loading course overview...</Text>
        </View>
      ) : !course ? (
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>Course not found.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Hero Image */}
          <Image source={{ uri: course.image }} style={styles.heroImage} resizeMode="cover" />

          <View style={styles.mainContent}>
            {/* Category & Rating */}
            <View style={styles.badgeRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{course.category.toUpperCase()}</Text>
              </View>
              <View style={styles.ratingRow}>
                <Star size={15} color="#f59e0b" fill="#f59e0b" />
                <Text style={[styles.ratingText, { color: colors.text }]}>
                  {course.rating} ({course.totalRatings} ratings)
                </Text>
              </View>
            </View>

            {/* Title */}
            <Text style={[styles.courseTitle, { color: colors.text }]}>{course.title}</Text>

            {/* Meta Row */}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Clock size={15} color="#10b981" />
                <Text style={[styles.metaText, { color: colors.text }]}>{course.duration} hours</Text>
              </View>
              <View style={styles.metaItem}>
                <Users size={15} color="#10b981" />
                <Text style={[styles.metaText, { color: colors.text }]}>{course.enrolledStudents} students</Text>
              </View>
              <View style={styles.metaItem}>
                <BookOpen size={15} color="#10b981" />
                <Text style={[styles.metaText, { color: colors.text }]}>
                  {curriculum.reduce((acc, m) => acc + (m.lessons?.length || 0), 0)} lessons
                </Text>
              </View>
            </View>

            {/* Tabs */}
            <View style={[styles.tabBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {(['overview', 'syllabus', 'instructor'] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[
                    styles.tabItem,
                    activeTab === tab && { backgroundColor: '#10b981' },
                  ]}
                >
                  <Text
                    style={[
                      styles.tabItemText,
                      { color: activeTab === tab ? '#ffffff' : colors.text },
                    ]}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Overview Tab */}
            {activeTab === 'overview' ? (
              <View style={styles.tabContent}>
                <Text style={[styles.sectionHeading, { color: colors.text }]}>Description</Text>
                <Text style={[styles.bodyText, { color: colors.text }]}>{course.description}</Text>

                {course.learningObjectives && course.learningObjectives.length > 0 ? (
                  <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>What you'll learn</Text>
                    {course.learningObjectives.map((obj, oIdx) => (
                      <View key={`obj-${oIdx}`} style={styles.objectiveRow}>
                        <CheckCircle2 size={16} color="#10b981" />
                        <Text style={[styles.objectiveText, { color: colors.text }]}>{obj}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Syllabus Tab */}
            {activeTab === 'syllabus' ? (
              <View style={styles.tabContent}>
                <Text style={[styles.sectionHeading, { color: colors.text }]}>Course Curriculum</Text>
                {curriculum.map((module, mIdx) => {
                  const isExpanded = Boolean(expandedModules[module.id]);
                  return (
                    <View
                      key={module.id}
                      style={[styles.moduleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => toggleModule(module.id)}
                        style={styles.moduleHeader}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.moduleTitle, { color: colors.text }]}>{module.title}</Text>
                          <Text style={[styles.moduleLessonsCount, { color: colors.mutedText }]}>
                            {module.lessons?.length || 0} lessons
                          </Text>
                        </View>
                        {isExpanded ? (
                          <ChevronUp size={20} color={colors.text} />
                        ) : (
                          <ChevronDown size={20} color={colors.text} />
                        )}
                      </TouchableOpacity>

                      {isExpanded && module.lessons ? (
                        <View style={styles.lessonsList}>
                          {module.lessons.map((lesson) => {
                            const isCompleted = enrollment?.completedLessons?.includes(lesson.id);
                            return (
                              <TouchableOpacity
                                key={lesson.id}
                                activeOpacity={0.7}
                                onPress={() => router.push(`/eLearning/courses/${id}/lesson` as Href)}
                                style={styles.lessonItem}
                              >
                                {lesson.type === 'video' ? (
                                  <PlayCircle size={18} color="#10b981" />
                                ) : lesson.type === 'quiz' ? (
                                  <HelpCircle size={18} color="#f59e0b" />
                                ) : (
                                  <FileText size={18} color="#3b82f6" />
                                )}
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.lessonTitle, { color: colors.text }]}>
                                    {lesson.title}
                                  </Text>
                                  {lesson.duration ? (
                                    <Text style={[styles.lessonDuration, { color: colors.mutedText }]}>
                                      {lesson.duration} min
                                    </Text>
                                  ) : null}
                                </View>
                                {isCompleted ? (
                                  <CheckCircle2 size={16} color="#10b981" />
                                ) : (
                                  <Unlock size={14} color={colors.mutedText} />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* Instructor Tab */}
            {activeTab === 'instructor' ? (
              <View style={styles.tabContent}>
                <View style={[styles.instructorCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <UserAvatar
                    profileImage={course.instructor.avatar}
                    firstName={course.instructor.name}
                    size={64}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.instructorName, { color: colors.text }]}>
                      {course.instructor.name}
                    </Text>
                    {course.instructor.role ? (
                      <Text style={[styles.instructorRole, { color: colors.mutedText }]}>
                        {course.instructor.role}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}

      {/* Bottom CTA */}
      {course ? (
        <View style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={styles.priceColumn}>
            <Text style={[styles.priceLabel, { color: colors.mutedText }]}>Access</Text>
            <Text style={[styles.priceValue, { color: colors.text }]}>
              {course.price === 0 ? 'Free' : `$${course.price}`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleEnrollOrResume}
            disabled={enrolling}
            style={[styles.enrollBtn, { backgroundColor: '#10b981' }]}
          >
            {enrolling ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Text style={styles.enrollBtnText}>
                  {enrollment ? 'Continue Learning' : 'Enroll for Free'}
                </Text>
                <ArrowRight size={16} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
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
    paddingBottom: 100,
  },
  heroImage: {
    width: '100%',
    height: 220,
  },
  mainContent: {
    padding: 18,
    gap: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
  },
  courseTitle: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginVertical: 6,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabItemText: {
    fontSize: 13,
    fontWeight: '800',
  },
  tabContent: {
    gap: 14,
    marginTop: 6,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '800',
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 24,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  objectiveRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  objectiveText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  moduleCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  moduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  moduleTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  moduleLessonsCount: {
    fontSize: 12,
    marginTop: 2,
  },
  lessonsList: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f033',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  lessonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f022',
  },
  lessonTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  lessonDuration: {
    fontSize: 11,
    marginTop: 2,
  },
  instructorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
  },
  instructorName: {
    fontSize: 17,
    fontWeight: '800',
  },
  instructorRole: {
    fontSize: 13,
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  priceColumn: {},
  priceLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  priceValue: {
    fontSize: 17,
    fontWeight: '900',
  },
  enrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
  },
  enrollBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
