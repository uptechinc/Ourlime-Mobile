import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, limit } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { ApiService } from '@/lib/services/ApiService';
import { adminAccessService } from '@/lib/services/AdminAccessService';
import { DiagnosticLogService } from '@/lib/services/DiagnosticLogService';
import type {
  AdminDeleteContentRequest,
  AdminRestoreContentRequest,
  SubmitAppealRequest,
  ContentAppealRecord,
  UserDeletedPostRecord,
  PredefinedDeletionCategory,
  AdminUserContentFilter,
  AdminUserContentPage,
  AdminUserContentRecord,
} from '@/lib/types/adminContent';
import type { ModerationDeliveryResult } from '@/lib/types/moderationDelivery';

export type AdminContentMutationResult = {
  success: boolean;
  error?: string;
  correlationId?: string;
  delivery?: ModerationDeliveryResult;
};

type UnknownRecord = { [key: string]: unknown };
type UserContentSource = 'feedPosts' | 'reels';
type UserContentDocument = {
  source: UserContentSource;
  id: string;
  data: UnknownRecord;
};

const USER_CONTENT_SOURCES: UserContentSource[] = ['feedPosts', 'reels'];
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const readString = (value: unknown): string => typeof value === 'string' ? value : '';
const readTimestampMs = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (!isRecord(value)) return 0;
  if (typeof value.toDate === 'function') {
    const converted = value.toDate();
    return converted instanceof Date ? converted.getTime() : 0;
  }
  const seconds = typeof value.seconds === 'number'
    ? value.seconds
    : typeof value._seconds === 'number'
      ? value._seconds
      : 0;
  return seconds * 1_000;
};
const readTimestampIso = (value: unknown): string | null => {
  const milliseconds = readTimestampMs(value);
  return milliseconds > 0 ? new Date(milliseconds).toISOString() : null;
};
const isAdminDeletedContent = (value: UnknownRecord): boolean => (
  (value.isDeleted === true || value.status === 'deleted')
  && (value.deletedByAdmin === true || value.deletionSource === 'admin_moderation')
);

