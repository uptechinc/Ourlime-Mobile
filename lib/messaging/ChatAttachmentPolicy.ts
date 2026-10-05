import { getInfoAsync } from 'expo-file-system/legacy';

/** Same cap as the `chats/` and `voiceNotes/` Storage rules (25 MB). */
export const MAX_CHAT_FILE_BYTES = 25 * 1024 * 1024;
/** Videos are trimmed to fit under this, leaving room for container overhead. */
export const CHAT_VIDEO_TARGET_BYTES = 24 * 1024 * 1024;
export const CHAT_IMAGE_MAX_DIMENSION = 1600;
export const MAX_VOICE_NOTE_SECONDS = 5 * 60;
export const MIN_VOICE_NOTE_SECONDS = 1;

export type ChatAttachmentKind = 'image' | 'video' | 'document';

export type ChatAttachmentCheck =
  | { ok: true; mimeType: string; sizeBytes: number }
  | { ok: false; reason: 'type' | 'size' | 'unreadable'; message: string; sizeBytes: number };

const EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp',
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', webm: 'video/webm', '3gp': 'video/3gpp', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac',
  pdf: 'application/pdf',
  txt: 'text/plain', csv: 'text/csv', md: 'text/markdown', html: 'text/html', htm: 'text/html', xml: 'text/xml', json: 'text/plain', log: 'text/plain',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

// Storage rule: image/* video/* audio/* application/pdf text/* .doc .docx
const ALLOWED_MIME = /^(image\/.+|video\/.+|audio\/.+|application\/pdf|text\/.+|application\/(msword|vnd\.openxmlformats-officedocument\.wordprocessingml\.document))$/i;

export const ALLOWED_FILES_LABEL = 'photos, videos, audio, PDF, Word (.doc/.docx) and text files';

export function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The MIME type the upload will use: picker type when useful, otherwise from the extension. */
export function resolveChatMimeType(fileName: string, pickerMimeType?: string | null, kind?: ChatAttachmentKind): string {
  const picked = (pickerMimeType || '').toLowerCase();
  if (picked && picked !== 'application/octet-stream' && picked.includes('/')) {
    // JSON/JS files are previewed as text, and the Storage rule only accepts text/*.
    if (picked === 'application/json' || picked === 'application/javascript' || picked === 'application/xml') return 'text/plain';
    return picked;
  }
  const extension = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() ?? '' : '';
  return EXTENSION_MIME[extension] ?? (kind === 'image' ? 'image/jpeg' : kind === 'video' ? 'video/mp4' : 'application/octet-stream');
}

export async function readFileSize(uri: string, reportedSize?: number | null): Promise<number> {
  if (typeof reportedSize === 'number' && reportedSize > 0) return reportedSize;
  try {
    const info = await getInfoAsync(uri);
    return info.exists && typeof info.size === 'number' ? info.size : 0;
  } catch (error: unknown) {
    console.warn('[ChatAttachmentPolicy.readFileSize] Error:', error instanceof Error ? error.message : String(error));
    return 0;
  }
}

/** Checks a picked file against the Storage rule before uploading (type + 25 MB). */
export function checkChatAttachment(fileName: string, mimeType: string, sizeBytes: number): ChatAttachmentCheck {
  if (!ALLOWED_MIME.test(mimeType)) {
    return { ok: false, reason: 'type', sizeBytes, message: `"${fileName}" can't be sent. You can send ${ALLOWED_FILES_LABEL}.` };
  }
  if (sizeBytes > MAX_CHAT_FILE_BYTES) {
    return { ok: false, reason: 'size', sizeBytes, message: `"${fileName}" is ${formatMegabytes(sizeBytes)}. Files must be 25 MB or smaller.` };
  }
  return { ok: true, mimeType, sizeBytes };
}

/** Longest clip (seconds) that should fit under the chat limit at this video's bitrate. */
export function maxVideoSecondsForLimit(durationSeconds: number, sizeBytes: number): number {
  if (durationSeconds <= 0 || sizeBytes <= 0) return 30;
  return Math.max(1, Math.floor((durationSeconds * CHAT_VIDEO_TARGET_BYTES) / sizeBytes));
}
