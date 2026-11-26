import {
  addDoc,
  collection,
  count,
  deleteDoc,
  doc,
  documentId,
  getAggregateFromServer,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  sum,
  updateDoc,
  where,
  type QueryFieldFilterConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { adminAccessService } from './AdminAccessService';
import { adminApiService } from './AdminApiService';
import { appServerService } from './AppServerService';
import { firestoreBatchReadService } from './FirestoreBatchReadService';
import { privateProfileService } from './PrivateProfileService';
import {
  ADMIN_WORKSPACE_PAGE_SIZE,
  buildWorkspacePage,
  isWorkspaceRecordActive,
  resolveCommunityPrivacy,
  resolveWorkspaceStatus,
  type AdminWorkspaceStatus,
} from './AdminWorkspaceRules';

export type { AdminWorkspaceStatus } from './AdminWorkspaceRules';

type FirebaseDateValue = { toMillis?: () => number; seconds?: number } | string | number | Date | null | undefined;
type AdminDocumentData = {
  title?: unknown;
  name?: unknown;
  description?: unknown;
  status?: unknown;
  privacy?: unknown;
  isPrivate?: unknown;
  isDeleted?: unknown;
  category?: unknown;
  categoryName?: unknown;
  creatorId?: unknown;
  userId?: unknown;
  ownerId?: unknown;
  createdBy?: unknown;
  membershipCount?: unknown;
  members?: unknown;
  price?: unknown;
  image?: unknown;
  imageUrl?: unknown;
  imageURL?: unknown;
  coverImage?: unknown;
  thumbnailImage?: unknown;
  images?: unknown;
  shortDescription?: unknown;
  longDescription?: unknown;
  sellerId?: unknown;
  sellerName?: unknown;
  salePrice?: unknown;
  originalPrice?: unknown;
  isOnSale?: unknown;
  currency?: unknown;
  condition?: unknown;
  packId?: unknown;
  isActive?: unknown;
  isPublished?: unknown;
  enabled?: unknown;
  keywords?: unknown;
  icon?: unknown;
  folder?: unknown;
  order?: unknown;
  createdAt?: FirebaseDateValue;
  updatedAt?: FirebaseDateValue;
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  userName?: unknown;
  displayName?: unknown;
  invitedBy?: unknown;
  adminNotes?: unknown;
  betaAdminNotes?: unknown;
  reviewedByName?: unknown;
  betaTester?: unknown;
  betaTesterStatus?: unknown;
  betaTesterSince?: FirebaseDateValue;
  invitationType?: unknown;
  emailDelivery?: unknown;
  expiresAt?: FirebaseDateValue;
};

export type AdminWorkspaceKind = 'products' | 'communities' | 'stickers' | 'sticker_packs';
export type AdminCategoryKind = 'products' | 'communities';
export type AdminWorkspaceItem = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  status: AdminWorkspaceStatus;
  category: string;
  imageUrl: string | null;
  ownerId: string | null;
  metricLabel: string | null;
  createdAtMs: number;
  isActive: boolean;
  /** Product price (0 when unknown) and community member count / privacy, for the website's filters and stats. */
  price: number;
  memberCount: number;
  privacy: string;
  /** Editable sticker / sticker-pack fields (the website's sticker manager form); null for other kinds. */
  stickerFields: AdminStickerFields | null;
  /** Products: every listing photo (cover first) and the listing facts a reviewer needs. Empty for other kinds. */
  images: string[];
  sellerName: string;
  condition: string;
  currency: string;
};
/** Pack: name, description, icon, folder. Sticker: name, keywords, category, packId, imageUrl. */
export type AdminStickerFields = {
  name: string;
  description: string;
  icon: string;
  folder: string;
  keywords: string;
  category: string;
  packId: string;
  imageUrl: string;
};
/** One page of a workspace list; `nextCursor` is the last document id read, or null on the last page. */
export type AdminWorkspacePage = { items: AdminWorkspaceItem[]; nextCursor: string | null };
/** Collection-wide totals for the workspace stat cards (counted on the server, so they cover every page). */
export type AdminWorkspaceStats =
  | { kind: 'products'; total: number; pending: number; approved: number; rejected: number }
  | { kind: 'communities'; total: number; publicCount: number; privateCount: number; memberships: number };
