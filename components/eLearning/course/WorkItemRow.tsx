import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertCircle, Calendar, CheckCircle2, ChevronRight } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { CourseLesson } from '@/lib/types/course';
import LessonTypeIcon from './LessonTypeIcon';
import { formatDate } from './workspaceHelpers';

type WorkItemRowProps = {
  lesson: CourseLesson;
  isDone: boolean;
  isOverdue: boolean;
  /** Status pill text, e.g. "Submitted" / "Not submitted" or "Completed" / "Not started". */
  statusLabel: string;
  /** Extra line under the meta row, e.g. a grade. */
  detail?: string;
  onPress: () => void;
};

/** One quiz or assignment with its due date, points, overdue flag and status (web quizzes/assignments pages). */
export default function WorkItemRow({ lesson, isDone, isOverdue, statusLabel, detail, onPress }: WorkItemRowProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${lesson.title}, ${statusLabel}`} onPress={onPress} style={styles.card}>
      <View style={[styles.icon, { backgroundColor: isDone ? colors.successSurface : colors.control }]}>
        {isDone ? <CheckCircle2 size={22} color="#16a34a" /> : <LessonTypeIcon type={lesson.type} size={22} />}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>{lesson.title}</Text>
        <View style={styles.metaRow}>
          <Calendar size={12} color={colors.mutedText} />
          <Text style={styles.meta}>Due: {formatDate(lesson.dueDate)}</Text>
          <Text style={styles.meta}>· {lesson.points ?? 0} pts</Text>
        </View>
        {isOverdue ? (
          <View style={styles.metaRow}><AlertCircle size={12} color={colors.destructiveText} /><Text style={styles.overdue}>Overdue</Text></View>
        ) : null}
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      <View style={styles.side}>
        <View style={[styles.pill, { backgroundColor: isDone ? colors.successSurface : colors.control }]}>
          <Text style={[styles.pillText, { color: isDone ? colors.successText : colors.mutedText }]}>{statusLabel}</Text>
        </View>
        <ChevronRight size={18} color={colors.mutedText} />
      </View>
    </Pressable>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  title: { color: colors.text, fontSize: 15, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  meta: { color: colors.mutedText, fontSize: 12 },
  overdue: { color: colors.destructiveText, fontSize: 12, fontWeight: '800' },
  detail: { color: colors.accentText, fontSize: 12, fontWeight: '700' },
  side: { alignItems: 'flex-end', gap: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.4 },
});
