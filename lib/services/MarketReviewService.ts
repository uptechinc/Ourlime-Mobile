import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { marketApiClient } from './MarketApiClient';
import type { MarketReview } from '@/lib/types/reliability';

export type MarketReviewDraft = { productId: string; rating: number; title: string; comment: string };
export type MarketRatingBreakdown = { star: number; count: number; percentage: number }[];

/** Product reviews: read from Firestore (signed-in read is allowed), written through marketApi POST /api/market/reviews. */
export class MarketReviewService {
  private static instance: MarketReviewService;

  private constructor() {}

  public static getInstance(): MarketReviewService {
    if (!MarketReviewService.instance) MarketReviewService.instance = new MarketReviewService();
    return MarketReviewService.instance;
  }

  /** Newest first, at most 50 (same as GET /api/market/reviews). */
  public async list(productId: string): Promise<MarketReview[]> {
    try {
      const snapshot = await getDocs(query(collection(db, 'productReviews'), where('productId', '==', productId), limit(50)));
      return this.decodeList(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
    } catch (error: unknown) {
      console.warn('[MarketReviewService.list] Error:', error instanceof Error ? error.message : error);
      const reviews = await marketApiClient.request<unknown>('GET', '/api/market/reviews', { query: `productId=${encodeURIComponent(productId)}` });
      return this.decodeList(reviews);
    }
  }

  public async submit(draft: MarketReviewDraft): Promise<string> {
    if (!Number.isInteger(draft.rating) || draft.rating < 1 || draft.rating > 5) throw new Error('Rating must be between 1 and 5 stars.');
    if (!draft.title.trim() || !draft.comment.trim()) throw new Error('Please fill in both the review headline and detailed comments.');
    if (draft.title.trim().length > 200 || draft.comment.trim().length > 5000) throw new Error('Your review is too long.');
    const result = await marketApiClient.request<{ reviewId?: unknown }>('POST', '/api/market/reviews', {
      body: { productId: draft.productId, rating: draft.rating, title: draft.title.trim(), comment: draft.comment.trim() },
    });
    return typeof result?.reviewId === 'string' ? result.reviewId : '';
  }

  /** Web ProductReviewsSection star distribution. */
  public breakdown(reviews: MarketReview[]): MarketRatingBreakdown {
    return [5, 4, 3, 2, 1].map((star) => {
      const count = reviews.filter((review) => Math.round(review.rating) === star).length;
      return { star, count, percentage: reviews.length ? (count / reviews.length) * 100 : 0 };
    });
  }

  public decodeList(value: unknown): MarketReview[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry): MarketReview[] => {
      if (!entry || typeof entry !== 'object') return [];
      const review = entry as Record<string, unknown>;
      if (typeof review.id !== 'string') return [];
      const rating = typeof review.rating === 'number' && Number.isFinite(review.rating) ? Math.min(5, Math.max(1, review.rating)) : 0;
      if (!rating) return [];
      const response = review.sellerResponse && typeof review.sellerResponse === 'object' ? review.sellerResponse as Record<string, unknown> : null;
      return [{
        id: review.id,
        productId: typeof review.productId === 'string' ? review.productId : '',
        reviewerId: typeof review.reviewerId === 'string' ? review.reviewerId : '',
        reviewerName: typeof review.reviewerName === 'string' && review.reviewerName.trim() ? review.reviewerName.trim() : 'Marketplace Buyer',
        rating,
        title: typeof review.title === 'string' ? review.title : '',
        comment: typeof review.comment === 'string' ? review.comment : '',
        verifiedPurchase: review.verifiedPurchase === true,
        sellerResponse: response && typeof response.response === 'string' && response.response.trim()
          ? { response: response.response, respondedAt: this.isoDate(response.respondedAt), sellerName: typeof response.sellerName === 'string' && response.sellerName ? response.sellerName : 'Seller' }
          : null,
        createdAt: this.isoDate(review.createdAt),
      }];
    }).sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  }

  /** ISO string from an ISO string, a Firestore Timestamp, or `{ seconds }` (toClientJson); '' when unknown. */
  public isoDate(value: unknown): string {
    if (typeof value === 'string') return Number.isNaN(Date.parse(value)) ? '' : new Date(value).toISOString();
    if (value && typeof value === 'object') {
      const stamp = value as { toMillis?: () => number; seconds?: unknown; _seconds?: unknown };
      if (typeof stamp.toMillis === 'function') return new Date(stamp.toMillis()).toISOString();
      const seconds = typeof stamp.seconds === 'number' ? stamp.seconds : typeof stamp._seconds === 'number' ? stamp._seconds : null;
      if (seconds !== null) return new Date(seconds * 1000).toISOString();
    }
    return '';
  }
}

export const marketReviewService = MarketReviewService.getInstance();
