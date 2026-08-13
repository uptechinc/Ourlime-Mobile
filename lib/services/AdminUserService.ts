import { ApiService, ApiServiceError } from './ApiService';
import { addDoc, collection, documentId, doc, getDocs, limit, orderBy, query, serverTimestamp, startAfter, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import type { PageResult } from '@/lib/types/serviceResults';
import { adminAccessService } from './AdminAccessService';
import { auth } from '@/lib/firebaseConfig';

export type AdminUserRole = 'user' | 'premium' | 'moderator' | 'admin' | 'developer';
export type AdminUserRecord = {
  id: string;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  profilePicture: string | null;
  role: AdminUserRole;
  isAdmin: boolean;
  emailVerified: boolean;
  accountStatus: string;
  archived: boolean;
  banned: boolean;
  accountType: string;
  onlineStatus: string;
  statusReason: string;
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'unsubmitted';
  isAuthenticated: boolean;
  createdAtMs: number;
};
export type AdminAccountStatus = 'active' | 'pending' | 'suspended' | 'banned';

type AdminUserSource = {
  id?: unknown; firstName?: unknown; lastName?: unknown; userName?: unknown; email?: unknown;
  profilePicture?: unknown; profileImage?: unknown; role?: unknown; isAdmin?: unknown; emailVerified?: unknown;
  accountStatus?: unknown; deletedAt?: unknown; banned?: unknown; isBanned?: unknown; accountType?: unknown;
  onlineStatus?: unknown; statusReason?: unknown; verificationStatus?: unknown; isAuthenticated?: unknown; createdAt?: unknown;
};
const isUserSource = (value: unknown): value is AdminUserSource => typeof value === 'object' && value !== null && !Array.isArray(value);
const readString = (value: unknown): string => typeof value === 'string' ? value : '';
const readRole = (value: unknown): AdminUserRole => value === 'premium' || value === 'moderator' || value === 'admin' || value === 'developer' ? value : 'user';
const readVerificationStatus = (value: unknown): AdminUserRecord['verificationStatus'] => value === 'pending' || value === 'verified' || value === 'rejected' ? value : 'unsubmitted';
const readDateMs = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') return new Date(value).getTime() || 0;
  if (typeof value === 'object' && value !== null && 'seconds' in value && typeof value.seconds === 'number') return value.seconds * 1000;
  return 0;
};

export class AdminUserService {
  private static instance: AdminUserService;
  private readonly apiService = ApiService.getInstance();

  private constructor() {}

  public static getInstance(): AdminUserService {
    if (!AdminUserService.instance) AdminUserService.instance = new AdminUserService();
    return AdminUserService.instance;
  }

  public getCurrentUserId(): string | null {
    return auth.currentUser?.uid ?? null;
  }

  public async fetchUsers(cursor?: string | null): Promise<PageResult<AdminUserRecord>> {
    const search = new URLSearchParams({ limit: '50' });
    if (cursor) search.set('cursor', cursor);
    try {
      return await this.fetchUsersFromFirestore(cursor);
    } catch (firestoreError: unknown) {
      console.warn('[AdminUserService] Firestore users unavailable; trying the secure API.', firestoreError);
      const response = await this.apiService.request<{ success: boolean; data?: unknown[]; error?: string; pagination?: { hasMore?: boolean; nextCursor?: string | null } }>(`/api/admin/users?${search.toString()}`, { authenticated: true, timeoutMs: 2_500 });
      if (!response.success) throw new Error(response.error || 'Unable to load users');
      return this.createPage(response.data ?? [], response.pagination?.hasMore === true, response.pagination?.nextCursor ?? null);
    }
  }

  public async updateRole(userId: string, role: AdminUserRole): Promise<void> {
    try {
      await this.apiService.request(`/api/admin/users/${encodeURIComponent(userId)}/role`, { method: 'PATCH', authenticated: true, body: { role }, timeoutMs: 8_000 });
    } catch (error: unknown) {
      if (error instanceof ApiServiceError && error.code === 'REQUEST_TIMEOUT') {
        throw new Error('Role changes require the secure Ourlime server, which is currently unavailable.');
      }
      throw error;
    }
  }

  public async updateLifecycle(userId: string, action: 'archive' | 'unarchive' | 'delete_permanently'): Promise<void> {
    try {
      await this.apiService.request(`/api/admin/users/${encodeURIComponent(userId)}/lifecycle`, { method: 'POST', authenticated: true, body: { action }, timeoutMs: 8_000 });
    } catch (error: unknown) {
      if (error instanceof ApiServiceError && error.code === 'REQUEST_TIMEOUT') {
        throw new Error('Account lifecycle actions require the secure Ourlime server, which is currently unavailable.');
      }
      throw error;
    }
  }

