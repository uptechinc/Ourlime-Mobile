import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { useEHubProductRatings } from '@/lib/hooks/useEHubRatings';
import { describeIneligibleReason } from '@/lib/services/EHubRatingService';
import { RATING_LIMITS, type EHubProductRatingAggregate, type EHubProductReview, type RatingDistribution } from '@/lib/types/ratings';
import { RatingOverview } from '@/components/reviews/RatingSummary';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { DeleteReviewConfirm } from '@/components/reviews/DeleteReviewConfirm';
import { ReviewNotice, ReviewsEmpty, ReviewsSkeleton, ShowMoreReviews, WriteReviewButton, useReviewPaging } from '@/components/reviews/ReviewParts';
import { ProductReviewFormSheet, type ProductReviewValues } from '@/components/reviews/ProductReviewFormSheet';

const UNAVAILABLE = 'Ratings are not available right now. Please try again later.';
const VERIFIED_NOTE = 'Your review will show a Verified order badge because you sent this store an order request for this product.';

type EHubProductReviewsSectionProps = {
  productId: string;
  productTitle: string;
  viewerId: string | null;
  /** The product's own aggregate from the catalog, shown until (or if) the rating callables answer. */
  fallback: { rating: number | null; ratingCount: number; ratingDistribution: RatingDistribution | null };
  onSignIn: () => void;
  /** Opens the seller enquiry (the way to become eligible). */
  onContactSeller: () => void;
  /** The latest aggregate (after loading, reviewing or deleting), so the product header can show it. */
  onAggregateChange?: (aggregate: EHubProductRatingAggregate) => void;
};

/**
 * Ratings for one E-Hub product: average, count and 5 to 1 bars, the member's own review pinned with Edit and Delete
 * (or "Write a review", "Sign in to review", "Message seller" by eligibility), then the reviews with "Verified order"
 * badges, five first and ten more per "Show more reviews". Same layout as Market reviews.
 */
export default function EHubProductReviewsSection({ productId, productTitle, viewerId, fallback, onSignIn, onContactSeller, onAggregateChange }: EHubProductReviewsSectionProps) {
  const feed = useEHubProductRatings(productId, viewerId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const existing = feed.eligibility?.existingReview ?? null;
  const initial = useMemo<ProductReviewValues | null>(() => existing ? { rating: existing.rating, title: existing.title, comment: existing.comment } : null, [existing]);
  // The member's own review is pinned: from eligibility, or the list's copy when eligibility could not be checked.
  const pinned = existing ?? (viewerId ? feed.reviews.find((review) => review.reviewerId === viewerId) ?? null : null);
  const others = useMemo(() => feed.reviews.filter((review) => review.id !== pinned?.id && review.reviewerId !== viewerId), [feed.reviews, pinned?.id, viewerId]);
  const canEdit = Boolean(feed.eligibility?.canReview);

  useEffect(() => { if (feed.aggregate) onAggregateChange?.(feed.aggregate); }, [feed.aggregate, onAggregateChange]);
  // The "deleted" confirmation goes away by itself.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const paging = useReviewPaging(others.length, feed.hasMore, feed.loadMore);

  const average = feed.aggregate?.rating ?? fallback.rating ?? 0;
  const count = feed.aggregate?.ratingCount ?? fallback.ratingCount;
  const distribution = feed.aggregate?.ratingDistribution ?? fallback.ratingDistribution;
  const eligibility = feed.eligibility;
  const reason = eligibility && !eligibility.canReview ? eligibility.reason : null;

  const action = (() => {
    if (!viewerId) return <WriteReviewButton label="Sign in to review" onPress={onSignIn} />;
    if (pinned) return null;
    if (feed.isLoading && !eligibility) return null;
    if (!eligibility && feed.eligibilityError) return <ReviewNotice text="Rating isn't available right now" actionLabel="Try again" onAction={() => void feed.refresh()} />;
    if (eligibility?.canReview) return <WriteReviewButton label="Write a review" onPress={() => setIsFormOpen(true)} />;
    if (reason === 'NO_INTERACTION') return <ReviewNotice text={eligibility?.message || describeIneligibleReason(reason, 'product')} actionLabel="Message seller" onAction={onContactSeller} />;
    if (reason === 'SIGN_IN_REQUIRED') return <WriteReviewButton label="Sign in to review" onPress={onSignIn} />;
    if (reason) return <ReviewNotice text={eligibility?.message || describeIneligibleReason(reason, 'product')} />;
    return null;
  })();

  const renderCard = (review: EHubProductReview, isOwn: boolean) => <ReviewCard key={review.id} reviewerId={review.reviewerId} reviewerName={review.reviewerName} reviewerAvatar={review.reviewerAvatar}
    date={review.createdAt} updatedAt={review.updatedAt} rating={review.rating} title={review.title} body={review.comment} badge={review.verifiedCustomer ? 'Verified order' : null}
    ownLabel={isOwn ? 'Your review' : null} isHidden={isOwn && review.status === 'hidden'}
    onEdit={isOwn && canEdit ? () => { setNotice(null); setIsFormOpen(true); } : undefined} onDelete={isOwn ? () => { setNotice(null); setIsConfirmingDelete(true); } : undefined} />;

  return <View style={styles.section}>
    {feed.isLoading && !feed.aggregate && count === 0 ? <ReviewsSkeleton /> : count > 0
      ? <RatingOverview average={average} count={count} distribution={distribution} unit="review" />
      : feed.error ? null : <ReviewsEmpty title="No reviews yet." />}
    {action}
    {notice ? <ReviewNotice text={notice} /> : null}
    {feed.error ? <ReviewNotice tone={feed.error.isUnavailable ? 'info' : 'error'} text={feed.error.isUnavailable ? UNAVAILABLE : feed.error.message} actionLabel="Try again" onAction={() => void feed.refresh()} /> : null}
    {pinned ? renderCard(pinned, true) : null}
    {others.slice(0, paging.shown).map((review) => renderCard(review, false))}
    {paging.canShowMore && (others.length > 0 || feed.hasMore) ? <ShowMoreReviews label="Show more reviews" isLoading={feed.isLoadingMore} onPress={paging.showMore} /> : null}
    <ProductReviewFormSheet visible={isFormOpen} productTitle={productTitle} initial={initial} limits={{ title: RATING_LIMITS.productTitle, comment: RATING_LIMITS.productComment }}
      verifiedNote={!existing && eligibility?.verifiedCustomer ? VERIFIED_NOTE : null}
      onSubmit={async (values) => { await feed.submit(values); }} onDelete={feed.remove} onDeleted={setNotice} onClose={() => setIsFormOpen(false)} />
    <DeleteReviewConfirm visible={isConfirmingDelete} kind="review" onDelete={feed.remove}
      onDeleted={() => { setIsConfirmingDelete(false); setNotice('Your review was deleted.'); AccessibilityInfo.announceForAccessibility('Your review was deleted.'); }}
      onCancel={() => setIsConfirmingDelete(false)} onError={(message) => { setIsConfirmingDelete(false); setNotice(message); }} />
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 14 },
});
