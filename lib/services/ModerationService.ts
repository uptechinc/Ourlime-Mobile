import { addDoc, collection, doc, getDoc, serverTimestamp, type DocumentData } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes, type StorageReference } from 'firebase/storage';
import { auth, db, storage } from '../firebaseConfig';
import { childSafetyReportService } from './ChildSafetyReportService';
import { CHILD_SAFETY_CATEGORY_LABELS, type ChildSafetyCategory, type ChildSafetyDangerAnswer, type ChildSafetyTargetType } from '@/lib/types/childSafety';

export const REPORT_REASONS = {
  child_safety: { label: 'Child Safety / Sexual Exploitation', reasons: Object.values(CHILD_SAFETY_CATEGORY_LABELS) },
  safety_abuse: { label: 'Safety and Abuse', reasons: ['Harassment or bullying', 'Hate speech', 'Threats of violence', 'Encouraging violence', 'Self-harm or suicide content', 'Sexual harassment', 'Stalking or intimidation'] },
  misleading: { label: 'Misleading or Harmful Content', reasons: ['False or misleading information', 'Scam or fraud', 'Impersonation', 'Dangerous advice', 'Manipulated or deceptive media', 'Fake giveaway or promotion'] },
  inappropriate: { label: 'Inappropriate Content', reasons: ['Nudity or sexual content', 'Graphic or disturbing content', 'Excessive violence', 'Offensive language', 'Inappropriate content involving minors'] },
  spam: { label: 'Spam and Platform Abuse', reasons: ['Spam', 'Repetitive posting', 'Fake engagement', 'Bot activity', 'Malicious links', 'Phishing', 'Selling prohibited items', 'Unauthorized advertising'] },
  ip_privacy: { label: 'Intellectual Property and Privacy', reasons: ['Copyright infringement', 'Trademark infringement', 'Sharing private information', 'Doxxing', "Using someone's image without permission", 'Identity theft'] },
  account: { label: 'Account and Profile Issues', reasons: ['Fake account', 'Impersonating another person', 'Inappropriate username', 'Inappropriate profile picture', 'Inappropriate biography', 'Underage account', 'Suspicious account activity'] },
  other: { label: 'Other', reasons: ['Community guideline violation', 'Illegal activity', 'Other'] },
} as const;

export type ReportReasonCategory = keyof typeof REPORT_REASONS;
export const CHILD_SAFETY_REASON_CATEGORY: ReportReasonCategory = 'child_safety';
export type ReportContentType = 'post' | 'user' | 'community' | 'lime' | 'event' | 'marketplace_listing' | 'course' | 'blog' | 'blog_comment' | 'comment' | 'reply' | 'message' | 'conversation' | 'media' | 'other';

export type SubmitReportInput = {
  targetId: string;
  reportedUserId?: string;
  parentContentId?: string;
  communityId?: string;
  chatId?: string;
  reasonCategory: ReportReasonCategory;
  reason: string;
  description?: string;
  evidence?: string[];
  routePath?: string;
  contentUrl?: string;
  evidenceFiles?: ReportEvidenceDraft[];
  immediateDanger?: ChildSafetyDangerAnswer;
  goodFaithAcknowledged?: boolean;
  allowContact?: boolean;
};
export type ReportEvidenceDraft = { uri: string; fileName: string; mimeType?: string; fileSize?: number };

export class ModerationService {
  private static instance: ModerationService;

  private constructor() {}

  public static getInstance(): ModerationService {
    if (!ModerationService.instance) ModerationService.instance = new ModerationService();
    return ModerationService.instance;
  }

  public async reportPost(input: SubmitReportInput): Promise<string> {
    return this.reportContent('post', input);
  }

