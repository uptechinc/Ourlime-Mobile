import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { ELEARNING_ACTION_GREEN } from '@/components/eLearning/ELearningParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

export type CourseChecklistItem = { label: string; done: boolean };
export type CourseSummaryRow = { label: string; value: string };

type CoursePublishReviewProps = {
  summary: CourseSummaryRow[];
  checklist: CourseChecklistItem[];
};

/** The website's Publish step: the readiness checklist (what is still missing first) and a summary of the course. */
export default function CoursePublishReview({ summary, checklist }: CoursePublishReviewProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const doneCount = checklist.filter((item) => item.done).length;
  const isReady = doneCount === checklist.length;
  return (
    <View style={styles.wrapper}>
      <View style={[styles.card, isReady ? styles.cardReady : null]}>
        <Text accessibilityRole="header" style={styles.heading}>{isReady ? 'Ready to publish' : 'Before you publish'}</Text>
        <Text style={styles.muted}>{doneCount} of {checklist.length} done{isReady ? '' : '. Go back to a step to finish the rest.'}</Text>
        {[...checklist].sort((left, right) => Number(left.done) - Number(right.done)).map((item) => (
          <View key={item.label} accessible accessibilityLabel={`${item.label}, ${item.done ? 'done' : 'not done'}`} style={styles.checkRow}>
            <View style={[styles.checkCircle, item.done ? styles.checkCircleDone : styles.checkCircleMissing]}>
              {item.done ? <Check size={13} strokeWidth={3} color="#ffffff" /> : <X size={13} strokeWidth={3} color={colors.destructiveText} />}
            </View>
            <Text style={[styles.checkLabel, !item.done && styles.checkLabelMissing]}>{item.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.heading}>Course summary</Text>
        {summary.map((row, index) => (
          <View key={row.label} style={[styles.summaryRow, index > 0 && styles.summaryDivider]}>
            <Text style={styles.summaryLabel}>{row.label}</Text>
            <Text style={styles.summaryValue} numberOfLines={3}>{row.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 16 },
  card: { padding: 16, gap: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  cardReady: { borderWidth: 1, borderColor: ELEARNING_ACTION_GREEN },
  heading: { color: colors.text, fontSize: 17, fontWeight: '800' },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 18, marginTop: -4 },
  summaryRow: { flexDirection: 'row', gap: 12, paddingTop: 2 },
  summaryDivider: { paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  summaryLabel: { width: 84, color: colors.mutedText, fontSize: 14 },
  summaryValue: { flex: 1, minWidth: 0, color: colors.text, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  checkRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkCircle: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  checkCircleDone: { backgroundColor: ELEARNING_ACTION_GREEN },
  checkCircleMissing: { backgroundColor: colors.destructiveSurface },
  checkLabel: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
  checkLabelMissing: { fontWeight: '700' },
});
