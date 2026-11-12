import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Check, Star } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { toast } from 'sonner-native';
import UserAvatar from '@/components/ui/UserAvatar';
import MentionText from '@/components/ui/MentionText';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { eventDiscussionService, type EventReview, type EventReviewNode } from '@/lib/services/EventDiscussionService';
import { EventDiscussionSkeleton } from '../EventSkeletons';

type EventReviewsSectionProps = {
  eventId: string;
  viewerId: string | null;
  hasEnded: boolean;
  isAttending: boolean;
  /** The organiser, or a co-organiser with manage_reviews: may reply to reviews. */
  canReply: boolean;
  onCountChange: (count: number) => void;
};

/** The website's Reviews tab: attendees review an event after it ends; the organiser can reply. */
export default function EventReviewsSection({ eventId, viewerId, hasEnded, isAttending, canReply, onCountChange }: EventReviewsSectionProps) {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [reviews, setReviews] = useState<EventReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const load = useCallback(async () => {
    try {
      const loaded = await eventDiscussionService.fetchReviews(eventId);
      setReviews(loaded);
      onCountChange(loaded.filter((review) => !review.parentId).length);
    } catch (error: unknown) {
      console.error('[EventReviewsSection.load] Error:', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [eventId, onCountChange]);
  useEffect(() => { void load(); }, [load]);

  const hasReviewed = Boolean(viewerId && reviews.some((review) => review.userId === viewerId && !review.parentId));
  const tree = useMemo(() => eventDiscussionService.buildTree(reviews), [reviews]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await eventDiscussionService.createReview(eventId, rating, content);
      setRating(0);
      setContent('');
      toast.success('Review submitted successfully');
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (reviewId: string) => {
    try {
      await eventDiscussionService.replyToReview(eventId, reviewId, replyText);
      setReplyTo(null);
      setReplyText('');
      toast.success('Reply posted');
      await load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to post reply. Please try again.');
    }
  };

  const renderReview = (node: EventReviewNode, depth: number) => (
    <View key={node.id} style={[styles.review, depth > 0 && styles.reply]}>
      <View style={styles.row}>
        <TouchableOpacity disabled={!node.authorUserName} onPress={() => node.authorUserName && router.push({ pathname: '/profile/[username]', params: { username: node.authorUserName } })}>
          <UserAvatar profileImage={node.authorImage} firstName={node.authorName} size={depth > 0 ? 30 : 36} />
        </TouchableOpacity>
        <View style={styles.flex}>
          <View style={styles.headerRow}>
            <Text style={styles.author} numberOfLines={1}>{node.authorName}</Text>
            {node.isOrganizerReply ? <Text style={styles.badge}>Organizer</Text> : null}
          </View>
          <View style={styles.headerRow}>
            {!node.isOrganizerReply && node.rating > 0 ? (
              <View style={styles.stars}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={13} color={star <= node.rating ? '#facc15' : colors.border} fill={star <= node.rating ? '#facc15' : 'transparent'} />)}</View>
            ) : null}
            <Text style={styles.time}>{node.createdAt ? new Date(node.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</Text>
          </View>
        </View>
      </View>
      <MentionText content={node.content} style={styles.body} mentionStyle={styles.mention} onMentionPress={(username) => router.push({ pathname: '/profile/[username]', params: { username } })} />
      {depth === 0 && canReply ? (
        <TouchableOpacity onPress={() => { setReplyTo((current) => (current === node.id ? null : node.id)); setReplyText(''); }}><Text style={styles.replyLink}>Reply</Text></TouchableOpacity>
      ) : null}
      {replyTo === node.id ? (
        <View style={styles.form}>
          <TextInput value={replyText} onChangeText={setReplyText} placeholder="Write an organizer reply..." placeholderTextColor={colors.mutedText} multiline maxLength={5000} style={styles.input} />
          <View style={styles.buttons}>
            <TouchableOpacity onPress={() => { setReplyTo(null); setReplyText(''); }} style={styles.secondaryButton}><Text style={styles.secondaryText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity disabled={!replyText.trim()} onPress={() => void handleReply(node.id)} style={[styles.primaryButton, !replyText.trim() && styles.disabled]}><Text style={styles.primaryText}>Reply</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}
      {node.replies.map((child) => renderReview(child, depth + 1))}
    </View>
  );

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>Reviews & Ratings ({reviews.filter((review) => !review.parentId).length})</Text>
      {!hasEnded ? (
        <View style={styles.empty}><Star size={40} color={colors.mutedText} /><Text style={styles.muted}>Reviews will be available after the event ends.</Text></View>
      ) : !isAttending ? (
        <View style={styles.empty}><Star size={40} color={colors.mutedText} /><Text style={styles.muted}>You must have attended this event to leave a review.</Text></View>
      ) : hasReviewed ? (
        <View style={styles.empty}><Check size={40} color={colors.accent} /><Text style={styles.reviewed}>You&apos;ve already reviewed this event.</Text></View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Write a Review</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} accessibilityLabel={`${star} star${star === 1 ? '' : 's'}`} hitSlop={4} onPress={() => setRating(star)}>
                <Star size={28} color={star <= rating ? '#facc15' : colors.border} fill={star <= rating ? '#facc15' : 'transparent'} />
              </TouchableOpacity>
            ))}
          </View>
          <TextInput value={content} onChangeText={setContent} placeholder="Share your experience about this event..." placeholderTextColor={colors.mutedText} multiline maxLength={5000} style={[styles.input, styles.reviewInput]} />
          <TouchableOpacity disabled={rating === 0 || !content.trim() || isSubmitting} onPress={() => void handleSubmit()} style={[styles.primaryButton, styles.alignEnd, (rating === 0 || !content.trim() || isSubmitting) && styles.disabled]}>
            <Text style={styles.primaryText}>{isSubmitting ? 'Submitting…' : 'Submit Review'}</Text>
          </TouchableOpacity>
        </View>
      )}
      {loading ? <EventDiscussionSkeleton /> : tree.map((node) => renderReview(node, 0))}
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  wrapper: { gap: 12 },
  flex: { flex: 1 },
  title: { color: colors.text, fontSize: 19, fontWeight: '900' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  muted: { color: colors.mutedText, fontSize: 13, textAlign: 'center' },
  reviewed: { color: colors.text, fontSize: 14, fontWeight: '700' },
  form: { gap: 10, padding: 14, borderRadius: 14, backgroundColor: colors.control },
  formTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  stars: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  input: { minHeight: 44, maxHeight: 160, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.input, color: colors.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, textAlignVertical: 'top' },
  reviewInput: { minHeight: 96 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  primaryButton: { minHeight: 40, paddingHorizontal: 16, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.onAccent, fontWeight: '900' },
  secondaryButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.text, fontWeight: '800' },
  alignEnd: { alignSelf: 'flex-end' },
  disabled: { opacity: 0.5 },
  review: { gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  reply: { marginLeft: 14, backgroundColor: colors.canvas },
  row: { flexDirection: 'row', gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  author: { color: colors.text, fontWeight: '800', fontSize: 14, flexShrink: 1 },
  badge: { color: colors.successText, backgroundColor: colors.successSurface, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, fontWeight: '800', overflow: 'hidden' },
  time: { color: colors.mutedText, fontSize: 11 },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  mention: { color: colors.accentText, fontWeight: '700' },
  replyLink: { color: colors.accentText, fontSize: 12, fontWeight: '800' },
});
