import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Clock } from 'lucide-react-native';
import RubricGradingFields, { type RubricChoices } from '@/components/eLearning/instructor/RubricGradingFields';
import { ToggleRow } from '@/components/eLearning/instructor/InstructorForm';
import { applyLatePenalty, describeAppliedPenalty, isRubricComplete, NO_LATE_PENALTY, rubricRawScore } from '@/lib/services/AssignmentPolicy';
import type { RubricScoreInput } from '@/lib/services/TeachingWorkflowService';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { InstructorLesson, InstructorSubmission } from '@/lib/types/instructor';

/** What the grader has entered: a score (points-only grading) or rubric choices, and the late-penalty waiver. */
export type GradeEntry = { score: string; rubric: RubricChoices; waive: boolean };

export function gradeEntryFrom(submission: Pick<InstructorSubmission, 'score' | 'rawScore' | 'rubricScores' | 'latePenalty' | 'waiveLatePenalty'>): GradeEntry {
  const levels: { [criterionId: string]: string } = {};
  const feedback: { [criterionId: string]: string } = {};
  (submission.rubricScores ?? []).forEach((score) => { levels[score.criterionId] = score.levelId; if (score.feedback) feedback[score.criterionId] = score.feedback; });
  const raw = submission.rawScore ?? submission.score;
  return { score: raw !== undefined ? String(raw) : '', rubric: { levels, feedback }, waive: submission.waiveLatePenalty === true || submission.latePenalty?.waived === true };
}

/** The grade to send, or the problem to show. The score is the raw score; the server applies the late penalty. */
export function readGradeEntry(entry: GradeEntry, lesson: InstructorLesson | undefined, maximum: number):
  { ok: true; rawScore: number; score?: number; rubricScores?: RubricScoreInput[] } | { ok: false; error: string } {
  const rubric = lesson?.rubric;
  if (rubric) {
    if (!isRubricComplete(rubric, entry.rubric.levels)) return { ok: false, error: 'Pick a level for every rubric criterion.' };
    return {
      ok: true, rawScore: rubricRawScore(rubric, entry.rubric.levels),
      rubricScores: rubric.criteria.map((criterion) => ({ criterionId: criterion.id, levelId: entry.rubric.levels[criterion.id], feedback: entry.rubric.feedback[criterion.id] ?? '' })),
    };
  }
  const value = Number(entry.score);
  if (entry.score.trim() === '' || !Number.isFinite(value) || value < 0 || value > maximum) return { ok: false, error: `Enter a score from 0 to ${maximum}.` };
  return { ok: true, rawScore: value, score: value };
}

type GradeEntryFieldsProps = {
  lesson: InstructorLesson | undefined;
  maximum: number;
  lateDays: number;
  value: GradeEntry;
  onChange: (value: GradeEntry) => void;
  hasError?: boolean;
};

/** Score or rubric, then the late penalty (with a waiver) and the final score the learner will see. */
export default function GradeEntryFields({ lesson, maximum, lateDays, value, onChange, hasError }: GradeEntryFieldsProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const rubric = lesson?.rubric;
  const policy = lesson?.latePenalty ?? NO_LATE_PENALTY;
  const raw = rubric ? (isRubricComplete(rubric, value.rubric.levels) ? rubricRawScore(rubric, value.rubric.levels) : null)
    : value.score.trim() !== '' && Number.isFinite(Number(value.score)) ? Number(value.score) : null;
  const preview = raw !== null ? applyLatePenalty(raw, policy, lateDays, value.waive) : null;
  const hasPenalty = lateDays > 0 && policy.type !== 'none';

  return (
    <View style={styles.wrapper}>
      {rubric ? (
        <RubricGradingFields rubric={rubric} value={value.rubric} onChange={(choices) => onChange({ ...value, rubric: choices })} />
      ) : (
        <View style={styles.field}>
          <Text style={styles.label}>Score</Text>
          <View style={styles.scoreRow}>
            <TextInput accessibilityLabel={`Score out of ${maximum}`} value={value.score} onChangeText={(score) => onChange({ ...value, score })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedText} maxLength={7} style={[styles.input, styles.scoreInput, hasError ? styles.inputError : null]} />
            <Text style={styles.scoreMax}>/ {maximum}</Text>
          </View>
        </View>
      )}
      {hasPenalty ? (
        <View style={styles.penalty}>
          <View style={styles.row}>
            <Clock size={14} color={colors.warningText} />
            <Text style={styles.penaltyText}>{preview ? describeAppliedPenalty(preview.latePenalty) : `Handed in ${lateDays} ${lateDays === 1 ? 'day' : 'days'} late.`}</Text>
          </View>
          <ToggleRow label="Waive the late penalty" description="For an accommodation or an excused absence. Recorded in the grade history." value={value.waive} onChange={(waive) => onChange({ ...value, waive })} />
        </View>
      ) : lateDays > 0 ? <Text style={styles.muted}>Handed in {lateDays} {lateDays === 1 ? 'day' : 'days'} late; this assignment has no late penalty.</Text> : null}
      {preview ? (
        <Text accessibilityLiveRegion="polite" style={styles.final}>
          Learner sees: {preview.score} / {maximum}{maximum > 0 ? ` (${Math.round((preview.score / maximum) * 100)}%)` : ''}
        </Text>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 10 },
  field: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 16 },
  inputError: { borderColor: colors.destructiveText },
  scoreInput: { width: 104, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  scoreMax: { color: colors.secondaryText, fontSize: 16, fontWeight: '600' },
  penalty: { padding: 10, gap: 6, borderRadius: 12, backgroundColor: colors.warningSurface },
  penaltyText: { flex: 1, color: colors.warningText, fontSize: 13, fontWeight: '700' },
  final: { color: colors.text, fontSize: 15, fontWeight: '800' },
});
