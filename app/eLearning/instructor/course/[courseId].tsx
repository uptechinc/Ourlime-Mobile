import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { BookOpen, ClipboardCheck, Clock, ExternalLink, FileText, HelpCircle, Plus, Star, Users, Video } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import { CourseDetailSkeleton } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { instructorService, type InstructorCourseDetail, type InstructorCourseStatus, type InstructorCurriculum, type InstructorLesson } from '@/lib/services/InstructorService';

const CONTENT_MAX_WIDTH = 860;
const STATUS_LABEL: Record<InstructorCourseStatus, string> = { draft: 'Draft', pending_review: 'Pending review', published: 'Published', archived: 'Archived' };
const UNAVAILABLE_TEXT: Record<InstructorCourseStatus, string> = {
  pending_review: 'An administrator is reviewing this course. Its modules and lessons appear here once it is approved and published.',
  draft: 'This course is unpublished. Its modules and lessons appear here while it is published.',
  archived: 'This course is archived. Its modules and lessons appear here while it is published.',
  published: 'The modules and lessons could not be loaded. Pull down to try again.',
};

const lessonLabel = (lesson: InstructorLesson): string => {
  if (lesson.type === 'quiz') return `Quiz · ${lesson.questionCount} question${lesson.questionCount === 1 ? '' : 's'}`;
  if (lesson.type === 'assignment') {
    const due = lesson.dueDate ? ` · due ${new Date(lesson.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : '';
    return `Assignment${lesson.points !== undefined ? ` · ${lesson.points} pts` : ''}${due}`;
  }
  const kind = lesson.type === 'video' ? 'Video' : lesson.type === 'text' ? 'Lesson' : 'Resource';
  return lesson.duration > 0 ? `${kind} · ${lesson.duration} min` : kind;
};

/**
 * The instructor's own course in any status (draft and pending-review courses included, which the learner course page
 * cannot open): details, curriculum once published, and shortcuts to add quizzes, assignments and grade.
 */
export default function InstructorCourseScreen() {
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const id = typeof courseId === 'string' ? courseId : '';
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [course, setCourse] = useState<InstructorCourseDetail | null>(null);
  const [curriculum, setCurriculum] = useState<InstructorCurriculum>({ kind: 'unavailable' });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const detail = await instructorService.getCourse(id);
      setCourse(detail);
      if (!detail) {
        setError('This course could not be found, or it belongs to another instructor.');
        return;
      }
      setCurriculum(await instructorService.getCurriculum(id, detail.status));
    } catch (loadError: unknown) {
      console.error('[InstructorCourseScreen.load] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      setError('The course could not be loaded. Pull down to try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const query = course ? `${encodeURIComponent(course.id)}?title=${encodeURIComponent(course.title)}` : '';

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="Course" onBackPress={() => router.back()} />
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.padded}><CourseDetailSkeleton /></ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); void load(); }} tintColor={colors.accent} />}>
          <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {course ? (
              <>
                {course.image ? <Image source={{ uri: course.image }} contentFit="cover" style={styles.cover} /> : null}
                <View style={styles.metaRow}>
                  <Text style={[styles.badge, course.status === 'published' ? styles.badgeLive : course.status === 'pending_review' ? styles.badgePending : styles.badgeDraft]}>{STATUS_LABEL[course.status]}</Text>
                  {course.category ? <Text style={styles.muted}>{course.subcategory ? `${course.category} · ${course.subcategory}` : course.category}</Text> : null}
                </View>
                <Text style={styles.title}>{course.title}</Text>
                {course.shortDescription ? <Text style={styles.subtitle}>{course.shortDescription}</Text> : null}
                <View style={styles.metaRow}>
                  <Users size={14} color={colors.mutedText} /><Text style={styles.muted}>{course.enrolledStudents} enrolled</Text>
                  <Star size={14} color="#f59e0b" /><Text style={styles.muted}>{course.rating.toFixed(1)} ({course.totalRatings})</Text>
                  <Text style={styles.muted}>· {course.level.charAt(0).toUpperCase() + course.level.slice(1)} · {course.price > 0 ? `$${course.price.toFixed(2)}` : 'Free'}</Text>
                </View>

                {course.status === 'pending_review' ? (
                  <View style={styles.notice}>
                    <Clock size={18} color={colors.warningText} />
                    <Text style={[styles.noticeText, styles.flex]}>Waiting for an administrator to approve this course. You can still add quizzes and assignments.</Text>
                  </View>
                ) : null}

                <View style={styles.actions}>
                  <Pressable accessibilityRole="button" onPress={() => router.push(`/eLearning/instructor/quiz/${query}` as Href)} style={styles.actionButton}>
                    <Plus size={15} color={colors.text} /><Text style={styles.actionText}>Quiz</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => router.push(`/eLearning/instructor/assignment/${query}` as Href)} style={styles.actionButton}>
                    <Plus size={15} color={colors.text} /><Text style={styles.actionText}>Assignment</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => router.push(`/eLearning/instructor/grading/${query}` as Href)} style={styles.actionButton}>
                    <ClipboardCheck size={15} color={colors.text} /><Text style={styles.actionText}>Grade</Text>
                  </Pressable>
                </View>
                {course.status === 'published' ? (
                  <Pressable accessibilityRole="link" onPress={() => router.push(`/eLearning/courses/${encodeURIComponent(course.id)}` as Href)} style={styles.linkButton}>
                    <ExternalLink size={15} color={colors.accentText} /><Text style={styles.linkText}>Open the learner view</Text>
                  </Pressable>
                ) : null}

                <View style={styles.stats}>
                  <View style={styles.statCard}><HelpCircle size={16} color="#8b5cf6" /><Text style={styles.statValue}>{course.quizCount ?? '–'}</Text><Text style={styles.muted}>Quizzes</Text></View>
                  <View style={styles.statCard}><FileText size={16} color="#f97316" /><Text style={styles.statValue}>{course.assignmentCount ?? '–'}</Text><Text style={styles.muted}>Assignments</Text></View>
                  <View style={styles.statCard}><Users size={16} color={colors.accent} /><Text style={styles.statValue}>{course.enrolledStudents}</Text><Text style={styles.muted}>Enrolled</Text></View>
                </View>

                {course.description ? <><Text style={styles.section}>About</Text><Text style={styles.body}>{course.description}</Text></> : null}
                {course.learningObjectives.length > 0 ? (
                  <><Text style={styles.section}>What learners will learn</Text>{course.learningObjectives.map((item) => <Text key={item} style={styles.body}>• {item}</Text>)}</>
                ) : null}
                {course.prerequisites.length > 0 ? (
                  <><Text style={styles.section}>Prerequisites</Text>{course.prerequisites.map((item) => <Text key={item} style={styles.body}>• {item}</Text>)}</>
                ) : null}
                {course.tags.length > 0 ? (
                  <View style={styles.tags}>{course.tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}</View>
                ) : null}

                <Text style={styles.section}>Curriculum</Text>
                {curriculum.kind === 'unavailable' ? (
                  <Text style={styles.muted}>{UNAVAILABLE_TEXT[course.status]}</Text>
                ) : curriculum.modules.length === 0 ? (
                  <Text style={styles.muted}>No modules yet.</Text>
                ) : curriculum.modules.map((module, index) => (
                  <View key={module.id} style={styles.moduleCard}>
                    <Text style={styles.moduleTitle}>{index + 1}. {module.title}</Text>
                    {module.description ? <Text style={styles.muted}>{module.description}</Text> : null}
                    {module.lessons.length === 0 ? <Text style={styles.muted}>No lessons.</Text> : null}
                    {module.lessons.map((lesson) => (
                      <View key={lesson.id} style={styles.lessonRow}>
                        {lesson.type === 'video' ? <Video size={16} color={colors.mutedText} /> : lesson.type === 'quiz' ? <HelpCircle size={16} color="#8b5cf6" /> : lesson.type === 'assignment' ? <FileText size={16} color="#f97316" /> : <BookOpen size={16} color={colors.mutedText} />}
                        <View style={styles.flex}>
                          <Text style={styles.lessonTitle} numberOfLines={2}>{lesson.title}</Text>
                          <Text style={styles.muted}>{lessonLabel(lesson)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
              </>
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  padded: { padding: 16 },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: 16, gap: 12 },
  error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 10, padding: 10 },
  cover: { width: '100%', aspectRatio: 16 / 9, maxHeight: 320, borderRadius: 16 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  subtitle: { color: colors.secondaryText, fontSize: 15, lineHeight: 21 },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden', fontSize: 11, fontWeight: '800' },
  badgeLive: { color: colors.successText, backgroundColor: colors.successSurface },
  badgeDraft: { color: colors.mutedText, backgroundColor: colors.control },
  badgePending: { color: colors.warningText, backgroundColor: colors.warningSurface },
  notice: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, backgroundColor: colors.warningSurface },
  noticeText: { color: colors.warningText, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 8 },
  actionButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actionText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  linkButton: { minHeight: 40, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 },
  linkText: { color: colors.accentText, fontSize: 14, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, padding: 12, gap: 2, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  statValue: { marginTop: 2, color: colors.text, fontSize: 20, fontWeight: '900' },
  section: { marginTop: 8, color: colors.text, fontSize: 17, fontWeight: '900' },
  body: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.control, color: colors.secondaryText, fontSize: 12, fontWeight: '700' },
  moduleCard: { padding: 12, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  moduleTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  lessonRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  lessonTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
