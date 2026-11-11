import { useCallback, useEffect, useState } from 'react';
import { marketplaceService } from '@/lib/services/MarketplaceService';
import { marketListingDetailService } from '@/lib/services/MarketListingDetailService';
import { marketReviewService } from '@/lib/services/MarketReviewService';
import type { MarketProduct, MarketReview, MarketSellerDetail } from '@/lib/types/reliability';

type ProductDetailState = {
  product: MarketProduct | null;
  productError: string | null;
  seller: MarketSellerDetail | null;
  reviews: MarketReview[];
  reviewsLoading: boolean;
  reviewsError: string | null;
  related: MarketProduct[];
};

const INITIAL_STATE: ProductDetailState = { product: null, productError: null, seller: null, reviews: [], reviewsLoading: true, reviewsError: null, related: [] };

/** One listing for the detail screen: the published product (Firestore), seller block (marketApi), reviews and related. */
export function useMarketProductDetail(ownerId: string | null, productId: string) {
  const [state, setState] = useState<ProductDetailState>(INITIAL_STATE);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let active = true;
    setState(INITIAL_STATE);
    void marketplaceService.product(ownerId, productId).then((product) => {
      if (!active) return;
      setState((current) => ({ ...current, product }));
      void marketplaceService.related(product).then((related) => { if (active) setState((current) => ({ ...current, related })); }).catch(() => undefined);
    }).catch((error: unknown) => {
      if (active) setState((current) => ({ ...current, productError: error instanceof Error ? error.message : 'This listing was removed or is unavailable.' }));
    });
    void marketListingDetailService.detail(productId).then((detail) => {
      if (!active) return;
      setState((current) => ({ ...current, seller: detail.seller }));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [ownerId, productId]);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, reviewsLoading: true, reviewsError: null }));
    void marketReviewService.list(productId).then((reviews) => {
      if (active) setState((current) => ({ ...current, reviews, reviewsLoading: false }));
    }).catch(() => {
      if (active) setState((current) => ({ ...current, reviewsLoading: false, reviewsError: 'Reviews could not be loaded.' }));
    });
    return () => { active = false; };
  }, [productId, generation]);

  const reloadReviews = useCallback(() => setGeneration((value) => value + 1), []);
  return { ...state, reloadReviews };
}
