import { ProductReviewFormSheet } from '@/components/reviews/ProductReviewFormSheet';
import { marketReviewService } from '@/lib/services/MarketReviewService';

type WriteReviewModalProps = { productId: string; productTitle: string; onClose: () => void; onSuccess: () => void };

/** Market review limits, the same as the website's form: a headline and a review are required. */
const MARKET_REVIEW_LIMITS = { title: 120, comment: 2000 } as const;

/**
 * Web WriteReviewModal: 1–5 stars, headline and comment, sent through marketApi POST /api/market/reviews. Uses the same
 * review sheet as E-Hub products (no preselected stars, counters, inline error, thank-you state).
 */
export default function WriteReviewModal({ productId, productTitle, onClose, onSuccess }: WriteReviewModalProps) {
  return <ProductReviewFormSheet visible productTitle={productTitle} initial={null} limits={MARKET_REVIEW_LIMITS} requiresText
    onSubmit={async (values) => {
      await marketReviewService.submit({ productId, ...values });
      onSuccess();
    }} onClose={onClose} />;
}