export type AdminCategoryRecord = {
  id: string;
  name: string;
  description: string;
  itemCount: number;
  createdAtMs: number;
};
export type AdminAnalyticsMetric = {
  id: string;
  label: string;
  count: number;
  domain: 'audience' | 'social' | 'communities' | 'events' | 'marketplace' | 'administration';
};
export type AdminAnalyticsSnapshot = {
  metrics: AdminAnalyticsMetric[];
  unavailableCollections: string[];
};
export type AdminBetaKind = 'application' | 'invitation' | 'tester';
export type AdminBetaRecord = {
  id: string;
  kind: AdminBetaKind;
  name: string;
  email: string;
  status: string;
  source: string;
  notes: string;
  reviewer: string;
  createdAtMs: number;
};
export type AdminBetaOverview = {
  records: AdminBetaRecord[];
  registrationMode: 'open' | 'invite_only' | 'closed';
};
export type AdminBetaInvitationResult = { success: boolean; inviteUrl?: string; emailDelivery?: string };
type AdminApiWriteResponse = { success?: boolean; error?: string; message?: string } | null;

const readString = (value: unknown): string => typeof value === 'string' ? value : '';
const readNumber = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const readDateMs = (value: FirebaseDateValue): number => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (value && typeof value === 'object') {
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
  }
  return 0;
};

function getWorkspaceCollection(kind: AdminWorkspaceKind): string {
  if (kind === 'products') return 'products';
  if (kind === 'communities') return 'communityVariant';
  if (kind === 'sticker_packs') return 'stickerPacks';
  return 'stickers';
}

export class AdminWorkspaceService {
  private static instance: AdminWorkspaceService;

  private constructor() {}

  public static getInstance(): AdminWorkspaceService {
    if (!AdminWorkspaceService.instance) AdminWorkspaceService.instance = new AdminWorkspaceService();
    return AdminWorkspaceService.instance;
  }

  /**
   * One page of records ordered by document id, like the website's admin lists. This needs no composite index and
   * includes records without `createdAt`. Soft-deleted records (`isDeleted` / `status: 'deleted'`) are left out.
   */
  public async fetchWorkspacePage(kind: AdminWorkspaceKind, cursor: string | null = null, pageSize = ADMIN_WORKSPACE_PAGE_SIZE): Promise<AdminWorkspacePage> {
    await adminAccessService.requireAdmin();
    const size = Math.min(100, Math.max(1, Math.trunc(pageSize)));
    const source = collection(db, getWorkspaceCollection(kind));
    const snapshot = await getDocs(cursor
      ? query(source, orderBy(documentId()), startAfter(cursor), limit(size + 1))
      : query(source, orderBy(documentId()), limit(size + 1)));
    const page = buildWorkspacePage(snapshot.docs.map((document) => ({ id: document.id, data: document.data() as AdminDocumentData })), size);
    const memberCounts = kind === 'communities' ? await this.readCommunityMemberCounts(page.visible.map((document) => document.id)) : null;
    return {
      items: page.visible.map((document) => {
        const item = this.normalizeWorkspaceItem(kind, document.id, document.data);
        const memberCount = memberCounts?.get(document.id);
        return memberCount === undefined ? item : { ...item, memberCount, metricLabel: `${memberCount} ${memberCount === 1 ? 'member' : 'members'}` };
      }),
      nextCursor: page.nextCursor,
    };
  }

  /**
   * Community documents carry no member count; the app keeps it in communityVariantMembershipAndLikeCount/{communityId}
   * (CommunityDataService). A failed read leaves the rows without counts instead of failing the list.
   */
  private async readCommunityMemberCounts(communityIds: string[]): Promise<Map<string, number>> {
    if (communityIds.length === 0) return new Map();
    try {
      const counts = await firestoreBatchReadService.getDocumentsByIds('communityVariantMembershipAndLikeCount', communityIds);
      return new Map(communityIds.map((communityId) => [communityId, Math.max(0, readNumber(counts.get(communityId)?.membershipCount))]));
    } catch (error: unknown) {
      console.warn('[AdminWorkspaceService.readCommunityMemberCounts] Error:', error instanceof Error ? error.message : error);
      return new Map();
    }
  }

