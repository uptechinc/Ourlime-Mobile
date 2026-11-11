import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MessageSquare, ShieldCheck, Star } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { marketReviewService } from '@/lib/services/MarketReviewService';
import type { MarketReview } from '@/lib/types/reliability';
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
  onRetry: () => void;
  onReviewAdded: () => void;
};

const formatDate = (iso: string): string => iso ? new Date(iso).toLocaleDateString() : '';

type StarsProps = { value: number; size: number };
function Stars({ value, size }: StarsProps) {
  const { colors } = useAppTheme();
  return <View style={{ flexDirection: 'row' }}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} size={size} color={star <= Math.round(value) ? '#f59e0b' : colors.mutedText} fill={star <= Math.round(value) ? '#f59e0b' : 'transparent'} />)}</View>;
}

/** Web ProductReviewsSection: average, star distribution, review list with verified-purchase and seller responses. */
export default function ProductReviewsSection({ productId, productTitle, reviews, loading, error, averageRating, ratingCount, canWrite, onRetry, onReviewAdded }: ProductReviewsSectionProps) {
  const { colors } = useAppTheme();
  const [writeOpen, setWriteOpen] = useState(false);
  const count = ratingCount || reviews.length;
  const average = averageRating ?? (reviews.length ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0);
  const breakdown = marketReviewService.breakdown(reviews);
  return <View style={{ gap: 12, paddingTop: 6 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>Customer Reviews</Text>
        {count > 0 && average > 0 ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><Stars value={average} size={15} /><Text style={{ color: colors.text, fontWeight: '800' }}>{average.toFixed(1)} out of 5</Text><Text style={{ color: colors.mutedText, fontSize: 12 }}>({count} {count === 1 ? 'global rating' : 'global ratings'})</Text></View>
          : <Text style={{ color: colors.mutedText }}>No reviews yet</Text>}
      </View>
      {canWrite ? <Pressable accessibilityRole="button" onPress={() => setWriteOpen(true)} style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 12, backgroundColor: colors.text }}><Text style={{ color: colors.canvas, fontWeight: '800', fontSize: 12 }}>Write a Review</Text></Pressable> : null}
    </View>
    {reviews.length ? <View style={{ padding: 12, gap: 7, borderRadius: 14, backgroundColor: colors.surface }}>
      {breakdown.map(({ star, count: starCount, percentage }) => <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ width: 48, color: colors.secondaryText, fontSize: 12 }}>{star} star</Text>
        <View style={{ flex: 1, height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.control }}><View style={{ width: `${percentage}%`, height: '100%', backgroundColor: '#f59e0b' }} /></View>
        <Text style={{ width: 28, textAlign: 'right', color: colors.mutedText, fontSize: 12, fontWeight: '700' }}>{starCount}</Text>
      </View>)}
    </View> : null}
    {loading ? <Text style={{ color: colors.mutedText }}>Loading reviews…</Text> : null}
    {error ? <Pressable accessibilityRole="button" onPress={onRetry} style={{ padding: 12, borderRadius: 12, backgroundColor: colors.destructiveSurface }}><Text style={{ color: colors.destructiveText }}>{error} Tap to retry.</Text></Pressable> : null}
    {!loading && !error && !reviews.length ? <View style={{ paddingVertical: 26, alignItems: 'center', gap: 6, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border }}>
      <MessageSquare size={30} color={colors.mutedText} />
      <Text style={{ color: colors.text, fontWeight: '800' }}>No customer reviews yet</Text>
      <Text style={{ color: colors.mutedText, fontSize: 12 }}>Be the first to share your thoughts on this product!</Text>
    </View> : null}
    {reviews.map((review) => <View key={review.id} style={{ padding: 13, gap: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface }}><Text style={{ color: colors.accentText, fontWeight: '900' }}>{review.reviewerName.charAt(0).toUpperCase() || 'U'}</Text></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>{review.reviewerName}</Text>
            {review.verifiedPurchase ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><ShieldCheck size={12} color={colors.accentText} /><Text style={{ color: colors.accentText, fontSize: 10, fontWeight: '800' }}>Verified Purchase</Text></View> : null}
          </View>
        </View>
        <Text style={{ color: colors.mutedText, fontSize: 11 }}>{formatDate(review.createdAt)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><Stars value={review.rating} size={13} />{review.title ? <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13, flexShrink: 1 }}>{review.title}</Text> : null}</View>
      {review.comment ? <Text style={{ color: colors.secondaryText, lineHeight: 19 }}>{review.comment}</Text> : null}
      {review.sellerResponse ? <View style={{ marginTop: 4, padding: 10, gap: 4, borderLeftWidth: 3, borderLeftColor: colors.accent, borderRadius: 10, backgroundColor: colors.control }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={{ color: colors.text, fontWeight: '800', fontSize: 12, flex: 1 }}>Response from {review.sellerResponse.sellerName}:</Text><Text style={{ color: colors.mutedText, fontSize: 11 }}>{formatDate(review.sellerResponse.respondedAt)}</Text></View>
        <Text style={{ color: colors.secondaryText, fontStyle: 'italic', fontSize: 12 }}>{review.sellerResponse.response}</Text>
      </View> : null}
    </View>)}
    {writeOpen ? <WriteReviewModal productId={productId} productTitle={productTitle} onClose={() => setWriteOpen(false)} onSuccess={onReviewAdded} /> : null}
  </View>;
}
