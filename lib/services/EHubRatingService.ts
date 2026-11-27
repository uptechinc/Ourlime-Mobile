import { AppServerError, appServerService } from '@/lib/services/AppServerService';
import {
  PRODUCT_NO_INTERACTION_MESSAGE,
  RATING_LIMITS,
  REVIEW_INELIGIBLE_MESSAGES,
  type DeleteEHubProductReviewResponse,
  type DeleteServiceReviewResponse,
  type EHubProductReviewEligibilityResponse,
  type ListEHubProductReviewsResponse,
  type ListServiceReviewsResponse,
  type ReviewIneligibleReason,
  type ServiceReviewEligibilityResponse,
  type SubmitEHubProductReviewRequest,
  type SubmitEHubProductReviewResponse,
  type SubmitServiceReviewRequest,
  type SubmitServiceReviewResponse,
} from '@/lib/types/ratings';

/** A reason code from the rating callables, plus INVALID_INPUT (a field the server refused). */
export type RatingErrorReason = ReviewIneligibleReason | 'INVALID_INPUT';
export type RatingTargetKind = 'service' | 'product';

/** A rating request that failed, with the reason the server gave (null when the server could not be reached). */
export class RatingRequestError extends Error {
  public constructor(public readonly reason: RatingErrorReason | null, message: string, public readonly isUnavailable: boolean) {
    super(message);
    this.name = 'RatingRequestError';
  }
}

const REASONS = new Set<RatingErrorReason>(['SIGN_IN_REQUIRED', 'ACCOUNT_RESTRICTED', 'OWN_LISTING', 'NO_INTERACTION', 'NOT_FOUND', 'INVALID_INPUT']);
const UNAVAILABLE_MESSAGE = 'Ratings are not available right now. Please try again later.';

function readReason(details: unknown): RatingErrorReason | null {
  if (!details || typeof details !== 'object' || !('reason' in details)) return null;
  const reason: unknown = details.reason;
  return typeof reason === 'string' && REASONS.has(reason as RatingErrorReason) ? reason as RatingErrorReason : null;
}

/**
 * Logs a failed rating request: unavailable (e.g. the callables are not deployed yet) is expected and shown calmly, so it
 * is a warning; anything else is an error.
 */
export function reportRatingError(where: string, error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unknown error';
  if (error instanceof RatingRequestError && (error.isUnavailable || error.reason !== null)) console.warn(`[${where}] Error:`, message);
  else console.error(`[${where}] Error:`, message);
}

/** The message for an ineligible reason, with the product wording of NO_INTERACTION. */
export function describeIneligibleReason(reason: ReviewIneligibleReason, kind: RatingTargetKind): string {
  return reason === 'NO_INTERACTION' && kind === 'product' ? PRODUCT_NO_INTERACTION_MESSAGE : REVIEW_INELIGIBLE_MESSAGES[reason];
}

/**
 * E-Hub service ratings (per provider, with a criteria breakdown) and E-Hub product ratings, through the website's
 * rating callables (functions/src/RatingService.ts; contract in lib/types/ratings.ts). Every failure comes back as a
 * RatingRequestError carrying the server's reason, or isUnavailable when the callables cannot be reached (e.g. not
 * deployed yet), so screens can keep showing what they already know.
 */
export class EHubRatingService {
  private static instance: EHubRatingService;

  private constructor() {}

  public static getInstance(): EHubRatingService {
    if (!EHubRatingService.instance) EHubRatingService.instance = new EHubRatingService();
    return EHubRatingService.instance;
  }

  public listServiceReviews(providerId: string, cursor: string | null = null): Promise<ListServiceReviewsResponse> {
    return this.call<ListServiceReviewsResponse>('listServiceReviews', { providerId, limit: RATING_LIMITS.listPageSize, cursor }, 'service');
  }

  public getServiceEligibility(providerId: string): Promise<ServiceReviewEligibilityResponse> {
    return this.call<ServiceReviewEligibilityResponse>('getServiceReviewEligibility', { providerId }, 'service');
  }

  public submitServiceReview(request: SubmitServiceReviewRequest): Promise<SubmitServiceReviewResponse> {
    return this.call<SubmitServiceReviewResponse>('submitServiceReview', request, 'service');
  }

  public deleteServiceReview(providerId: string): Promise<DeleteServiceReviewResponse> {
    return this.call<DeleteServiceReviewResponse>('deleteServiceReview', { providerId }, 'service');
  }

  public listProductReviews(productId: string, cursor: string | null = null): Promise<ListEHubProductReviewsResponse> {
    return this.call<ListEHubProductReviewsResponse>('listEHubProductReviews', { productId, limit: RATING_LIMITS.listPageSize, cursor }, 'product');
  }

  public getProductEligibility(productId: string): Promise<EHubProductReviewEligibilityResponse> {
    return this.call<EHubProductReviewEligibilityResponse>('getEHubProductReviewEligibility', { productId }, 'product');
  }

  public submitProductReview(request: SubmitEHubProductReviewRequest): Promise<SubmitEHubProductReviewResponse> {
    return this.call<SubmitEHubProductReviewResponse>('submitEHubProductReview', request, 'product');
  }

  public deleteProductReview(productId: string): Promise<DeleteEHubProductReviewResponse> {
    return this.call<DeleteEHubProductReviewResponse>('deleteEHubProductReview', { productId }, 'product');
  }

  private async call<TResponse>(name: string, data: object, kind: RatingTargetKind): Promise<TResponse> {
    try {
      return await appServerService.call<TResponse>(name, data);
    } catch (error: unknown) {
      throw this.toRatingError(error, kind);
    }
  }

  private toRatingError(error: unknown, kind: RatingTargetKind): RatingRequestError {
    if (!(error instanceof AppServerError)) return new RatingRequestError(null, UNAVAILABLE_MESSAGE, true);
    const reason = readReason(error.details);
    if (reason === 'INVALID_INPUT') return new RatingRequestError(reason, error.message || 'Check your rating and try again.', false);
    if (reason) return new RatingRequestError(reason, reason === 'NO_INTERACTION' && kind === 'product' ? PRODUCT_NO_INTERACTION_MESSAGE : error.message || describeIneligibleReason(reason, kind), false);
    if (error.code === 'unauthenticated') return new RatingRequestError('SIGN_IN_REQUIRED', REVIEW_INELIGIBLE_MESSAGES.SIGN_IN_REQUIRED, false);
    // No reason: the function is missing (not deployed), unreachable or failed unexpectedly.
    return new RatingRequestError(null, UNAVAILABLE_MESSAGE, true);
  }
}

export const eHubRatingService = EHubRatingService.getInstance();
