import {
  SAVED_ITEM_TYPES,
  SAVED_SNAPSHOT_TITLE_MAX,
  SAVED_SNAPSHOT_URL_MAX,
  type SavedItem,
  type SavedItemSnapshot,
  type SavedItemType,
} from '@/lib/types/saved';

/**
 * Pure helpers for saved items (no Firestore calls) used by SavedService and the Saved screen.
 * Mirrors Ourlime-Web lib/saved/SavedItemCatalog.ts with the app's routes; keep the two in step.
 */

type SavedItemSource = {
  /** Firestore collection the live item is read from; null when clients cannot read it (eHub is server-only). */
  collection: string | null;
  /** Expo Router path for the item. */
  route: (itemId: string) => string;
};

const SOURCES: { [type in SavedItemType]: SavedItemSource } = {
  post: { collection: 'feedPosts', route: (itemId) => `/post/${encodeURIComponent(itemId)}` },
  lime: { collection: 'reels', route: (itemId) => `/limes/viewer?limeId=${encodeURIComponent(itemId)}&viewer=1` },
  blog: { collection: 'blogsAndArticles', route: (itemId) => `/blogs/${encodeURIComponent(itemId)}` },
  job: { collection: 'jobs', route: (itemId) => `/jobs/${encodeURIComponent(itemId)}` },
  event: { collection: 'events', route: (itemId) => `/events/${encodeURIComponent(itemId)}` },
  market_product: { collection: 'products', route: (itemId) => `/market/${encodeURIComponent(itemId)}` },
  ehub_product: { collection: null, route: (itemId) => `/ehub/products/${encodeURIComponent(itemId)}` },
  ehub_provider: { collection: null, route: (itemId) => `/ehub/providers/${encodeURIComponent(itemId)}` },
  community: { collection: 'communityVariant', route: (itemId) => `/communities/${encodeURIComponent(itemId)}` },
  course: { collection: 'courses', route: (itemId) => `/eLearning/courses/${encodeURIComponent(itemId)}` },
  pet_listing: { collection: 'petListings', route: (itemId) => `/market/pets/${encodeURIComponent(itemId)}` },
};

const REMOVED_STATUSES = new Set(['deleted', 'removed', 'taken_down', 'takendown']);
const AUTHOR_FIELDS = ['userId', 'authorUserId', 'authorId', 'ownerId', 'sellerId', 'createdBy', 'organizerId', 'instructorId'] as const;

export class SavedItemCatalog {
  public static isSavedItemType(value: unknown): value is SavedItemType {
    return typeof value === 'string' && (SAVED_ITEM_TYPES as readonly string[]).includes(value);
  }

  public static buildDocumentId(type: SavedItemType, itemId: string): string {
    return `${type}_${itemId}`;
  }

  public static getCollection(type: SavedItemType): string | null {
    return SOURCES[type].collection;
  }

  public static getRoute(type: SavedItemType, itemId: string): string {
    return SOURCES[type].route(itemId);
  }

  /** Item ids must be non-empty, at most 200 characters and free of '/', as the rules and document paths require. */
  public static isValidItemId(itemId: unknown): itemId is string {
    return typeof itemId === 'string' && itemId.trim().length > 0 && itemId.length <= 200 && !itemId.includes('/');
  }

  /** Trims the snapshot to what the rules accept: a title of at most 300 characters and optional short strings. */
  public static normalizeSnapshot(snapshot: Partial<SavedItemSnapshot> | null | undefined, fallbackTitle = 'Saved item'): SavedItemSnapshot {
    const text = (value: unknown, maxLength: number): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.replace(/\s+/g, ' ').trim();
      return trimmed ? trimmed.slice(0, maxLength) : null;
    };
    const url = (value: unknown): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed && trimmed.length <= SAVED_SNAPSHOT_URL_MAX ? trimmed : null;
    };
    const normalized: SavedItemSnapshot = { title: text(snapshot?.title, SAVED_SNAPSHOT_TITLE_MAX) ?? fallbackTitle.slice(0, SAVED_SNAPSHOT_TITLE_MAX) };
    const thumbnail = url(snapshot?.thumbnail);
    const authorId = text(snapshot?.authorId, 128);
    const subtitle = text(snapshot?.subtitle, 300);
    if (thumbnail) normalized.thumbnail = thumbnail;
    if (authorId) normalized.authorId = authorId;
    if (subtitle) normalized.subtitle = subtitle;
    return normalized;
  }

  /** Reads a saved document; returns null for anything that is not a well-formed saved item. */
  public static parseDocument(documentId: string, data: unknown, readMillis: (value: unknown) => number): SavedItem | null {
    if (!data || typeof data !== 'object') return null;
    const record = data as { type?: unknown; itemId?: unknown; savedAt?: unknown; snapshot?: unknown; folderId?: unknown };
    if (!SavedItemCatalog.isSavedItemType(record.type) || !SavedItemCatalog.isValidItemId(record.itemId)) return null;
    const snapshot = record.snapshot && typeof record.snapshot === 'object' ? record.snapshot as Partial<SavedItemSnapshot> : null;
    return {
      id: documentId,
      type: record.type,
      itemId: record.itemId,
      savedAtMs: readMillis(record.savedAt),
      snapshot: SavedItemCatalog.normalizeSnapshot(snapshot),
      folderId: typeof record.folderId === 'string' ? record.folderId : null,
    };
  }

  /** The member who owns a live item, from the field names the content collections use. */
  public static readAuthorId(data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const record = data as { [field: string]: unknown };
    for (const field of AUTHOR_FIELDS) {
      const value = record[field];
      if (typeof value === 'string' && value) return value;
    }
    const instructor = record.instructor;
    if (instructor && typeof instructor === 'object') {
      const instructorId = (instructor as { id?: unknown }).id;
      if (typeof instructorId === 'string' && instructorId) return instructorId;
    }
    return null;
  }

  /** True when the live item is soft-deleted or taken down. */
  public static isContentRemoved(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const record = data as { [field: string]: unknown };
    if (record.isDeleted === true || record.deleted === true) return true;
    if (record.deletedAt !== null && record.deletedAt !== undefined) return true;
    return ['status', 'moderationStatus', 'publicationStatus', 'publicationState'].some((field) => {
      const value = record[field];
      return typeof value === 'string' && REMOVED_STATUSES.has(value.trim().toLowerCase());
    });
  }

  /** Case-insensitive search over the snapshot title and subtitle. */
  public static matchesSearch(item: Pick<SavedItem, 'snapshot'>, search: string): boolean {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return item.snapshot.title.toLowerCase().includes(needle) || (item.snapshot.subtitle ?? '').toLowerCase().includes(needle);
  }

  /** True when either member has the other on their block list. */
  public static isBlockedEitherWay(viewerId: string, viewerBlockList: readonly string[], authorId: string, authorBlockList: readonly string[]): boolean {
    if (!authorId || authorId === viewerId) return false;
    return viewerBlockList.includes(authorId) || authorBlockList.includes(viewerId);
  }

  public static readBlockList(data: unknown): string[] {
    if (!data || typeof data !== 'object') return [];
    const value = (data as { blockList?: unknown }).blockList;
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
  }
}
