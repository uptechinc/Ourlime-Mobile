import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertCircle, Calendar, CheckCircle2, Clock, Download, FileText } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { courseService } from '@/lib/services/CourseService';
import { describeLatePolicy, describeResubmission, NO_LATE_PENALTY, NO_RESUBMISSION } from '@/lib/services/AssignmentPolicy';
import type { CourseLesson } from '@/lib/types/course';
import { formatDate, formatFileSize, openCourseFile } from './workspaceHelpers';

type AssignmentDetailsProps = {
  lesson: CourseLesson;
  isSubmitted: boolean;
  /** Called when a reference file cannot be opened on this device. */
  onOpenError?: () => void;
};

type AssignmentState = { label: 'Submitted' | 'Not submitted' | 'Late' | 'Missing'; tone: 'success' | 'neutral' | 'warning' | 'danger' };

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Due today", "Due tomorrow", "Due in 3 days", "1 day late"; null without a due date. */
export const dueCountdown = (dueDate: string | undefined, now = Date.now()): string | null => {
  const due = dueDate ? Date.parse(dueDate) : NaN;
  if (!Number.isFinite(due)) return null;
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const startOfDueDay = new Date(due).setHours(0, 0, 0, 0);
  const days = Math.round((startOfDueDay - startOfToday) / DAY_MS);
  if (due < now) {
    const late = Math.max(1, -days);
    return days >= 0 ? 'Due date passed today' : `${late} ${late === 1 ? 'day' : 'days'} late`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
};

/**
 * Points, due date with a countdown, the submission state as text (Submitted, Not submitted, Late when late work is
 * accepted, Missing when it is not) and reference files (web assignment/[assignmentId] header). Missing clears as soon
 * as the work is submitted; the grade itself shows in the submission card.
 */
export default function AssignmentDetails({ lesson, isSubmitted, onOpenError }: AssignmentDetailsProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isPastDue = courseService.isOverdue(lesson, false);
  const attachments = lesson.attachments ?? [];
  const countdown = dueCountdown(lesson.dueDate);
  const state: AssignmentState = isSubmitted
    ? { label: 'Submitted', tone: 'success' }
    : isPastDue ? (lesson.allowLateSubmission ? { label: 'Late', tone: 'warning' } : { label: 'Missing', tone: 'danger' })
    : { label: 'Not submitted', tone: 'neutral' };
  const toneColors = {
    success: { background: colors.successSurface, text: colors.successText },
    neutral: { background: colors.control, text: colors.secondaryText },
    warning: { background: colors.warningSurface, text: colors.warningText },
    danger: { background: colors.destructiveSurface, text: colors.destructiveText },
  }[state.tone];
  const StateIcon = state.tone === 'success' ? CheckCircle2 : state.tone === 'neutral' ? Clock : AlertCircle;
  const resubmissionLine = describeResubmission(lesson.resubmission ?? NO_RESUBMISSION);

  const handleOpen = async (index: number, url: string) => {
    if (!(await openCourseFile({ kind: 'lesson_attachment', lessonId: lesson.id, index }, url))) onOpenError?.();
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.statePill, { backgroundColor: toneColors.background }]}>
          <StateIcon size={14} color={toneColors.text} />
          <Text style={[styles.stateText, { color: toneColors.text }]}>{state.label}</Text>
        </View>
        <View style={styles.inline}>
          <FileText size={14} color={colors.mutedText} />
          <Text style={styles.meta}>{lesson.points ?? 0} points</Text>
        </View>
      </View>
      <View style={styles.inline}>
        <Calendar size={15} color={colors.mutedText} />
        <Text style={styles.meta}>Due {formatDate(lesson.dueDate)}</Text>
        {countdown && !isSubmitted ? <Text style={[styles.countdown, isPastDue && { color: toneColors.text }]}>· {countdown}</Text> : null}
      </View>
      {/* The late policy as the server enforces it: no penalty is mentioned unless the assignment defines one. */}
      {lesson.dueDate ? (
        <Text style={[styles.meta, isPastDue && !isSubmitted ? { color: toneColors.text } : null]}>
          {isPastDue && !isSubmitted && !lesson.allowLateSubmission ? 'The due date has passed and this assignment no longer accepts work.' : describeLatePolicy(lesson.allowLateSubmission === true, lesson.latePenalty ?? NO_LATE_PENALTY)}
        </Text>
      ) : null}
      {resubmissionLine ? <Text style={styles.meta}>{resubmissionLine}</Text> : null}
      {lesson.rubric ? <Text style={styles.meta}>Graded with a rubric ({lesson.rubric.criteria.length} {lesson.rubric.criteria.length === 1 ? 'criterion' : 'criteria'}), shown below.</Text> : null}
      {attachments.length > 0 ? (
        <View style={styles.files}>
          <Text style={styles.label}>Reference files</Text>
          {attachments.map((file, index) => (
            <Pressable key={file.url} accessibilityRole="link" accessibilityLabel={`Open ${file.name}`} onPress={() => void handleOpen(index, file.url)} android_ripple={{ color: colors.control }} style={styles.fileRow}>
              <Download size={16} color={colors.accentText} />
              <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
              {file.size ? <Text style={styles.meta}>{formatFileSize(file.size)}</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { padding: 16, gap: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  statePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  stateText: { fontSize: 13, fontWeight: '800' },
  meta: { color: colors.mutedText, fontSize: 13, lineHeight: 19, flexShrink: 1 },
  countdown: { color: colors.text, fontSize: 13, fontWeight: '700' },
  files: { gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  label: { color: colors.mutedText, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  fileRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.canvas, overflow: 'hidden' },
  fileName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
});
