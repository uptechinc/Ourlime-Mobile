import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { adminAccessService } from './AdminAccessService';
import { apiService } from './ApiService';

type FirebaseDateValue = { toMillis?: () => number; seconds?: number } | string | number | Date | null | undefined;
type AdminDocumentData = {
  title?: unknown;
  name?: unknown;
  description?: unknown;
  status?: unknown;
  privacy?: unknown;
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
  packId?: unknown;
  isActive?: unknown;
  isPublished?: unknown;
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
export type AdminWorkspaceStatus = 'active' | 'pending' | 'approved' | 'rejected' | 'archived' | 'disabled' | 'other';
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
};
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

const readString = (value: unknown): string => typeof value === 'string' ? value : '';
const readNumber = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const readStatus = (value: unknown): AdminWorkspaceStatus => {
  const status = readString(value).toLowerCase();
  return status === 'active' || status === 'pending' || status === 'approved' || status === 'rejected' || status === 'archived' || status === 'disabled'
    ? status
    : 'other';
};
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

  public async fetchWorkspaceItems(kind: AdminWorkspaceKind, maxResults = 100): Promise<AdminWorkspaceItem[]> {
    await adminAccessService.requireAdmin();
    const snapshot = await getDocs(query(collection(db, getWorkspaceCollection(kind)), limit(Math.min(200, Math.max(1, maxResults)))));
    return snapshot.docs.map((document) => this.normalizeWorkspaceItem(kind, document.id, document.data() as AdminDocumentData));
  }

  public async setWorkspaceStatus(kind: AdminWorkspaceKind, itemId: string, status: AdminWorkspaceStatus): Promise<void> {
    const administrator = await adminAccessService.requireAdmin();
    const statusFields = kind === 'stickers' || kind === 'sticker_packs'
      ? { isActive: status === 'active' || status === 'approved', isPublished: status === 'active' || status === 'approved', status }
      : { status };
    await updateDoc(doc(db, getWorkspaceCollection(kind), itemId), { ...statusFields, updatedAt: serverTimestamp() });
    await this.writeAudit(administrator.userId, `admin_${kind}_status`, itemId, status);
  }

  public async deleteWorkspaceItem(kind: AdminWorkspaceKind, itemId: string): Promise<void> {
    const administrator = await adminAccessService.requireAdmin();
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
    const definitions: ReadonlyArray<{ id: string; label: string; collectionName: string; domain: AdminAnalyticsMetric['domain'] }> = [
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
      ...testers.docs.map((document) => this.normalizeBetaRecord('tester', document.id, document.data() as AdminDocumentData)),
    ];
    const modeValue = config?.docs.find((document) => document.id === 'general')?.data().registrationMode;
    const registrationMode = modeValue === 'open' || modeValue === 'closed' ? modeValue : 'invite_only';
    return { records: records.sort((first, second) => second.createdAtMs - first.createdAtMs), registrationMode };
  }

  public async updateBetaRecord(record: AdminBetaRecord, status: string, notes: string): Promise<void> {
    await adminAccessService.requireAdmin();
    if (record.kind === 'tester') {
      await apiService.request(`/api/beta/admin/testers/${encodeURIComponent(record.id)}`, { method: 'PATCH', authenticated: true, body: { status, notes } });
      return;
    }
    if (record.kind === 'application') {
      const action = status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'note';
      await apiService.request(`/api/beta/admin/applications/${encodeURIComponent(record.id)}`, { method: 'PATCH', authenticated: true, body: { action, adminNotes: notes, sendInvitation: status === 'approved' } });
      return;
    }
    const action = status === 'revoked' ? 'revoke' : status === 'invited' ? 'resend' : 'note';
    await apiService.request(`/api/beta/admin/invitations/${encodeURIComponent(record.id)}`, { method: 'PATCH', authenticated: true, body: { action, notes } });
  }

  public async setRegistrationMode(mode: AdminBetaOverview['registrationMode']): Promise<void> {
    await adminAccessService.requireAdmin();
    await apiService.request('/api/beta/registration-mode', { method: 'PATCH', authenticated: true, body: { mode } });
  }

  public async inviteBetaTester(fullName: string, email: string, notes: string): Promise<AdminBetaInvitationResult> {
    await adminAccessService.requireAdmin();
    return apiService.request<AdminBetaInvitationResult>('/api/beta/admin/invitations', { method: 'POST', authenticated: true, body: { fullName: fullName.trim(), email: email.trim(), notes: notes.trim() } });
  }

  public async seedStickers(): Promise<void> {
    await adminAccessService.requireAdmin();
    await apiService.request('/api/admin/stickers/seed', { method: 'POST', authenticated: true });
  }

  private normalizeWorkspaceItem(kind: AdminWorkspaceKind, id: string, value: AdminDocumentData): AdminWorkspaceItem {
    const title = readString(value.title) || readString(value.name) || 'Untitled';
    const ownerId = readString(value.creatorId) || readString(value.userId) || readString(value.ownerId) || null;
    const imageUrl = readString(value.imageUrl) || readString(value.imageURL) || readString(value.image) || readString(value.coverImage) || null;
    const active = value.isActive !== false && value.isPublished !== false;
    const explicitStatus = readStatus(value.status);
    const status = explicitStatus === 'other' ? active ? 'active' : 'disabled' : explicitStatus;
    const memberCount = readNumber(value.membershipCount) || readNumber(value.members);
    return {
      id,
      title,
      subtitle: kind === 'communities' ? readString(value.privacy) || 'public' : kind === 'stickers' ? readString(value.packId) || 'Unassigned pack' : readString(value.category) || 'Uncategorized',
      description: readString(value.description),
      status,
      category: readString(value.category),
      imageUrl,
      ownerId,
      metricLabel: kind === 'communities' ? `${memberCount} members` : kind === 'products' && readNumber(value.price) ? `$${readNumber(value.price).toLocaleString()}` : null,
      createdAtMs: readDateMs(value.createdAt),
      isActive: active,
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
      notes: readString(value.adminNotes),
      reviewer: readString(value.reviewedByName) || 'Unassigned',
      createdAtMs: readDateMs(kind === 'tester' ? value.betaTesterSince : value.createdAt),
    };
  }

  private async writeAudit(adminId: string, action: string, targetId: string, details: string): Promise<void> {
    await addDoc(collection(db, 'adminLogs'), { adminId, action, targetId, details, timestamp: serverTimestamp(), createdAt: serverTimestamp() });
  }
}

export const adminWorkspaceService = AdminWorkspaceService.getInstance();
