import { ApiService } from './ApiService';
import { deleteObject, getDownloadURL, ref, uploadBytes, type StorageReference } from 'firebase/storage';
import { auth, storage } from '../firebaseConfig';

export const REPORT_REASONS = {
  safety_abuse: { label: 'Safety and Abuse', reasons: ['Harassment or bullying', 'Hate speech', 'Threats of violence', 'Encouraging violence', 'Self-harm or suicide content', 'Sexual harassment', 'Stalking or intimidation', 'Child safety concern'] },
  misleading: { label: 'Misleading or Harmful Content', reasons: ['False or misleading information', 'Scam or fraud', 'Impersonation', 'Dangerous advice', 'Manipulated or deceptive media', 'Fake giveaway or promotion'] },
  inappropriate: { label: 'Inappropriate Content', reasons: ['Nudity or sexual content', 'Graphic or disturbing content', 'Excessive violence', 'Offensive language', 'Inappropriate content involving minors'] },
  spam: { label: 'Spam and Platform Abuse', reasons: ['Spam', 'Repetitive posting', 'Fake engagement', 'Bot activity', 'Malicious links', 'Phishing', 'Selling prohibited items', 'Unauthorized advertising'] },
  ip_privacy: { label: 'Intellectual Property and Privacy', reasons: ['Copyright infringement', 'Trademark infringement', 'Sharing private information', 'Doxxing', "Using someone's image without permission", 'Identity theft'] },
  account: { label: 'Account and Profile Issues', reasons: ['Fake account', 'Impersonating another person', 'Inappropriate username', 'Inappropriate profile picture', 'Inappropriate biography', 'Underage account', 'Suspicious account activity'] },
  other: { label: 'Other', reasons: ['Community guideline violation', 'Illegal activity', 'Other'] },
} as const;

export type ReportReasonCategory = keyof typeof REPORT_REASONS;

export type SubmitReportInput = {
  targetId: string;
  reportedUserId?: string;
  reasonCategory: ReportReasonCategory;
  reason: string;
  description?: string;
  evidence?: string[];
  routePath?: string;
  contentUrl?: string;
  evidenceFiles?: ReportEvidenceDraft[];
};
export type ReportEvidenceDraft = { uri: string; fileName: string; mimeType?: string; fileSize?: number };

export class ModerationService {
  private static instance: ModerationService;
  private readonly apiService = ApiService.getInstance();

  private constructor() {}

  public static getInstance(): ModerationService {
    if (!ModerationService.instance) ModerationService.instance = new ModerationService();
    return ModerationService.instance;
  }

  public async reportPost(input: SubmitReportInput): Promise<string> {
    if (!input.reason.trim()) throw new Error('Select a reason for reporting this post');
    if (input.reason === 'Other' && !input.description?.trim()) throw new Error('Describe why you are reporting this post');
    const uploadedReferences: StorageReference[] = [];
    try {
      const evidence = [...(input.evidence ?? [])];
      for (const [index, file] of (input.evidenceFiles ?? []).entries()) {
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
      const response = await this.apiService.request<{ success: boolean; data?: { id?: string }; error?: string }>(
        '/api/moderation/reports',
        {
          method: 'POST',
          authenticated: true,
          body: {
            contentType: 'post',
            targetId: input.targetId,
            reportedUserId: input.reportedUserId ?? null,
            reasonCategory: input.reasonCategory,
            reason: input.reason,
            description: input.description?.trim() ?? '',
            evidence,
            severity: input.reasonCategory === 'safety_abuse' ? 'high' : 'medium',
            routePath: input.routePath ?? `/post/${input.targetId}`,
            contentUrl: input.contentUrl ?? null,
          },
        }
      );
      if (!response.success || !response.data?.id) throw new Error(response.error || 'Failed to submit report');
      return response.data.id;
    } catch (error: unknown) {
      await Promise.all(uploadedReferences.map(async (reference) => {
        try { await deleteObject(reference); } catch { return; }
      }));
      throw error;
    }
  }

  public async reportUser(input: Omit<SubmitReportInput, 'reportedUserId'>): Promise<string> {
    if (!input.reason.trim()) throw new Error('Select a reason for reporting this user');
    const response = await this.apiService.request<{ success: boolean; data?: { id?: string }; error?: string }>(
      '/api/moderation/reports',
      {
        method: 'POST',
        authenticated: true,
        body: {
          contentType: 'user',
          targetId: input.targetId,
          reportedUserId: input.targetId,
          reasonCategory: input.reasonCategory,
          reason: input.reason,
          description: input.description?.trim() ?? '',
          evidence: input.evidence ?? [],
          severity: 'medium',
          routePath: input.routePath ?? `/profile/${input.targetId}`,
          contentUrl: input.contentUrl ?? null,
        },
      }
    );
    if (!response.success || !response.data?.id) throw new Error(response.error || 'Failed to submit report');
    return response.data.id;
  }

  public async reportCommunity(input: Omit<SubmitReportInput, 'reportedUserId'>): Promise<string> {
    if (!input.reason.trim()) throw new Error('Select a reason for reporting this community');
    const response = await this.apiService.request<{ success: boolean; data?: { id?: string }; error?: string }>('/api/moderation/reports', {
      method: 'POST',
      authenticated: true,
      body: {
        contentType: 'community',
        targetId: input.targetId,
        reasonCategory: input.reasonCategory,
        reason: input.reason,
        description: input.description?.trim() ?? '',
        evidence: input.evidence ?? [],
        severity: 'medium',
        routePath: input.routePath ?? `/communities/${input.targetId}`,
        contentUrl: input.contentUrl ?? null,
      },
    });
    if (!response.success || !response.data?.id) throw new Error(response.error || 'Failed to submit community report');
    return response.data.id;
  }
}

export const moderationService = ModerationService.getInstance();
