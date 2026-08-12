import { ApiService } from './ApiService';

export type AdminReportStatus = 'pending' | 'under_review' | 'action_taken' | 'resolved' | 'dismissed' | 'escalated' | 'other';
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
};

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const readString = (value: unknown): string => typeof value === 'string' ? value : '';

export class AdminModerationService {
  private static instance: AdminModerationService;
  private readonly apiService = ApiService.getInstance();
  private constructor() {}
  public static getInstance(): AdminModerationService { if (!AdminModerationService.instance) AdminModerationService.instance = new AdminModerationService(); return AdminModerationService.instance; }

  public async fetchReports(): Promise<AdminModerationReport[]> {
    const response = await this.apiService.request<{ success: boolean; data?: unknown[]; error?: string }>('/api/moderation/reports', { authenticated: true });
    if (!response.success) throw new Error(response.error || 'Failed to load reports');
    return (response.data ?? []).flatMap((value): AdminModerationReport[] => {
      if (!isRecord(value)) return [];
      const id = readString(value.id);
      if (!id) return [];
      const severityValue = readString(value.severity);
      const severity: AdminModerationReport['severity'] = severityValue === 'low' || severityValue === 'high' || severityValue === 'critical' ? severityValue : 'medium';
      const statusValue = readString(value.status);
      const status: AdminReportStatus = statusValue === 'pending' || statusValue === 'under_review' || statusValue === 'action_taken' || statusValue === 'resolved' || statusValue === 'dismissed' || statusValue === 'escalated' ? statusValue : 'other';
      return [{ id, contentType: readString(value.contentType), targetId: readString(value.targetId), reportedUserId: readString(value.reportedUserId) || null, reporterId: readString(value.reporterId), reporterName: readString(value.reporterName), reason: readString(value.reason), description: readString(value.description), severity, status, createdAtMs: typeof value.createdAtMs === 'number' ? value.createdAtMs : 0 }];
    });
  }

  public async takeAction(reportId: string, action: 'dismiss' | 'resolved_no_violation', reason: string): Promise<void> {
    const response = await this.apiService.request<{ success: boolean; error?: string }>(`/api/moderation/reports/${encodeURIComponent(reportId)}/action`, { method: 'POST', authenticated: true, body: { action, reason } });
    if (!response.success) throw new Error(response.error || 'Moderation action failed');
  }
}