  public async reportContent(contentType: ReportContentType, input: SubmitReportInput): Promise<string> {
    if (!input.reason.trim()) throw new Error('Select a reason for reporting this post');
    if (input.reason === 'Other' && !input.description?.trim()) throw new Error('Describe why you are reporting this post');
    const isChildSafetyReport = input.reasonCategory === CHILD_SAFETY_REASON_CATEGORY;
    const description = input.description?.trim() ?? '';
    if (isChildSafetyReport) {
      if (description.length < 20) throw new Error('Describe the child-safety concern in at least 20 characters. Do not copy or attach suspected harmful material.');
      if (input.goodFaithAcknowledged !== true) throw new Error('Confirm that this child-safety report is submitted in good faith.');
      const category = Object.entries(CHILD_SAFETY_CATEGORY_LABELS).find(([, label]) => label === input.reason)?.[0] as ChildSafetyCategory | undefined;
      if (!category) throw new Error('Select a valid child-safety concern');
      const report = await childSafetyReportService.submit({
        category,
        description,
        immediateDanger: input.immediateDanger ?? 'unsure',
        goodFaithAcknowledged: true,
        allowContact: input.allowContact ?? true,
        target: {
          type: this.getChildSafetyTargetType(contentType),
          id: input.targetId,
          ownerUserId: input.reportedUserId,
          routePath: input.routePath ?? this.getDefaultRoute(contentType, input.targetId),
        },
      });
      return report.reference;
    }
    const uploadedReferences: StorageReference[] = [];
    try {
      const evidence = isChildSafetyReport ? [] : [...(input.evidence ?? [])];
      for (const [index, file] of (isChildSafetyReport ? [] : input.evidenceFiles ?? []).entries()) {
        if ((file.fileSize ?? 0) > 10 * 1024 * 1024) throw new Error(`${file.fileName} exceeds the 10 MB evidence limit.`);
        const response = await fetch(file.uri);
        if (!response.ok) throw new Error(`Could not read ${file.fileName}`);
        const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const userId = auth.currentUser?.uid;
        if (!userId) throw new Error('Sign in to submit a report');
        const evidenceReference = ref(storage, `reports/evidence/${userId}/${Date.now()}-${index}-${safeName}`);
        await uploadBytes(evidenceReference, await response.blob(), file.mimeType ? { contentType: file.mimeType } : undefined);
        uploadedReferences.push(evidenceReference);
        evidence.push(await getDownloadURL(evidenceReference));
      }
      // Same document the website's /api/moderation/reports route writes.
      const reporterId = auth.currentUser?.uid;
      if (!reporterId) throw new Error('Sign in to submit a report');
      const { reportedUserId, targetSnapshot } = await this.buildTargetSnapshot(contentType, input);
      const reporter = (await getDoc(doc(db, 'users', reporterId))).data() ?? {};
      const reporterName = [reporter.firstName, reporter.lastName].filter(Boolean).join(' ') || reporter.userName || 'Unknown user';
      const report = await addDoc(collection(db, 'reports'), {
        contentType,
        targetId: input.targetId,
        reportedUserId,
        reporterId,
        reporterName,
        reporterUserName: typeof reporter.userName === 'string' ? reporter.userName : null,
        reasonCategory: input.reasonCategory || 'other',
        reason: input.reason,
        description,
        evidence,
        severity: input.reasonCategory === 'safety_abuse' ? 'high' : 'medium',
        status: 'pending',
        childSafetyPriority: false,
        moderatorNotes: '',
        assignedModerator: null,
        actionTaken: null,
        appealStatus: 'none',
        routePath: input.routePath ?? this.getDefaultRoute(contentType, input.targetId),
        contentUrl: input.contentUrl ?? null,
        parentContentId: input.parentContentId ?? null,
        communityId: input.communityId ?? null,
        chatId: null,
        targetSnapshot,
        conversationContext: [],
        conversationParticipantIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return report.id;
    } catch (error: unknown) {
      await Promise.all(uploadedReferences.map(async (reference) => {
        try { await deleteObject(reference); } catch { return; }
      }));
      throw error;
    }
  }

  /** Validates the reported content and captures a snapshot, like the website report route. */
  private async buildTargetSnapshot(contentType: ReportContentType, input: SubmitReportInput): Promise<{ reportedUserId: string | null; targetSnapshot: DocumentData | null }> {
    const text = (value: unknown) => (typeof value === 'string' ? value : '');
    if (contentType === 'blog_comment') {
      const blogId = input.parentContentId ?? '';
      const [commentId, replyId, extra] = input.targetId.split(':');
      if (!blogId || !commentId || extra !== undefined) throw new Error('A valid blog and comment are required');
      const [blog, comment] = await Promise.all([getDoc(doc(db, 'blogsAndArticles', blogId)), getDoc(doc(db, 'blogsAndArticles', blogId, 'comments', commentId))]);
      const commentData = comment.data();
      if (!blog.exists() || blog.data().status !== 'published' || !commentData || commentData.isDeleted) throw new Error('Reported comment was not found');
      const replies: DocumentData[] = Array.isArray(commentData.replies) ? commentData.replies : [];
      const target = replyId ? replies.find((reply) => reply.id === replyId && !reply.isDeleted) : commentData;
      if (!target) throw new Error('Reported reply was not found');
      const authorId = text(target.userId) || null;
      return { reportedUserId: authorId, targetSnapshot: { content: text(target.text).slice(0, 4000), blogId, commentId, replyId: replyId || null, authorId } };
    }
    if (contentType === 'comment' || contentType === 'reply') {
      const target = await getDoc(doc(db, contentType === 'reply' ? 'feedsPostCommentsReplies' : 'feedsPostComments', input.targetId));
      if (!target.exists()) throw new Error('Reported comment was not found');
      const data = target.data();
      const authorId = text(data.userId) || null;
      return { reportedUserId: authorId, targetSnapshot: { content: text(contentType === 'reply' ? data.reply : data.comment).slice(0, 4000), sticker: data.sticker ?? null, postId: input.parentContentId || data.feedsPostId || null, authorId } };
    }
    if (contentType === 'post') {
      const post = await getDoc(doc(db, 'feedPosts', input.targetId));
      if (!post.exists()) throw new Error('Reported post was not found');
      const data = post.data();
      const authorId = text(data.userId) || input.reportedUserId || null;
      return { reportedUserId: authorId, targetSnapshot: { content: text(data.caption || data.description || data.content).slice(0, 4000), media: Array.isArray(data.media) ? data.media : [], type: data.type || 'regular', authorId, postId: input.targetId } };
    }
    if (contentType === 'community') {
      const community = await getDoc(doc(db, 'communityVariant', input.targetId));
      const data = community.data();
      return { reportedUserId: input.reportedUserId ?? null, targetSnapshot: data ? { name: text(data.name || data.title), description: text(data.description).slice(0, 4000), avatar: data.avatar || data.icon || null, category: data.category || null } : null };
    }
    return { reportedUserId: input.reportedUserId ?? null, targetSnapshot: null };
  }

  public async reportUser(input: Omit<SubmitReportInput, 'reportedUserId'>): Promise<string> {
    return this.reportContent('user', { ...input, reportedUserId: input.targetId });
  }

  public async reportCommunity(input: Omit<SubmitReportInput, 'reportedUserId'>): Promise<string> {
    return this.reportContent('community', input);
  }

  private getDefaultRoute(contentType: ReportContentType, targetId: string): string {
    if (contentType === 'community') return `/communities/${targetId}`;
    if (contentType === 'user') return `/profile/${targetId}`;
    if (contentType === 'lime') return `/limes?limeId=${targetId}`;
    if (contentType === 'event') return `/events?targetId=${targetId}`;
    if (contentType === 'marketplace_listing') return `/market?productId=${targetId}`;
    if (contentType === 'course') return `/eLearning?courseId=${targetId}`;
    if (contentType === 'blog') return `/blogs/${targetId}`;
    return `/post/${targetId}`;
  }

  private getChildSafetyTargetType(contentType: ReportContentType): ChildSafetyTargetType {
    if (contentType === 'user') return 'profile';
    if (contentType === 'event') return 'event';
    if (contentType === 'marketplace_listing') return 'marketplace_listing';
    if (contentType === 'course') return 'course';
    if (contentType === 'blog') return 'blog';
    if (contentType === 'comment' || contentType === 'blog_comment') return 'comment';
    if (contentType === 'reply') return 'reply';
    if (contentType === 'message') return 'message';
    if (contentType === 'conversation') return 'conversation';
    if (contentType === 'media') return 'media';
    if (contentType === 'other') return 'other';
    if (contentType === 'community') return 'community';
    if (contentType === 'lime') return 'lime';
    return 'post';
  }
}

export const moderationService = ModerationService.getInstance();
