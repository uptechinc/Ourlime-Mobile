/** Pure rules behind the admin product, community and sticker workspaces (no Firebase imports, so they are unit-testable). */

export type AdminWorkspaceStatus = 'active' | 'pending' | 'approved' | 'rejected' | 'archived' | 'disabled' | 'other';

export type AdminWorkspaceStatusSource = {
  status?: unknown;
  isDeleted?: unknown;
  isActive?: unknown;
  isPublished?: unknown;
  enabled?: unknown;
};

/** Records per workspace page; the website's admin lists page by document id the same way. */
export const ADMIN_WORKSPACE_PAGE_SIZE = 50;

const KNOWN_STATUSES: readonly AdminWorkspaceStatus[] = ['active', 'pending', 'approved', 'rejected', 'archived', 'disabled'];

/** The server's soft delete (admin content moderation) sets `isDeleted: true` and `status: 'deleted'`. */
export function isSoftDeletedRecord(value: AdminWorkspaceStatusSource): boolean {
  return value.isDeleted === true || (typeof value.status === 'string' && value.status.toLowerCase() === 'deleted');
}

/** Whether the record is switched on (stickers and packs use `enabled`, older records `isActive` / `isPublished`). */
export function isWorkspaceRecordActive(value: AdminWorkspaceStatusSource): boolean {
  return value.isActive !== false && value.isPublished !== false && value.enabled !== false;
}

/** The explicit status when it is a known review status, otherwise derived from the active flags. */
export function resolveWorkspaceStatus(value: AdminWorkspaceStatusSource): AdminWorkspaceStatus {
  const status = typeof value.status === 'string' ? value.status.toLowerCase() : '';
  const known = KNOWN_STATUSES.find((candidate) => candidate === status);
  if (known) return known;
  return isWorkspaceRecordActive(value) ? 'active' : 'disabled';
}

/** Communities store `isPrivate` (the rules' field list); older records carry a `privacy` string. */
export function resolveCommunityPrivacy(privacy: unknown, isPrivate: unknown): string {
  if (typeof privacy === 'string' && privacy.trim()) return privacy.trim().toLowerCase();
  return isPrivate === true ? 'private' : 'public';
}

/**
 * Splits one raw page (fetched with one extra document to detect more) into the visible records and the cursor.
 * Soft-deleted records are dropped, but the cursor still advances past them so the next page never repeats them.
 */
export function buildWorkspacePage<TDocument extends { id: string; data: AdminWorkspaceStatusSource }>(
  documents: readonly TDocument[],
  pageSize: number,
): { visible: TDocument[]; nextCursor: string | null } {
  const pageDocuments = documents.slice(0, pageSize);
  const hasMore = documents.length > pageSize;
  return {
    visible: pageDocuments.filter((document) => !isSoftDeletedRecord(document.data)),
    nextCursor: hasMore ? pageDocuments.at(-1)?.id ?? null : null,
  };
}
