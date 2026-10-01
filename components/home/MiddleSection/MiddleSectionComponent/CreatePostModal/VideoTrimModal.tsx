import SharedVideoTrimModal, { type TrimmedVideoResult } from '@/components/media/VideoTrimModal';
import { MAX_POST_VIDEO_DURATION_SECONDS, type PendingVideoTrim } from '@/lib/services/PostMediaService';
import type { PostMediaDraft } from '@/lib/services/PostService';

type VideoTrimModalProps = {
  pending: PendingVideoTrim;
  queueLength: number;
  onCancel: () => void;
  onComplete: (media: PostMediaDraft) => void;
  onError: (message: string) => void;
};

/** Feed-post adapter around the shared trimmer (components/media/VideoTrimModal.tsx): 2-minute limit. */
export default function VideoTrimModal({ pending, queueLength, onCancel, onComplete, onError }: VideoTrimModalProps) {
  const handleComplete = (result: TrimmedVideoResult) => {
    onComplete({
      uri: result.uri,
      type: 'video',
      // A cut file is always an MP4 written by the device.
      fileName: result.wasCut ? pending.fileName.replace(/\.[^.]+$/, '') + '.mp4' : pending.fileName,
      mimeType: result.wasCut ? 'video/mp4' : pending.mimeType,
      width: pending.asset.width,
      height: pending.asset.height,
      fileSize: result.fileSize,
      durationSeconds: Math.round(result.durationSeconds),
      // Only when the device couldn't cut the file: the full video uploads and players skip to this range.
      trimStartSeconds: result.wasCut ? undefined : result.trimStartSeconds,
      trimEndSeconds: result.wasCut ? undefined : result.trimEndSeconds,
      thumbnailUri: result.thumbnailUri,
    });
  };

  return (
    <SharedVideoTrimModal
      source={{ uri: pending.asset.uri, durationSeconds: pending.durationSeconds, fileSize: pending.fileSize }}
      maxDurationSeconds={MAX_POST_VIDEO_DURATION_SECONDS}
      queueLength={queueLength}
      onCancel={onCancel}
      onComplete={handleComplete}
      onError={onError}
    />
  );
}
