import { collection, getDocs, limit, orderBy, query, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { AppServerError, appServerService } from '@/lib/services/AppServerService';
import { eHubService } from '@/lib/services/EHubService';
import {
  SERVICE_REVIEW_CRITERIA,
  type ModerateEHubProductReviewResponse,
  type ModerateReviewRequest,
  type ModerateServiceReviewResponse,
  type ReviewStatus,
  type ServiceReviewCriteriaScores,
} from '@/lib/types/ratings';

export type ModerationReviewKind = 'service' | 'product';

/** A service rating or E-Hub product review as the admin Ratings moderation tab shows it. */
export type ModerationReview = {
  kind: ModerationReviewKind;
  id: string;
  /** The provider (business) id for a service rating, the product id for a product review. */
  targetId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerAvatar: string | null;
  stars: number;
  /** Product review headline ('' for service ratings). */
  title: string;
  comment: string;
  serviceUsed: string | null;
  criteria: ServiceReviewCriteriaScores | null;
  wouldRecommend: boolean | null;
  verifiedCustomer: boolean;
  status: ReviewStatus;
  createdAtMs: number;
  moderatedAtMs: number | null;
  moderationReason: string | null;
};

const COLLECTIONS: { [kind in ModerationReviewKind]: string } = { service: 'serviceReviews', product: 'ehubProductReviews' };
const PAGE_SIZE = 50;

function readText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function readMillis(value: unknown): number | null {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    const millis: unknown = value.toMillis();
    return typeof millis === 'number' ? millis : null;
  }
  return null;
}

function readCriteria(value: unknown): ServiceReviewCriteriaScores {
  const source: { [key: string]: unknown } = value && typeof value === 'object' ? { ...value } : {};
  return SERVICE_REVIEW_CRITERIA.reduce<ServiceReviewCriteriaScores>(
    (scores, key) => ({ ...scores, [key]: typeof source[key] === 'number' ? source[key] : null }),
    { attitude: null, punctuality: null, presentation: null, quality: null, communication: null, value: null },
  );
}

function toModerationReview(kind: ModerationReviewKind, id: string, data: DocumentData): ModerationReview {
  return {
    kind,
    id,
    targetId: readText(kind === 'service' ? data.providerId : data.productId),
    reviewerId: readText(data.reviewerId),
    reviewerName: readText(data.reviewerName) || 'Member',
    reviewerAvatar: readText(data.reviewerAvatar) || null,
    stars: Number(kind === 'service' ? data.overall : data.rating) || 0,
    title: kind === 'product' ? readText(data.title) : '',
    comment: readText(data.comment),
    serviceUsed: kind === 'service' ? readText(data.serviceUsed) || null : null,
    criteria: kind === 'service' ? readCriteria(data.criteria) : null,
    wouldRecommend: typeof data.wouldRecommend === 'boolean' ? data.wouldRecommend : null,
    verifiedCustomer: data.verifiedCustomer === true,
    status: data.status === 'hidden' ? 'hidden' : 'published',
    createdAtMs: readMillis(data.createdAt) ?? 0,
    moderatedAtMs: readMillis(data.moderatedAt),
    moderationReason: readText(data.moderationReason) || null,
  };
}

/**
 * Admin moderation of E-Hub service ratings and product reviews (same as the website's Ratings tab). Administrators
 * may read every review in Firestore; hiding and republishing go through the website's moderate* callables, which
 * recompute the provider's or product's averages.
 */
export class AdminRatingModerationService {
  /** The newest 50 reviews of one kind (single-field order, no composite index). */
  public async listRecent(kind: ModerationReviewKind): Promise<ModerationReview[]> {
    const snapshot = await getDocs(query(collection(db, COLLECTIONS[kind]), orderBy('createdAt', 'desc'), limit(PAGE_SIZE)));
    return snapshot.docs.map((document) => toModerationReview(kind, document.id, document.data()));
  }

  public async moderate(kind: ModerationReviewKind, request: ModerateReviewRequest): Promise<ModerateServiceReviewResponse | ModerateEHubProductReviewResponse> {
    try {
      return await appServerService.call<ModerateServiceReviewResponse | ModerateEHubProductReviewResponse>(kind === 'service' ? 'moderateServiceReview' : 'moderateEHubProductReview', request, 30_000);
    } catch (error: unknown) {
      console.error('[AdminRatingModerationService.moderate] Error:', error instanceof Error ? error.message : error);
      if (error instanceof AppServerError && error.message && error.code !== 'internal') throw new Error(error.message);
      throw new Error('The review could not be updated. Please try again.');
    }
  }

  /** The provider's or product's public name; null when the listing is no longer public (show the id instead). */
  public async resolveTargetName(kind: ModerationReviewKind, targetId: string): Promise<string | null> {
    try {
      if (kind === 'service') return (await eHubService.getProvider(targetId))?.name || null;
      return (await eHubService.getProduct(targetId))?.product.title || null;
    } catch (error: unknown) {
      console.warn('[AdminRatingModerationService.resolveTargetName] Error:', error instanceof Error ? error.message : error);
      return null;
    }
  }
}

export const adminRatingModerationService = new AdminRatingModerationService();