  /** Server-side totals for the product and community stat cards, without soft-deleted records. Null for stickers. */
  public async fetchWorkspaceStats(kind: AdminWorkspaceKind): Promise<AdminWorkspaceStats | null> {
    await adminAccessService.requireAdmin();
    if (kind !== 'products' && kind !== 'communities') return null;
    const source = collection(db, getWorkspaceCollection(kind));
    const countOf = async (filter?: QueryFieldFilterConstraint): Promise<number> =>
      (await getCountFromServer(filter ? query(source, filter) : source)).data().count;
    if (kind === 'products') {
      // Deleted listings carry status 'deleted', so the status counts already leave them out.
      const [all, deleted, pending, approved, rejected] = await Promise.all([
        countOf(),
        countOf(where('isDeleted', '==', true)),
        countOf(where('status', '==', 'pending')),
        countOf(where('status', 'in', ['approved', 'active'])),
        countOf(where('status', '==', 'rejected')),
      ]);
      return { kind, total: Math.max(0, all - deleted), pending, approved, rejected };
    }
    // Members are summed from the count documents (communities have no count of their own). Plain count/sum queries
    // need no composite index; the old sum over communityVariant with an isDeleted filter did, and always failed.
    const [all, deleted, privateCount, membershipTotals] = await Promise.all([
      countOf(),
      countOf(where('isDeleted', '==', true)),
      countOf(where('isPrivate', '==', true)),
      getAggregateFromServer(collection(db, 'communityVariantMembershipAndLikeCount'), { memberships: sum('membershipCount') }),
    ]);
    const total = Math.max(0, all - deleted);
    return {
      kind,
      total,
      privateCount: Math.min(total, privateCount),
      publicCount: Math.max(0, total - privateCount),
      memberships: Math.max(0, membershipTotals.data().memberships || 0),
    };
  }

  /**
   * Returns the status the record now has. For products, hiding decisions (rejected, disabled, archived) need a
   * reason shown to the seller like on the web, and the server stores every hiding decision as 'rejected'.
   */
  public async setWorkspaceStatus(kind: AdminWorkspaceKind, itemId: string, status: AdminWorkspaceStatus, reason?: string): Promise<AdminWorkspaceStatus> {
    const administrator = await adminAccessService.requireAdmin();
    if (kind === 'products') {
      return this.reviewProduct(itemId, status, reason ?? '');
    }
    const statusFields = kind === 'stickers' || kind === 'sticker_packs'
      // The website's sticker picker and manager read `enabled`.
      ? { isActive: status === 'active' || status === 'approved', isPublished: status === 'active' || status === 'approved', enabled: status === 'active' || status === 'approved', status }
      : { status };
    await updateDoc(doc(db, getWorkspaceCollection(kind), itemId), { ...statusFields, updatedAt: serverTimestamp() });
    await this.writeAudit(administrator.userId, `admin_${kind}_status`, itemId, status);
    return status;
  }

