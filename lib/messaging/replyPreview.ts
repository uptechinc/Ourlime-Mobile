import type { FullMessage } from '@/lib/messaging/MessagingService';

function formatSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}

/**
 * Short text for a message in a reply ("Replying to…" bar and the quoted box): voice notes, photos, files and
 * stickers have no text of their own, so they get a label instead of an empty box (same labels as the website).
 */
export function describeMessageForReply(message: FullMessage): string {
  const text = message.message?.trim();
  if (text) return text;
  const audioUrl = message.audioUrl ?? message.voiceNoteData?.audioUrl;
  if (message.type === 'voiceNote' || audioUrl) {
    const duration = message.audioDuration ?? message.voiceNoteData?.audioDuration ?? 0;
    return duration > 0 ? `🎤 Voice note (${formatSeconds(duration)})` : '🎤 Voice note';
  }
  if (message.type === 'sticker' || message.stickerUrl || message.stickerData) return '🎨 Sticker';
  const attachment = message.attachment;
  if (attachment) {
    const fileType = (attachment.fileType || '').toLowerCase();
    if (fileType.startsWith('image/')) return '📷 Photo';
    if (fileType.startsWith('video/')) return '🎥 Video';
    if (fileType.startsWith('audio/')) return `🎵 ${attachment.fileName || 'Audio'}`;
    return `📎 ${attachment.fileName || 'File'}`;
  }
  return 'Message';
}

/** Text to show in a reply's quoted box, falling back to the original message when the stored text is empty. */
export function replyPreviewText(storedText: string | undefined, original: FullMessage | undefined): string {
  if (storedText?.trim()) return storedText;
  return original ? describeMessageForReply(original) : 'Message';
}
