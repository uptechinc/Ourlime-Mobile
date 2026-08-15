import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ApiService, ApiServiceError } from './ApiService';
import { DiagnosticLogService } from './DiagnosticLogService';
import { LocalCacheService } from './LocalCacheService';
import type { NotificationData, NotificationPage } from '@/lib/types/notification';

type NotificationApiResponse = { success: boolean; data?: NotificationPage; error?: string };
type NotificationAction = 'read' | 'unread' | 'read-all' | 'delete';

const CACHE_NAMESPACE = 'notifications';
const CACHE_KEY = 'latest';
const CACHE_RETENTION_MS = 48 * 60 * 60 * 1000;

export class NotificationService {
  private static instance: NotificationService;
  private readonly apiService = ApiService.getInstance();
  private readonly cacheService = LocalCacheService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly inFlight = new Map<string, Promise<NotificationPage>>();

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) NotificationService.instance = new NotificationService();
    return NotificationService.instance;
  }

  public async hydrate(userId: string): Promise<NotificationPage | null> {
    if (!userId) return null;
    const cached = await this.cacheService.read<NotificationPage>(userId, CACHE_NAMESPACE, CACHE_KEY);
    return cached?.data ?? null;
  }

  public async fetchPage(userId: string, cursor: string | null = null, pageLimit = 30): Promise<NotificationPage> {
    const key = `${userId}:${cursor ?? 'head'}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const operation = (async () => {
      const search = new URLSearchParams({ limit: String(pageLimit) });
      if (cursor) search.set('cursor', cursor);
      const response = await this.apiService.request<NotificationApiResponse>(`/api/notifications?${search.toString()}`, { authenticated: true });
      if (!response.success || !response.data) throw new Error(response.error || 'Notifications unavailable');
      const page = response.data;
      if (!cursor) await this.cacheService.write(userId, CACHE_NAMESPACE, CACHE_KEY, page, { expiresAt: Date.now() + CACHE_RETENTION_MS });
      this.logger.success('NotificationService', 'fetch-page', { count: page.notifications.length, unreadCount: page.unreadCount, hasMore: page.hasMore });
      return page;
    })().catch((error: unknown) => {
      const isAvailabilityFailure = error instanceof ApiServiceError
        && ['API_UNAVAILABLE', 'REQUEST_TIMEOUT', 'NETWORK_ERROR'].includes(error.code ?? '');
      if (!isAvailabilityFailure) {
        this.logger.error('NotificationService', 'fetch-page', error, { userId, hasCursor: Boolean(cursor) });
      }
      throw error;
    }).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, operation);
    return operation;
  }

  public subscribeToInvalidation(userId: string, onChange: () => void, onError: (error: Error) => void): () => void {
    return onSnapshot(
      query(collection(doc(db, 'userNotifications', userId), 'items'), orderBy('createdAt', 'desc'), limit(1)),
      () => onChange(),
      onError,
    );
  }

  public async mutate(action: NotificationAction, notificationIds: string[] = []): Promise<void> {
    const response = await this.apiService.request<{ success: boolean; error?: string }>('/api/notifications', {
      method: 'PATCH', authenticated: true, body: { action, notificationIds },
    });
    if (!response.success) throw new Error(response.error || 'Notification update failed');
  }

  public markAsRead(notificationId: string): Promise<void> { return this.mutate('read', [notificationId]); }
  public markAsUnread(notificationId: string): Promise<void> { return this.mutate('unread', [notificationId]); }
  public markAllAsRead(): Promise<void> { return this.mutate('read-all'); }
  public delete(notificationIds: string[]): Promise<void> { return this.mutate('delete', notificationIds); }

  public mergePages(current: NotificationData[], next: NotificationData[]): NotificationData[] {
    const merged = new Map(current.map((notification) => [notification.id ?? '', notification]));
    next.forEach((notification) => merged.set(notification.id ?? '', notification));
    merged.delete('');
    return Array.from(merged.values());
  }
}