export class AdminContentService {
  private static instance: AdminContentService;
  private readonly apiService = ApiService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): AdminContentService {
    if (!AdminContentService.instance) {
      AdminContentService.instance = new AdminContentService();
    }
    return AdminContentService.instance;
  }

  public async deleteContent(params: AdminDeleteContentRequest): Promise<AdminContentMutationResult> {
    await adminAccessService.requireAdmin();
    const correlationId = this.createCorrelationId();
    this.logger.info('AdminContentService', 'delete:start', { correlationId, contentId: params.contentId, contentType: params.contentType });
    const response = await this.apiService.request<AdminContentMutationResult>(
      '/api/admin/content/delete',
      { method: 'POST', authenticated: true, body: params, headers: { 'X-Ourlime-Correlation-Id': correlationId }, timeoutMs: 45_000 },
    );
    this.logDelivery('delete', response.delivery, correlationId);
    return response.success
      ? { ...response, success: true, correlationId }
      : { success: false, error: response.error || 'Failed to delete content.' };
  }

  public async restoreContent(params: AdminRestoreContentRequest): Promise<AdminContentMutationResult> {
    await adminAccessService.requireAdmin();
    const correlationId = this.createCorrelationId();
    this.logger.info('AdminContentService', 'restore:start', { correlationId, contentId: params.contentId, contentType: params.contentType });
    const response = await this.apiService.request<AdminContentMutationResult>(
      '/api/admin/content/restore',
      { method: 'POST', authenticated: true, body: params, headers: { 'X-Ourlime-Correlation-Id': correlationId }, timeoutMs: 45_000 },
    );
    this.logDelivery('restore', response.delivery, correlationId);
    return response.success
      ? { ...response, success: true, correlationId }
      : { success: false, error: response.error || 'Failed to restore content.' };
  }

  public async retryDelivery(eventId: string): Promise<ModerationDeliveryResult> {
    const response = await this.apiService.request<{ success: boolean; delivery: ModerationDeliveryResult; error?: string }>(
      `/api/admin/moderation-delivery/${encodeURIComponent(eventId)}/retry`,
      { method: 'POST', authenticated: true, timeoutMs: 18_000 },
    );
    if (!response.success) throw new Error(response.error || 'Unable to retry email delivery.');
    return response.delivery;
  }

  private createCorrelationId(): string {
    return `mobile-content-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private logDelivery(action: 'delete' | 'restore', delivery: ModerationDeliveryResult | undefined, correlationId: string): void {
    this.logger.info('AdminContentService', `${action}:delivery`, {
      correlationId,
      notificationStatus: delivery?.notificationStatus ?? 'not_reported',
      emailStatus: delivery?.emailStatus ?? 'not_reported',
      emailAttemptCount: delivery?.emailAttemptCount ?? 0,
      errorCode: delivery?.errorCode ?? null,
    });
  }

  public async submitAppeal(submission: SubmitAppealRequest): Promise<{ success: boolean; appealId?: string; error?: string }> {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'Authentication required' };

    try {
      const response = await this.apiService.request<{ success: boolean; appealId?: string; error?: string }>(
        '/api/appeals',
        {
          method: 'POST',
          authenticated: true,
          body: submission,
        }
      );
      if (response?.success) return response;
    } catch {
      // Fallback to Firestore
    }

    const appealRef = doc(collection(db, 'contentAppeals'));
    await setDoc(appealRef, {
      id: appealRef.id,
      contentId: submission.contentId,
      contentType: submission.contentType,
      authorId: user.uid,
      authorEmail: user.email || '',
      deletionReason: submission.deletionReason,
      appealReason: submission.appealReason,
      status: 'pending',
      createdAt: serverTimestamp(),
    });

    return { success: true, appealId: appealRef.id };
  }

  public async getUserContent(
    userId: string,
    filter: AdminUserContentFilter = 'all',
    cursor?: string | null,
    requestedPageSize = 20,
  ): Promise<AdminUserContentPage> {
    await adminAccessService.requireAdmin();
    const pageSize = Math.min(Math.max(Math.trunc(requestedPageSize) || 20, 1), 50);
    if (!cursor?.startsWith('fallback:')) {
      try {
        const search = new URLSearchParams({ filter, limit: String(pageSize) });
        if (cursor) search.set('cursor', cursor);
        const response = await this.apiService.request<{
          success: boolean;
          data?: AdminUserContentPage;
          error?: string;
        }>(`/api/admin/users/${encodeURIComponent(userId)}/posts?${search.toString()}`, {
          method: 'GET',
          authenticated: true,
          timeoutMs: 18_000,
        });
        if (response.success && response.data) return response.data;
        throw new Error(response.error || 'Unable to load user content.');
      } catch (error: unknown) {
        this.logger.warn('AdminContentService', 'user-content:api-fallback', {
          userId,
          message: error instanceof Error ? error.message : 'Unknown API error',
        });
      }
    }
    return this.getUserContentFromFirestore(userId, filter, cursor, pageSize);
  }

  private async getUserContentFromFirestore(
    userId: string,
    filter: AdminUserContentFilter,
    cursor: string | null | undefined,
    pageSize: number,
  ): Promise<AdminUserContentPage> {
    const snapshots = await Promise.all(USER_CONTENT_SOURCES.map(async (source) => ({
      source,
      snapshot: await getDocs(query(
        collection(db, source),
        where('userId', '==', userId),
        limit(200),
      )),
    })));
    const documents: UserContentDocument[] = snapshots
      .flatMap(({ source, snapshot }) => snapshot.docs.map((contentDocument): UserContentDocument => ({
        source,
        id: contentDocument.id,
        data: isRecord(contentDocument.data()) ? contentDocument.data() : {},
      })))
      .sort((left, right) => readTimestampMs(right.data.createdAt) - readTimestampMs(left.data.createdAt)
        || right.id.localeCompare(left.id));
    const feedPostIds = documents
      .filter((contentDocument) => contentDocument.source === 'feedPosts')
      .map((contentDocument) => contentDocument.id);
    const feedMediaByPostId = new Map<string, AdminUserContentRecord['mediaPreviews']>();
    for (let offset = 0; offset < feedPostIds.length; offset += 30) {
      const idChunk = feedPostIds.slice(offset, offset + 30);
      if (idChunk.length === 0) continue;
      const mediaSnapshot = await getDocs(query(
        collection(db, 'feedsPostSummary'),
        where('feedsPostId', 'in', idChunk),
      ));
      mediaSnapshot.docs.forEach((mediaDocument) => {
        const mediaData: unknown = mediaDocument.data();
        if (!isRecord(mediaData)) return;
        const postId = readString(mediaData.feedsPostId);
        const mediaUrl = readString(mediaData.typeUrl);
        if (!postId || !mediaUrl) return;
        const rawType = readString(mediaData.type).toLowerCase();
        const mediaType = rawType.includes('image')
          ? 'image'
          : rawType.includes('video')
            ? 'video'
            : 'media';
        const existingMedia = feedMediaByPostId.get(postId) ?? [];
        if (existingMedia.some((entry) => entry.url === mediaUrl)) return;
        feedMediaByPostId.set(postId, [...existingMedia, {
          id: mediaDocument.id,
          url: mediaUrl,
          type: mediaType,
          thumbnailUrl: readString(mediaData.thumbnailUrl) || readString(mediaData.previewUrl) || null,
        }]);
      });
    }

    const records = documents.map((contentDocument): AdminUserContentRecord => {
      const value = contentDocument.data;
      const nestedMedia = isRecord(value.media) ? value.media : {};
      const feedMedia = feedMediaByPostId.get(contentDocument.id) ?? [];
      const limeThumbnail = readString(value.thumbnailUrl) || readString(nestedMedia.thumbnailUrl);
      const limeVideo = readString(nestedMedia.typeUrl);
      const mediaPreviews: AdminUserContentRecord['mediaPreviews'] = contentDocument.source === 'reels'
        ? limeVideo
          ? [{ id: `${contentDocument.id}:video`, url: limeVideo, type: 'video', thumbnailUrl: limeThumbnail || null }]
          : limeThumbnail
            ? [{ id: `${contentDocument.id}:thumbnail`, url: limeThumbnail, type: 'image', thumbnailUrl: null }]
            : []
        : feedMedia;
      const primaryMedia = mediaPreviews[0] ?? null;
      return {
        id: contentDocument.id,
        authorId: readString(value.userId) || userId,
        contentType: contentDocument.source === 'reels' ? 'lime' : 'post',
        caption: readString(value.caption) || readString(value.title),
        description: readString(value.description) || readString(value.content),
        visibility: readString(value.visibility) || 'public',
        createdAt: readTimestampIso(value.createdAt),
        mediaPreviewUrl: primaryMedia?.thumbnailUrl ?? primaryMedia?.url ?? null,
        mediaPreviewType: primaryMedia?.thumbnailUrl ? 'image' : primaryMedia?.type ?? null,
        mediaPreviews,
        isDeleted: value.isDeleted === true || value.status === 'deleted',
        deletedByAdmin: isAdminDeletedContent(value),
        deletedAt: readTimestampIso(value.deletedAt),
        adminId: readString(value.adminId) || readString(value.deletedBy) || null,
        adminName: readString(value.adminName) || readString(value.deletedByName) || null,
        deletionReason: readString(value.deletionReason) || null,
        deletionCategory: readString(value.deletionCategory) || null,
        deletionNotes: readString(value.deletionNotes) || null,
        deletionAuditId: readString(value.deletionAuditId) || null,
      };
    }).filter((contentRecord) => {
      if (filter === 'deleted_by_admin') return contentRecord.deletedByAdmin;
      if (filter === 'active') return !contentRecord.isDeleted;
      return true;
    });
    const requestedOffset = cursor?.startsWith('fallback:')
      ? Number(cursor.slice('fallback:'.length))
      : 0;
    const offset = Number.isFinite(requestedOffset) && requestedOffset > 0 ? Math.trunc(requestedOffset) : 0;
    const items = records.slice(offset, offset + pageSize);
    const nextOffset = offset + items.length;
    const hasMore = nextOffset < records.length;
    this.logger.success('AdminContentService', 'user-content:firestore', {
      userId,
      filter,
      resultCount: items.length,
      hasMore,
    });
    return {
      items,
      pageSize,
      hasMore,
      nextCursor: hasMore ? `fallback:${nextOffset}` : null,
    };
  }

  public async getUserDeletedPosts(userId: string): Promise<UserDeletedPostRecord[]> {
    await adminAccessService.requireAdmin();

    try {
      const response = await this.apiService.request<{ success: boolean; data: UserDeletedPostRecord[] }>(
        `/api/admin/users/${userId}/deleted-posts`,
        {
          method: 'GET',
          authenticated: true,
        }
      );
      if (response?.success && Array.isArray(response.data)) return response.data;
    } catch {
      // Fallback to Firestore
    }

    const q = query(
      collection(db, 'feedPosts'),
      where('userId', '==', userId),
      where('isDeleted', '==', true)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        caption: data.caption || data.title || '',
        userId: data.userId || '',
        deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate().toISOString() : String(data.deletedAt || ''),
        deletedByName: data.deletedByName || 'Admin',
        deletionReason: data.deletionReason || 'Policy Violation',
        deletionCategory: data.deletionCategory || 'custom',
        imageUrl: data.imageUrl || data.image || '',
        images: data.images || [],
        mediaUrls: data.mediaUrls || [],
        type: data.type || 'post',
      };
    });
  }

  public async getPendingAppeals(): Promise<ContentAppealRecord[]> {
    await adminAccessService.requireAdmin();

    try {
      const response = await this.apiService.request<{ success: boolean; data: ContentAppealRecord[] }>(
        '/api/admin/appeals',
        {
          method: 'GET',
          authenticated: true,
        }
      );
      if (response?.success && Array.isArray(response.data)) return response.data;
    } catch {
      // Fallback
    }

    const q = query(
      collection(db, 'contentAppeals'),
      where('status', '==', 'pending'),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        contentId: data.contentId || '',
        contentType: data.contentType || 'post',
        authorId: data.authorId || '',
        authorEmail: data.authorEmail || '',
        authorName: data.authorName || 'User',
        deletionReason: data.deletionReason || '',
        appealReason: data.appealReason || '',
        status: data.status || 'pending',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : String(data.createdAt || ''),
      };
    });
  }

  public async reviewAppeal(appealId: string, decision: 'approved' | 'rejected', reviewNote?: string): Promise<{ success: boolean; error?: string }> {
    await adminAccessService.requireAdmin();

    try {
      const response = await this.apiService.request<{ success: boolean; error?: string }>(
        '/api/admin/appeals',
        {
          method: 'POST',
          authenticated: true,
          body: { appealId, decision, reviewNote },
        }
      );
      if (response?.success) return { success: true };
    } catch {
      // Fallback
    }

    const appealRef = doc(db, 'contentAppeals', appealId);
    const snap = await getDoc(appealRef);
    if (!snap.exists()) return { success: false, error: 'Appeal not found' };

    const data = snap.data();
    await updateDoc(appealRef, {
      status: decision,
      reviewedAt: serverTimestamp(),
      reviewNote: reviewNote || '',
    });

    if (decision === 'approved' && data.contentId && data.contentType) {
      await this.restoreContent({
        contentType: data.contentType,
        contentId: data.contentId,
        restoreReason: `Appeal approved: ${reviewNote || 'Approved'}`,
      });
    }

    return { success: true };
  }
}

export const adminContentService = AdminContentService.getInstance();
