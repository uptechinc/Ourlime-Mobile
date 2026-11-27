import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { ThumbsDown, ThumbsUp } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useServiceRatings } from '@/lib/hooks/useEHubRatings';
import { describeIneligibleReason } from '@/lib/services/EHubRatingService';
import { SERVICE_REVIEW_CRITERIA, SERVICE_REVIEW_CRITERIA_LABELS, type ServiceRatingAggregate, type ServiceReview, type ServiceReviewCriterion } from '@/lib/types/ratings';
import { RATING_STAR_COLOR } from '@/components/reviews/RatingStars';
import { CriteriaBreakdown, RatingOverview, RecommendBadge } from '@/components/reviews/RatingSummary';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { DeleteReviewConfirm } from '@/components/reviews/DeleteReviewConfirm';
import { ReviewNotice, ReviewsEmpty, ReviewsHeading, ReviewsSkeleton, ShowMoreReviews, WriteReviewButton, useReviewPaging } from '@/components/reviews/ReviewParts';
import ServiceRatingFormSheet from './ServiceRatingFormSheet';

/** Short names for the per-review chips; screen readers still hear the full label. */
const SHORT_LABELS: { [key in ServiceReviewCriterion]: string } = {
  attitude: 'Attitude', punctuality: 'Punctuality', presentation: 'Presentation', quality: 'Quality', communication: 'Communication', value: 'Value',
};
const UNAVAILABLE = 'Ratings are not available right now. Please try again later.';

type ServiceRatingsSectionProps = {
  providerId: string;
  providerName: string;
  services: string[];
  viewerId: string | null;
  isOwnProvider: boolean;
  /** The provider's rating from the directory, shown until (or if) the rating callables answer. */
  fallback: { rating: number | null; reviewCount: number };
  onSignIn: () => void;
  /** Scrolls to the enquiry form (contacting the provider makes the member eligible). */
  onContactProvider: () => void;
  /** The latest aggregate (after loading, rating or deleting), so the profile header can show it. */
  onAggregateChange?: (aggregate: ServiceRatingAggregate) => void;
};

/** The details one reviewer gave: service used, the areas they rated as compact chips, and their recommendation. */
function ReviewDetails({ review, colors }: { review: ServiceReview; colors: AppThemeColors }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const rated = SERVICE_REVIEW_CRITERIA.filter((key) => review.criteria[key] !== null);
  if (!review.serviceUsed && !rated.length && review.wouldRecommend === null) return null;
  return <View style={styles.details}>
    {review.serviceUsed ? <Text numberOfLines={2} style={styles.serviceText}>Service used: {review.serviceUsed}</Text> : null}
    {rated.length ? <View style={styles.chips}>{rated.map((key) => <View key={key} accessible accessibilityLabel={`${SERVICE_REVIEW_CRITERIA_LABELS[key]} ${review.criteria[key]} out of 5`} style={styles.chip}>
      <Text numberOfLines={1} style={styles.chipLabel}>{SHORT_LABELS[key]}</Text>
      <Text style={styles.chipValue}>{review.criteria[key]}<Text style={{ color: RATING_STAR_COLOR }}> ★</Text></Text>
    </View>)}</View> : null}
    {review.wouldRecommend !== null ? <View style={styles.recommendRow}>
      {review.wouldRecommend ? <ThumbsUp size={13} color={colors.successText} /> : <ThumbsDown size={13} color={colors.destructiveText} />}
      <Text style={[styles.recommendText, { color: review.wouldRecommend ? colors.successText : colors.destructiveText }]}>{review.wouldRecommend ? 'Would recommend' : 'Would not recommend'}</Text>
    </View> : null}
  </View>;
}

/**
 * A provider's service ratings: the average with 5 to 1 bars, "N% would recommend", the rated areas, the member's own
 * rating pinned with Edit and Delete (or "Rate this provider", "Sign in to rate", "Contact provider" by eligibility),
 * then the other ratings, five first and ten more per "Show more ratings".
 */
