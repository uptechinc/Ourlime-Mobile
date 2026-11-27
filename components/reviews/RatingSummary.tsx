import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Star, ThumbsUp } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { RATING_STAR_COLOR, RatingStars, describeStars } from './RatingStars';
import { SERVICE_REVIEW_CRITERIA, SERVICE_REVIEW_CRITERIA_LABELS, type RatingDistribution, type ServiceRatingAggregate } from '@/lib/types/ratings';

const DESCENDING = ['5', '4', '3', '2', '1'] as const;

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

type RatingOverviewProps = {
  average: number;
  count: number;
  /** null when only the average and count are known (e.g. the directory's figures while reviews cannot load). */
  distribution: RatingDistribution | null;
  /** Shown under the big number, e.g. "ratings" for products and services. */
  unit?: string;
  /** What the bars are shares of, when the distribution counts fewer reviews than count (Market's loaded reviews). */
  distributionTotal?: number;
};

/**
 * The big average with its stars and count, beside the 5 to 1 star bars. Used for E-Hub services, E-Hub products and
 * Market products so the three read the same.
 */
export function RatingOverview({ average, count, distribution, unit = 'rating', distributionTotal }: RatingOverviewProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!distribution) {
    return <View accessible accessibilityLabel={`Average ${describeStars(average)} from ${pluralize(count, unit)}`} style={styles.compact}>
      <Text style={styles.averageValue}>{average.toFixed(1)}</Text>
      <View style={styles.compactText}>
        <RatingStars value={average} size={16} />
        <Text style={styles.averageCount}>{pluralize(count, unit)}</Text>
      </View>
    </View>;
  }
  return <View style={styles.overview}>
    <View accessible accessibilityLabel={`Average ${describeStars(average)} from ${pluralize(count, unit)}`} style={styles.average}>
      <Text style={styles.averageValue}>{average.toFixed(1)}</Text>
      <RatingStars value={average} size={14} />
      <Text style={styles.averageCount}>{pluralize(count, unit)}</Text>
    </View>
    <View style={styles.bars}>
      {DESCENDING.map((star) => {
        const starCount = distribution[star];
        const total = distributionTotal ?? count;
        const share = total > 0 ? starCount / total : 0;
        return <View key={star} accessible accessibilityLabel={`${star} stars: ${pluralize(starCount, unit)}, ${Math.round(share * 100)} percent`} style={styles.barRow}>
          <Text style={styles.barLabel}>{star}</Text>
          <Star size={11} color={RATING_STAR_COLOR} fill={RATING_STAR_COLOR} />
          <View style={styles.track}><View style={[styles.fillBar, { width: `${share * 100}%` }]} /></View>
          <Text style={styles.barCount}>{starCount}</Text>
        </View>;
      })}
    </View>
  </View>;
}

type CriteriaBreakdownProps = { criteria: ServiceRatingAggregate['criteria'] };

/** The average for each service criterion someone rated, as a labelled bar out of 5. Unrated criteria are left out. */
export function CriteriaBreakdown({ criteria }: CriteriaBreakdownProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const rated = SERVICE_REVIEW_CRITERIA.filter((key) => criteria[key].count > 0);
  if (!rated.length) return null;
  return <View style={styles.criteria}>
    {rated.map((key) => {
      const { average, count } = criteria[key];
      return <View key={key} accessible accessibilityLabel={`${SERVICE_REVIEW_CRITERIA_LABELS[key]}: ${describeStars(average)} from ${pluralize(count, 'rating')}`} style={styles.criterionRow}>
        <Text numberOfLines={2} style={styles.criterionLabel}>{SERVICE_REVIEW_CRITERIA_LABELS[key]}</Text>
        <View style={styles.criterionTrack}><View style={[styles.criterionFill, { width: `${(average / 5) * 100}%` }]} /></View>
        <Text style={styles.criterionValue}>{average.toFixed(1)}</Text>
        <Text style={styles.criterionCount}>({count})</Text>
      </View>;
    })}
  </View>;
}

/** "86% would recommend", shown when anyone answered the question. */
export function RecommendBadge({ percent }: { percent: number }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.recommend}>
    <ThumbsUp size={15} color={colors.successText} />
    <Text style={styles.recommendText}><Text style={styles.recommendStrong}>{percent}%</Text> would recommend</Text>
  </View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  overview: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  compact: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  compactText: { gap: 3, alignItems: 'flex-start' },
  average: { width: 96, alignItems: 'center', gap: 4 },
  averageValue: { color: colors.text, fontSize: 40, lineHeight: 44, fontWeight: '900' },
  averageCount: { color: colors.mutedText, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  bars: { flex: 1, minWidth: 0, gap: 5 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  barLabel: { width: 9, color: colors.secondaryText, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  track: { flex: 1, height: 8, marginLeft: 3, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.control },
  fillBar: { height: '100%', borderRadius: 4, backgroundColor: RATING_STAR_COLOR },
  barCount: { minWidth: 22, color: colors.mutedText, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  criteria: { gap: 9 },
  criterionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  criterionLabel: { width: '40%', color: colors.secondaryText, fontSize: 13, lineHeight: 17, fontWeight: '700' },
  criterionValue: { minWidth: 26, color: colors.text, fontSize: 13, fontWeight: '900', textAlign: 'right' },
  criterionCount: { minWidth: 26, color: colors.mutedText, fontSize: 12, fontWeight: '600' },
  criterionTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.control },
  criterionFill: { height: '100%', borderRadius: 3, backgroundColor: colors.accent },
  recommend: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.successSurface },
  recommendText: { color: colors.successText, fontSize: 13, fontWeight: '600' },
  recommendStrong: { fontWeight: '900' },
});
