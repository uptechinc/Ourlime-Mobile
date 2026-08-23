import { ApiService } from './ApiService';
import { DiagnosticLogService } from './DiagnosticLogService';

export type PresenceState = {
  activityStatus: boolean;
  status: 'online' | 'offline';
  lastActiveMs: number | null;
};

type PresenceResponse = { success: boolean; data?: PresenceState; error?: string };

export class PresenceService {
  private static instance: PresenceService;
  private readonly apiService = ApiService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): PresenceService {
    if (!PresenceService.instance) PresenceService.instance = new PresenceService();
    return PresenceService.instance;
  }

  public async heartbeat(state: 'online' | 'offline'): Promise<void> {
    const response = await this.apiService.request<{ success: boolean; error?: string }>('/api/profile/presence', {
      method: 'POST', authenticated: true, body: { state }, timeoutMs: 15_000,
    });
    if (!response.success) throw new Error(response.error || 'Presence update failed');
    this.logger.info('PresenceService', 'heartbeat', { state });
  }

  public async getPresence(userId: string): Promise<PresenceState> {
    const response = await this.apiService.request<PresenceResponse>(`/api/profile/presence?userId=${encodeURIComponent(userId)}`, { authenticated: true });
    if (!response.success || !response.data) throw new Error(response.error || 'Presence unavailable');
    return response.data;
  }
}

export const presenceService = PresenceService.getInstance();
