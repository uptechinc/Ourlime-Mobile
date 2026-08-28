import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, limit } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { ApiService } from '@/lib/services/ApiService';
import { adminAccessService } from '@/lib/services/AdminAccessService';
import type {
  AdminDeleteContentRequest,
  AdminRestoreContentRequest,
  SubmitAppealRequest,
  ContentAppealRecord,
  UserDeletedPostRecord,
  PredefinedDeletionCategory,
} from '@/lib/types/adminContent';

export class AdminContentService {
  private static instance: AdminContentService;
  private readonly apiService = ApiService.getInstance();

  private constructor() {}

  public static getInstance(): AdminContentService {
    if (!AdminContentService.instance) {
      AdminContentService.instance = new AdminContentService();
    }
    return AdminContentService.instance;
  }

  private resolvePrimaryReason(category: PredefinedDeletionCategory, customReason?: string): string {
    const categoryLabels: Record<PredefinedDeletionCategory, string> = {
      inappropriate: 'Inappropriate Content / Nudity / Explicit Material',
      harassment: 'Hate Speech / Harassment / Bullying',
      spam: 'Spam / Scam / Commercial Solicitation / Fraud',
      misinformation: 'Misinformation / Harmful Falsehoods',
      copyright: 'Copyright / Intellectual Property Infringement',
      safety: 'Child Safety / Exploitation / Physical Danger',
      tos_violation: 'Community Guidelines / Terms of Service Violation',
      custom: customReason?.trim() || 'Moderation Policy Violation',
    };

    if (category === 'custom' && customReason?.trim()) {
      return customReason.trim();
    }
    return categoryLabels[category] || customReason?.trim() || 'Content Violation';
  }

  public async deleteContent(params: AdminDeleteContentRequest): Promise<{ success: boolean; error?: string }> {
    const identity = await adminAccessService.requireAdmin();

    try {
      const response = await this.apiService.request<{ success: boolean; error?: string }>(
        '/api/admin/content/delete',
        {
          method: 'POST',
          authenticated: true,
          body: params,
        }
      );
      if (response?.success) return { success: true };
    } catch {
      // Fallback to direct Firestore operations
    }

    const reason = this.resolvePrimaryReason(params.category, params.customReason);
    const updatePayload = {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: identity.userId,
      deletionReason: reason,
      deletionCategory: params.category,
      deletionNotes: params.additionalNotes || '',
      deletionSource: 'admin_moderation',
      status: 'deleted',
    };

    let targetAuthorId = '';
    let contentTitle = '';

    if (params.contentType === 'post' || params.contentType === 'lime') {
      const collections = ['feedPosts', 'posts', 'reels', 'limes', 'communityVariantDetails'];
      for (const coll of collections) {
        const docRef = doc(db, coll, params.contentId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (!targetAuthorId) {
            targetAuthorId = data?.userId || data?.user?.id || '';
            contentTitle = String(data?.caption || data?.title || 'Post').slice(0, 100);
          }
          await updateDoc(docRef, updatePayload);
        }
      }
    } else if (params.contentType === 'product') {
      const docRef = doc(db, 'products', params.contentId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        targetAuthorId = data?.sellerId || data?.userId || '';
        contentTitle = data?.title || data?.name || 'Product';
        await updateDoc(docRef, updatePayload);
      }
    } else if (params.contentType === 'blog') {
      const docRef = doc(db, 'blogsAndArticles', params.contentId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        targetAuthorId = data?.authorId || data?.userId || '';
        contentTitle = data?.title || 'Blog';
        await updateDoc(docRef, updatePayload);
      }
    } else if (params.contentType === 'project') {
      const docRef = doc(db, 'projects', params.contentId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        targetAuthorId = data?.creatorId || data?.ownerId || '';
        contentTitle = data?.title || 'Project';
        await updateDoc(docRef, updatePayload);
      }
    } else if (params.contentType === 'community') {
      const docRef = doc(db, 'communities', params.contentId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        targetAuthorId = data?.ownerId || '';
        contentTitle = data?.name || 'Community';
        await updateDoc(docRef, updatePayload);
      }
    }

    const auditRef = doc(collection(db, 'moderationAuditLog'));
    await setDoc(auditRef, {
      id: auditRef.id,
      action: 'delete',
      contentType: params.contentType,
      contentId: params.contentId,
      contentAuthorId: targetAuthorId,
      contentTitle,
      adminId: identity.userId,
      reason,
      category: params.category,
      timestamp: serverTimestamp(),
    });

    return { success: true };
  }

  public async restoreContent(params: AdminRestoreContentRequest): Promise<{ success: boolean; error?: string }> {
    const identity = await adminAccessService.requireAdmin();

    try {
      const response = await this.apiService.request<{ success: boolean; error?: string }>(
        '/api/admin/content/restore',
        {
          method: 'POST',
          authenticated: true,
          body: params,
        }
      );
      if (response?.success) return { success: true };
    } catch {
      // Fallback to direct Firestore operations
    }

    const restorePayload = {
      isDeleted: false,
      restoredAt: serverTimestamp(),
      restoredBy: identity.userId,
      restoreReason: params.restoreReason || 'Restored by Admin',
      status: 'active',
    };

    if (params.contentType === 'post' || params.contentType === 'lime') {
      const collections = ['feedPosts', 'posts', 'reels', 'limes', 'communityVariantDetails'];
      for (const coll of collections) {
        const docRef = doc(db, coll, params.contentId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          await updateDoc(docRef, restorePayload);
        }
      }
    } else if (params.contentType === 'product') {
      const docRef = doc(db, 'products', params.contentId);
      const snap = await getDoc(docRef);
      if (snap.exists()) await updateDoc(docRef, restorePayload);
    } else if (params.contentType === 'blog') {
      const docRef = doc(db, 'blogsAndArticles', params.contentId);
      const snap = await getDoc(docRef);
      if (snap.exists()) await updateDoc(docRef, restorePayload);
    } else if (params.contentType === 'project') {
      const docRef = doc(db, 'projects', params.contentId);
      const snap = await getDoc(docRef);
      if (snap.exists()) await updateDoc(docRef, restorePayload);
    } else if (params.contentType === 'community') {
      const docRef = doc(db, 'communities', params.contentId);
      const snap = await getDoc(docRef);
      if (snap.exists()) await updateDoc(docRef, restorePayload);
    }

    const auditRef = doc(collection(db, 'moderationAuditLog'));
    await setDoc(auditRef, {
      id: auditRef.id,
      action: 'restore',
      contentType: params.contentType,
      contentId: params.contentId,
      adminId: identity.userId,
      reason: params.restoreReason || 'Admin restoration',
      timestamp: serverTimestamp(),
    });

    return { success: true };
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