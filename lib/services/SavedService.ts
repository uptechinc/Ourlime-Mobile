import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { AuthService } from '@/lib/services/AuthService';
import { accountLifecycleVisibilityService } from '@/lib/services/AccountLifecycleVisibilityService';
import { firestoreBatchReadService } from '@/lib/services/FirestoreBatchReadService';
import { SavedItemCatalog } from '@/lib/services/SavedItemCatalog';
import type {
  ResolvedSavedItem,
  SavedItem,
  SavedItemsPage,
  SavedItemType,
  SavedItemUnavailableReason,
  SaveTarget,
} from '@/lib/types/saved';

const SAVED_COLLECTION = 'saved';
const IN_QUERY_LIMIT = 30;
/** The live saved-key listener covers the newest saves; older ones are looked up one by one when shown. */
const LIVE_KEY_LIMIT = 2000;
const DEFAULT_PAGE_SIZE = 20;

type LiveItemState = { data: DocumentData | null; reason: SavedItemUnavailableReason | null };

/**
 * Saved items for the signed-in member: users/{uid}/saved/{type}_{itemId}, read and written directly in Firestore
 * (the website's lib/saved/SavedService; Ourlime-Web docs/SAVED_FEATURE.md).
 */
export class SavedService {
  private static instance: SavedService;

  private readonly authService = AuthService.getInstance();

  private constructor() {}

  public static getInstance(): SavedService {
    if (!SavedService.instance) SavedService.instance = new SavedService();
    return SavedService.instance;
  }

  private requireUserId(): string {
    const userId = this.authService.getVerifiedCurrentUser()?.uid;
    if (!userId) throw new Error('Sign in to save items.');
    return userId;
  }

  private savedCollection(userId: string) {
    return collection(db, 'users', userId, SAVED_COLLECTION);
  }

  private savedDocument(userId: string, type: SavedItemType, itemId: string) {
    return doc(db, 'users', userId, SAVED_COLLECTION, SavedItemCatalog.buildDocumentId(type, itemId));
  }

