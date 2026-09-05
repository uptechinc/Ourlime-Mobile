import { ApiService, ApiServiceError } from './ApiService';
import { addDoc, collection, documentId, doc, getDocs, limit, orderBy, query, serverTimestamp, startAfter, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import type { PageResult } from '@/lib/types/serviceResults';
import { adminAccessService } from './AdminAccessService';
import { auth } from '@/lib/firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';
import type { ModerationDeliveryResult } from '@/lib/types/moderationDelivery';
import { localCacheService } from './LocalCacheService';
import { useResourceStore } from '@/lib/store/useResourceStore';

const USER_LIFECYCLE_START_TIMEOUT_MS = 18_000;
const USER_LIFECYCLE_POLL_INTERVAL_MS = 1_000;
const USER_LIFECYCLE_POLL_TIMEOUT_MS = 180_000;

export type UserLifecycleOperation = {
  id: string;
  targetUserId: string;
  administratorId: string;
  action: 'archive' | 'unarchive' | 'delete_permanently' | 'hide_for_status' | 'activate';
  phase: 'queued' | 'discovering' | 'processing' | 'notifying' | 'completed' | 'failed';
  processedDocuments: number;
  totalDocuments: number;
  affectedCollections: string[];
  storageObjectsDeleted: number;
  authDeleted: boolean;
  delivery?: ModerationDeliveryResult;
  errorCode?: string;
};

type LifecycleStartResponse = { success: boolean; operation: UserLifecycleOperation; correlationId: string; error?: string };
type LifecycleStatusResponse = { success: boolean; operation: UserLifecycleOperation; error?: string };

export type AdminUserRole = 'user' | 'premium' | 'moderator' | 'tester' | 'admin' | 'developer';
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
  profilePicture?: unknown; profileImage?: unknown; profileImages?: unknown; avatar?: unknown; photoURL?: unknown;
  role?: unknown; isAdmin?: unknown; emailVerified?: unknown;
  accountStatus?: unknown; deletedAt?: unknown; banned?: unknown; isBanned?: unknown; accountType?: unknown;
  onlineStatus?: unknown; statusReason?: unknown; verificationStatus?: unknown; isAuthenticated?: unknown; createdAt?: unknown;
};
type UnknownRecord = { [key: string]: unknown };
type ProfileImageSelection = {
  userId: string;
  profileImageId: string;
  setAs: string;
};
const isUserSource = (value: unknown): value is AdminUserSource => typeof value === 'object' && value !== null && !Array.isArray(value);
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const readString = (value: unknown): string => typeof value === 'string' ? value : '';
const readImageUrl = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (!isRecord(value)) return '';
  return readString(value.imageURL)
    || readString(value.imageUrl)
    || readString(value.downloadURL)
    || readString(value.url);
};
const readEmbeddedProfileImage = (value: unknown): string => {
  if (!isRecord(value)) return '';
  return readImageUrl(value.profile) || readImageUrl(value.avatar);
};
const readRole = (value: unknown): AdminUserRole => value === 'premium' || value === 'moderator' || value === 'tester' || value === 'admin' || value === 'developer' ? value : 'user';
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
  private readonly logger = DiagnosticLogService.getInstance();

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
      return await this.resolveProfilePictures(await this.fetchUsersFromFirestore(cursor));
    } catch (firestoreError: unknown) {
      this.logger.warn('AdminUserService', 'users:firestore-fallback', {
        message: firestoreError instanceof Error ? firestoreError.message : 'Unknown Firestore error',
      });
      const response = await this.apiService.request<{ success: boolean; data?: unknown[]; error?: string; pagination?: { hasMore?: boolean; nextCursor?: string | null } }>(`/api/admin/users?${search.toString()}`, { authenticated: true, timeoutMs: 18_000 });
      if (!response.success) throw new Error(response.error || 'Unable to load users');
      return this.resolveProfilePictures(this.createPage(
        response.data ?? [],
        response.pagination?.hasMore === true,
        response.pagination?.nextCursor ?? null,
      ));
    }
  }

  public async updateRole(userId: string, role: AdminUserRole): Promise<void> {
    try {
      await this.apiService.request(`/api/admin/users/${encodeURIComponent(userId)}/role`, { method: 'PATCH', authenticated: true, body: { role }, timeoutMs: 18_000 });
    } catch (error: unknown) {
      if (error instanceof ApiServiceError && error.code === 'REQUEST_TIMEOUT') {
        throw new Error('Role changes require the secure Ourlime server, which is currently unavailable.');
      }
      throw error;
    }
  }

  public async updateLifecycle(
    userId: string,
    action: 'archive' | 'unarchive' | 'delete_permanently',
    reason: string,
    onProgress?: (operation: UserLifecycleOperation) => void,
  ): Promise<UserLifecycleOperation> {
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new Error('A lifecycle reason is required.');
    try {
      const correlationId = this.createCorrelationId();
      this.logger.info('AdminUserService', 'lifecycle:start', { correlationId, userId, action });
      const response = await this.apiService.request<LifecycleStartResponse>(`/api/admin/users/${encodeURIComponent(userId)}/lifecycle`, {
        method: 'POST',
        authenticated: true,
        body: { action, reason: normalizedReason },
        headers: { 'X-Ourlime-Correlation-Id': correlationId },
        timeoutMs: USER_LIFECYCLE_START_TIMEOUT_MS,
        availabilityImpact: 'request-only',
      });
      onProgress?.(response.operation);
      return await this.waitForLifecycleOperation(userId, response.operation.id, onProgress);
    } catch (error: unknown) {
      if (error instanceof ApiServiceError && error.code === 'REQUEST_TIMEOUT') {
        throw new Error('The lifecycle job was queued but progress could not be loaded. Refresh the user to resume tracking it.');
      }
      throw error;
    }
  }

  public async updateAccountStatus(userId: string, status: AdminAccountStatus, reason: string, suspendedUntil: Date | null, onProgress?: (operation: UserLifecycleOperation) => void): Promise<UserLifecycleOperation> {
    await adminAccessService.requireAdmin();
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new Error('A status reason is required.');
    const correlationId = this.createCorrelationId();
    const response = await this.apiService.request<LifecycleStartResponse>(
      `/api/admin/users/${encodeURIComponent(userId)}/status`,
      {
        method: 'PATCH',
        authenticated: true,
        body: {
          status,
          reason: normalizedReason,
          suspendedUntil: suspendedUntil?.toISOString() ?? null,
        },
        headers: { 'X-Ourlime-Correlation-Id': correlationId },
        timeoutMs: USER_LIFECYCLE_START_TIMEOUT_MS,
      },
    );
    if (!response.success) throw new Error(response.error || 'Unable to update account status.');
    onProgress?.(response.operation);
    return this.waitForLifecycleOperation(userId, response.operation.id, onProgress);
  }

  public async retryLifecycleOperation(userId: string, operationId: string): Promise<UserLifecycleOperation> {
    const response = await this.apiService.request<LifecycleStatusResponse>(
      `/api/admin/users/${encodeURIComponent(userId)}/lifecycle/${encodeURIComponent(operationId)}/retry`,
      { method: 'POST', authenticated: true, timeoutMs: USER_LIFECYCLE_START_TIMEOUT_MS },
    );
    if (!response.success) throw new Error(response.error || 'Unable to retry lifecycle operation.');
    return this.waitForLifecycleOperation(userId, operationId);
  }

  public async retryModerationDelivery(eventId: string): Promise<ModerationDeliveryResult> {
    const response = await this.apiService.request<{ success: boolean; delivery: ModerationDeliveryResult; error?: string }>(
      `/api/admin/moderation-delivery/${encodeURIComponent(eventId)}/retry`,
      { method: 'POST', authenticated: true, timeoutMs: USER_LIFECYCLE_START_TIMEOUT_MS },
    );
    if (!response.success) throw new Error(response.error || 'Unable to retry email delivery.');
    this.logger.info('AdminUserService', 'delivery:retry', {
      eventId,
      emailStatus: response.delivery.emailStatus,
      attemptCount: response.delivery.emailAttemptCount,
    });
    return response.delivery;
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
          profilePicture: readImageUrl(value.profilePicture)
            || readImageUrl(value.profileImage)
            || readEmbeddedProfileImage(value.profileImages)
            || readImageUrl(value.avatar)
            || readImageUrl(value.photoURL)
            || null,
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

  private async resolveProfilePictures(page: PageResult<AdminUserRecord>): Promise<PageResult<AdminUserRecord>> {
    if (page.items.length === 0) return page;
    try {
      const userIds = [...new Set(page.items.map((user) => user.id).filter(Boolean))];
      const selectionSnapshots = await Promise.all(
        Array.from({ length: Math.ceil(userIds.length / 30) }, (_, index) => userIds.slice(index * 30, index * 30 + 30))
          .filter((userIdChunk) => userIdChunk.length > 0)
          .map((userIdChunk) => getDocs(query(
            collection(db, 'profileImageSetAs'),
            where('userId', 'in', userIdChunk),
          )))
      );
      const selectionByUserId = new Map<string, ProfileImageSelection>();
      selectionSnapshots.flatMap((snapshot) => snapshot.docs).forEach((selectionDocument) => {
        const value: unknown = selectionDocument.data();
        if (!isRecord(value)) return;
        const selection: ProfileImageSelection = {
          userId: readString(value.userId),
          profileImageId: readString(value.profileImageId),
          setAs: readString(value.setAs),
        };
        if (
          !selection.userId
          || !selection.profileImageId
          || (selection.setAs !== 'postProfile' && selection.setAs !== 'profile')
        ) return;
        const existing = selectionByUserId.get(selection.userId);
        const existingPriority = existing?.setAs === 'postProfile' ? 2 : existing?.setAs === 'profile' ? 1 : 0;
        const nextPriority = selection.setAs === 'postProfile' ? 2 : selection.setAs === 'profile' ? 1 : 0;
        if (!existing || nextPriority > existingPriority) selectionByUserId.set(selection.userId, selection);
      });

      const imageIds = [...new Set(
        [...selectionByUserId.values()].map((selection) => selection.profileImageId).filter(Boolean)
      )];
      const imageSnapshots = await Promise.all(
        Array.from({ length: Math.ceil(imageIds.length / 30) }, (_, index) => imageIds.slice(index * 30, index * 30 + 30))
          .filter((imageIdChunk) => imageIdChunk.length > 0)
          .map((imageIdChunk) => getDocs(query(
            collection(db, 'profileImages'),
            where(documentId(), 'in', imageIdChunk),
          )))
      );
      const imageUrlById = new Map<string, string>();
      imageSnapshots.flatMap((snapshot) => snapshot.docs).forEach((imageDocument) => {
        const imageUrl = readImageUrl(imageDocument.data());
        if (imageUrl) imageUrlById.set(imageDocument.id, imageUrl);
      });

      const resolvedItems = page.items.map((user): AdminUserRecord => {
        const selectedImageId = selectionByUserId.get(user.id)?.profileImageId;
        return {
          ...user,
          profilePicture: selectedImageId
            ? imageUrlById.get(selectedImageId) || user.profilePicture
            : user.profilePicture,
        };
      });
      this.logger.success('AdminUserService', 'avatars:resolved', {
        userCount: resolvedItems.length,
        selectionCount: selectionByUserId.size,
        resolvedAvatarCount: resolvedItems.filter((user) => Boolean(user.profilePicture)).length,
      });
      return { ...page, items: resolvedItems };
    } catch (error: unknown) {
      this.logger.warn('AdminUserService', 'avatars:resolve', {
        message: error instanceof Error ? error.message : 'Unknown avatar resolution error',
      });
      return page;
    }
  }

  private createCorrelationId(): string {
    return `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private async waitForLifecycleOperation(
    userId: string,
    operationId: string,
    onProgress?: (operation: UserLifecycleOperation) => void,
  ): Promise<UserLifecycleOperation> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < USER_LIFECYCLE_POLL_TIMEOUT_MS) {
      const response = await this.apiService.request<LifecycleStatusResponse>(
        `/api/admin/users/${encodeURIComponent(userId)}/lifecycle/${encodeURIComponent(operationId)}`,
        { authenticated: true, timeoutMs: USER_LIFECYCLE_START_TIMEOUT_MS, availabilityImpact: 'request-only' },
      );
      const operation = response.operation;
      onProgress?.(operation);
      this.logger.info('AdminUserService', 'lifecycle:progress', {
        operationId,
        userId,
        phase: operation.phase,
        processedDocuments: operation.processedDocuments,
        totalDocuments: operation.totalDocuments,
        emailStatus: operation.delivery?.emailStatus ?? 'not_requested',
      });
      if (operation.phase === 'completed') {
        const administratorId = auth.currentUser?.uid;
        if (administratorId) await localCacheService.clearUser(administratorId).catch(() => undefined);
        useResourceStore.getState().clearUserResources();
        return operation;
      }
      if (operation.phase === 'failed') throw new Error(`Lifecycle job failed (${operation.errorCode || 'unknown error'}). You can retry it safely.`);
      await new Promise<void>((resolve) => setTimeout(resolve, USER_LIFECYCLE_POLL_INTERVAL_MS));
    }
    throw new Error('The lifecycle job is still running. Refresh the user to continue tracking progress.');
  }
}

export const adminUserService = AdminUserService.getInstance();
