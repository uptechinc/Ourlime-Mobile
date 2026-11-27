import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { ProductReviewsSkeleton } from '../MarketSkeletons';
import { marketReviewService } from '@/lib/services/MarketReviewService';
import type { MarketReview } from '@/lib/types/reliability';
import type { RatingDistribution } from '@/lib/types/ratings';
import { RatingOverview } from '@/components/reviews/RatingSummary';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { ReviewNotice, ReviewsEmpty, ReviewsHeading, ShowMoreReviews, WriteReviewButton } from '@/components/reviews/ReviewParts';
import WriteReviewModal from './WriteReviewModal';

type ProductReviewsSectionProps = {
  productId: string;
  productTitle: string;
  reviews: MarketReview[];
  loading: boolean;
  error: string | null;
  averageRating: number | null;
  ratingCount: number;
  canWrite: boolean;
  /** The signed-in member, to mark their review and not offer a second one. */
  currentUserId?: string | null;
  /** Shown as "Sign in to review" when nobody is signed in. */
  onSignIn?: () => void;
  onRetry: () => void;
  onReviewAdded: () => void;
};

const FIRST_PAGE = 5;
const PAGE = 10;

/**
 * Web ProductReviewsSection, laid out like E-Hub product reviews (shared components): average with 5 to 1 bars, the
 * write button, reviews with avatars, Verified purchase badges and seller replies, five at a time.
 */
export default function ProductReviewsSection({ productId, productTitle, reviews, loading, error, averageRating, ratingCount, canWrite, currentUserId, onSignIn, onRetry, onReviewAdded }: ProductReviewsSectionProps) {
  const { colors } = useAppTheme();
  const [writeOpen, setWriteOpen] = useState(false);
  const [shown, setShown] = useState(FIRST_PAGE);
  const count = ratingCount || reviews.length;
  const average = averageRating ?? (reviews.length ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0);
  const distribution = useMemo<RatingDistribution>(() => {
    const counts = Object.fromEntries(marketReviewService.breakdown(reviews).map(({ star, count: starCount }) => [String(star), starCount]));
    return { '1': counts['1'] ?? 0, '2': counts['2'] ?? 0, '3': counts['3'] ?? 0, '4': counts['4'] ?? 0, '5': counts['5'] ?? 0 };
  }, [reviews]);
  const ownReview = currentUserId ? reviews.find((review) => review.reviewerId === currentUserId) ?? null : null;
  const barTotal = reviews.length;

  return <View style={styles.section}>
    <ReviewsHeading title="Ratings & reviews" />
    {loading && !reviews.length ? <ProductReviewsSkeleton /> : count > 0 && average > 0 ? <>
      <RatingOverview average={average} count={count} distribution={distribution} distributionTotal={barTotal || undefined} unit="review" />
      {/* The bars count the loaded reviews (up to 50); say so when the product has more. */}
      {barTotal > 0 && barTotal < count ? <Text style={[styles.basedOn, { color: colors.mutedText }]}>Based on the latest {barTotal} {barTotal === 1 ? 'review' : 'reviews'}</Text> : null}
    </> : !error ? <ReviewsEmpty title="No reviews yet." /> : null}
    {ownReview ? <ReviewNotice text="You reviewed this product" />
      : canWrite ? <WriteReviewButton label="Write a review" onPress={() => setWriteOpen(true)} />
        : !currentUserId && onSignIn ? <WriteReviewButton label="Sign in to review" onPress={onSignIn} /> : null}
    {error ? <ReviewNotice tone="error" text={error} actionLabel="Try again" onAction={onRetry} /> : null}
    {reviews.slice(0, shown).map((review) => <ReviewCard key={review.id} reviewerId={review.reviewerId} reviewerName={review.reviewerName} date={review.createdAt}
      rating={review.rating} title={review.title} body={review.comment} badge={review.verifiedPurchase ? 'Verified purchase' : null} ownLabel={review.reviewerId === currentUserId ? 'Your review' : null}
      reply={review.sellerResponse ? { label: `Reply from ${review.sellerResponse.sellerName}`, message: review.sellerResponse.response, date: review.sellerResponse.respondedAt } : null} />)}
    {reviews.length > shown ? <ShowMoreReviews label="Show more reviews" isLoading={false} onPress={() => setShown((current) => current + PAGE)} /> : null}
    {writeOpen ? <WriteReviewModal productId={productId} productTitle={productTitle} onClose={() => setWriteOpen(false)} onSuccess={onReviewAdded} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 14, paddingTop: 6 },
  basedOn: { marginTop: -6, fontSize: 12, fontWeight: '600' },
});
