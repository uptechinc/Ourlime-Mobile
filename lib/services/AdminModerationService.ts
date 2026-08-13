import { ApiService, ApiServiceError } from './ApiService';
import { collection, getDocs, limit, orderBy, query, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { adminAccessService } from './AdminAccessService';

export type AdminReportStatus = 'pending' | 'under_review' | 'action_taken' | 'resolved' | 'dismissed' | 'escalated' | 'other';
export type AdminModerationAction =
  | 'dismiss' | 'resolved_no_violation' | 'content_removed' | 'content_hidden' | 'content_restored'
  | 'warning_issued' | 'content_restricted' | 'commenting_disabled' | 'messaging_disabled'
  | 'posting_disabled' | 'account_suspended' | 'account_temp_banned' | 'account_perma_banned'
  | 'account_restricted' | 'profile_picture_removed' | 'username_removed' | 'bio_removed'
  | 'advertisement_removed' | 'escalated_senior_review' | 'requested_info' | 'referred_legal';
export type AdminModerationReport = {
  id: string;
  contentType: string;
  targetId: string;
  reportedUserId: string | null;
  reporterId: string;
  reporterName: string;
  reason: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: AdminReportStatus;
  createdAtMs: number;
  routePath: string | null;
  moderatorNotes: string;
};

type AdminModerationSource = {
  id?: unknown; contentType?: unknown; targetId?: unknown; reportedUserId?: unknown; reporterId?: unknown;
  reporterName?: unknown; reason?: unknown; description?: unknown; severity?: unknown; status?: unknown;
  createdAtMs?: unknown; createdAt?: unknown; routePath?: unknown; moderatorNotes?: unknown;
};
const isModerationSource = (value: unknown): value is AdminModerationSource => typeof value === 'object' && value !== null && !Array.isArray(value);
const readString = (value: unknown): string => typeof value === 'string' ? value : '';

export class AdminModerationService {
  private static instance: AdminModerationService;
  private readonly apiService = ApiService.getInstance();
  private constructor() {}
  public static getInstance(): AdminModerationService { if (!AdminModerationService.instance) AdminModerationService.instance = new AdminModerationService(); return AdminModerationService.instance; }

  public async fetchReports(): Promise<AdminModerationReport[]> {
    try {
      return await this.fetchReportsFromFirestore();
    } catch (firestoreError: unknown) {
      console.warn('[AdminModerationService] Firestore reports unavailable; trying the secure API.', firestoreError);
      const response = await this.apiService.request<{ success: boolean; data?: unknown[]; error?: string }>('/api/moderation/reports', { authenticated: true, timeoutMs: 2_500 });
      if (!response.success) throw new Error(response.error || 'Failed to load reports');
      return this.normalizeReports(response.data ?? []);
    }
  }

  public async takeAction(reportId: string, action: AdminModerationAction, reason: string, durationMs?: number): Promise<void> {
    try {
      const response = await this.apiService.request<{ success: boolean; error?: string }>(`/api/moderation/reports/${encodeURIComponent(reportId)}/action`, { method: 'POST', authenticated: true, body: { action, reason, duration: durationMs, durationLabel: durationMs ? `${Math.round(durationMs / 86_400_000)} days` : undefined } });
      if (!response.success) throw new Error(response.error || 'Moderation action failed');
    } catch (error: unknown) {
      if (error instanceof ApiServiceError && error.code === 'REQUEST_TIMEOUT') {
        throw new Error('Moderation actions require the secure Ourlime server, which is currently unavailable.');
      }
      throw error;
    }
  }

  public async fetchReport(reportId: string): Promise<AdminModerationReport> {
    const reports = await this.fetchReportsFromFirestore();
    const report = reports.find((candidate) => candidate.id === reportId);
    if (!report) throw new Error('Moderation report not found');
    return report;
  }

  public async deleteReport(reportId: string): Promise<void> {
    try {
      await this.apiService.request<{ success: boolean }>(`/api/moderation/reports/${encodeURIComponent(reportId)}`, { method: 'DELETE', authenticated: true });
    } catch (error: unknown) {
      if (error instanceof ApiServiceError && error.code === 'REQUEST_TIMEOUT') throw new Error('Deleting a report requires the secure Ourlime server, which is currently unavailable.');
      throw error;
    }
  }

  private async fetchReportsFromFirestore(): Promise<AdminModerationReport[]> {
    await adminAccessService.requireReviewer();
    const reportsCollection = collection(db, 'reports');
    const orderedSnapshot = await getDocs(query(reportsCollection, orderBy('createdAt', 'desc'), limit(100))).catch(() => null);
    const snapshot = orderedSnapshot ?? await getDocs(query(reportsCollection, limit(100)));
    return this.normalizeReports(snapshot.docs.map((document) => ({ ...document.data(), id: document.id })));
  }

  private normalizeReports(values: unknown[]): AdminModerationReport[] {
    return values.flatMap((value): AdminModerationReport[] => {
      if (!isModerationSource(value)) return [];
      const id = readString(value.id);
      if (!id) return [];
      const severityValue = readString(value.severity);
      const severity: AdminModerationReport['severity'] = severityValue === 'low' || severityValue === 'high' || severityValue === 'critical' ? severityValue : 'medium';
      const statusValue = readString(value.status);
      const status: AdminReportStatus = statusValue === 'pending' || statusValue === 'under_review' || statusValue === 'action_taken' || statusValue === 'resolved' || statusValue === 'dismissed' || statusValue === 'escalated' ? statusValue : 'other';
      const createdAtMs = typeof value.createdAtMs === 'number'
        ? value.createdAtMs
        : value.createdAt instanceof Timestamp ? value.createdAt.toMillis() : 0;
      return [{ id, contentType: readString(value.contentType), targetId: readString(value.targetId), reportedUserId: readString(value.reportedUserId) || null, reporterId: readString(value.reporterId), reporterName: readString(value.reporterName) || 'Ourlime user', reason: readString(value.reason) || 'Unspecified', description: readString(value.description), severity, status, createdAtMs, routePath: readString(value.routePath) || null, moderatorNotes: readString(value.moderatorNotes) }];
    });
  }
}
