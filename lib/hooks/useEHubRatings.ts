import { useCallback, useEffect, useRef, useState } from 'react';
import { eHubRatingService, RatingRequestError, reportRatingError } from '@/lib/services/EHubRatingService';
import { settleAll } from '@/lib/utils/settleAll';
import { withCleanup } from '@/lib/utils/withCleanup';
import type {
  EHubProductRatingAggregate, EHubProductReview, EHubProductReviewEligibilityResponse, ServiceRatingAggregate, ServiceReview,
  ServiceReviewEligibilityResponse, SubmitEHubProductReviewRequest, SubmitServiceReviewRequest,
} from '@/lib/types/ratings';

type FeedReview = { id: string; reviewerId: string; status: 'published' | 'hidden' };
type FeedEligibility<TReview> = { canReview: boolean; existingReview: TReview | null };
type FeedPage<TReview, TAggregate> = { reviews: TReview[]; nextCursor: string | null; aggregate: TAggregate };
type FeedSubmitResult<TReview, TAggregate> = { review: TReview; aggregate: TAggregate };

export type ReviewFeed<TReview, TAggregate, TEligibility, TRequest> = {
  reviews: TReview[];
  aggregate: TAggregate | null;
  eligibility: TEligibility | null;
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  /** Why the reviews could not load (null while they are fine). */
  error: RatingRequestError | null;
  /** Why eligibility could not be checked (e.g. the callables are not deployed yet). */
  eligibilityError: RatingRequestError | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  /** Sends the review; rejects with a RatingRequestError the form shows inline. */
  submit: (request: TRequest) => Promise<TReview>;
  remove: () => Promise<void>;
};

type FeedSource<TReview, TAggregate, TEligibility, TRequest> = {
  list: (cursor: string | null) => Promise<FeedPage<TReview, TAggregate>>;
  eligibility: () => Promise<TEligibility>;
  submit: (request: TRequest) => Promise<FeedSubmitResult<TReview, TAggregate>>;
  /** Gets the current eligibility (the service delete addresses the business id it returned). */
  remove: (eligibility: TEligibility | null) => Promise<{ deleted: boolean; aggregate: TAggregate }>;
};

function toRatingError(error: unknown): RatingRequestError {
  return error instanceof RatingRequestError ? error : new RatingRequestError(null, 'Ratings are not available right now. Please try again later.', true);
}

/**
 * One target's reviews (newest first, paged), its aggregate and the member's eligibility. A submit or delete puts the
 * aggregate the server returns in place and updates the list at once, then quietly reloads the first page and the
 * eligibility: a cursor can point at the deleted review, and deleting can change whether the member may rate.
 */
