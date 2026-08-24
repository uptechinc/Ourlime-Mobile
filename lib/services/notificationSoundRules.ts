const MAX_NOTIFICATION_SOUND_BYTES = 20 * 1024 * 1024;

export type NotificationSoundFileCandidate = {
  fileName: string;
  mimeType?: string | null;
  size?: number | null;
};

export function validateNotificationSoundFile(candidate: NotificationSoundFileCandidate): string | null {
  const normalizedMimeType = candidate.mimeType?.trim().toLowerCase() ?? '';
  const isMp3 = normalizedMimeType === 'audio/mpeg'
    || normalizedMimeType === 'audio/mp3'
    || candidate.fileName.trim().toLowerCase().endsWith('.mp3');
  if (!isMp3) return 'Choose an MP3 audio file.';
  if ((candidate.size ?? 0) > MAX_NOTIFICATION_SOUND_BYTES) return 'Choose an MP3 smaller than 20 MB.';
  return null;
}
