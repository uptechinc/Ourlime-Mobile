import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { deleteObject, getDownloadURL, listAll, ref, uploadBytes } from 'firebase/storage';
import { cacheDirectory, downloadAsync } from 'expo-file-system/legacy';
import { db, storage } from '@/lib/firebaseConfig';
import type { PostLocation, PostMediaDraft, PostVisibility } from '@/lib/services/PostService';
import { DiagnosticLogService } from './DiagnosticLogService';

export type CreationDraftKind = 'post' | 'lime';

export const MAX_DRAFTS_PER_KIND = 5;
export const DRAFT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export const DRAFT_REMINDER_DAYS = 3;

/** One media file in a draft (same fields the website writes). */
export type CreationDraftMedia = {
  type: 'image' | 'video';
  typeUrl: string;
  fileName: string;
  originalName: string;
  contentType: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  coverUrl?: string;
};

export type CreationDraftLimeDetails = { category?: string; privacy?: string; durationSeconds?: number };

/** A saved draft as listed (postDrafts/{uid}/items/{draftId}). */
export type CreationDraft = {
  id: string;
  kind: CreationDraftKind;
  title: string;
  content: string;
  visibility: 'public' | 'private';
  appVisibility?: PostVisibility;
  selectedLocation: PostLocation | null;
  hashtags: string[];
  media: CreationDraftMedia[];
  lime?: CreationDraftLimeDetails;
  createdAtMs: number;
  expiresAtMs: number;
  updatedAtMs: number;
  /** Day (`Y-M-D`, local) the expiry warning was last shown on any device, so the app and website show it once a day. */
  reminderShownOn?: string;
};

/** What a composer saves and gets back when it opens a draft. */
export type CreationDraftContent = {
  caption: string;
  visibility: PostVisibility;
  location?: PostLocation;
  hashtags: string[];
  media: PostMediaDraft[];
  lime?: CreationDraftLimeDetails;
};

/** Saving would exceed 5 drafts of this kind: the user must delete one first. */
export class DraftLimitError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'DraftLimitError';
  }
}

type StoredDraftRecord = Partial<Omit<CreationDraft, 'id'>> & {
  createdAt?: { toMillis?: () => number };
  updatedAt?: { toMillis?: () => number };
  mentions?: string[];
  status?: string;
  migratedToItems?: boolean;
};

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function draftTitle(content: string, kind: CreationDraftKind): string {
  const firstLine = content.trim().split('\n')[0]?.trim() ?? '';
  return firstLine ? firstLine.slice(0, 80) : kind === 'lime' ? 'Untitled Lime' : 'Untitled post';
}

/** Whole days left before expiry, rounded up (1 = the last day). */
export function draftDaysLeft(expiresAtMs: number, now = Date.now()): number {
  return Math.ceil((expiresAtMs - now) / (24 * 60 * 60 * 1000));
}

async function uploadFromUri(path: string, uri: string, contentType: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, blob, { contentType });
  return getDownloadURL(fileRef);
}

/**
 * Feed-post and Lime drafts, shared with the website (it reads/writes the same records through
 * app/api/posts/drafts). Up to 5 per kind; each is deleted 7 days after it was created (DraftExpiryService).
 */