export default function ServiceRatingsSection({ providerId, providerName, services, viewerId, isOwnProvider, fallback, onSignIn, onContactProvider, onAggregateChange }: ServiceRatingsSectionProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const feed = useServiceRatings(providerId, viewerId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const aggregate = feed.aggregate;
  const count = aggregate?.total ?? fallback.reviewCount;
  const average = aggregate?.overall ?? fallback.rating ?? 0;
  const eligibility = feed.eligibility;
  const existing = eligibility?.existingReview ?? null;
  const reason = eligibility && !eligibility.canReview ? eligibility.reason : null;
  // The member's own rating is pinned: from eligibility, or the list's copy when eligibility could not be checked.
  const pinned = existing ?? (viewerId ? feed.reviews.find((review) => review.reviewerId === viewerId) ?? null : null);
  const others = useMemo(() => feed.reviews.filter((review) => review.id !== pinned?.id && review.reviewerId !== viewerId), [feed.reviews, pinned?.id, viewerId]);
  const canEdit = Boolean(eligibility?.canReview);

  useEffect(() => { if (aggregate) onAggregateChange?.(aggregate); }, [aggregate, onAggregateChange]);
  // The "deleted" confirmation goes away by itself.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const paging = useReviewPaging(others.length, feed.hasMore, feed.loadMore);

  const action = (() => {
    if (isOwnProvider) return <ReviewNotice text={describeIneligibleReason('OWN_LISTING', 'service')} />;
    if (!viewerId) return <WriteReviewButton label="Sign in to rate" onPress={onSignIn} />;
    if (pinned) return null;
    if (feed.isLoading && !eligibility) return null;
    if (!eligibility && feed.eligibilityError) return <ReviewNotice text="Rating isn't available right now" actionLabel="Try again" onAction={() => void feed.refresh()} />;
    if (eligibility?.canReview) return <WriteReviewButton label="Rate this provider" onPress={() => setIsFormOpen(true)} />;
    if (reason === 'NO_INTERACTION') return <ReviewNotice text={eligibility?.message || describeIneligibleReason(reason, 'service')} actionLabel="Contact provider" onAction={onContactProvider} />;
    if (reason === 'SIGN_IN_REQUIRED') return <WriteReviewButton label="Sign in to rate" onPress={onSignIn} />;
    if (reason) return <ReviewNotice text={eligibility?.message || describeIneligibleReason(reason, 'service')} />;
    return null;
  })();

  const renderCard = (review: ServiceReview, isOwn: boolean) => <ReviewCard key={review.id} reviewerId={review.reviewerId} reviewerName={review.reviewerName} reviewerAvatar={review.reviewerAvatar}
    date={review.createdAt} updatedAt={review.updatedAt} rating={review.overall} body={review.comment} ownLabel={isOwn ? 'Your rating' : null}
    isHidden={isOwn && review.status === 'hidden'} onEdit={isOwn && canEdit ? () => { setNotice(null); setIsFormOpen(true); } : undefined}
    onDelete={isOwn ? () => { setNotice(null); setIsConfirmingDelete(true); } : undefined}
    reply={review.providerReply ? { label: 'Reply from the provider', message: review.providerReply.message, date: review.providerReply.repliedAt } : null}>
    <ReviewDetails review={review} colors={colors} />
  </ReviewCard>;

  return <View style={styles.card}>
    <ReviewsHeading title="Ratings & reviews" subtitle={`From members who contacted ${providerName} through Ourlime.`} />
    {feed.isLoading && !aggregate && count === 0 ? <ReviewsSkeleton /> : count > 0 ? <>
      <RatingOverview average={average} count={count} distribution={aggregate?.distribution ?? null} />
      {aggregate?.recommendPercent !== null && aggregate?.recommendPercent !== undefined ? <RecommendBadge percent={aggregate.recommendPercent} /> : null}
      {aggregate && SERVICE_REVIEW_CRITERIA.some((key) => aggregate.criteria[key].count > 0) ? <View style={styles.breakdown}>
        <Text style={styles.subheading}>Rated areas</Text>
        <CriteriaBreakdown criteria={aggregate.criteria} />
      </View> : null}
    </> : feed.error ? null : <ReviewsEmpty title={eligibility?.canReview && !pinned ? 'No ratings yet. Be the first to rate this provider.' : 'No ratings yet.'} />}
    {action}
    {notice ? <ReviewNotice text={notice} /> : null}
    {feed.error ? <ReviewNotice tone={feed.error.isUnavailable ? 'info' : 'error'} text={feed.error.isUnavailable ? UNAVAILABLE : feed.error.message} actionLabel="Try again" onAction={() => void feed.refresh()} /> : null}
    {pinned ? renderCard(pinned, true) : null}
    {others.length ? <View style={styles.list}>{others.slice(0, paging.shown).map((review) => renderCard(review, false))}</View> : null}
    {paging.canShowMore && (others.length > 0 || feed.hasMore) ? <ShowMoreReviews label="Show more ratings" isLoading={feed.isLoadingMore} onPress={paging.showMore} /> : null}
    <ServiceRatingFormSheet visible={isFormOpen} providerName={providerName} services={services} existing={existing}
      onSubmit={feed.submit} onDelete={feed.remove} onDeleted={setNotice} onClose={() => setIsFormOpen(false)} />
    <DeleteReviewConfirm visible={isConfirmingDelete} kind="rating" onDelete={feed.remove}
      onDeleted={() => { setIsConfirmingDelete(false); setNotice('Your rating was deleted.'); AccessibilityInfo.announceForAccessibility('Your rating was deleted.'); }}
      onCancel={() => setIsConfirmingDelete(false)} onError={(message) => { setIsConfirmingDelete(false); setNotice(message); }} />
  </View>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: { padding: 16, gap: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  breakdown: { gap: 10, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  subheading: { color: colors.text, fontSize: 14, fontWeight: '800' },
  list: { gap: 10 },
  details: { gap: 7 },
  serviceText: { color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.control },
  chipLabel: { flexShrink: 1, color: colors.secondaryText, fontSize: 12, fontWeight: '600' },
  chipValue: { color: colors.text, fontSize: 12, fontWeight: '900' },
  recommendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  recommendText: { fontSize: 12, fontWeight: '800' },
});
