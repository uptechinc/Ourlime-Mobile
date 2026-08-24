import { useCallback, useEffect } from 'react';
import { useRootNavigationState, useRouter } from 'expo-router';
import { nativeCallService } from '@/lib/services/NativeCallService';
import { notificationNavigationService, type PendingNotificationResponse } from '@/lib/services/NotificationNavigationService';
import { notificationService } from '@/lib/services/NotificationService';
import { pushNotificationService } from '@/lib/services/PushNotificationService';
import { platformEnvironmentService } from '@/lib/services/PlatformEnvironmentService';
import { DiagnosticLogService } from '@/lib/services/DiagnosticLogService';

type NotificationNavigationCoordinatorProps = {
  userId: string | null;
};

type NotificationResponseData = {
  type?: unknown;
  expiresAtMs?: unknown;
};

const logger = DiagnosticLogService.getInstance();

export default function NotificationNavigationCoordinator({ userId }: NotificationNavigationCoordinatorProps) {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const isNavigationReady = Boolean(rootNavigationState?.key);

  const executeResponse = useCallback(async (response: PendingNotificationResponse) => {
    const destination = pushNotificationService.resolveNotificationDestination(response.data);
    const source = response.data && typeof response.data === 'object' ? response.data as NotificationResponseData : {};
    const expiresAtMs = typeof source.expiresAtMs === 'number' ? source.expiresAtMs : Number(source.expiresAtMs);
    const isExpiredCall = source.type === 'incoming_call' && Number.isFinite(expiresAtMs) && Date.now() >= expiresAtMs;

    if (destination.notificationId) {
      void notificationService.markAsRead(destination.notificationId).catch((error: unknown) => {
        logger.warn('NotificationNavigationCoordinator', 'notification:mark-read-failed', {
          notificationId: destination.notificationId,
          reason: error instanceof Error ? error.message : String(error),
        });
      });
    }

    const handledAsCall = await nativeCallService.handleNotificationResponse(response.data, response.actionIdentifier);
    if (handledAsCall && !isExpiredCall) return;

    try {
      router.push(destination.route);
      logger.info('NotificationNavigationCoordinator', 'response:navigated', {
        responseId: response.responseId,
        behavior: destination.behavior,
      });
    } catch (error: unknown) {
      logger.error('NotificationNavigationCoordinator', 'response:navigation-failed', error, { responseId: response.responseId });
      router.replace(destination.fallbackRoute);
    }
  }, [router]);

  const handleResponse = useCallback(async (response: PendingNotificationResponse) => {
    if (!notificationNavigationService.claimResponse(response.responseId)) return;
    if (!userId || !isNavigationReady) {
      await notificationNavigationService.savePending(response);
      return;
    }
    await executeResponse(response);
  }, [executeResponse, isNavigationReady, userId]);

  useEffect(() => {
    if (!userId || !isNavigationReady) return;
    void notificationNavigationService.consumePending().then((response) => {
      if (response) return executeResponse(response);
      return undefined;
    });
  }, [executeResponse, isNavigationReady, userId]);

  useEffect(() => {
    pushNotificationService.configureForegroundPresentation();
    if (!platformEnvironmentService.isNativePushSupported()) return;

    let subscription: { remove: () => void } | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Notifications = require('expo-notifications') as typeof import('expo-notifications');
      const receiveResponse = (response: import('expo-notifications').NotificationResponse) => {
        const responseId = `${response.notification.request.identifier}:${response.actionIdentifier}`;
        const pending = notificationNavigationService.createResponse(
          responseId,
          response.actionIdentifier,
          response.notification.request.content.data,
        );
        void handleResponse(pending).finally(() => {
          void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
        });
      };
      subscription = Notifications.addNotificationResponseReceivedListener(receiveResponse);
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) receiveResponse(response);
      });
    } catch (error: unknown) {
      logger.warn('NotificationNavigationCoordinator', 'listener:unavailable', {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    return () => subscription?.remove();
  }, [handleResponse]);

  return null;
}
