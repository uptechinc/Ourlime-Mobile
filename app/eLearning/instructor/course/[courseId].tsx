import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { BookOpen, ClipboardCheck, ClipboardList, Clock, ExternalLink, HelpCircle, Lock } from 'lucide-react-native';
import { InstructorCourseSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { CourseRating, ELearningEmptyState, ELearningHeader, ELEARNING_GUTTER, StatusPill, type ELearningTone } from '@/components/eLearning/ELearningParts';
import LessonTypeIcon from '@/components/eLearning/course/LessonTypeIcon';
import { pluralize } from '@/components/eLearning/course/workspaceHelpers';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { instructorService, type InstructorCourseDetail, type InstructorCourseStatus, type InstructorCurriculum, type InstructorLesson } from '@/lib/services/InstructorService';

const CONTENT_MAX_WIDTH = 860;
const RIPPLE = { color: 'rgba(15,23,42,0.12)' };
const STATUS_LABEL: Record<InstructorCourseStatus, string> = { draft: 'Draft', pending_review: 'In review', published: 'Published', archived: 'Archived' };
const STATUS_TONE: Record<InstructorCourseStatus, ELearningTone> = { draft: 'neutral', pending_review: 'warning', published: 'success', archived: 'neutral' };
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
  const kind = lesson.type === 'video' ? 'Video' : lesson.type === 'text' ? 'Reading' : 'Resource';
  return lesson.duration > 0 ? `${kind} · ${lesson.duration} min` : kind;
};

/** LessonTypeIcon knows the learner lesson types; the instructor's file types map to its resource icon. */
const iconType = (type: InstructorLesson['type']): 'video' | 'text' | 'quiz' | 'assignment' | 'resource' =>
  type === 'video' || type === 'text' || type === 'quiz' || type === 'assignment' ? type : 'resource';

/**
 * The instructor's own course in any status (draft and pending-review courses included, which the learner course page
 * cannot open): details, curriculum once published, and shortcuts to add quizzes, assignments and grade.
 */
