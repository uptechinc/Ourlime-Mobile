import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clock } from 'lucide-react-native';
import { describeAppliedPenalty } from '@/lib/services/AssignmentPolicy';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { AppliedLatePenalty } from '@/lib/types/course';

type GradeBreakdownProps = {
  score: number;
  maxScore?: number;
  rawScore?: number;
  latePenalty?: AppliedLatePenalty | null;
  feedback?: string;
};

/** The published grade: the final score, and when a late penalty applied (or was waived), the score before it. */
export default function GradeBreakdown({ score, maxScore, rawScore, latePenalty, feedback }: GradeBreakdownProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const penaltyText = describeAppliedPenalty(latePenalty);
  const percent = maxScore && maxScore > 0 ? Math.round((score / maxScore) * 100) : null;
  return (
    <View style={styles.wrapper}>
      <View accessible accessibilityLabel={`Score ${score}${maxScore ? ` out of ${maxScore}` : ''}${percent !== null ? `, ${percent} percent` : ''}`} style={styles.scoreRow}>
        <Text style={styles.score}>{score}{maxScore ? <Text style={styles.max}> / {maxScore}</Text> : null}</Text>
        {percent !== null ? <Text style={styles.percent}>{percent}%</Text> : null}
      </View>
      {penaltyText ? (
        <View style={styles.penalty}>
          <Clock size={14} color={colors.warningText} />
          <Text style={styles.penaltyText}>
            {penaltyText}{rawScore !== undefined && latePenalty && latePenalty.points > 0 ? ` · ${rawScore} before the penalty` : ''}
          </Text>
        </View>
      ) : null}
      {feedback ? (
        <View style={styles.feedback}>
          <Text style={styles.feedbackLabel}>Instructor feedback</Text>
          <Text style={styles.body}>{feedback}</Text>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  score: { color: colors.text, fontSize: 30, fontWeight: '900' },
  max: { color: colors.secondaryText, fontSize: 18, fontWeight: '700' },
  percent: { color: colors.mutedText, fontSize: 15, fontWeight: '700' },
  penalty: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.warningSurface },
  penaltyText: { flexShrink: 1, color: colors.warningText, fontSize: 13, fontWeight: '700' },
  feedback: { padding: 12, gap: 4, borderRadius: 12, backgroundColor: colors.control },
  feedbackLabel: { color: colors.mutedText, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
});
