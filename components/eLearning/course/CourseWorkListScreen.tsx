import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ClipboardList, HelpCircle } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import { CourseWorkListSkeleton } from '@/components/eLearning/ELearningSkeletons';
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

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title={title} onBackPress={() => router.back()} />
      {loading ? (
        <ScrollView contentContainerStyle={styles.scroll}><CourseWorkListSkeleton /></ScrollView>
      ) : !workspace || !isActiveEnrollment(enrollment) ? (
        <WorkspaceScreenState message={error ?? `Enroll in this course to see its ${title.toLowerCase()}.`} actionLabel="Back to course" onAction={() => router.replace(courseHref(id))} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh(true)} tintColor={colors.accent} />}>
          <Text style={styles.title} numberOfLines={2}>{workspace.course.title}</Text>
          <Text style={styles.muted}>{pluralize(total, kind === 'quiz' ? 'quiz' : 'assignment', title.toLowerCase())} in total</Text>
          {total === 0 ? (
            <View style={styles.empty}>
              <Icon size={44} color={colors.border} />
              <Text style={styles.emptyTitle}>No {title.toLowerCase()} yet</Text>
              <Text style={styles.muted}>There are no {title.toLowerCase()} for this course at the moment.</Text>
            </View>
          ) : groups.map((group) => (
            <View key={group.module.id} style={styles.group}>
              <Text style={styles.groupTitle}>{group.module.title}</Text>
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
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' },
  muted: { color: colors.mutedText, fontSize: 13, textAlign: 'left' },
  group: { gap: 10 },
  groupTitle: { color: colors.mutedText, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 },
  empty: { alignItems: 'center', gap: 8, padding: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
});