export default function InstructorCourseScreen() {
  const router = useRouter();
  const { courseId, title: titleParam } = useLocalSearchParams<{ courseId: string; title?: string }>();
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
    if (!id) { setIsLoading(false); setError('This course could not be found.'); return; }
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
      setError('The course could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const query = course ? `${encodeURIComponent(course.id)}?title=${encodeURIComponent(course.title)}` : '';
  const columnWidth = Math.min(width, CONTENT_MAX_WIDTH);
  const coverWidth = columnWidth - ELEARNING_GUTTER * 2;
  const coverHeight = Math.min(240, Math.round(coverWidth * 9 / 16));
  const headerTitle = course?.title ?? (typeof titleParam === 'string' && titleParam ? titleParam : 'Course');
  const meta = course ? [
    course.level ? course.level.charAt(0).toUpperCase() + course.level.slice(1) : null,
    course.price > 0 ? `$${course.price.toFixed(2)}` : 'Free',
    course.category ? (course.subcategory ? `${course.category} · ${course.subcategory}` : course.category) : null,
  ].filter(Boolean).join(' · ') : '';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ELearningHeader title={headerTitle} subtitle="Your course" onBack={() => router.back()} />
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.scroll}><InstructorCourseSkeleton /></ScrollView>
      ) : !course ? (
        <View style={styles.centerFill}>
          <ELearningEmptyState icon={<BookOpen size={40} color={colors.mutedText} />} title="Course unavailable" hint={error ?? 'This course could not be found.'} actionLabel="Try again" onAction={() => { setIsLoading(true); void load(); }} secondaryActionLabel="Go back" onSecondaryAction={() => router.back()} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); void load(); }} tintColor={colors.accent} />}>
          <View style={[styles.column, { width: columnWidth }]}>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {course.image ? <Image source={{ uri: course.image }} contentFit="cover" style={[styles.cover, { width: coverWidth, height: coverHeight }]} /> : null}
            <View style={styles.heading}>
              <StatusPill label={STATUS_LABEL[course.status]} tone={STATUS_TONE[course.status]} />
              <Text accessibilityRole="header" style={styles.title}>{course.title}</Text>
              {course.shortDescription ? <Text style={styles.subtitle}>{course.shortDescription}</Text> : null}
              <View style={styles.metaRow}>
                <Text style={styles.muted}>{pluralize(course.enrolledStudents, 'learner', 'learners')}</Text>
                <CourseRating rating={course.rating} count={course.totalRatings} />
              </View>
              {meta ? <Text style={styles.muted}>{meta}</Text> : null}
            </View>

            {course.status === 'pending_review' ? (
              <View style={styles.notice}>
                <Clock size={18} color={colors.warningText} />
                <Text style={[styles.noticeText, styles.flexText]}>Waiting for an administrator to approve this course. You can still add quizzes and assignments.</Text>
              </View>
            ) : null}

            <View style={styles.tiles}>
              <Pressable accessibilityRole="button" accessibilityLabel="Add a quiz" onPress={() => router.push(`/eLearning/instructor/quiz/${query}` as Href)} android_ripple={RIPPLE} style={styles.tile}>
                <HelpCircle size={20} color={colors.icon} /><Text numberOfLines={2} style={styles.tileText}>Add quiz</Text>
                {course.quizCount !== null ? <Text style={styles.tileMeta}>{course.quizCount} so far</Text> : null}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Add an assignment" onPress={() => router.push(`/eLearning/instructor/assignment/${query}` as Href)} android_ripple={RIPPLE} style={styles.tile}>
                <ClipboardList size={20} color={colors.icon} /><Text numberOfLines={2} style={styles.tileText}>Add assignment</Text>
                {course.assignmentCount !== null ? <Text style={styles.tileMeta}>{course.assignmentCount} so far</Text> : null}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Grade student work" onPress={() => router.push(`/eLearning/instructor/grading/${query}` as Href)} android_ripple={RIPPLE} style={styles.tile}>
                <ClipboardCheck size={20} color={colors.icon} /><Text numberOfLines={2} style={styles.tileText}>Grade work</Text>
              </Pressable>
            </View>
            {course.status === 'published' ? (
              <Pressable accessibilityRole="link" onPress={() => router.push(`/eLearning/courses/${encodeURIComponent(course.id)}` as Href)} android_ripple={RIPPLE} style={styles.linkButton}>
                <ExternalLink size={16} color={colors.accentText} /><Text style={styles.linkText}>Open the learner view</Text>
              </Pressable>
            ) : null}

            {course.description ? (
              <View style={styles.card}>
                <Text accessibilityRole="header" style={styles.section}>About</Text>
                <Text style={styles.body}>{course.description}</Text>
              </View>
            ) : null}
            {course.learningObjectives.length > 0 || course.prerequisites.length > 0 ? (
              <View style={styles.card}>
                {course.learningObjectives.length > 0 ? (
                  <>
                    <Text accessibilityRole="header" style={styles.section}>What learners will learn</Text>
                    {course.learningObjectives.map((item) => <Text key={item} style={styles.body}>• {item}</Text>)}
                  </>
                ) : null}
                {course.prerequisites.length > 0 ? (
                  <>
                    <Text accessibilityRole="header" style={[styles.section, course.learningObjectives.length > 0 && styles.sectionGap]}>Prerequisites</Text>
                    {course.prerequisites.map((item) => <Text key={item} style={styles.body}>• {item}</Text>)}
                  </>
                ) : null}
                {course.tags.length > 0 ? <View style={styles.tags}>{course.tags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}</View> : null}
              </View>
            ) : null}

            <Text accessibilityRole="header" style={styles.sectionTitle}>Curriculum</Text>
            {curriculum.kind === 'unavailable' ? (
              <View style={styles.lockedCard}>
                <Lock size={18} color={colors.mutedText} />
                <Text style={[styles.mutedBody, styles.flexText]}>{UNAVAILABLE_TEXT[course.status]}</Text>
              </View>
            ) : curriculum.modules.length === 0 ? (
              <Text style={styles.mutedBody}>No modules yet.</Text>
            ) : curriculum.modules.map((module, index) => (
              <View key={module.id} style={styles.moduleCard}>
                <View style={styles.moduleHead}>
                  <Text style={styles.eyebrow}>Module {index + 1} · {pluralize(module.lessons.length, 'item', 'items')}</Text>
                  <Text style={styles.moduleTitle}>{module.title}</Text>
                  {module.description ? <Text style={styles.muted}>{module.description}</Text> : null}
                </View>
                {module.lessons.length === 0 ? <Text style={[styles.muted, styles.lessonPad]}>No lessons.</Text> : null}
                {module.lessons.map((lesson) => (
                  <View key={lesson.id} style={styles.lessonRow}>
                    <LessonTypeIcon type={iconType(lesson.type)} size={18} />
                    <View style={styles.flexText}>
                      <Text style={styles.lessonTitle} numberOfLines={2}>{lesson.title}</Text>
                      <Text style={styles.muted}>{lessonLabel(lesson)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flexText: { flex: 1, minWidth: 0 },
  centerFill: { flex: 1, justifyContent: 'center' },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: ELEARNING_GUTTER, gap: 16 },
  error: { color: colors.destructiveText, backgroundColor: colors.destructiveSurface, borderRadius: 12, overflow: 'hidden', padding: 12 },
  cover: { borderRadius: 16 },
  heading: { gap: 6 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', lineHeight: 28 },
  subtitle: { color: colors.secondaryText, fontSize: 15, lineHeight: 21 },
  muted: { flexShrink: 1, color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  mutedBody: { color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  notice: { padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, backgroundColor: colors.warningSurface },
  noticeText: { color: colors.warningText, fontSize: 13, lineHeight: 19 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minWidth: 0, minHeight: 72, paddingHorizontal: 4, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  tileText: { color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  tileMeta: { color: colors.mutedText, fontSize: 11 },
  linkButton: { minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, marginTop: -6 },
  linkText: { color: colors.accentText, fontSize: 14, fontWeight: '700' },
  card: { padding: 16, gap: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  section: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 2 },
  sectionGap: { marginTop: 10 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 4 },
  body: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.control, color: colors.secondaryText, fontSize: 12, fontWeight: '600' },
  lockedCard: { padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  moduleCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' },
  moduleHead: { padding: 14, gap: 4, backgroundColor: colors.control },
  eyebrow: { color: colors.mutedText, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  moduleTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  lessonPad: { padding: 14 },
  lessonRow: { minHeight: 56, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  lessonTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
