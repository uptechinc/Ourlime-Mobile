import AsyncStorage from '@react-native-async-storage/async-storage';
import { DiagnosticLogService } from './DiagnosticLogService';

export type PendingNotificationResponse = {
  responseId: string;
  actionIdentifier: string;
  capturedAtMs: number;
  data: unknown;
};

type StoredPendingNotificationResponse = {
  responseId?: unknown;
  actionIdentifier?: unknown;
  capturedAtMs?: unknown;
  data?: unknown;
};

const PENDING_RESPONSE_KEY = 'ourlime.pending-notification-response.v1';
const PENDING_RESPONSE_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_HANDLED_RESPONSES = 200;

export class NotificationNavigationService {
  private static instance: NotificationNavigationService;
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly handledResponseIds = new Set<string>();

  private constructor() {}

  public static getInstance(): NotificationNavigationService {
    if (!NotificationNavigationService.instance) NotificationNavigationService.instance = new NotificationNavigationService();
    return NotificationNavigationService.instance;
  }

  public createResponse(responseId: string, actionIdentifier: string, data: unknown): PendingNotificationResponse {
    return { responseId, actionIdentifier, data, capturedAtMs: Date.now() };
  }

  public claimResponse(responseId: string): boolean {
    if (!responseId || this.handledResponseIds.has(responseId)) return false;
    this.handledResponseIds.add(responseId);
    if (this.handledResponseIds.size > MAX_HANDLED_RESPONSES) {
      const oldestResponseId = this.handledResponseIds.values().next().value;
      if (typeof oldestResponseId === 'string') this.handledResponseIds.delete(oldestResponseId);
    }
    return true;
  }

  public async savePending(response: PendingNotificationResponse): Promise<void> {
    await AsyncStorage.setItem(PENDING_RESPONSE_KEY, JSON.stringify(response));
    this.logger.info('NotificationNavigationService', 'response:queued', { responseId: response.responseId });
  }

  public async hasPending(): Promise<boolean> {
    return Boolean(await this.readPending());
  }

  public async consumePending(): Promise<PendingNotificationResponse | null> {
    const response = await this.readPending();
    await AsyncStorage.removeItem(PENDING_RESPONSE_KEY);
    return response;
  }

  private async readPending(): Promise<PendingNotificationResponse | null> {
    const raw = await AsyncStorage.getItem(PENDING_RESPONSE_KEY);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as StoredPendingNotificationResponse;
      if (
        typeof value.responseId !== 'string'
        || typeof value.actionIdentifier !== 'string'
        || typeof value.capturedAtMs !== 'number'
        || Date.now() - value.capturedAtMs > PENDING_RESPONSE_RETENTION_MS
      ) {
        await AsyncStorage.removeItem(PENDING_RESPONSE_KEY);
        return null;
      }
      return {
        responseId: value.responseId,
        actionIdentifier: value.actionIdentifier,
        capturedAtMs: value.capturedAtMs,
        data: value.data,
      };
    } catch (error: unknown) {
      await AsyncStorage.removeItem(PENDING_RESPONSE_KEY);
      this.logger.warn('NotificationNavigationService', 'response:invalid', {
        reason: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

export const notificationNavigationService = NotificationNavigationService.getInstance();