  public async updateAccountStatus(userId: string, status: AdminAccountStatus, reason: string, suspendedUntil: Date | null): Promise<void> {
    const administrator = await adminAccessService.requireAdmin();
    await updateDoc(doc(db, 'users', userId), {
      accountStatus: status,
      statusReason: reason.trim(),
      statusUpdatedAt: serverTimestamp(),
      statusUpdatedBy: administrator.userId,
      suspendedUntil,
      suspendedAt: status === 'suspended' ? serverTimestamp() : null,
      bannedAt: status === 'banned' ? serverTimestamp() : null,
      isBanned: status === 'banned',
      banned: status === 'banned',
      isSuspended: status === 'suspended',
    });
    await addDoc(collection(db, 'adminLogs'), { action: 'change_account_status', adminId: administrator.userId, targetUserId: userId, newStatus: status, reason: reason.trim(), createdAt: serverTimestamp(), timestamp: serverTimestamp() });
  }

  public async verifyEmail(userId: string): Promise<void> {
    const administrator = await adminAccessService.requireAdmin();
    await updateDoc(doc(db, 'users', userId), { emailVerified: true, manuallyVerified: true, verifiedBy: administrator.userId, verifiedAt: serverTimestamp() });
    await addDoc(collection(db, 'adminLogs'), { action: 'verify_user_email', adminId: administrator.userId, targetUserId: userId, createdAt: serverTimestamp(), timestamp: serverTimestamp() });
  }

  public async updateIdentityVerification(userId: string, status: 'verified' | 'rejected', reason: string): Promise<void> {
    const administrator = await adminAccessService.requireAdmin();
    await updateDoc(doc(db, 'users', userId), {
      isAuthenticated: status === 'verified',
      verificationStatus: status,
      verificationRejectionReason: status === 'rejected' ? reason.trim() : '',
      verificationReviewedAt: serverTimestamp(),
      verificationReviewedBy: administrator.userId,
    });
    await addDoc(collection(db, 'adminLogs'), { action: status === 'verified' ? 'authenticate_user' : 'reject_verification', adminId: administrator.userId, targetUserId: userId, reason: reason.trim(), createdAt: serverTimestamp(), timestamp: serverTimestamp() });
  }

  public createCsv(users: readonly AdminUserRecord[]): string {
    const escapeCell = (value: string): string => `"${value.replace(/"/g, '""')}"`;
    const header = ['ID', 'First Name', 'Last Name', 'Username', 'Email', 'Role', 'Status', 'Account Type', 'Email Verified', 'Identity Verified'];
    const rows = users.map((user) => [user.id, user.firstName, user.lastName, user.userName, user.email, user.role, user.archived ? 'archived' : user.accountStatus, user.accountType, String(user.emailVerified), String(user.isAuthenticated)]);
    return [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
  }

  private async fetchUsersFromFirestore(cursor?: string | null): Promise<PageResult<AdminUserRecord>> {
    await adminAccessService.requireAdmin();
    const pageSize = 50;
    const constraints = cursor
      ? [orderBy(documentId()), startAfter(cursor), limit(pageSize + 1)]
      : [orderBy(documentId()), limit(pageSize + 1)];
    const snapshot = await getDocs(query(collection(db, 'users'), ...constraints));
    const documents = snapshot.docs.slice(0, pageSize);
    return this.createPage(
      documents.map((document) => ({ ...document.data(), id: document.id })),
      snapshot.docs.length > pageSize,
      snapshot.docs.length > pageSize ? documents.at(-1)?.id ?? null : null,
    );
  }

  private createPage(values: unknown[], hasMore: boolean, nextCursor: string | null): PageResult<AdminUserRecord> {
    return {
      items: values.flatMap((value): AdminUserRecord[] => {
        if (!isUserSource(value)) return [];
        const id = readString(value.id);
        if (!id) return [];
        const role = readRole(value.role);
        return [{
          id,
          firstName: readString(value.firstName),
          lastName: readString(value.lastName),
          userName: readString(value.userName),
          email: readString(value.email),
          profilePicture: readString(value.profilePicture) || readString(value.profileImage) || null,
          role,
          isAdmin: value.isAdmin === true || role === 'admin',
          emailVerified: value.emailVerified === true,
          accountStatus: readString(value.accountStatus) || 'active',
          archived: value.deletedAt !== null && value.deletedAt !== undefined,
          banned: value.banned === true || value.isBanned === true,
          accountType: readString(value.accountType) || 'regular',
          onlineStatus: readString(value.onlineStatus) || 'offline',
          statusReason: readString(value.statusReason),
          verificationStatus: readVerificationStatus(value.verificationStatus),
          isAuthenticated: value.isAuthenticated === true,
          createdAtMs: readDateMs(value.createdAt),
        }];
      }),
      hasMore,
      nextCursor,
    };
  }
}

export const adminUserService = AdminUserService.getInstance();
