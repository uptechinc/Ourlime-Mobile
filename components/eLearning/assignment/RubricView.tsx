import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { AssignmentRubric, RubricScore } from '@/lib/types/course';

type RubricViewProps = {
  /** The assignment's current rubric (shown before handing in). */
  rubric?: AssignmentRubric;
  /** The published grade's scored criteria. They carry their own titles, so a later rubric edit never changes them. */
  scores?: RubricScore[];
  title?: string;
};

const points = (value: number): string => `${value} ${value === 1 ? 'pt' : 'pts'}`;

/**
 * A rubric, read-only. Before a grade: every criterion with its levels and points. After a grade: the level the grader
 * chose in each criterion (in words, not colour alone) with that criterion's feedback.
 */
export default function RubricView({ rubric, scores, title }: RubricViewProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scored = new Map((scores ?? []).map((score) => [score.criterionId, score]));
  const isScored = scored.size > 0;
  // A graded rubric is shown from what was graded; criteria the current rubric no longer has still appear.
  const criteria = isScored
    ? (scores ?? []).map((score) => ({ score, criterion: rubric?.criteria.find((entry) => entry.id === score.criterionId) }))
    : (rubric?.criteria ?? []).map((criterion) => ({ score: undefined, criterion }));
  if (criteria.length === 0) return null;
  const total = isScored ? (scores ?? []).reduce((sum, score) => sum + score.points, 0) : rubric?.totalPoints ?? 0;
  const maximum = isScored ? (scores ?? []).reduce((sum, score) => sum + score.maxPoints, 0) : rubric?.totalPoints ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text accessibilityRole="header" style={styles.title}>{title ?? (isScored ? 'Your rubric scores' : 'How this is graded')}</Text>
        <Text style={styles.total}>{isScored ? `${total} / ${maximum}` : points(maximum)}</Text>
      </View>
      {criteria.map(({ score, criterion }, index) => {
        const criterionTitle = score?.criterionTitle || criterion?.title || `Criterion ${index + 1}`;
        const criterionMax = score?.maxPoints ?? criterion?.maxPoints ?? 0;
        return (
          <View key={score?.criterionId ?? criterion?.id ?? index} style={styles.criterion}>
            <View style={styles.headerRow}>
              <Text style={styles.criterionTitle}>{criterionTitle}</Text>
              <Text style={styles.muted}>{score ? `${score.points} / ${criterionMax}` : `up to ${points(criterionMax)}`}</Text>
            </View>
            {criterion?.description && !score ? <Text style={styles.muted}>{criterion.description}</Text> : null}
            {score && !criterion ? (
              <View style={[styles.level, styles.levelChosen]}>
                <CheckCircle2 size={16} color={colors.successText} />
                <Text style={styles.levelTitle}>{score.levelTitle || 'Level'} · {points(score.points)}</Text>
              </View>
            ) : (criterion?.levels ?? []).map((level) => {
              const isChosen = score?.levelId === level.id;
              return (
                <View key={level.id} accessible accessibilityLabel={`${level.title}, ${points(level.points)}${isChosen ? ', the level you received' : ''}`} style={[styles.level, isChosen && styles.levelChosen]}>
                  {isChosen ? <CheckCircle2 size={16} color={colors.successText} /> : null}
                  <View style={styles.flexText}>
                    <Text style={styles.levelTitle}>{level.title} · {points(level.points)}{isChosen ? <Text style={styles.chosenLabel}>  Your level</Text> : null}</Text>
                    {level.description ? <Text style={styles.muted}>{level.description}</Text> : null}
                  </View>
                </View>
              );
            })}
            {score?.feedback ? <Text style={styles.feedback}>{score.feedback}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { padding: 16, gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '800' },
  total: { color: colors.text, fontSize: 15, fontWeight: '800' },
  criterion: { gap: 6, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  criterionTitle: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  level: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.canvas },
  levelChosen: { borderWidth: 1.5, borderColor: colors.successText, backgroundColor: colors.successSurface },
  levelTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  chosenLabel: { color: colors.successText, fontSize: 12, fontWeight: '800' },
  flexText: { flex: 1, minWidth: 0, gap: 2 },
  feedback: { padding: 10, borderRadius: 10, backgroundColor: colors.control, color: colors.text, fontSize: 14, lineHeight: 20 },
});
