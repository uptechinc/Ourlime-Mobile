import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar, CheckCircle2, Clock, Download, FileText } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { courseService } from '@/lib/services/CourseService';
import type { CourseLesson } from '@/lib/types/course';
import { formatDate, formatFileSize, openExternalLink } from './workspaceHelpers';

type AssignmentDetailsProps = {
  lesson: CourseLesson;
  isSubmitted: boolean;
  /** Called when a reference file cannot be opened on this device. */
  onOpenError?: () => void;
};

/** Points, due date, overdue/late notes and reference files of an assignment (web assignment/[assignmentId] header). */
export default function AssignmentDetails({ lesson, isSubmitted, onOpenError }: AssignmentDetailsProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isPastDue = courseService.isOverdue(lesson, false);
  const isOverdue = isPastDue && !isSubmitted;
  const attachments = lesson.attachments ?? [];

  const handleOpen = async (url: string) => {
    if (!(await openExternalLink(url))) onOpenError?.();
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.pointsBadge}>
          <FileText size={14} color={colors.successText} />
          <Text style={styles.pointsText}>{lesson.points ?? 0} points</Text>
        </View>
        {isSubmitted ? (
          <View style={styles.inline}><CheckCircle2 size={15} color="#16a34a" /><Text style={styles.submitted}>Submitted</Text></View>
        ) : null}
      </View>
      <View style={styles.inline}>
        <Calendar size={15} color={colors.mutedText} />
        <Text style={styles.meta}>Due: {formatDate(lesson.dueDate)}</Text>
        {isOverdue ? <View style={styles.overdue}><Text style={styles.overdueText}>OVERDUE</Text></View> : null}
      </View>
      {isPastDue && !isSubmitted ? (
        <View style={styles.inline}>
          <Clock size={15} color={lesson.allowLateSubmission ? colors.warningText : colors.destructiveText} />
          <Text style={[styles.meta, { color: lesson.allowLateSubmission ? colors.warningText : colors.destructiveText }]}>
            {lesson.allowLateSubmission ? 'Late submission allowed' : 'The due date has passed. Check with your instructor before submitting.'}
          </Text>
        </View>
      ) : null}
      {attachments.length > 0 ? (
        <View style={styles.files}>
          <Text style={styles.label}>Reference files</Text>
          {attachments.map((file) => (
            <Pressable key={file.url} accessibilityRole="link" accessibilityLabel={`Open ${file.name}`} onPress={() => void handleOpen(file.url)} style={styles.fileRow}>
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
  card: { padding: 14, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.successSurface },
  pointsText: { color: colors.successText, fontSize: 13, fontWeight: '800' },
  submitted: { color: '#16a34a', fontSize: 13, fontWeight: '800' },
  meta: { color: colors.mutedText, fontSize: 13, flexShrink: 1 },
  overdue: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.destructiveSurface },
  overdueText: { color: colors.destructiveText, fontSize: 10, fontWeight: '900' },
  files: { gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  label: { color: colors.mutedText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  fileRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas },
  fileName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' },
});
