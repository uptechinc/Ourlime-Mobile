import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FileText } from 'lucide-react-native';
import { StatusPill, formatWhen } from '@/components/eLearning/ELearningParts';
import { openCourseFile } from '@/components/eLearning/course/workspaceHelpers';
import { APPEAL_STATUS_LABELS, describeAppliedPenalty, gradeEventLabel } from '@/lib/services/AssignmentPolicy';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { SubmissionHistory } from '@/lib/types/course';

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

type SubmissionHistoryListProps = {
  history: SubmissionHistory;
  /** The current version, shown first and not repeated with its files (the screen already shows it). */
  currentVersion?: number;
  onOpenError?: () => void;
};

/** Every hand-in version with its published grades and review outcome, newest first (the grade history is never lost). */
export default function SubmissionHistoryList({ history, currentVersion, onOpenError }: SubmissionHistoryListProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (history.versions.length === 0 && history.grades.length === 0) return <Text style={styles.muted}>No earlier versions or grades yet.</Text>;

  return (
    <View style={styles.list}>
      {history.versions.map((version) => {
        const grades = history.grades.filter((grade) => grade.version === version.version);
        const appeal = history.appeals.find((entry) => entry.version === version.version);
        const isCurrent = version.version === currentVersion;
        return (
          <View key={version.id} style={styles.version}>
            <View style={styles.row}>
              <Text style={styles.versionTitle}>Version {version.version}{isCurrent ? ' (current)' : ''}</Text>
              <StatusPill label={version.status === 'graded' && version.score !== null ? `Graded · ${version.score}${version.maxScore ? `/${version.maxScore}` : ''}` : 'Handed in'} tone={version.status === 'graded' ? 'success' : 'neutral'} />
            </View>
            <Text style={styles.muted}>
              {version.submittedAt ? `Handed in ${formatWhen(version.submittedAt)}` : 'Handed in'}{version.isLate ? ` · late by ${version.lateDays} ${version.lateDays === 1 ? 'day' : 'days'}` : ''}
            </Text>
            {!isCurrent && version.textResponse ? <Text numberOfLines={4} style={styles.body}>{version.textResponse}</Text> : null}
            {!isCurrent ? version.files.map((file, index) => (
              <Pressable
                key={`${file.url}-${index}`}
                accessibilityRole="link"
                accessibilityLabel={`Open ${file.name} from version ${version.version}`}
                onPress={() => void openCourseFile({ kind: 'submission_file', submissionId: history.submissionId, index, version: version.version }, file.url).then((opened) => { if (!opened) onOpenError?.(); })}
                android_ripple={RIPPLE}
                style={styles.fileRow}
              >
                <FileText size={16} color={colors.accentText} />
                <Text numberOfLines={1} style={styles.fileName}>{file.name}</Text>
              </Pressable>
            )) : null}
            {grades.map((grade) => (
              <View key={grade.id} style={styles.event}>
                <Text style={styles.eventTitle}>{gradeEventLabel(grade.event)} · {grade.score}/{grade.maxScore}{grade.createdAt ? ` · ${formatWhen(grade.createdAt)}` : ''}</Text>
                {describeAppliedPenalty(grade.latePenalty) ? <Text style={styles.muted}>{describeAppliedPenalty(grade.latePenalty)}</Text> : null}
                {grade.note ? <Text style={styles.body}>Note: {grade.note}</Text> : null}
              </View>
            ))}
            {appeal ? (
              <View style={styles.event}>
                <Text style={styles.eventTitle}>{APPEAL_STATUS_LABELS[appeal.status]}{appeal.resultScore !== null && appeal.status === 'adjusted' ? ` · now ${appeal.resultScore}/${appeal.maxScore}` : ''}</Text>
                {appeal.reason ? <Text style={styles.muted}>Reason: {appeal.reason}</Text> : null}
                {appeal.responseNote ? <Text style={styles.body}>Response: {appeal.responseNote}</Text> : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  list: { gap: 10 },
  version: { padding: 12, gap: 6, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.canvas },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  versionTitle: { flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  body: { color: colors.text, fontSize: 13, lineHeight: 19 },
  event: { gap: 2, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  eventTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  fileRow: { minHeight: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  fileName: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600' },
});
