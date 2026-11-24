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
import { ELEARNING_ACTION_GREEN, ProgressBar } from '@/components/eLearning/ELearningParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { courseService } from '@/lib/services/CourseService';
import type { AssignmentSubmission, Course, CourseModule, Enrollment } from '@/lib/types/course';
import LessonTypeIcon from './LessonTypeIcon';
import { courseHref, formatDate, lessonHref, lessonTypeLabel, openCourseFile } from './workspaceHelpers';

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

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
  const step = courseService.nextStep(modules, enrollment, submissions);
  const completion = courseService.completion(modules, enrollment, submissions);
  const breakdown = [
    completion.lessons.total > 0 ? `${completion.lessons.done}/${completion.lessons.total} lessons` : null,
    completion.quizzes.total > 0 ? `${completion.quizzes.done}/${completion.quizzes.total} quizzes` : null,
    completion.assignments.total > 0 ? `${completion.assignments.done}/${completion.assignments.total} assignments` : null,
  ].filter(Boolean).join(' · ');
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

  // One icon colour (the theme's) so the tiles read the same in light and dark mode; the label carries the meaning.
  const navItems = [
    { key: 'modules', label: 'Modules', icon: <BookOpen size={18} color={colors.accentText} />, onPress: () => router.push(courseHref(course.id, 'modules')) },
    { key: 'assignments', label: 'Assignments', icon: <ClipboardList size={18} color={colors.accentText} />, onPress: () => router.push(courseHref(course.id, 'assignments')) },
    { key: 'quizzes', label: 'Quizzes', icon: <HelpCircle size={18} color={colors.accentText} />, onPress: () => router.push(courseHref(course.id, 'quizzes')) },
    { key: 'grades', label: 'Grades', icon: <BarChart2 size={18} color={colors.accentText} />, onPress: () => router.push(courseHref(course.id, 'grades')) },
    { key: 'discussions', label: 'Discussions', icon: <MessageSquare size={18} color={colors.accentText} />, onPress: () => router.push(courseHref(course.id, 'discussions')) },
  ];

  const handleOpenResource = async (resourceId: string, url: string) => {
    if (!(await openCourseFile({ kind: 'resource', resourceId }, url))) onOpenError();
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <View style={styles.progressHeader}>
          <Text accessibilityRole="header" style={styles.welcome}>Your progress</Text>
          <Text style={styles.progressValue}>{progress}%</Text>
        </View>
        <ProgressBar value={progress} height={8} accessibilityLabel={`${course.title} progress`} />
        <Text style={styles.muted}>
          {completion.all.total === 0 ? 'No lessons are available to you yet.' : `${completion.all.done} of ${completion.all.total} done${breakdown ? ` · ${breakdown}` : ''}`}
        </Text>
        <View style={styles.navGrid}>
          {navItems.map((item) => (
            <Pressable key={item.key} accessibilityRole="button" onPress={item.onPress} android_ripple={RIPPLE} style={styles.navItem}>
              {item.icon}
              <Text style={styles.navText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {step.kind === 'overdue' || step.kind === 'lesson' ? (
        <View style={[styles.card, styles.noPadding]}>
          <View style={[styles.nextHeader, step.kind === 'overdue' && { backgroundColor: colors.destructiveSurface }]}>
            <Text style={[styles.nextHeaderText, step.kind === 'overdue' && { color: colors.destructiveText }]}>{step.kind === 'overdue' ? 'Overdue' : 'Next up'}</Text>
            {step.kind === 'overdue' ? <AlertCircle size={16} color={colors.destructiveText} /> : <Clock size={16} color="#ffffff" />}
          </View>
          <View style={styles.nextBody}>
            <View style={styles.nextIcon}><LessonTypeIcon type={step.lesson.type} size={24} /></View>
            <View style={styles.flex}>
              <Text style={styles.muted}>{step.moduleTitle} · {lessonTypeLabel(step.lesson.type)}</Text>
              <Text style={styles.cardTitle}>{step.lesson.title}</Text>
              {step.kind === 'overdue' && step.lesson.dueDate ? (
                <Text style={[styles.small, styles.overdueText]}>Was due {formatDate(step.lesson.dueDate)}{step.lesson.type === 'assignment' ? (step.lesson.allowLateSubmission ? ' · late hand-ins accepted' : ' · ask your instructor about a late hand-in') : ''}</Text>
              ) : step.lesson.description ? <Text style={styles.muted} numberOfLines={2}>{step.lesson.description}</Text> : null}
              <Pressable accessibilityRole="button" onPress={() => router.push(lessonHref(course.id, step.lesson.id))} android_ripple={{ color: 'rgba(255,255,255,0.2)' }} style={styles.primaryButton}>
                <Text numberOfLines={1} style={styles.primaryButtonText}>{step.kind === 'overdue' ? 'Open it now' : progress > 0 ? 'Resume learning' : 'Start learning'}</Text>
                <ChevronRight size={16} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </View>
      ) : step.kind === 'empty' ? (
        <View style={[styles.card, styles.centerCard]}>
          <BookOpen size={32} color={colors.mutedText} />
          <Text style={styles.cardTitle}>Lessons are on the way</Text>
          <Text style={[styles.muted, styles.center]}>This course has no lessons available to you yet. They appear here as soon as the instructor publishes them.</Text>
        </View>
      ) : (
        <View style={[styles.card, styles.centerCard]}>
          <Award size={32} color={colors.accentText} />
          <Text style={styles.cardTitle}>You finished every lesson</Text>
          <Text style={[styles.muted, styles.center]}>Check your quiz scores and any feedback on your assignments. You can reopen any lesson to review it.</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push(courseHref(course.id, 'grades'))} style={styles.linkButton}>
            <Text style={styles.linkText}>See your grades and feedback</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.sectionHeader}><Calendar size={18} color={colors.icon} /><Text accessibilityRole="header" style={styles.cardTitle}>To do</Text></View>
        {todo.length === 0 ? <Text style={styles.empty}>Nothing due. You're all caught up.</Text> : todo.map((task) => {
          const isOverdue = courseService.isOverdue(task, false);
          const kind = task.type === 'assignment' ? 'Assignment' : 'Quiz';
          return (
            <Pressable key={task.id} accessibilityRole="button" accessibilityLabel={`${task.title}, ${kind}${task.dueDate ? `, due ${formatDate(task.dueDate)}` : ''}${isOverdue ? ', overdue' : ''}`} onPress={() => router.push(lessonHref(course.id, task.id))} android_ripple={RIPPLE} style={styles.listRow}>
              <View style={styles.smallIcon}>{task.type === 'assignment' ? <FileText size={18} color={colors.mutedText} /> : <HelpCircle size={18} color={colors.mutedText} />}</View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle} numberOfLines={2}>{task.title}</Text>
                <View style={styles.inline}>
                  {isOverdue ? <AlertCircle size={12} color={colors.destructiveText} /> : null}
                  <Text style={[styles.small, isOverdue && styles.overdueText]}>{kind}{task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ''}{isOverdue ? ' · overdue' : ''}</Text>
                </View>
              </View>
              <ChevronRight size={16} color={colors.mutedText} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}><TrendingUp size={18} color={colors.icon} /><Text accessibilityRole="header" style={styles.cardTitle}>Recently completed</Text></View>
        {recent.length === 0 ? <Text style={styles.empty}>Lessons you finish show up here.</Text> : recent.map((lesson) => (
          <Pressable key={lesson.id} accessibilityRole="button" onPress={() => router.push(lessonHref(course.id, lesson.id))} android_ripple={RIPPLE} style={styles.listRow}>
            <View style={[styles.smallIcon, { backgroundColor: colors.successSurface, borderColor: colors.successSurface }]}><CheckCircle2 size={16} color={colors.successText} /></View>
            <View style={styles.flex}>
              <Text style={styles.rowTitle} numberOfLines={2}>{lesson.title}</Text>
              <Text style={styles.small}>{lessonTypeLabel(lesson.type)} · completed</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}><FileText size={18} color={colors.icon} /><Text accessibilityRole="header" style={styles.cardTitle}>Helpful resources</Text></View>
        {resources.length === 0 ? <Text style={styles.empty}>No resources available yet.</Text> : resources.map((resource) => (
          <Pressable key={resource.id} accessibilityRole="link" onPress={() => void handleOpenResource(resource.id, resource.url)} android_ripple={RIPPLE} style={styles.listRow}>
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
  card: { padding: 16, gap: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  noPadding: { padding: 0, overflow: 'hidden', gap: 0 },
  centerCard: { alignItems: 'center', paddingVertical: 24 },
  center: { textAlign: 'center' },
  welcome: { color: colors.text, fontSize: 20, fontWeight: '800' },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  progressValue: { color: colors.accentText, fontSize: 14, fontWeight: '800' },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  navItem: { flexGrow: 1, flexBasis: '30%', minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.canvas, paddingHorizontal: 6, overflow: 'hidden' },
  navText: { color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  nextHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: ELEARNING_ACTION_GREEN },
  nextHeaderText: { color: '#ffffff', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  nextBody: { flexDirection: 'row', gap: 12, padding: 16 },
  nextIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface },
  flex: { flex: 1, minWidth: 0, gap: 3 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  primaryButton: { alignSelf: 'flex-start', minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, borderRadius: 12, backgroundColor: ELEARNING_ACTION_GREEN, marginTop: 8, overflow: 'hidden' },
  primaryButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  linkButton: { minHeight: 44, justifyContent: 'center' },
  linkText: { color: colors.accentText, fontSize: 14, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  listRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, overflow: 'hidden' },
  smallIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  small: { color: colors.mutedText, fontSize: 12 },
  overdueText: { color: colors.destructiveText, fontWeight: '700' },
});