function useReviewFeed<TReview extends FeedReview, TAggregate, TEligibility extends FeedEligibility<TReview>, TRequest>(
  targetId: string, viewerId: string | null, source: FeedSource<TReview, TAggregate, TEligibility, TRequest>,
): ReviewFeed<TReview, TAggregate, TEligibility, TRequest> {
  const [reviews, setReviews] = useState<TReview[]>([]);
  const [aggregate, setAggregate] = useState<TAggregate | null>(null);
  const [eligibility, setEligibility] = useState<TEligibility | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(targetId));
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<RatingRequestError | null>(null);
  const [eligibilityError, setEligibilityError] = useState<RatingRequestError | null>(null);
  const requestRef = useRef(0);
  const sourceRef = useRef(source);
  sourceRef.current = source;

  /** quiet keeps what is shown while reloading (after a submit or delete) instead of showing the skeleton. */
  const load = useCallback(async (quiet: boolean): Promise<void> => {
    if (!targetId) return;
    const requestId = ++requestRef.current;
    if (!quiet) setIsLoading(true);
    const [page, eligible] = await settleAll([sourceRef.current.list(null), sourceRef.current.eligibility()] as const);
    if (requestId !== requestRef.current) return;
    if (page.status === 'fulfilled') {
      setReviews(page.value.reviews);
      setAggregate(page.value.aggregate);
      setCursor(page.value.nextCursor);
      setError(null);
    } else {
      const failure = toRatingError(page.reason);
      reportRatingError('useReviewFeed.load', failure);
      // The old cursor may point at a review that no longer exists: drop it rather than page from it.
      setCursor(null);
      if (!quiet) setError(failure);
    }
    if (eligible.status === 'fulfilled') {
      setEligibility(eligible.value);
      setEligibilityError(null);
    } else {
      const failure = toRatingError(eligible.reason);
      reportRatingError('useReviewFeed.load', failure);
      if (!quiet) setEligibility(null);
      setEligibilityError(failure);
    }
    setIsLoading(false);
  }, [targetId]);
  const refresh = useCallback(() => load(false), [load]);
  const eligibilityRef = useRef(eligibility);
  eligibilityRef.current = eligibility;

  // Reload when the target or the signed-in member changes (eligibility depends on both).
  useEffect(() => {
    setReviews([]); setAggregate(null); setEligibility(null); setCursor(null); setError(null); setEligibilityError(null);
    void refresh();
  }, [refresh, viewerId]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!cursor || isLoadingMore) return;
    const requestId = requestRef.current;
    setIsLoadingMore(true);
    try {
      const page = await withCleanup(sourceRef.current.list(cursor), () => setIsLoadingMore(false));
      if (requestId !== requestRef.current) return;
      setReviews((current) => [...current, ...page.reviews.filter((review) => !current.some((existing) => existing.id === review.id))]);
      setCursor(page.nextCursor);
      setAggregate(page.aggregate);
    } catch (loadError: unknown) {
      const failure = toRatingError(loadError);
      reportRatingError('useReviewFeed.loadMore', failure);
      setError(failure);
    }
  }, [cursor, isLoadingMore]);

  const submit = useCallback(async (request: TRequest): Promise<TReview> => {
    try {
      const result = await sourceRef.current.submit(request);
      setAggregate(result.aggregate);
      setReviews((current) => {
        const others = current.filter((review) => review.id !== result.review.id);
        // A review a moderator hid stays out of the public list.
        return result.review.status === 'published' ? [result.review, ...others] : others;
      });
      setEligibility((current) => (current ? { ...current, canReview: true, existingReview: result.review } : current));
      void load(true);
      return result.review;
    } catch (submitError: unknown) {
      throw toRatingError(submitError);
    }
  }, [load]);

  const remove = useCallback(async (): Promise<void> => {
    try {
      const result = await sourceRef.current.remove(eligibilityRef.current);
      setAggregate(result.aggregate);
      if (!result.deleted) {
        void load(true);
        throw new RatingRequestError('NOT_FOUND', 'Your review could not be found. It may already be deleted.', false);
      }
      setReviews((current) => current.filter((review) => review.reviewerId !== viewerId));
      setEligibility((current) => (current ? { ...current, existingReview: null } : current));
      void load(true);
    } catch (removeError: unknown) {
      throw toRatingError(removeError);
    }
  }, [load, viewerId]);

  return { reviews, aggregate, eligibility, hasMore: Boolean(cursor), isLoading, isLoadingMore, error, eligibilityError, refresh, loadMore, submit, remove };
}

export type ServiceRatingsFeed = ReviewFeed<ServiceReview, ServiceRatingAggregate, ServiceReviewEligibilityResponse, Omit<SubmitServiceReviewRequest, 'providerId'>>;
export type EHubProductRatingsFeed = ReviewFeed<EHubProductReview, EHubProductRatingAggregate, EHubProductReviewEligibilityResponse, Omit<SubmitEHubProductReviewRequest, 'productId'>>;

/** A provider's service ratings with the criteria breakdown (providerId is the public /ehub/providers id). */
export function useServiceRatings(providerId: string, viewerId: string | null): ServiceRatingsFeed {
  return useReviewFeed(providerId, viewerId, {
    list: (cursor) => eHubRatingService.listServiceReviews(providerId, cursor),
    eligibility: () => eHubRatingService.getServiceEligibility(providerId),
    submit: (request) => eHubRatingService.submitServiceReview({ ...request, providerId }),
    remove: (eligibility) => eHubRatingService.deleteServiceReview(eligibility?.providerId ?? providerId),
  });
}

/** An E-Hub product's ratings. */
export function useEHubProductRatings(productId: string, viewerId: string | null): EHubProductRatingsFeed {
  return useReviewFeed(productId, viewerId, {
    list: (cursor) => eHubRatingService.listProductReviews(productId, cursor),
    eligibility: () => eHubRatingService.getProductEligibility(productId),
    submit: (request) => eHubRatingService.submitProductReview({ ...request, productId }),
    remove: () => eHubRatingService.deleteProductReview(productId),
  });
}