export class CreationDraftService {
  private static instance: CreationDraftService;
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): CreationDraftService {
    if (!CreationDraftService.instance) CreationDraftService.instance = new CreationDraftService();
    return CreationDraftService.instance;
  }

  public async list(uid: string, kind?: CreationDraftKind): Promise<CreationDraft[]> {
    await this.migrateLegacyDraft(uid);
    const snapshot = await getDocs(collection(db, 'postDrafts', uid, 'items'));
    return snapshot.docs
      .map((document) => this.toDraft(document.id, document.data() as StoredDraftRecord))
      .filter((draft) => !kind || draft.kind === kind)
      .sort((first, second) => second.updatedAtMs - first.updatedAtMs);
  }

  /** Uploads the media and creates (no draftId) or updates a draft. Returns its id. */
  public async save(uid: string, kind: CreationDraftKind, content: CreationDraftContent, draftId?: string): Promise<string> {
    const itemsRef = collection(db, 'postDrafts', uid, 'items');
    const existing = draftId ? await getDoc(doc(itemsRef, draftId)) : null;
    if (!existing?.exists()) {
      const sameKind = (await getDocs(itemsRef)).docs.filter((document) => ((document.data() as StoredDraftRecord).kind ?? 'post') === kind);
      if (sameKind.length >= MAX_DRAFTS_PER_KIND) {
        throw new DraftLimitError(`You already have ${MAX_DRAFTS_PER_KIND} ${kind === 'lime' ? 'Lime' : 'post'} drafts. Delete one to save this draft.`);
      }
    }
    const id = existing?.exists() ? existing.id : (draftId ?? doc(itemsRef).id);
    const folder = `postDrafts/${uid}/${id}`;
    const keptPaths = new Set<string>();
    const media: CreationDraftMedia[] = [];
    for (const [index, item] of content.media.slice(0, 10).entries()) {
      const originalName = item.fileName || `${item.type}-${index}`;
      const fileName = `${index}_${safeFileName(originalName)}`;
      const contentType = item.mimeType || (item.type === 'video' ? 'video/mp4' : 'image/jpeg');
      keptPaths.add(`${folder}/${fileName}`);
      const typeUrl = await uploadFromUri(`${folder}/${fileName}`, item.uri, contentType);
      let coverUrl: string | undefined;
      if (item.type === 'video' && item.thumbnailUri) {
        keptPaths.add(`${folder}/cover_${index}.jpg`);
        coverUrl = await uploadFromUri(`${folder}/cover_${index}.jpg`, item.thumbnailUri, 'image/jpeg').catch(() => undefined);
      }
      media.push({
        type: item.type, typeUrl, fileName, originalName, contentType,
        ...(item.width ? { width: item.width } : {}),
        ...(item.height ? { height: item.height } : {}),
        ...(item.durationSeconds ? { durationSeconds: item.durationSeconds } : {}),
        ...(coverUrl ? { coverUrl } : {}),
      });
    }
    const now = Date.now();
    await setDoc(doc(itemsRef, id), {
      kind,
      authorId: uid,
      title: draftTitle(content.caption, kind),
      content: content.caption.slice(0, 2200),
      // The website only knows public/private; the app's own audience is kept alongside.
      visibility: content.visibility === 'private' ? 'private' : 'public',
      appVisibility: content.visibility,
      selectedLocation: content.location ?? null,
      hashtags: content.hashtags.slice(0, 20).map((tag) => `#${tag.toLowerCase()}`),
      mentions: Array.from(new Set(content.caption.match(/@[\w.-]+/g)?.map((mention) => mention.slice(1)) ?? [])).slice(0, 50),
      media,
      ...(content.lime ? { lime: content.lime } : {}),
      updatedAt: serverTimestamp(),
      updatedAtMs: now,
      // Editing never extends the 7-day life (it runs from creation).
      ...(existing?.exists() ? {} : { createdAt: serverTimestamp(), createdAtMs: now, expiresAtMs: now + DRAFT_LIFETIME_MS }),
    }, { merge: true });
    await this.deleteFilesExcept(folder, keptPaths);
    this.logger.info('CreationDraftService', 'save', { kind, mediaCount: media.length, updated: Boolean(existing?.exists()) });
    return id;
  }

  /** Downloads a draft's media to the cache so the composer can edit and post it. */
  public async open(draft: CreationDraft): Promise<{ content: CreationDraftContent; failedMedia: number }> {
    const media: PostMediaDraft[] = [];
    let failedMedia = 0;
    for (const [index, item] of draft.media.entries()) {
      try {
        const localUri = await this.download(item.typeUrl, `${draft.id}-${index}_${safeFileName(item.originalName || item.fileName)}`);
        const thumbnailUri = item.coverUrl ? await this.download(item.coverUrl, `${draft.id}-cover_${index}.jpg`).catch(() => undefined) : undefined;
        media.push({
          uri: localUri,
          type: item.type === 'video' ? 'video' : 'image',
          fileName: item.originalName || item.fileName,
          mimeType: item.contentType,
          width: item.width,
          height: item.height,
          durationSeconds: item.durationSeconds,
          thumbnailUri,
        });
      } catch (error: unknown) {
        failedMedia += 1;
        this.logger.warn('CreationDraftService', 'open:media-failed', { index, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return {
      content: {
        caption: draft.content,
        visibility: draft.appVisibility ?? draft.visibility,
        location: draft.selectedLocation ?? undefined,
        hashtags: draft.hashtags.map((tag) => tag.replace(/^#+/, '').toLowerCase()).filter(Boolean),
        media,
        lime: draft.lime,
      },
      failedMedia,
    };
  }

  /** Deletes the draft and its files. */
  /** Marks the expiry warning as shown today for these drafts (read by the website too). */
  public async markReminded(uid: string, draftIds: string[], day: string): Promise<void> {
    if (draftIds.length === 0) return;
    const batch = writeBatch(db);
    draftIds.forEach((draftId) => batch.update(doc(db, 'postDrafts', uid, 'items', draftId), { reminderShownOn: day }));
    await batch.commit();
  }

  public async remove(uid: string, draftId: string): Promise<void> {
    await deleteDoc(doc(db, 'postDrafts', uid, 'items', draftId));
    await this.deleteFilesExcept(`postDrafts/${uid}/${draftId}`, new Set());
    if (draftId === 'legacy') await this.deleteFilesExcept(`postDrafts/${uid}/current`, new Set());
  }

  private toDraft(id: string, data: StoredDraftRecord): CreationDraft {
    const kind: CreationDraftKind = data.kind === 'lime' ? 'lime' : 'post';
    const serverCreatedAtMs = data.createdAt?.toMillis?.();
    const createdAtMs = typeof serverCreatedAtMs === 'number' ? serverCreatedAtMs : typeof data.createdAtMs === 'number' ? data.createdAtMs : Date.now();
    return {
      id,
      kind,
      title: typeof data.title === 'string' ? data.title : draftTitle(data.content ?? '', kind),
      content: typeof data.content === 'string' ? data.content : '',
      visibility: data.visibility === 'private' ? 'private' : 'public',
      appVisibility: data.appVisibility,
      selectedLocation: data.selectedLocation ?? null,
      hashtags: Array.isArray(data.hashtags) ? data.hashtags.filter((tag): tag is string => typeof tag === 'string') : [],
      media: Array.isArray(data.media) ? data.media : [],
      lime: data.lime,
      createdAtMs,
      expiresAtMs: typeof serverCreatedAtMs === 'number' || typeof data.expiresAtMs !== 'number' ? createdAtMs + DRAFT_LIFETIME_MS : data.expiresAtMs,
      updatedAtMs: typeof data.updatedAtMs === 'number' ? data.updatedAtMs : data.updatedAt?.toMillis?.() ?? createdAtMs,
      ...(typeof data.reminderShownOn === 'string' ? { reminderShownOn: data.reminderShownOn } : {}),
    };
  }

  /** The old one-draft-per-user document (postDrafts/{uid}) becomes an item, keeping its creation time. */
  private async migrateLegacyDraft(uid: string): Promise<void> {
    const legacyRef = doc(db, 'postDrafts', uid);
    const legacy = await getDoc(legacyRef);
    const data = legacy.data() as StoredDraftRecord | undefined;
    if (!legacy.exists() || !data || data.status !== 'draft' || data.migratedToItems) return;
    const createdAtMs = data.createdAt?.toMillis?.() ?? Date.now();
    await setDoc(doc(db, 'postDrafts', uid, 'items', 'legacy'), {
      kind: 'post',
      authorId: uid,
      title: draftTitle(data.content ?? '', 'post'),
      content: data.content ?? '',
      visibility: data.visibility === 'private' ? 'private' : 'public',
      ...(data.appVisibility ? { appVisibility: data.appVisibility } : {}),
      selectedLocation: data.selectedLocation ?? null,
      hashtags: data.hashtags ?? [],
      mentions: data.mentions ?? [],
      media: data.media ?? [],
      createdAtMs,
      expiresAtMs: createdAtMs + DRAFT_LIFETIME_MS,
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    }, { merge: true });
    await setDoc(legacyRef, { migratedToItems: true, status: 'migrated' }, { merge: true });
  }

  private async download(url: string, name: string): Promise<string> {
    const target = `${cacheDirectory ?? ''}draft-${Date.now()}-${name}`;
    const result = await downloadAsync(url, target);
    if (result.status < 200 || result.status >= 300) throw new Error(`Download failed (${result.status})`);
    return result.uri;
  }

  private async deleteFilesExcept(folder: string, keep: Set<string>): Promise<void> {
    try {
      const listing = await listAll(ref(storage, folder));
      await Promise.all(listing.items.filter((item) => !keep.has(item.fullPath)).map((item) => deleteObject(item).catch(() => undefined)));
    } catch (error: unknown) {
      this.logger.warn('CreationDraftService', 'cleanup:failed', { error: error instanceof Error ? error.message : String(error) });
    }
  }
}

export const creationDraftService = CreationDraftService.getInstance();
