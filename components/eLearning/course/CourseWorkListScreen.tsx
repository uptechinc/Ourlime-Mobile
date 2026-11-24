import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ClipboardList, HelpCircle } from 'lucide-react-native';
import { CourseWorkListSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { ELearningEmptyState, ELearningHeader, ELEARNING_GUTTER } from '@/components/eLearning/ELearningParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useCourseWorkspace } from '@/lib/hooks/useCourseWorkspace';
import { courseService, isActiveEnrollment } from '@/lib/services/CourseService';
import WorkItemRow from './WorkItemRow';
import WorkspaceScreenState from './WorkspaceScreenState';
import { courseHref, lessonHref, pluralize } from './workspaceHelpers';

type CourseWorkListScreenProps = { kind: 'quiz' | 'assignment' };

/** A course's quizzes or assignments grouped by module (web /eLearning/courses/[id]/quizzes and /assignments). */
export default function CourseWorkListScreen({ kind }: CourseWorkListScreenProps) {
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const id = typeof courseId === 'string' ? courseId : '';
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { workspace, loading, refreshing, error, refresh } = useCourseWorkspace(id);
  const enrollment = workspace?.enrollment ?? null;
  const completed = new Set(enrollment?.completedLessons ?? []);
  const groups = (workspace?.modules ?? [])
    .map((courseModule) => ({ module: courseModule, items: (courseModule.lessons ?? []).filter((lesson) => lesson.type === kind) }))
    .filter((group) => group.items.length > 0);
  const total = groups.reduce((count, group) => count + group.items.length, 0);
  const title = kind === 'quiz' ? 'Quizzes' : 'Assignments';
  const Icon = kind === 'quiz' ? HelpCircle : ClipboardList;
  const doneCount = groups.reduce((count, group) => count + group.items.filter((lesson) => completed.has(lesson.id) || (kind === 'assignment' && workspace?.submissions.has(lesson.id))).length, 0);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ELearningHeader title={title} subtitle={workspace?.course.title} onBack={() => router.back()} />
      {loading ? (
        <ScrollView contentContainerStyle={styles.scroll}><CourseWorkListSkeleton /></ScrollView>
      ) : !workspace || !isActiveEnrollment(enrollment) ? (
        <WorkspaceScreenState message={error ?? `Enroll in this course to see its ${title.toLowerCase()}.`} actionLabel="Back to course" onAction={() => router.replace(courseHref(id))} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.accent} />}>
          {total > 0 ? <Text style={styles.summary}>{pluralize(total, kind === 'quiz' ? 'quiz' : 'assignment', title.toLowerCase())} · {doneCount} {kind === 'quiz' ? 'completed' : 'submitted'}</Text> : null}
          {total === 0 ? (
            <ELearningEmptyState
              icon={<Icon size={40} color={colors.mutedText} />}
              title={`No ${title.toLowerCase()} yet`}
              hint={`This course has no ${title.toLowerCase()} at the moment.`}
              actionLabel="Back to course"
              onAction={() => router.back()}
            />
          ) : groups.map((group) => (
            <View key={group.module.id} style={styles.group}>
              <Text accessibilityRole="header" style={styles.groupTitle}>{group.module.title}</Text>
              {group.items.map((lesson) => {
                const submission = workspace.submissions.get(lesson.id);
                const isDone = completed.has(lesson.id) || (kind === 'assignment' && Boolean(submission));
                const statusLabel = kind === 'quiz'
                  ? (isDone ? 'Completed' : 'Not started')
                  : submission?.status === 'graded' ? 'Graded' : isDone ? 'Submitted' : 'Not submitted';
                const detail = submission?.status === 'graded' && submission.score !== undefined
                  ? `Grade: ${submission.score}${submission.maxScore ?? lesson.points ? ` / ${submission.maxScore ?? lesson.points}` : ''}`
                  : undefined;
                return (
                  <WorkItemRow
                    key={lesson.id}
                    lesson={lesson}
                    isDone={isDone}
                    isOverdue={courseService.isOverdue(lesson, isDone)}
                    statusLabel={statusLabel}
                    detail={detail}
                    onPress={() => router.push(lessonHref(id, lesson.id))}
                  />
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  scroll: { padding: ELEARNING_GUTTER, gap: 12, paddingBottom: 40 },
  summary: { color: colors.text, fontSize: 15, fontWeight: '700' },
  group: { gap: 10 },
  groupTitle: { color: colors.mutedText, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 },
});
