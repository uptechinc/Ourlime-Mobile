import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  Award,
  BarChart2,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  HelpCircle,
  MessageSquare,
  TrendingUp,
} from 'lucide-react-native';
import CourseReviews from '@/components/eLearning/CourseReviews';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { courseService } from '@/lib/services/CourseService';
import type { AssignmentSubmission, Course, CourseModule, Enrollment } from '@/lib/types/course';
import LessonTypeIcon from './LessonTypeIcon';
import { courseHref, formatDate, lessonHref, openExternalLink } from './workspaceHelpers';

type StudentCourseDashboardProps = {
  course: Course;
  enrollment: Enrollment;
  modules: CourseModule[];
  submissions: Map<string, AssignmentSubmission>;
  currentUserId: string | null;
  onOpenError: () => void;
};

/** The enrolled learner's course home (web StudentCourseDashboard + CourseSidebar): progress, next up, to do, activity. */
export default function StudentCourseDashboard({ course, enrollment, modules, submissions, currentUserId, onOpenError }: StudentCourseDashboardProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const lessons = useMemo(() => courseService.flattenLessons(modules), [modules]);
  const completed = useMemo(() => new Set(enrollment.completedLessons ?? []), [enrollment.completedLessons]);
  const nextItem = courseService.nextLesson(modules, enrollment);
  const resources = modules.flatMap((courseModule) => courseModule.resources ?? []).slice(0, 3);
  const isWorkDone = (lessonId: string): boolean => completed.has(lessonId) || submissions.has(lessonId);
  const todo = lessons
    .filter((lesson) => (lesson.type === 'assignment' || lesson.type === 'quiz') && !isWorkDone(lesson.id))
    .sort((left, right) => (Date.parse(left.dueDate ?? '') || Number.MAX_SAFE_INTEGER) - (Date.parse(right.dueDate ?? '') || Number.MAX_SAFE_INTEGER))
    .slice(0, 5);
  const recent = (enrollment.completedLessons ?? []).slice(-3).reverse()
    .map((lessonId) => lessons.find((lesson) => lesson.id === lessonId))
    .filter((lesson): lesson is NonNullable<typeof lesson> => Boolean(lesson));
  const progress = Math.max(0, Math.min(100, Math.round(enrollment.progress)));

  const navItems = [
    { key: 'modules', label: 'Modules', icon: <BookOpen size={18} color={colors.accentText} />, onPress: () => router.push(courseHref(course.id, 'modules')) },
    { key: 'assignments', label: 'Assignments', icon: <ClipboardList size={18} color="#ea580c" />, onPress: () => router.push(courseHref(course.id, 'assignments')) },
    { key: 'quizzes', label: 'Quizzes', icon: <HelpCircle size={18} color="#9333ea" />, onPress: () => router.push(courseHref(course.id, 'quizzes')) },
    { key: 'grades', label: 'Grades', icon: <BarChart2 size={18} color="#2563eb" />, onPress: () => router.push(courseHref(course.id, 'grades')) },
    { key: 'discussions', label: 'Discussions', icon: <MessageSquare size={18} color="#7c3aed" />, onPress: () => router.push(courseHref(course.id, 'discussions')) },
  ];

  const handleOpenResource = async (url: string) => {
    if (!(await openExternalLink(url))) onOpenError();
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Text style={styles.welcome}>Welcome back!</Text>
        <Text style={styles.muted}>
          {lessons.length > 0 && !nextItem ? 'You’ve finished every lesson in this course.' : `You’ve completed ${progress}% of this course. Keep going!`}
        </Text>
        <View style={styles.progressHeader}>
          <Text style={styles.muted}>Progress</Text>
          <Text style={styles.progressValue}>{progress}%</Text>
        </View>
        <View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View>
        <View style={styles.navGrid}>
          {navItems.map((item) => (
            <Pressable key={item.key} accessibilityRole="button" onPress={item.onPress} style={styles.navItem}>
              {item.icon}
              <Text style={styles.navText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {nextItem ? (
        <View style={[styles.card, styles.noPadding]}>
          <View style={styles.nextHeader}>
            <Text style={styles.nextHeaderText}>NEXT UP</Text>
            <Clock size={16} color="#ffffff" />
          </View>
          <View style={styles.nextBody}>
            <View style={styles.nextIcon}><LessonTypeIcon type={nextItem.lesson.type} size={24} /></View>
            <View style={styles.flex}>
              <Text style={styles.muted}>{nextItem.moduleTitle}</Text>
              <Text style={styles.cardTitle}>{nextItem.lesson.title}</Text>
              {nextItem.lesson.description ? <Text style={styles.muted} numberOfLines={2}>{nextItem.lesson.description}</Text> : null}
              <Pressable accessibilityRole="button" onPress={() => router.push(lessonHref(course.id, nextItem.lesson.id))} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>{progress > 0 ? 'Resume Learning' : 'Start Learning'}</Text>
                <ChevronRight size={16} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </View>
      ) : lessons.length === 0 ? (
        <View style={[styles.card, styles.centerCard]}>
          <BookOpen size={32} color={colors.mutedText} />
          <Text style={styles.cardTitle}>Lessons are on the way</Text>
          <Text style={[styles.muted, styles.center]}>This course has no lessons available to you yet. Check back soon or read the course announcements.</Text>
        </View>
      ) : (
        <View style={[styles.card, styles.centerCard]}>
          <Award size={32} color="#eab308" />
          <Text style={styles.cardTitle}>Congratulations!</Text>
          <Text style={[styles.muted, styles.center]}>You’ve completed all the lessons in this course.</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push(courseHref(course.id, 'grades'))} style={styles.linkButton}>
            <Text style={styles.linkText}>View your final grade</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.sectionHeader}><Calendar size={18} color={colors.destructiveText} /><Text style={styles.cardTitle}>To Do</Text></View>
        {todo.length === 0 ? <Text style={styles.empty}>Nothing on your plate! Great job.</Text> : todo.map((task) => (
          <Pressable key={task.id} accessibilityRole="button" onPress={() => router.push(lessonHref(course.id, task.id))} style={styles.listRow}>
            <View style={styles.smallIcon}>{task.type === 'assignment' ? <FileText size={18} color={colors.mutedText} /> : <HelpCircle size={18} color={colors.mutedText} />}</View>
            <View style={styles.flex}>
              <Text style={styles.rowTitle} numberOfLines={1}>{task.title}</Text>
              <View style={styles.inline}>
                <AlertCircle size={12} color={courseService.isOverdue(task, false) ? colors.destructiveText : colors.mutedText} />
                <Text style={[styles.small, courseService.isOverdue(task, false) && { color: colors.destructiveText }]}>Due: {formatDate(task.dueDate)}</Text>
              </View>
            </View>
            <ChevronRight size={16} color={colors.mutedText} />
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}><TrendingUp size={18} color="#3b82f6" /><Text style={styles.cardTitle}>Recent Activity</Text></View>
        {recent.length === 0 ? <Text style={styles.empty}>No activity yet. Start your first lesson!</Text> : recent.map((lesson) => (
          <Pressable key={lesson.id} accessibilityRole="button" onPress={() => router.push(lessonHref(course.id, lesson.id))} style={styles.listRow}>
            <View style={[styles.smallIcon, { backgroundColor: colors.control }]}><CheckCircle2 size={16} color="#2563eb" /></View>
            <View style={styles.flex}>
              <Text style={styles.rowTitle} numberOfLines={1}>Completed: {lesson.title}</Text>
              <Text style={styles.small}>Recently</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}><FileText size={18} color="#f97316" /><Text style={styles.cardTitle}>Helpful Resources</Text></View>
        {resources.length === 0 ? <Text style={styles.empty}>No resources available yet.</Text> : resources.map((resource) => (
          <Pressable key={resource.id} accessibilityRole="link" onPress={() => void handleOpenResource(resource.url)} style={styles.listRow}>
            <FileText size={16} color={colors.accentText} />
            <Text style={[styles.rowTitle, styles.flex]} numberOfLines={1}>{resource.title}</Text>
            <ChevronRight size={16} color={colors.mutedText} />
          </Pressable>
        ))}
        {resources.length > 0 ? (
          <Pressable accessibilityRole="link" onPress={() => router.push(courseHref(course.id, 'modules'))} style={styles.linkButton}>
            <Text style={styles.linkText}>See all modules and resources</Text>
          </Pressable>
        ) : null}
      </View>

      <CourseReviews courseId={course.id} currentUserId={currentUserId} canReview />
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 14 },
  card: { padding: 16, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  noPadding: { padding: 0, overflow: 'hidden', gap: 0 },
  centerCard: { alignItems: 'center', paddingVertical: 24 },
  center: { textAlign: 'center' },
  welcome: { color: colors.text, fontSize: 20, fontWeight: '900' },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  progressValue: { color: colors.accentText, fontSize: 13, fontWeight: '800' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.control },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.accent },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  navItem: { flexGrow: 1, flexBasis: '30%', minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas, paddingHorizontal: 6 },
  navText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  nextHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#059669' },
  nextHeaderText: { color: '#ffffff', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  nextBody: { flexDirection: 'row', gap: 12, padding: 16 },
  nextIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface },
  flex: { flex: 1, gap: 3 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  primaryButton: { alignSelf: 'flex-start', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.accent, marginTop: 8 },
  primaryButtonText: { color: colors.onAccent, fontSize: 14, fontWeight: '800' },
  linkButton: { minHeight: 40, justifyContent: 'center' },
  linkText: { color: colors.accentText, fontSize: 14, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { color: colors.mutedText, fontSize: 13, fontStyle: 'italic' },
  listRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  small: { color: colors.mutedText, fontSize: 11 },
});
