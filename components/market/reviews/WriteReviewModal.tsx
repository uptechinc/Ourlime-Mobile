import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { marketReviewService } from '@/lib/services/MarketReviewService';
import MarketFormModal, { MarketButton, MarketField } from '../MarketFormModal';

type WriteReviewModalProps = { productId: string; productTitle: string; onClose: () => void; onSuccess: () => void };

/** Web WriteReviewModal: 1–5 stars, headline and comment, sent through marketApi POST /api/market/reviews. */
export default function WriteReviewModal({ productId, productTitle, onClose, onSuccess }: WriteReviewModalProps) {
  const { colors } = useAppTheme();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await marketReviewService.submit({ productId, rating, title, comment });
      setDone(true);
      onSuccess();
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'Failed to submit review');
    } finally {
      setBusy(false);
    }
  };

  return <MarketFormModal visible busy={busy} title="Write a review" onClose={onClose}>
    <Text style={{ color: colors.secondaryText }}>{productTitle}</Text>
    {done ? <>
      <Text accessibilityRole="alert" style={{ color: colors.accentText, fontWeight: '800' }}>Thank you! Your review has been published.</Text>
      <MarketButton label="Done" onPress={onClose} />
    </> : <>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Your rating</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((star) => <Pressable key={star} accessibilityRole="radio" accessibilityState={{ checked: rating === star }} accessibilityLabel={`Rate ${star} star${star > 1 ? 's' : ''}`} onPress={() => setRating(star)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Star size={30} color={rating >= star ? '#f59e0b' : colors.mutedText} fill={rating >= star ? '#f59e0b' : 'transparent'} />
        </Pressable>)}
        <Text style={{ color: colors.mutedText, marginLeft: 6 }}>{rating} of 5 stars</Text>
      </View>
      <MarketField label="Review headline" value={title} onChangeText={setTitle} />
      <MarketField label="Detailed comments" value={comment} onChangeText={setComment} multiline />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.destructiveText }}>{error}</Text> : null}
      <MarketButton label={busy ? 'Submitting…' : 'Submit review'} disabled={busy || !title.trim() || !comment.trim()} onPress={() => void handleSubmit()} />
    </>}
  </MarketFormModal>;
}
