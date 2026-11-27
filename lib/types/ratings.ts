/**
 * E-Hub ratings shared by the website, the app and Cloud Functions (functions/src/RatingService.ts).
 * Copied from the website repo (shared/types/ratings.ts); keep the two in step.
 *
 * - Service ratings: serviceReviews/{providerId}_{reviewerId}, one per member per E-Hub provider (business). The
 *   provider's aggregate lives on businesses/{providerId}: rating.overall, rating.criteria, rating.recommendPercent,
 *   reviews.total, reviews.distribution.
 * - E-Hub product ratings: ehubProductReviews/{productId}_{reviewerId}, one per member per product. The aggregate
 *   lives on ehubProducts/{productId}: rating, ratingCount, ratingDistribution (exposed by the product APIs).
 * Every write goes through the callables below; clients may only read published reviews.
 */

export const SERVICE_REVIEW_CRITERIA = ['attitude', 'punctuality', 'presentation', 'quality', 'communication', 'value'] as const;
export type ServiceReviewCriterion = (typeof SERVICE_REVIEW_CRITERIA)[number];

/** Labels the website and app show for each criterion. */
export const SERVICE_REVIEW_CRITERIA_LABELS: { [key in ServiceReviewCriterion]: string } = {
  attitude: 'Attitude & courtesy',
  punctuality: 'Punctuality',
  presentation: 'Presentation & attire',
  quality: 'Quality of work',
  communication: 'Communication',
  value: 'Value for money',
};

export const RATING_LIMITS = {
  serviceComment: 1000,
  serviceUsed: 80,
  productTitle: 120,
  productComment: 2000,
  moderationReason: 500,
  listPageSize: 20,
  listPageSizeMax: 50,
} as const;

export type ReviewStatus = 'published' | 'hidden';
/** Each criterion is optional: null means the reviewer did not rate it. */
export type ServiceReviewCriteriaScores = { [key in ServiceReviewCriterion]: number | null };
/** Star counts, keyed '1' to '5'. */
export type RatingDistribution = { '1': number; '2': number; '3': number; '4': number; '5': number };

/** Reason codes the eligibility callables return and the submit callables put in HttpsError details.reason. */
export type ReviewIneligibleReason =
  | 'SIGN_IN_REQUIRED'
  | 'ACCOUNT_RESTRICTED'
  | 'OWN_LISTING'
  | 'NO_INTERACTION'
  | 'NOT_FOUND';

export const REVIEW_INELIGIBLE_MESSAGES: { [key in ReviewIneligibleReason]: string } = {
  SIGN_IN_REQUIRED: 'Sign in to leave a rating.',
  ACCOUNT_RESTRICTED: 'Your account cannot leave ratings right now.',
  OWN_LISTING: 'You cannot rate your own business or products.',
  NO_INTERACTION: 'Contact this provider first, then you can rate them.',
  NOT_FOUND: 'This provider or product is no longer available.',
};
/** The product wording of NO_INTERACTION. */
export const PRODUCT_NO_INTERACTION_MESSAGE = 'Send this store an order request or enquiry first, then you can rate its products.';

// ── Documents as stored in Firestore (timestamps are Firestore Timestamps) ──

export type ServiceReviewDocument<TTimestamp> = {
  providerId: string;
  providerOwnerId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar: string | null;
  overall: number;
  criteria: ServiceReviewCriteriaScores;
  wouldRecommend: boolean | null;
  comment: string;
  serviceUsed: string | null;
  status: ReviewStatus;
  providerReply: null | { message: string; repliedAt: TTimestamp };
  createdAt: TTimestamp;
  updatedAt: TTimestamp;
};

export type EHubProductReviewDocument<TTimestamp> = {
  productId: string;
  storeId: string;
  storeOwnerId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar: string | null;
  rating: number;
  title: string;
  comment: string;
  verifiedCustomer: boolean;
  status: ReviewStatus;
  createdAt: TTimestamp;
  updatedAt: TTimestamp;
};

// ── Callable payloads (timestamps are ISO strings) ──

export type ServiceReview = ServiceReviewDocument<string> & { id: string };
export type EHubProductReview = EHubProductReviewDocument<string> & { id: string };

/** submitServiceReview. providerId is the public provider id (/ehub/providers/{id}): a business id or a storefront id. */
export type SubmitServiceReviewRequest = {
  providerId: string;
  overall: number;
  criteria?: Partial<ServiceReviewCriteriaScores>;
  wouldRecommend?: boolean | null;
  comment?: string;
  serviceUsed?: string | null;
};
export type SubmitServiceReviewResponse = { review: ServiceReview; created: boolean; aggregate: ServiceRatingAggregate };

export type DeleteServiceReviewRequest = { providerId: string };
export type DeleteServiceReviewResponse = { deleted: boolean; aggregate: ServiceRatingAggregate };

export type ServiceReviewEligibilityRequest = { providerId: string };
export type ServiceReviewEligibilityResponse = {
  canReview: boolean;
  reason: ReviewIneligibleReason | null;
  message: string | null;
  /** The businesses document id the reviews and aggregate belong to (query serviceReviews by this). */
  providerId: string | null;
  /** The caller's own review (also when hidden by a moderator), to prefill an edit. */
  existingReview: ServiceReview | null;
};

export type ListServiceReviewsRequest = { providerId: string; limit?: number; cursor?: string | null };
export type ListServiceReviewsResponse = { providerId: string; reviews: ServiceReview[]; nextCursor: string | null; aggregate: ServiceRatingAggregate };

export type ModerateReviewRequest = { reviewId: string; status: ReviewStatus; reason?: string };
export type ModerateServiceReviewResponse = { review: ServiceReview; aggregate: ServiceRatingAggregate };

export type SubmitEHubProductReviewRequest = { productId: string; rating: number; title?: string; comment?: string };
export type SubmitEHubProductReviewResponse = { review: EHubProductReview; created: boolean; aggregate: EHubProductRatingAggregate };
export type DeleteEHubProductReviewRequest = { productId: string };
export type DeleteEHubProductReviewResponse = { deleted: boolean; aggregate: EHubProductRatingAggregate };
export type EHubProductReviewEligibilityRequest = { productId: string };
export type EHubProductReviewEligibilityResponse = {
  canReview: boolean;
  reason: ReviewIneligibleReason | null;
  message: string | null;
  /** Whether a new review would be marked verifiedCustomer (an order request included this product). */
  verifiedCustomer: boolean;
  existingReview: EHubProductReview | null;
};
export type ListEHubProductReviewsRequest = { productId: string; limit?: number; cursor?: string | null };
export type ListEHubProductReviewsResponse = { productId: string; reviews: EHubProductReview[]; nextCursor: string | null; aggregate: EHubProductRatingAggregate };
export type ModerateEHubProductReviewResponse = { review: EHubProductReview; aggregate: EHubProductRatingAggregate };

// ── Aggregates as returned by the callables (a projection of the stored fields) ──

export type ServiceRatingAggregate = {
  /** Average overall stars, one decimal; 0 when there are no published reviews. */
  overall: number;
  total: number;
  distribution: RatingDistribution;
  criteria: { [key in ServiceReviewCriterion]: { average: number; count: number } };
  /** Whole percent of reviewers who answered the question and would recommend; null when nobody answered. */
  recommendPercent: number | null;
};

export type EHubProductRatingAggregate = { rating: number; ratingCount: number; ratingDistribution: RatingDistribution };