  /**
   * Edits an existing sticker pack or sticker with the website manager's fields and validation. New packs and
   * stickers are created by the server only (Firestore rules deny client creates).
   */
  public async updateStickerRecord(kind: 'stickers' | 'sticker_packs', itemId: string, fields: AdminStickerFields): Promise<void> {
    const administrator = await adminAccessService.requireAdmin();
    const name = fields.name.trim();
    if (!name) throw new Error(kind === 'sticker_packs' ? 'Pack name is required' : 'Sticker name is required');
    const update = kind === 'sticker_packs'
      ? (() => {
          if (!fields.folder.trim()) throw new Error('Folder name is required (must match public/images/stickers/ folder)');
          return { name, description: fields.description.trim(), icon: fields.icon.trim(), folder: fields.folder.trim() };
        })()
      : (() => {
          if (!fields.packId.trim()) throw new Error('Please select a pack');
          if (!fields.imageUrl.trim()) throw new Error('Image URL is required (e.g. /stickers/reactions/thumbs-up.png)');
          return {
            name,
            keywords: fields.keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean),
            category: fields.category.trim(),
            packId: fields.packId.trim(),
            imageUrl: fields.imageUrl.trim(),
          };
        })();
    await updateDoc(doc(db, getWorkspaceCollection(kind), itemId), { ...update, updatedAt: serverTimestamp() });
    await this.writeAudit(administrator.userId, `admin_${kind}_edit`, itemId, 'edited');
  }

  public async deleteWorkspaceItem(kind: AdminWorkspaceKind, itemId: string): Promise<void> {
    const administrator = await adminAccessService.requireAdmin();
    if (kind === 'products') {
      // Products are server-managed: the admin content route soft-deletes the listing, notifies the seller and audits it.
      const response = await adminApiService.request<{ success?: boolean; error?: string } | null>('/api/admin/content/delete', {
        method: 'POST',
        body: { contentType: 'product', contentId: itemId, category: 'custom', customReason: 'Removed by an administrator.' },
      });
      if (response?.success === false) throw new Error(response.error || 'The product could not be deleted.');
      return;
    }
    await deleteDoc(doc(db, getWorkspaceCollection(kind), itemId));
    await this.writeAudit(administrator.userId, `admin_${kind}_delete`, itemId, 'deleted');
  }

  public async fetchCategories(kind: AdminCategoryKind): Promise<AdminCategoryRecord[]> {
    await adminAccessService.requireAdmin();
    const collectionName = kind === 'products' ? 'customCategories' : 'communityCategories';
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map((document) => {
      const value = document.data() as AdminDocumentData;
      return {
        id: document.id,
        name: readString(value.name) || readString(value.categoryName) || 'Unnamed category',
        description: readString(value.description),
        itemCount: readNumber(value.members),
        createdAtMs: readDateMs(value.createdAt),
      };
    }).sort((first, second) => first.name.localeCompare(second.name));
  }

  public async createCategory(kind: AdminCategoryKind, name: string, description: string): Promise<AdminCategoryRecord> {
    const administrator = await adminAccessService.requireAdmin();
    const collectionName = kind === 'products' ? 'customCategories' : 'communityCategories';
    const normalizedName = name.trim();
    if (!normalizedName) throw new Error('Category name is required');
    const reference = await addDoc(collection(db, collectionName), {
      name: normalizedName,
      categoryName: normalizedName,
      description: description.trim(),
      createdAt: serverTimestamp(),
      createdBy: administrator.userId,
    });
    await this.writeAudit(administrator.userId, `admin_${kind}_category_create`, reference.id, normalizedName);
    return { id: reference.id, name: normalizedName, description: description.trim(), itemCount: 0, createdAtMs: Date.now() };
  }

  public async updateCategory(kind: AdminCategoryKind, categoryId: string, name: string, description: string): Promise<void> {
    const administrator = await adminAccessService.requireAdmin();
    const collectionName = kind === 'products' ? 'customCategories' : 'communityCategories';
    const normalizedName = name.trim();
    if (!normalizedName) throw new Error('Category name is required');
    await setDoc(doc(db, collectionName, categoryId), { name: normalizedName, categoryName: normalizedName, description: description.trim(), updatedAt: serverTimestamp(), updatedBy: administrator.userId }, { merge: true });
    await this.writeAudit(administrator.userId, `admin_${kind}_category_update`, categoryId, normalizedName);
  }

  public async deleteCategory(kind: AdminCategoryKind, categoryId: string): Promise<void> {
    const administrator = await adminAccessService.requireAdmin();
    const collectionName = kind === 'products' ? 'customCategories' : 'communityCategories';
    await deleteDoc(doc(db, collectionName, categoryId));
    await this.writeAudit(administrator.userId, `admin_${kind}_category_delete`, categoryId, 'deleted');
  }

  public async fetchAnalytics(): Promise<AdminAnalyticsSnapshot> {
    await adminAccessService.requireAdmin();
    const definitions: readonly { id: string; label: string; collectionName: string; domain: AdminAnalyticsMetric['domain'] }[] = [
      { id: 'members', label: 'Members', collectionName: 'users', domain: 'audience' },
      { id: 'connections', label: 'Connections', collectionName: 'friendship', domain: 'audience' },
      { id: 'followers', label: 'Follows', collectionName: 'followers', domain: 'audience' },
      { id: 'posts', label: 'Feed posts', collectionName: 'feedPosts', domain: 'social' },
      { id: 'limes', label: 'Limes', collectionName: 'reels', domain: 'social' },
      { id: 'communities', label: 'Communities', collectionName: 'communityVariant', domain: 'communities' },
      { id: 'memberships', label: 'Memberships', collectionName: 'communityVariantMembership', domain: 'communities' },
      { id: 'events', label: 'Events', collectionName: 'events', domain: 'events' },
      { id: 'products', label: 'Products', collectionName: 'products', domain: 'marketplace' },
      { id: 'reports', label: 'Reports', collectionName: 'reports', domain: 'administration' },
      { id: 'moderation', label: 'Moderation actions', collectionName: 'moderationHistory', domain: 'administration' },
      { id: 'admin-actions', label: 'Admin actions', collectionName: 'adminLogs', domain: 'administration' },
    ];
    const results = await Promise.all(definitions.map(async (definition) => {
      try {
        const count = (await getCountFromServer(collection(db, definition.collectionName))).data().count;
        return { metric: { id: definition.id, label: definition.label, count, domain: definition.domain }, unavailable: null };
      } catch {
        return { metric: { id: definition.id, label: definition.label, count: 0, domain: definition.domain }, unavailable: definition.collectionName };
      }
    }));
    return {
      metrics: results.map((result) => result.metric),
      unavailableCollections: results.flatMap((result) => result.unavailable ? [result.unavailable] : []),
    };
  }

  public async fetchBetaOverview(): Promise<AdminBetaOverview> {
    await adminAccessService.requireAdmin();
    const [applications, invitations, testers, config] = await Promise.all([
      getDocs(query(collection(db, 'betaApplications'), limit(100))),
      getDocs(query(collection(db, 'betaInvitations'), limit(100))),
      getDocs(query(collection(db, 'users'), where('betaTester', '==', true), limit(100))),
      getDocs(query(collection(db, 'siteConfig'), limit(20))).catch(() => null),
    ]);
    const records: AdminBetaRecord[] = [
      ...applications.docs.map((document) => this.normalizeBetaRecord('application', document.id, document.data() as AdminDocumentData)),
      ...invitations.docs.map((document) => this.normalizeBetaRecord('invitation', document.id, document.data() as AdminDocumentData)),
      // Tester emails and notes are in each member's private profile, which administrators can read.
      ...(await privateProfileService.withPrivateFields(testers.docs.map((document) => ({ id: document.id, data: document.data() as AdminDocumentData }))))
        .map((tester, index) => this.normalizeBetaRecord('tester', testers.docs[index].id, tester)),
    ];
    const modeValue = config?.docs.find((document) => document.id === 'general')?.data().registrationMode;
    const registrationMode = modeValue === 'open' || modeValue === 'closed' ? modeValue : 'invite_only';
    return { records: records.sort((first, second) => second.createdAtMs - first.createdAtMs), registrationMode };
  }

  public async updateBetaRecord(record: AdminBetaRecord, status: string, notes: string): Promise<void> {
    await adminAccessService.requireAdmin();
    if (record.kind === 'tester') {
      this.requireApiSuccess(await adminApiService.request<AdminApiWriteResponse>(`/api/beta/admin/testers/${encodeURIComponent(record.id)}`, { method: 'PATCH', body: { status, notes } }), 'The tester could not be updated.');
      return;
    }
    if (record.kind === 'application') {
      const action = status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'note';
      this.requireApiSuccess(await adminApiService.request<AdminApiWriteResponse>(`/api/beta/admin/applications/${encodeURIComponent(record.id)}`, { method: 'PATCH', body: { action, adminNotes: notes, sendInvitation: status === 'approved' } }), 'The application could not be updated.');
      return;
    }
    const action = status === 'revoked' ? 'revoke' : status === 'invited' ? 'resend' : 'note';
    this.requireApiSuccess(await adminApiService.request<AdminApiWriteResponse>(`/api/beta/admin/invitations/${encodeURIComponent(record.id)}`, { method: 'PATCH', body: { action, notes } }), 'The invitation could not be updated.');
  }

  public async setRegistrationMode(mode: AdminBetaOverview['registrationMode']): Promise<void> {
    await adminAccessService.requireAdmin();
    this.requireApiSuccess(await adminApiService.request<AdminApiWriteResponse>('/api/beta/registration-mode', { method: 'PATCH', body: { mode } }), 'The registration mode could not be changed.');
  }

  public async inviteBetaTester(fullName: string, email: string, notes: string): Promise<AdminBetaInvitationResult> {
    await adminAccessService.requireAdmin();
    const response = await adminApiService.request<(AdminBetaInvitationResult & { error?: string }) | null>('/api/beta/admin/invitations', { method: 'POST', body: { fullName: fullName.trim(), email: email.trim(), notes: notes.trim() } });
    this.requireApiSuccess(response, 'The invitation could not be created.');
    return { success: true, inviteUrl: response?.inviteUrl, emailDelivery: response?.emailDelivery };
  }

  /** A 2xx body of `{ success: false }` is still a failure; the request helper only throws on HTTP errors. */
  private requireApiSuccess(response: AdminApiWriteResponse, fallbackMessage: string): void {
    if (response?.success === false) throw new Error(response.error || response.message || fallbackMessage);
  }

  /** Runs the website's sticker seed (upserts the default packs, adds missing stickers) and returns its summary. */
  public async seedStickers(): Promise<string> {
    await adminAccessService.requireAdmin();
    const response = await adminApiService.request<{ success?: boolean; message?: string; error?: string } | null>('/api/admin/stickers/seed', { method: 'POST' });
    if (response?.success === false) throw new Error(response.error || response.message || 'The sticker seed did not run.');
    return response?.message || 'Done';
  }

  private normalizeWorkspaceItem(kind: AdminWorkspaceKind, id: string, value: AdminDocumentData): AdminWorkspaceItem {
    const title = readString(value.title) || readString(value.name) || 'Untitled';
    const ownerId = readString(value.creatorId) || readString(value.sellerId) || readString(value.userId) || readString(value.ownerId) || null;
    // Listings keep their photos in thumbnailImage and images[]; the other fields are for communities and stickers.
    const listingImages = Array.isArray(value.images) ? value.images.filter((image): image is string => typeof image === 'string' && image.trim().length > 0) : [];
    const images = kind === 'products' ? [...new Set([readString(value.thumbnailImage), ...listingImages].filter(Boolean))] : [];
    const imageUrl = readString(value.imageUrl) || readString(value.imageURL) || readString(value.image) || readString(value.coverImage) || images[0] || null;
    // Buyers see the sale price while a listing is on sale; older listings only have `price`.
    const price = readNumber(value.price) || (value.isOnSale === true ? readNumber(value.salePrice) : 0) || readNumber(value.originalPrice) || readNumber(value.salePrice);
    const currency = readString(value.currency);
    const active = isWorkspaceRecordActive(value);
    const status = resolveWorkspaceStatus(value);
    const privacy = kind === 'communities' ? resolveCommunityPrivacy(value.privacy, value.isPrivate) : '';
    const memberCount = readNumber(value.membershipCount) || readNumber(value.members);
    return {
      id,
      title,
      subtitle: kind === 'communities' ? privacy : kind === 'stickers' ? readString(value.packId) || 'Unassigned pack' : readString(value.category) || 'Uncategorized',
      description: readString(value.description) || readString(value.longDescription) || readString(value.shortDescription),
      status,
      category: readString(value.category),
      imageUrl,
      ownerId,
      metricLabel: kind === 'communities' ? `${memberCount} members` : kind === 'products' && price ? `${currency ? `${currency} ` : '$'}${price.toLocaleString()}` : null,
      createdAtMs: readDateMs(value.createdAt),
      isActive: active,
      price,
      memberCount,
      privacy,
      stickerFields: kind === 'stickers' || kind === 'sticker_packs'
        ? {
            name: readString(value.name),
            description: readString(value.description),
            icon: readString(value.icon),
            folder: readString(value.folder),
            keywords: Array.isArray(value.keywords) ? value.keywords.filter((keyword): keyword is string => typeof keyword === 'string').join(', ') : '',
            category: readString(value.category),
            packId: readString(value.packId),
            imageUrl: readString(value.imageUrl),
          }
        : null,
      images,
      sellerName: readString(value.sellerName),
      condition: readString(value.condition).replace(/_/g, ' '),
      currency,
    };
  }

  private normalizeBetaRecord(kind: AdminBetaKind, id: string, value: AdminDocumentData): AdminBetaRecord {
    const fullName = `${readString(value.firstName)} ${readString(value.lastName)}`.trim();
    return {
      id,
      kind,
      name: readString(value.displayName) || fullName || readString(value.name) || readString(value.userName) || 'Unnamed record',
      email: readString(value.email),
      status: kind === 'tester' ? readString(value.betaTesterStatus) || 'active' : readString(value.status) || (kind === 'invitation' ? 'invited' : 'pending'),
      source: kind === 'application' ? readString(value.invitedBy) || 'Direct application' : kind === 'invitation' ? readString(value.invitationType) || 'single_use' : 'Beta programme',
      notes: readString(value.adminNotes) || readString(value.betaAdminNotes),
      reviewer: readString(value.reviewedByName) || 'Unassigned',
      createdAtMs: readDateMs(kind === 'tester' ? value.betaTesterSince : value.createdAt),
    };
  }

  public async fetchActivityLogs(search?: string, action?: string, resource?: string): Promise<Record<string, unknown>[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (action && action !== 'all') params.append('action', action);
    if (resource && resource !== 'all') params.append('resource', resource);
    params.append('limit', '50');
    const response = await adminApiService.request<{ success: boolean; data?: { logs?: Record<string, unknown>[] }; error?: string }>(
      `/api/admin/activity-logs?${params.toString()}`,
      { method: 'GET' }
    );
    if (!response.success || !response.data?.logs) {
      throw new Error(response.error || 'Failed to load activity logs');
    }
    return response.data.logs;
  }

  public async restoreActivityLog(logId: string): Promise<void> {
    const response = await adminApiService.request<{ success: boolean; message?: string; error?: string }>(
      `/api/activity-logs/${encodeURIComponent(logId)}/restore`,
      { method: 'POST' }
    );
    if (!response.success) {
      throw new Error(response.error || 'Failed to restore item');
    }
  }

  /**
   * Listing decisions go through the reviewProductListing callable (the rules let no client change a product):
   * active/approved publishes, rejected/disabled/archived hides the listing; other states are not review decisions.
   */
  private async reviewProduct(productId: string, status: AdminWorkspaceStatus, reason: string): Promise<AdminWorkspaceStatus> {
    const decision = status === 'active' || status === 'approved' ? 'approved'
      : status === 'rejected' || status === 'disabled' || status === 'archived' ? 'rejected' : null;
    if (!decision) throw new Error('Listings can only be approved or rejected here.');
    const trimmedReason = reason.trim();
    if (decision === 'rejected' && !trimmedReason) throw new Error('Enter a reason for the seller before rejecting this listing.');
    if (trimmedReason.length > 4000) throw new Error('Keep the reason under 4,000 characters.');
    const product = await getDoc(doc(db, 'products', productId));
    if (!product.exists()) throw new Error('Product not found.');
    const revision: unknown = product.data().revision;
    const result = await appServerService.call<{ status?: unknown } | null>('reviewProductListing', {
      productId,
      decision,
      expectedRevision: typeof revision === 'number' && Number.isSafeInteger(revision) && revision >= 0 ? revision : 0,
      operationId: doc(collection(db, 'operationIds')).id,
      ...(decision === 'rejected' ? { reason: trimmedReason } : {}),
    });
    return result?.status === 'approved' || result?.status === 'rejected' ? result.status : decision;
  }

  /**
   * Records the change in adminLogs once the main write has succeeded. An audit failure is logged as a warning and
   * never reported as a failed change, because the change itself was saved.
   */
  private async writeAudit(adminId: string, action: string, targetId: string, details: string): Promise<void> {
    try {
      await addDoc(collection(db, 'adminLogs'), { adminId, action, targetId, details, timestamp: serverTimestamp(), createdAt: serverTimestamp() });
    } catch (auditError: unknown) {
      console.warn('[AdminWorkspaceService.writeAudit] Warning: the change was saved but its audit entry was not.', action, targetId, auditError instanceof Error ? auditError.message : auditError);
    }
  }
}

export const adminWorkspaceService = AdminWorkspaceService.getInstance();
