import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BarChart3, TrendingDown } from 'lucide-react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProgressBar } from '@/components/eLearning/ELearningParts';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import type { CourseInsights } from '@/lib/types/instructor';

type CourseInsightsCardProps = {
  insights: CourseInsights | null;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
};

const RIPPLE = { color: 'rgba(15,23,42,0.12)' };

/**
 * Learner progress for the instructor's course: enrollments, how many finished, how far learners got lesson by lesson
 * and hand-ins waiting. The server computes the totals and holds back completion numbers while the course has too few
 * learners for them to stay anonymous; no learner is named here.
 */
export default function CourseInsightsCard({ insights, isLoading, hasError, onRetry }: CourseInsightsCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isLoading && !insights) {
    return (
      <View accessible accessibilityLabel="Loading learner progress" style={styles.card}>
        <Skeleton width="45%" height={16} borderRadius={8} />
        <Skeleton width="100%" height={56} borderRadius={12} />
        <Skeleton width="100%" height={40} borderRadius={12} />
      </View>
    );
  }
  if (hasError || !insights) {
    return (
      <View style={styles.card}>
        <Text style={styles.muted}>Learner progress could not load.</Text>
        <Pressable accessibilityRole="button" onPress={onRetry} android_ripple={RIPPLE} style={styles.retry}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const finished = insights.completed === null ? '—' : `${insights.completed}${insights.completionPercent !== null ? ` (${insights.completionPercent}%)` : ''}`;
  const stats = [
    { label: 'Enrolled', value: String(insights.enrollments) },
    { label: 'Finished', value: finished },
    { label: 'To grade', value: String(insights.submissionsWaiting) },
  ];
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <BarChart3 size={18} color={colors.icon} />
        <Text accessibilityRole="header" style={styles.title}>Learner progress</Text>
      </View>
      <View style={styles.stats}>
        {stats.map((stat) => (
          <View key={stat.label} accessible accessibilityLabel={`${stat.label}: ${stat.value}`} style={styles.stat}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>{stat.value}</Text>
            <Text numberOfLines={1} style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
      {insights.withheld ? (
        <Text style={styles.muted}>Completion and lesson-by-lesson numbers appear once {insights.minimumGroup} or more learners are taking this course, so no one learner's progress can be picked out.</Text>
      ) : insights.lessons.length === 0 ? (
        <Text style={styles.muted}>This course has no lessons yet.</Text>
      ) : (
        <>
          {insights.biggestDropOff ? (
            <View accessible style={styles.dropOff}>
              <TrendingDown size={16} color={colors.warningText} />
              <Text style={styles.dropOffText}>Most learners stop before “{insights.biggestDropOff.title}” ({insights.biggestDropOff.dropOff} did not finish it after the lesson before).</Text>
            </View>
          ) : null}
          {insights.lessons.map((lesson, index) => (
            <View key={lesson.lessonId} style={styles.lessonRow}>
              <View style={styles.lessonHead}>
                <Text numberOfLines={1} style={styles.lessonTitle}>{index + 1}. {lesson.title}</Text>
                <Text style={styles.lessonCount}>{lesson.completedCount ?? 0} of {insights.learners}</Text>
              </View>
              <ProgressBar value={lesson.completedPercent ?? 0} accessibilityLabel={`${lesson.title}: ${lesson.completedCount ?? 0} of ${insights.learners} learners finished`} />
            </View>
          ))}
        </>
      )}
      <Text style={styles.footnote}>Counts active and finished learners only.{insights.partial ? ' Lesson numbers cover the first 1,000 enrollments.' : ''}</Text>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { padding: 16, gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 16, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, minWidth: 0, padding: 10, gap: 2, borderRadius: 12, backgroundColor: colors.control },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.mutedText, fontSize: 12 },
  muted: { color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  dropOff: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 12, backgroundColor: colors.warningSurface },
  dropOffText: { flex: 1, color: colors.warningText, fontSize: 13, lineHeight: 18 },
  lessonRow: { gap: 6 },
  lessonHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  lessonTitle: { flex: 1, minWidth: 0, color: colors.text, fontSize: 14, fontWeight: '600' },
  lessonCount: { color: colors.mutedText, fontSize: 13 },
  footnote: { color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  retry: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  retryText: { color: colors.text, fontSize: 14, fontWeight: '700' },
});