  public readMillis(value: unknown): number {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'object' && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
      return (value as { toMillis: () => number }).toMillis();
    }
    if (typeof value === 'object' && typeof (value as { seconds?: unknown }).seconds === 'number') {
      return (value as { seconds: number }).seconds * 1000;
    }
    return 0;
  }

  /** Saves the item. Saving an item that is already saved changes nothing (the rules keep savedAt fixed). */
  public async save(target: SaveTarget): Promise<void> {
    const userId = this.requireUserId();
    if (!SavedItemCatalog.isValidItemId(target.itemId)) throw new Error('This item cannot be saved.');
    const reference = this.savedDocument(userId, target.type, target.itemId);
    const existing = await getDoc(reference);
    if (existing.exists()) return;
    await setDoc(reference, {
      type: target.type,
      itemId: target.itemId,
      savedAt: serverTimestamp(),
      snapshot: SavedItemCatalog.normalizeSnapshot(target.snapshot),
    });
  }

  public async unsave(type: SavedItemType, itemId: string): Promise<void> {
    const userId = this.requireUserId();
    await deleteDoc(this.savedDocument(userId, type, itemId));
    await this.removeLegacySave(userId, type, itemId);
  }

  /**
   * Removes the pre-move copy (savedJobs, eventBookmarks) so a re-run of scripts/migrateSavedItems.ts cannot
   * restore an item the member unsaved. Blogs are handled by the blog interactions route. Best effort.
   */
  private async removeLegacySave(userId: string, type: SavedItemType, itemId: string): Promise<void> {
    try {
      if (type === 'job') await deleteDoc(doc(db, 'users', userId, 'savedJobs', itemId));
      if (type === 'event') {
        const bookmarks = await getDocs(query(collection(db, 'eventBookmarks'), where('userId', '==', userId), where('eventId', '==', itemId)));
        await Promise.all(bookmarks.docs.map((entry) => deleteDoc(entry.ref)));
      }
    } catch (error) {
      console.error('[SavedService.removeLegacySave] Error:', error);
    }
  }

  /** Saves or removes the item. Returns the new saved state. */
  public async toggle(target: SaveTarget, isSaved: boolean): Promise<boolean> {
    if (isSaved) {
      await this.unsave(target.type, target.itemId);
      return false;
    }
    await this.save(target);
    return true;
  }

  public async isSaved(type: SavedItemType, itemId: string): Promise<boolean> {
    const userId = this.authService.getVerifiedCurrentUser()?.uid;
    if (!userId || !SavedItemCatalog.isValidItemId(itemId)) return false;
    return (await getDoc(this.savedDocument(userId, type, itemId))).exists();
  }

  /** Item ids of one type the member saved, newest first. */
  public async getSavedIds(type: SavedItemType, maxItems = 500): Promise<string[]> {
    const userId = this.authService.getVerifiedCurrentUser()?.uid;
    if (!userId) return [];
    const snapshot = await getDocs(query(this.savedCollection(userId), where('type', '==', type), orderBy('savedAt', 'desc'), limit(maxItems)));
    return snapshot.docs.map((entry) => String(entry.data().itemId ?? '')).filter(Boolean);
  }

  /** One page of saved items, newest first, optionally of one type. Pass the previous page's cursor to continue. */
  public async list(options: { type?: SavedItemType | null; pageSize?: number; cursor?: unknown } = {}): Promise<SavedItemsPage> {
    const userId = this.requireUserId();
    const pageSize = Math.min(Math.max(options.pageSize ?? DEFAULT_PAGE_SIZE, 1), 100);
    const constraints: QueryConstraint[] = [];
    if (options.type) constraints.push(where('type', '==', options.type));
    constraints.push(orderBy('savedAt', 'desc'));
    if (options.cursor) constraints.push(startAfter(options.cursor as QueryDocumentSnapshot<DocumentData>));
    constraints.push(limit(pageSize + 1));
    const snapshot = await getDocs(query(this.savedCollection(userId), ...constraints));
    const pageDocs = snapshot.docs.slice(0, pageSize);
    const items = pageDocs
      .map((entry) => SavedItemCatalog.parseDocument(entry.id, entry.data(), (value) => this.readMillis(value)))
      .filter((item): item is SavedItem => item !== null);
    return { items, cursor: pageDocs[pageDocs.length - 1] ?? null, hasMore: snapshot.docs.length > pageSize };
  }

  /** Live set of `${type}_${itemId}` keys for the member's newest saves. */
  public subscribeToSavedKeys(userId: string, onChange: (keys: Set<string>) => void, onError: (error: Error) => void): Unsubscribe {
    return onSnapshot(
      query(this.savedCollection(userId), orderBy('savedAt', 'desc'), limit(LIVE_KEY_LIMIT)),
      (snapshot) => onChange(new Set(snapshot.docs.map((entry) => entry.id))),
      (error) => onError(error),
    );
  }

  /**
   * Checks each saved item against the live content and the member's relationships. Items that were deleted,
   * are private to the viewer, belong to a member either side has blocked, or whose owner's account is hidden
   * come back unavailable (with the reason) instead of throwing.
   */
  public async resolveItems(items: SavedItem[]): Promise<ResolvedSavedItem[]> {
    if (items.length === 0) return [];
    const viewerId = this.requireUserId();
    const liveStates = new Map<string, LiveItemState>();
    const byCollection = new Map<string, SavedItem[]>();
    items.forEach((item) => {
      const collectionName = SavedItemCatalog.getCollection(item.type);
      if (!collectionName) return;
      byCollection.set(collectionName, [...(byCollection.get(collectionName) ?? []), item]);
    });
    await Promise.all([...byCollection.entries()].map(async ([collectionName, group]) => {
      const states = await this.readLiveItems(collectionName, group.map((item) => item.itemId));
      group.forEach((item) => liveStates.set(item.id, states.get(item.itemId) ?? { data: null, reason: 'deleted' }));
    }));

    const authorIds = new Set<string>();
    items.forEach((item) => {
      const live = liveStates.get(item.id);
      const authorId = (live?.data ? SavedItemCatalog.readAuthorId(live.data) : null) ?? item.snapshot.authorId ?? null;
      if (authorId && authorId !== viewerId) authorIds.add(authorId);
    });
    const [viewerSnapshot, authors] = await Promise.all([
      getDoc(doc(db, 'users', viewerId)).catch(() => null),
      this.readUsers([...authorIds]),
    ]);
    const viewerBlockList = SavedItemCatalog.readBlockList(viewerSnapshot?.data());

    return items.map((item) => {
      const live = liveStates.get(item.id);
      const authorId = (live?.data ? SavedItemCatalog.readAuthorId(live.data) : null) ?? item.snapshot.authorId ?? null;
      const author = authorId ? authors.get(authorId) : undefined;
      let reason: SavedItemUnavailableReason | null = live?.reason ?? null;
      if (!reason && live?.data && (SavedItemCatalog.isContentRemoved(live.data) || accountLifecycleVisibilityService.isHidden(live.data))) reason = 'deleted';
      if (!reason && authorId && SavedItemCatalog.isBlockedEitherWay(viewerId, viewerBlockList, authorId, SavedItemCatalog.readBlockList(author))) reason = 'blocked';
      if (!reason && authorId && authorId !== viewerId && author && accountLifecycleVisibilityService.isHidden(author)) reason = 'hidden';
      return {
        ...item,
        available: reason === null,
        unavailableReason: reason,
        href: reason === null ? SavedItemCatalog.getRoute(item.type, item.itemId) : null,
      };
    });
  }

  /**
   * Reads content documents 30 at a time. A batch the rules refuse (one private item fails the whole query)
   * falls back to single reads so only the private item is marked unavailable.
   */
  private async readLiveItems(collectionName: string, itemIds: string[]): Promise<Map<string, LiveItemState>> {
    const states = new Map<string, LiveItemState>();
    const uniqueIds = [...new Set(itemIds)];
    const chunks: string[][] = [];
    for (let index = 0; index < uniqueIds.length; index += IN_QUERY_LIMIT) chunks.push(uniqueIds.slice(index, index + IN_QUERY_LIMIT));
    await Promise.all(chunks.map(async (chunk) => {
      try {
        const found = await firestoreBatchReadService.getDocumentsByIds(collectionName, chunk);
        chunk.forEach((itemId) => {
          const data = found.get(itemId);
          states.set(itemId, data ? { data, reason: null } : { data: null, reason: 'deleted' });
        });
      } catch {
        await Promise.all(chunk.map(async (itemId) => {
          try {
            const entry = await getDoc(doc(db, collectionName, itemId));
            states.set(itemId, entry.exists() ? { data: entry.data(), reason: null } : { data: null, reason: 'deleted' });
          } catch {
            states.set(itemId, { data: null, reason: 'private' });
          }
        }));
      }
    }));
    return states;
  }

  private async readUsers(userIds: string[]): Promise<Map<string, DocumentData>> {
    try {
      return await firestoreBatchReadService.getDocumentsByIds('users', userIds);
    } catch (error) {
      console.error('[SavedService.readUsers] Error:', error);
      return new Map<string, DocumentData>();
    }
  }

  /**
   * Uploads product favorites that were kept only on this device. Each id is saved once (existing saves are
   * left alone). Returns how many were uploaded.
   */
  /** Title and photo of a published E-Hub product through the E-Hub server API; null when unavailable. */
  private async readEHubProductSnapshot(productId: string): Promise<SaveTarget['snapshot'] | null> {
    try {
      // Loaded on demand so SavedService and EHubService don't import each other at startup.
      const { eHubService } = await import('./EHubService');
      const detail = await eHubService.getProduct(productId);
      const product = detail?.product;
      if (!product?.title) return null;
      return { title: product.title, thumbnail: product.imageUrl ?? product.imageUrls[0] ?? null };
    } catch (error: unknown) {
      console.warn('[SavedService.readEHubProductSnapshot] Error:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  public async importDeviceFavorites(type: 'market_product' | 'ehub_product', productIds: string[]): Promise<number> {
    const userId = this.requireUserId();
    const ids = [...new Set(productIds.filter((productId) => SavedItemCatalog.isValidItemId(productId)))].slice(0, 500);
    let uploaded = 0;
    for (const productId of ids) {
      const reference = this.savedDocument(userId, type, productId);
      if ((await getDoc(reference)).exists()) continue;
      let snapshot = { title: type === 'market_product' ? 'Market product' : 'eHub product' } as SaveTarget['snapshot'];
      const collectionName = SavedItemCatalog.getCollection(type);
      if (type === 'ehub_product') {
        // ehubProducts can't be read by members (rules), which left every imported E-Hub save titled "eHub product".
        snapshot = (await this.readEHubProductSnapshot(productId)) ?? snapshot;
      } else if (collectionName) {
        const product = await getDoc(doc(db, collectionName, productId)).catch(() => null);
        const data = product?.exists() ? product.data() : null;
        if (data) {
          snapshot = {
            title: typeof data.title === 'string' ? data.title : snapshot.title,
            thumbnail: typeof data.thumbnailImage === 'string' ? data.thumbnailImage : null,
            authorId: SavedItemCatalog.readAuthorId(data),
          };
        }
      }
      await setDoc(reference, { type, itemId: productId, savedAt: serverTimestamp(), snapshot: SavedItemCatalog.normalizeSnapshot(snapshot) });
      uploaded += 1;
    }
    return uploaded;
  }
}

export const savedService = SavedService.getInstance();
