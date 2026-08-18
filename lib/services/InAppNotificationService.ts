type InAppNotificationPayload = {
  peerId: string;
  senderName: string;
  avatarUrl: string | null;
  messageText: string;
};

type Listener = (payload: InAppNotificationPayload) => void;

export class InAppNotificationService {
  private static instance: InAppNotificationService;
  private readonly listeners = new Set<Listener>();

  private constructor() {}

  public static getInstance(): InAppNotificationService {
    if (!InAppNotificationService.instance) {
      InAppNotificationService.instance = new InAppNotificationService();
    }
    return InAppNotificationService.instance;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public showNotification(payload: InAppNotificationPayload): void {
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.warn('[InAppNotificationService] Listener error:', error);
      }
    });
  }
}

export const inAppNotificationService = InAppNotificationService.getInstance();
