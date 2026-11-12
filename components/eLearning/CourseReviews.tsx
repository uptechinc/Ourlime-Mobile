import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { CourseReviewsSkeleton } from '@/components/eLearning/ELearningSkeletons';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { courseService } from '@/lib/services/CourseService';
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

      {canReview && !hasReviewed && !isLoading ? (
        <View style={styles.card}>
          <Text style={styles.formTitle}>Rate this course</Text>
          <View style={styles.starRow} accessibilityRole="radiogroup" accessibilityLabel="Rating">
            {STARS.map((value) => (
              <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`} accessibilityState={{ checked: rating === value }} hitSlop={6} onPress={() => setRating(value)}>
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
            <View style={styles.starRow}>
              {STARS.map((value) => <Star key={value} size={14} color="#f59e0b" fill={value <= review.rating ? '#f59e0b' : 'transparent'} />)}
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
  card: { padding: 14, gap: 8, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  formTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  starRow: { flexDirection: 'row', gap: 4 },
  input: { minHeight: 90, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15, textAlignVertical: 'top' },
  error: { color: colors.destructiveText, fontSize: 13 },
  button: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.accent },
  buttonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reviewer: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
  comment: { color: colors.text, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.mutedText, fontSize: 12 },
});
