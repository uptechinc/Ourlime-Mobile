import { apiService } from './ApiService';

export type AdminMetrics = {
  usersCount: number;
  postsCount: number;
  reelsCount: number;
  eventsCount: number;
  reportsCount: number;
};

export class AdminMetricsService {
  private static instance: AdminMetricsService;

  private constructor() {}

  public static getInstance(): AdminMetricsService {
    if (!AdminMetricsService.instance) AdminMetricsService.instance = new AdminMetricsService();
    return AdminMetricsService.instance;
  }

  public async fetchMetrics(): Promise<AdminMetrics> {
    return apiService.request<AdminMetrics>('/api/admin/metrics', { authenticated: true });
  }
}
