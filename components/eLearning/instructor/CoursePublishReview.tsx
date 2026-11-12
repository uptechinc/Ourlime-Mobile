import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

export type CourseChecklistItem = { label: string; done: boolean };
export type CourseSummaryRow = { label: string; value: string };

type CoursePublishReviewProps = {
  summary: CourseSummaryRow[];
  checklist: CourseChecklistItem[];
};

/** The website's Publish step: a course summary and the readiness checklist that must be complete before publishing. */
export default function CoursePublishReview({ summary, checklist }: CoursePublishReviewProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Text style={styles.heading}>Course summary</Text>
        {summary.map((row) => (
          <View key={row.label} style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{row.label}</Text>
            <Text style={styles.summaryValue} numberOfLines={2}>{row.value}</Text>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Readiness checklist</Text>
        {checklist.map((item) => (
          <View key={item.label} accessible accessibilityLabel={`${item.label}, ${item.done ? 'done' : 'not done'}`} style={styles.checkRow}>
            <View style={[styles.checkCircle, item.done && styles.checkCircleDone]}>{item.done ? <Check size={12} strokeWidth={3} color={colors.onAccent} /> : null}</View>
            <Text style={[styles.checkLabel, !item.done && styles.checkLabelMuted]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 12 },
  card: { padding: 14, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  heading: { color: colors.text, fontSize: 17, fontWeight: '900' },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryLabel: { width: 90, color: colors.mutedText, fontSize: 14 },
  summaryValue: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkCircle: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  checkCircleDone: { borderColor: colors.accent, backgroundColor: colors.accent },
  checkLabel: { flex: 1, color: colors.text, fontSize: 14 },
  checkLabelMuted: { color: colors.mutedText },
});
