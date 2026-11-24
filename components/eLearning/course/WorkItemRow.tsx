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
    <Pressable accessibilityRole="button" accessibilityLabel={[lesson.title, statusLabel, lesson.dueDate ? `due ${formatDate(lesson.dueDate)}` : null, isOverdue ? 'overdue' : null, detail ?? null].filter(Boolean).join(', ')} onPress={onPress} android_ripple={{ color: colors.control }} style={styles.card}>
      <View style={[styles.icon, { backgroundColor: isDone ? colors.successSurface : colors.control }]}>
        {isDone ? <CheckCircle2 size={22} color={colors.successText} /> : <LessonTypeIcon type={lesson.type} size={22} />}
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={2}>{lesson.title}</Text>
        <View style={styles.metaRow}>
          {lesson.dueDate ? <><Calendar size={12} color={colors.mutedText} /><Text style={styles.meta}>Due {formatDate(lesson.dueDate)}</Text></> : null}
          {lesson.points !== undefined ? <Text style={styles.meta}>{lesson.dueDate ? '· ' : ''}{lesson.points} pts</Text> : null}
        </View>
        {isOverdue ? (
          <View style={styles.metaRow}><AlertCircle size={12} color={colors.destructiveText} /><Text style={styles.overdue}>Overdue</Text></View>
        ) : null}
        <View style={styles.statusRow}>
          <View style={[styles.pill, { backgroundColor: isDone ? colors.successSurface : colors.control }]}>
            <Text numberOfLines={1} style={[styles.pillText, { color: isDone ? colors.successText : colors.secondaryText }]}>{statusLabel}</Text>
          </View>
          {detail ? <Text numberOfLines={1} style={styles.detail}>{detail}</Text> : null}
        </View>
      </View>
      <ChevronRight size={18} color={colors.mutedText} />
    </Pressable>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  title: { color: colors.text, fontSize: 15, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  meta: { color: colors.mutedText, fontSize: 12 },
  overdue: { color: colors.destructiveText, fontSize: 12, fontWeight: '800' },
  detail: { color: colors.accentText, fontSize: 12, fontWeight: '700' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '800' },
});
