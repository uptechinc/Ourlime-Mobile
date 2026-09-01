export type ModerationDeliveryResult = {
  correlationId: string;
  eventId: string;
  notificationId: string | null;
  notificationStatus: 'sent' | 'failed';
  emailStatus: 'not_requested' | 'sent' | 'queued' | 'failed';
  emailAttemptCount: number;
  nextAttemptAt: string | null;
  errorCode?: string;
};
