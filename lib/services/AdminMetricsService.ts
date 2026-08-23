import { collection, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { apiService } from './ApiService';
import { adminAccessService } from './AdminAccessService';

export type AdminMetrics = {
  usersCount: number;
  postsCount: number;
  reelsCount: number;
  eventsCount: number;
  reportsCount: number;
};

export class AdminMetricsService {
  private static instance: AdminMetricsService;
  private cachedMetrics: { data: AdminMetrics; updatedAt: number } | null = null;
  private inFlight: Promise<AdminMetrics> | null = null;

  private constructor() {}

  public static getInstance(): AdminMetricsService {
    if (!AdminMetricsService.instance) AdminMetricsService.instance = new AdminMetricsService();
    return AdminMetricsService.instance;
  }

  public async fetchMetrics(force = false): Promise<AdminMetrics> {
    if (!force && this.cachedMetrics && Date.now() - this.cachedMetrics.updatedAt < 5 * 60_000) return this.cachedMetrics.data;
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.loadMetrics().then((data) => {
      this.cachedMetrics = { data, updatedAt: Date.now() };
      return data;
    }).finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async loadMetrics(): Promise<AdminMetrics> {
    try {
      return await this.fetchMetricsFromFirestore();
    } catch (firestoreError: unknown) {
      console.warn('[AdminMetricsService] Firestore metrics unavailable; trying the secure API.', firestoreError);
      return apiService.request<AdminMetrics>('/api/admin/metrics', { authenticated: true, timeoutMs: 18_000 });
    }
  }

  private async fetchMetricsFromFirestore(): Promise<AdminMetrics> {
    await adminAccessService.requireAdmin();
    const [usersCount, postsCount, reelsCount, eventsCount, reportsCount] = await Promise.all([
      this.countCollection('users'),
      this.countPreferredCollection('posts', 'feedPosts'),
      this.countPreferredCollection('reels', 'shorts'),
      this.countCollection('events'),
      this.countCollection('reports'),
    ]);
    return { usersCount, postsCount, reelsCount, eventsCount, reportsCount };
  }

  private async countCollection(collectionName: string): Promise<number> {
    return (await getCountFromServer(collection(db, collectionName))).data().count;
  }

  private async countPreferredCollection(primaryCollection: string, compatibilityCollection: string): Promise<number> {
    const primaryCount = await this.countCollection(primaryCollection).catch(() => 0);
    return primaryCount > 0 ? primaryCount : this.countCollection(compatibilityCollection);
  }
}
