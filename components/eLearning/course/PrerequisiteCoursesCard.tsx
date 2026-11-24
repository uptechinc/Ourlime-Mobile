import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { CheckCircle2, Circle, Lock } from 'lucide-react-native';
import { prerequisiteBlockMessage } from '@/lib/services/LearningDepthRules';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { PrerequisiteLink, PrerequisiteStatus } from '@/lib/types/course';

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

type PrerequisiteCoursesCardProps = { links: PrerequisiteLink[]; status: PrerequisiteStatus | null };

/**
 * The courses this one builds on. Required ones block enrollment until completed (the server refuses it too);
 * recommended ones are advice only. Each opens its course; the learner sees which ones they already completed.
 */
export default function PrerequisiteCoursesCard({ links, status }: PrerequisiteCoursesCardProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (links.length === 0) return null;
  const completed = new Set((status?.links ?? []).filter((link) => link.completed).map((link) => link.courseId));
  const blockMessage = prerequisiteBlockMessage(status?.missingRequired ?? []);
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>Courses to take first</Text>
      {blockMessage ? (
        <View style={styles.block}><Lock size={16} color={colors.warningText} /><Text style={styles.blockText}>{blockMessage}</Text></View>
      ) : null}
      {links.map((link) => {
        const isDone = completed.has(link.courseId);
        const label = isDone ? 'Completed' : link.required ? 'Required' : 'Recommended';
        return (
          <Pressable
            key={link.courseId}
            accessibilityRole="link"
            accessibilityLabel={`${link.title}, ${label}`}
            android_ripple={RIPPLE}
            onPress={() => router.push(`/eLearning/courses/${encodeURIComponent(link.courseId)}` as Href)}
            style={styles.row}
          >
            {isDone ? <CheckCircle2 size={18} color={colors.successText} /> : <Circle size={18} color={colors.mutedText} />}
            <Text style={styles.rowTitle} numberOfLines={2}>{link.title}</Text>
            <Text style={[styles.pill, link.required && !isDone ? styles.pillRequired : null]}>{label}</Text>
          </Pressable>
        );
      })}
      <Text style={styles.muted}>Required courses must be completed before you enroll. Recommended ones are advice only.</Text>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { padding: 16, gap: 8, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  block: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 10, borderRadius: 12, backgroundColor: colors.warningSurface },
  blockText: { flex: 1, color: colors.warningText, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  rowTitle: { flex: 1, minWidth: 0, color: colors.text, fontSize: 14, fontWeight: '700' },
  pill: { color: colors.secondaryText, fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.control, overflow: 'hidden' },
  pillRequired: { color: colors.surface, backgroundColor: colors.text },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
});
