import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import CustomModal from '@/components/ui/CustomModal';
import { reportRatingError } from '@/lib/services/EHubRatingService';

type DeleteReviewConfirmProps = {
  visible: boolean;
  /** "rating" for services, "review" for products. */
  kind: 'rating' | 'review';
  onDelete: () => Promise<void>;
  onDeleted: () => void;
  onCancel: () => void;
  /** Called with a message to show when deleting failed (the dialog closes). */
  onError: (message: string) => void;
};

/** "Delete your rating?" / "Delete your review?" with Delete and Keep it; runs the delete with a busy state. */
export function DeleteReviewConfirm({ visible, kind, onDelete, onDeleted, onCancel, onError }: DeleteReviewConfirmProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const handleConfirm = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete();
      onDeleted();
    } catch (error: unknown) {
      const message = error instanceof Error && error.message ? error.message : 'Ratings are not available right now. Please try again later.';
      reportRatingError('DeleteReviewConfirm.handleConfirm', error);
      AccessibilityInfo.announceForAccessibility(message);
      onError(message);
    } finally {
      setIsDeleting(false);
    }
  };
  const message = kind === 'rating'
    ? 'Your stars, rated areas and comment will be removed. You can rate again later.'
    : 'Your stars and review will be removed from this product. You can review it again later.';
  return <CustomModal visible={visible} type="danger" title={kind === 'rating' ? 'Delete your rating?' : 'Delete your review?'} message={message}
    confirmText="Delete" cancelText="Keep it" isLoading={isDeleting} onConfirm={() => void handleConfirm()} onCancel={onCancel} onClose={onCancel} />;
}
