import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { CourseReviewsSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { courseService } from '@/lib/services/CourseService';
import { ELEARNING_ACTION_GREEN } from '@/components/eLearning/ELearningParts';
import type { CourseReview } from '@/lib/types/course';

type CourseReviewsProps = {
  courseId: string;
  currentUserId: string | null;
  /** Only enrolled learners can review (the server checks the enrollment too). */
  canReview: boolean;
};

const STARS = [1, 2, 3, 4, 5];

/** Course ratings and the "rate this course" form, like the website's course dashboard. */
export default function CourseReviews({ courseId, currentUserId, canReview }: CourseReviewsProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReviews(await courseService.getReviews(courseId));
    } catch (loadError: unknown) {
      console.error('[CourseReviews.load] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => { void load(); }, [load]);

  const averageRating = reviews.length ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0;
  const hasReviewed = Boolean(currentUserId && reviews.some((review) => review.userId === currentUserId));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await courseService.addReview(courseId, rating, comment);
      setComment('');
      await load();
    } catch (submitError: unknown) {
      const message = submitError instanceof Error ? submitError.message : '';
      setError(message.includes('already') ? 'You have already reviewed this course.' : 'Your review could not be submitted. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.heading}>Reviews{reviews.length ? ` · ${reviews.length}` : ''}</Text>

      {reviews.length > 0 ? (
        <View style={[styles.card, styles.summary]}>
          <View style={styles.summaryScore}>
            <Text style={styles.summaryValue}>{averageRating.toFixed(1)}</Text>
            <View style={styles.starRowSmall}>
              {STARS.map((value) => <Star key={value} size={12} color="#f59e0b" fill={value <= Math.round(averageRating) ? '#f59e0b' : 'transparent'} />)}
            </View>
            <Text style={styles.muted}>{reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</Text>
          </View>
          <View style={styles.breakdown}>
            {[...STARS].reverse().map((value) => {
              const count = reviews.filter((review) => Math.round(review.rating) === value).length;
              return (
                <View key={value} accessible accessibilityLabel={`${value} stars: ${count}`} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{value}</Text>
                  <View style={styles.breakdownTrack}><View style={[styles.breakdownFill, { width: `${Math.round((count / reviews.length) * 100)}%` }]} /></View>
                  <Text style={styles.breakdownCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {canReview && !hasReviewed && !isLoading ? (
        <View style={styles.card}>
          <Text style={styles.formTitle}>Rate this course</Text>
          <View style={styles.starRow} accessibilityRole="radiogroup" accessibilityLabel="Rating">
            {STARS.map((value) => (
              <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`} accessibilityState={{ checked: rating === value }} onPress={() => setRating(value)} style={styles.starButton}>
                <Star size={30} color="#f59e0b" fill={value <= rating ? '#f59e0b' : 'transparent'} />
              </Pressable>
            ))}
          </View>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="What did you think of the course?"
            placeholderTextColor={colors.mutedText}
            multiline
            maxLength={5000}
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting || !comment.trim()}
            onPress={() => void handleSubmit()}
            style={[styles.button, (isSubmitting || !comment.trim()) && styles.disabled]}
          >
            <Text style={styles.buttonText}>{isSubmitting ? 'Submitting…' : 'Submit review'}</Text>
          </Pressable>
        </View>
      ) : null}

      {isLoading ? <CourseReviewsSkeleton /> : null}
      {!isLoading && reviews.length === 0 ? <Text style={styles.muted}>No reviews yet.</Text> : null}
      {reviews.map((review) => (
        <View key={review.id} style={styles.card}>
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewer} numberOfLines={1}>{review.reviewerName}{review.userId === currentUserId ? ' (you)' : ''}</Text>
            <View style={styles.starRowSmall}>
              {STARS.map((value) => <Star key={value} size={13} color="#f59e0b" fill={value <= review.rating ? '#f59e0b' : 'transparent'} />)}
            </View>
          </View>
          {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}
          {review.createdAt ? <Text style={styles.muted}>{new Date(review.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 10, marginTop: 8 },
  heading: { color: colors.text, fontSize: 18, fontWeight: '800' },
  card: { padding: 16, gap: 8, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  formTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  starRow: { flexDirection: 'row', gap: 0, marginLeft: -7 },
  starRowSmall: { flexDirection: 'row', gap: 2 },
  starButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  summaryScore: { alignItems: 'center', gap: 2, minWidth: 72 },
  summaryValue: { color: colors.text, fontSize: 32, fontWeight: '800' },
  breakdown: { flex: 1, gap: 4 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownLabel: { width: 10, color: colors.mutedText, fontSize: 12, fontWeight: '700' },
  breakdownTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.control },
  breakdownFill: { height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },
  breakdownCount: { width: 24, textAlign: 'right', color: colors.mutedText, fontSize: 12 },
  input: { minHeight: 90, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15, textAlignVertical: 'top' },
  error: { color: colors.destructiveText, fontSize: 13 },
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: ELEARNING_ACTION_GREEN },
  buttonText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reviewer: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  comment: { color: colors.text, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.mutedText, fontSize: 12 },
});
