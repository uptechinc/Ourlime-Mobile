import type { NotificationDestinationInput } from '@/lib/navigation/NotificationDestinationRegistry';

export type InAppNotificationKind = 'message' | 'notification';

/** One drop-down banner: a chat message or any other Ourlime notification (like, comment, friend request, ...). */
export type InAppNotificationPayload = {
  /** Stable id used to show each event once, even when it arrives by push and by the Firestore listener. */
  id: string;
  kind: InAppNotificationKind;
  title: string;
  body: string;
  avatarUrl: string | null;
  /** For messages: the other person, so the banner is skipped while that chat is open. */
  peerId?: string;
  /** Where tapping the banner goes (same shape as push notification data). */
  destination: NotificationDestinationInput;
  /** Colour accent: amber for warnings (e.g. a draft expiring soon), red for urgent (its last day). */
  tone?: 'default' | 'warning' | 'danger';
};

type Listener = (payload: InAppNotificationPayload) => void;

const DEDUPE_WINDOW_MS = 60_000;

/** Event bus for the in-app drop-down banner (components/ui/InAppNotificationBanner.tsx). */
export class InAppNotificationService {
  private static instance: InAppNotificationService;
  private readonly listeners = new Set<Listener>();
  private readonly recentlyShown = new Map<string, number>();

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
    const now = Date.now();
    this.recentlyShown.forEach((shownAt, id) => { if (now - shownAt > DEDUPE_WINDOW_MS) this.recentlyShown.delete(id); });
    if (this.recentlyShown.has(payload.id)) return;
    this.recentlyShown.set(payload.id, now);
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (error: unknown) {
        console.warn('[InAppNotificationService.showNotification] Listener error:', error);
      }
    });
  }
}

export const inAppNotificationService = InAppNotificationService.getInstance();
