/**
 * Saved items: users/{uid}/saved/{type}_{itemId}. See docs/SAVED_FEATURE.md.
 * Mirrors Ourlime-Web lib/types/saved.ts; keep the two in step.
 */

export const SAVED_ITEM_TYPES = [
  'post',
  'lime',
  'blog',
  'job',
  'event',
  'market_product',
  'ehub_product',
  'ehub_provider',
  'community',
  'course',
  'pet_listing',
] as const;

export type SavedItemType = (typeof SAVED_ITEM_TYPES)[number];

/** Display hint stored with the save. Readers re-check the live item before showing it. */
export type SavedItemSnapshot = {
  title: string;
  thumbnail?: string | null;
  authorId?: string | null;
  subtitle?: string | null;
};

/** The Firestore document as written. `savedAt` is a server timestamp. */
export type SavedItemDocument = {
  type: SavedItemType;
  itemId: string;
  savedAt: unknown;
  snapshot: SavedItemSnapshot;
  folderId?: string | null;
};

/** Why a saved item can no longer be opened. */
export type SavedItemUnavailableReason = 'deleted' | 'private' | 'blocked' | 'hidden';

export type SavedItem = {
  id: string;
  type: SavedItemType;
  itemId: string;
  savedAtMs: number;
  snapshot: SavedItemSnapshot;
  folderId: string | null;
};

export type ResolvedSavedItem = SavedItem & {
  available: boolean;
  unavailableReason: SavedItemUnavailableReason | null;
  /** Where tapping the row goes; null when unavailable. */
  href: string | null;
};

export type SavedItemsPage = {
  items: SavedItem[];
  cursor: unknown;
  hasMore: boolean;
};

export type SaveTarget = {
  type: SavedItemType;
  itemId: string;
  snapshot: SavedItemSnapshot;
};

export const SAVED_TYPE_LABELS: { [type in SavedItemType]: string } = {
  post: 'Posts',
  lime: 'Limes',
  blog: 'Blogs',
  job: 'Jobs',
  event: 'Events',
  market_product: 'Market',
  ehub_product: 'eHub products',
  ehub_provider: 'eHub providers',
  community: 'Communities',
  course: 'Courses',
  pet_listing: 'Pets',
};

export const SAVED_SNAPSHOT_TITLE_MAX = 300;
export const SAVED_SNAPSHOT_URL_MAX = 2048;
