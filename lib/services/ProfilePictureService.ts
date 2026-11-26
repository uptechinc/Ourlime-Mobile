import type { DocumentData } from 'firebase/firestore';
import { firestoreBatchReadService } from './FirestoreBatchReadService';

/**
 * Looks up members' profile pictures. A picture is not stored on users/{uid}: it is the profileImages document picked
 * in profileImageSetAs (setAs 'profile', else 'postProfile'; ProfileMediaService writes both). Screens that only read
 * the user document therefore showed initials instead of the photo.
 *
 * Requests made in the same moment are batched into one pair of `in` queries, and answers (including "no picture")
 * are cached for a while, so a list of 50 avatars costs two reads per 30 people, not 100 reads.
 */
type CacheEntry = { url: string | null; expiresAt: number };
type Waiter = { resolve: (url: string | null) => void };

const CACHE_MS = 10 * 60 * 1000;
const SLOT_PRIORITY: Record<string, number> = { profile: 2, postProfile: 1 };

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const readImageUrl = (data: DocumentData | undefined): string =>
  readString(data?.imageURL) || readString(data?.imageUrl) || readString(data?.downloadURL) || readString(data?.url);

export class ProfilePictureService {
  private static instance: ProfilePictureService;
  private readonly cache = new Map<string, CacheEntry>();
  private readonly waiters = new Map<string, Waiter[]>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  public static getInstance(): ProfilePictureService {
    if (!ProfilePictureService.instance) ProfilePictureService.instance = new ProfilePictureService();
    return ProfilePictureService.instance;
  }

  /** The cached answer: a URL, null when the member has no picture, undefined when not looked up yet. */
  public peek(userId: string): string | null | undefined {
    const entry = this.cache.get(userId);
    if (!entry || entry.expiresAt < Date.now()) return undefined;
    return entry.url;
  }

  /** One member's picture URL, or null. Never throws. */
  public get(userId: string): Promise<string | null> {
    const id = userId.trim();
    if (!id) return Promise.resolve(null);
    const cached = this.peek(id);
    if (cached !== undefined) return Promise.resolve(cached);
    return new Promise((resolve) => {
      const list = this.waiters.get(id) ?? [];
      list.push({ resolve });
      this.waiters.set(id, list);
      if (!this.flushTimer) this.flushTimer = setTimeout(() => void this.flush(), 16);
    });
  }

  /** Pictures for many members (only those that have one). For services that build lists. */
  public async getMany(userIds: string[]): Promise<Map<string, string>> {
    const urls = await Promise.all([...new Set(userIds.filter(Boolean))].map(async (userId) => [userId, await this.get(userId)] as const));
    return new Map(urls.filter((entry): entry is readonly [string, string] => Boolean(entry[1])));
  }

  /** Forget a member's picture (e.g. after they change it), so the next request reads it again. */
  public invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  private async flush(): Promise<void> {
    this.flushTimer = null;
    const batch = new Map(this.waiters);
    this.waiters.clear();
    const userIds = [...batch.keys()];
    let urls = new Map<string, string>();
    try {
      urls = await this.load(userIds);
    } catch (error: unknown) {
      console.warn('[ProfilePictureService.flush] Error:', error instanceof Error ? error.message : error);
      // Not cached: a failed read is retried on the next request instead of hiding pictures for ten minutes.
      batch.forEach((waiters) => waiters.forEach((waiter) => waiter.resolve(null)));
      return;
    }
    const expiresAt = Date.now() + CACHE_MS;
    batch.forEach((waiters, userId) => {
      const url = urls.get(userId) ?? null;
      this.cache.set(userId, { url, expiresAt });
      waiters.forEach((waiter) => waiter.resolve(url));
    });
  }

  private async load(userIds: string[]): Promise<Map<string, string>> {
    const selections = await firestoreBatchReadService.getDocumentsByField('profileImageSetAs', 'userId', userIds);
    const best = new Map<string, { imageId: string; priority: number }>();
    selections.forEach((selection) => {
      const data = selection.data();
      const userId = readString(data.userId);
      const imageId = readString(data.profileImageId);
      const priority = SLOT_PRIORITY[readString(data.setAs)] ?? 0;
      if (!userId || !imageId || priority === 0) return;
      const current = best.get(userId);
      if (!current || priority > current.priority) best.set(userId, { imageId, priority });
    });
    const images = await firestoreBatchReadService.getDocumentsByIds('profileImages', [...new Set([...best.values()].map((entry) => entry.imageId))]);
    const urls = new Map<string, string>();
    best.forEach(({ imageId }, userId) => {
      const url = readImageUrl(images.get(imageId));
      if (url) urls.set(userId, url);
    });
    return urls;
  }
}

export const profilePictureService = ProfilePictureService.getInstance();
