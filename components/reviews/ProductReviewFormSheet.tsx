import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, StyleSheet, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { StarRatingInput } from './RatingStars';
import { RequiredLabel, ReviewField, ReviewFooter, ReviewSheet, ReviewSuccess } from './ReviewSheet';
import { reportRatingError } from '@/lib/services/EHubRatingService';
import { DeleteReviewConfirm } from './DeleteReviewConfirm';

export type ProductReviewValues = { rating: number; title: string; comment: string };

type ProductReviewFormSheetProps = {
  visible: boolean;
  productTitle: string;
  /** The member's current review, to edit (null to write a new one). */
  initial: ProductReviewValues | null;
  limits: { title: number; comment: number };
  /** Market needs a headline and a review; E-Hub makes both optional. */
  requiresText?: boolean;
  /** Shown above the fields when a new review will carry the Verified order badge. */
  verifiedNote?: string | null;
  onSubmit: (values: ProductReviewValues) => Promise<void>;
  /** Only for an existing review where the server supports deleting it. */
  onDelete?: () => Promise<void>;
  /** After a delete from the sheet: the sheet closes and the section shows this message. */
  onDeleted?: (message: string) => void;
  onClose: () => void;
};

function readMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Write or edit a product review (E-Hub and Market): stars (required, nothing preselected), a headline and a review
 * with counters, an inline error, a confirmed Delete for an existing review, and a confirmation state.
 */
export function ProductReviewFormSheet({ visible, productTitle, initial, limits, requiresText = false, verifiedNote, onSubmit, onDelete, onDeleted, onClose }: ProductReviewFormSheetProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const initialRef = useRef(initial);
  initialRef.current = initial;

  // Each opening starts from the member's current review (or blank); saving does not reset the open sheet.
  useEffect(() => {
    if (!visible) return;
    const start = initialRef.current;
    setRating(start?.rating ?? 0); setTitle(start?.title ?? ''); setComment(start?.comment ?? '');
    setError(null); setDone(null); setIsConfirmingDelete(false); setIsEditing(Boolean(start));
  }, [visible]);

  const missing = rating < 1 ? 'Choose a star rating.' : requiresText && !title.trim() ? 'Add a headline.' : requiresText && !comment.trim() ? 'Add your review.' : null;

  const handleSubmit = async () => {
    if (missing) { setError(missing); AccessibilityInfo.announceForAccessibility(missing); return; }
    Keyboard.dismiss();
    setIsSubmitting(true); setError(null);
    try {
      await onSubmit({ rating, title: title.trim(), comment: comment.trim() });
      const message = isEditing ? 'Your review is updated.' : 'Thanks — your review is posted.';
      setDone(message);
      AccessibilityInfo.announceForAccessibility(message);
    } catch (submitError: unknown) {
      const message = readMessage(submitError, 'Ratings are not available right now. Please try again later.');
      reportRatingError('ProductReviewFormSheet.handleSubmit', submitError);
      setError(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleted = () => {
    setIsConfirmingDelete(false);
    AccessibilityInfo.announceForAccessibility('Your review was deleted.');
    if (onDeleted) { onDeleted('Your review was deleted.'); onClose(); return; }
    setDone('Your review was deleted.');
  };

  return <ReviewSheet visible={visible} title={isEditing ? 'Edit your review' : 'Write a review'} subtitle={productTitle} isBusy={isSubmitting} onClose={onClose}
    footer={done ? null : <ReviewFooter submitLabel={isEditing ? 'Save changes' : 'Post review'} busyLabel={isEditing ? 'Saving…' : 'Posting…'} isSubmitting={isSubmitting} isDisabled={false}
      error={error} onSubmit={() => void handleSubmit()} onDelete={isEditing && onDelete ? () => setIsConfirmingDelete(true) : undefined} />}>
    {done ? <ReviewSuccess title={done} onDone={onClose} /> : <>
      <View style={styles.block}>
        <RequiredLabel text="Your rating" />
        <StarRatingInput value={rating} onChange={(next) => { setRating(next); setError(null); }} label="Your rating" size={34} showWord />
      </View>
      {verifiedNote ? <View style={styles.verified}><ShieldCheck size={15} color={colors.successText} /><Text style={styles.verifiedText}>{verifiedNote}</Text></View> : null}
      <ReviewField label="Headline" value={title} onChangeText={setTitle} maxLength={limits.title} isOptional={!requiresText} />
      <ReviewField label="Review" value={comment} onChangeText={setComment} maxLength={limits.comment} isOptional={!requiresText} multiline />
    </>}
    {onDelete ? <DeleteReviewConfirm visible={isConfirmingDelete} kind="review" onDelete={onDelete} onDeleted={handleDeleted} onCancel={() => setIsConfirmingDelete(false)}
      onError={(message) => { setIsConfirmingDelete(false); setError(message); }} /> : null}
  </ReviewSheet>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  block: { gap: 2 },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10, borderRadius: 10, backgroundColor: colors.successSurface },
  verifiedText: { flex: 1, color: colors.successText, fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
