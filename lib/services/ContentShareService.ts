import * as ReactNative from 'react-native';
import { MessagingService, type ConversationEntry } from '@/lib/messaging/MessagingService';

export type ExternalShareInput = {
  title: string;
  message: string;
  url: string;
};

export type ChatShareResult = {
  sentCount: number;
  failedCount: number;
};

type CachedRecipientsEntry = {
  userId: string;
  recipients: ConversationEntry[];
  timestamp: number;
};

export class ContentShareService {
  private static instance: ContentShareService;
  private cachedRecipients: CachedRecipientsEntry | null = null;
  private readonly inFlightRequests = new Map<string, Promise<ConversationEntry[]>>();
  private static readonly CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

  private constructor() {}

  public static getInstance(): ContentShareService {
    if (!ContentShareService.instance) ContentShareService.instance = new ContentShareService();
    return ContentShareService.instance;
  }

  public getCachedRecipients(currentUserId: string): ConversationEntry[] | null {
    if (
      this.cachedRecipients &&
      this.cachedRecipients.userId === currentUserId &&
      Date.now() - this.cachedRecipients.timestamp < ContentShareService.CACHE_TTL_MS
    ) {
      return this.cachedRecipients.recipients;
    }
    return null;
  }

  public async loadRecipients(currentUserId: string, forceRefresh = false): Promise<ConversationEntry[]> {
    if (!currentUserId) return [];

    if (!forceRefresh) {
      const cached = this.getCachedRecipients(currentUserId);
      if (cached) return cached;
    }

    const existing = this.inFlightRequests.get(currentUserId);
    if (existing) return existing;

    const requestPromise = (async (): Promise<ConversationEntry[]> => {
      try {
        const messaging = MessagingService.getInstance();
        const firstPage = await messaging.fetchConversationPage(currentUserId, null);
        const initialItems = Array.from(new Map(firstPage.items.map((recipient) => [recipient.uid, recipient])).values());

        this.cachedRecipients = {
          userId: currentUserId,
          recipients: initialItems,
          timestamp: Date.now(),
        };

        // If there are more recipients, prefetch the second page in background without blocking
        if (firstPage.nextCursor && initialItems.length < 50) {
          void messaging.fetchConversationPage(currentUserId, firstPage.nextCursor)
            .then((nextPage) => {
              if (nextPage.items.length > 0 && this.cachedRecipients?.userId === currentUserId) {
                const merged = Array.from(
                  new Map([...this.cachedRecipients.recipients, ...nextPage.items].map((r) => [r.uid, r])).values()
                );
                this.cachedRecipients.recipients = merged;
              }
            })
            .catch(() => {});
        }

        return initialItems;
      } finally {
        this.inFlightRequests.delete(currentUserId);
      }
    })();

    this.inFlightRequests.set(currentUserId, requestPromise);
    return requestPromise;
  }

  public clearCache(): void {
    this.cachedRecipients = null;
    this.inFlightRequests.clear();
  }

  public async sendToChats(
    currentUserId: string,
    recipientIds: string[],
    shareUrl: string,
    attachedMessage?: string,
  ): Promise<ChatShareResult> {
    if (!currentUserId) throw new Error('Sign in to share inside Ourlime.');
    if (recipientIds.length === 0) throw new Error('Choose at least one person.');

    const messaging = MessagingService.getInstance();
    const optionalMessage = attachedMessage?.trim();

    // Promise.allSettled is not available in all Hermes builds — use manual settle
    const settledResults = await Promise.all(
      recipientIds.map(async (recipientId) => {
        try {
          await messaging.sendMessage(recipientId, shareUrl, currentUserId);
          if (optionalMessage) {
            await messaging.sendMessage(recipientId, optionalMessage, currentUserId);
          }
          return { ok: true as const };
        } catch (err: unknown) {
          return { ok: false as const, error: err };
        }
      }),
    );

    const sentCount = settledResults.filter((r) => r.ok).length;
    if (sentCount === 0) {
      const first = settledResults.find((r): r is { ok: false; error: unknown } => !r.ok);
      const errorMsg = first?.error instanceof Error ? first.error.message : 'The share could not be sent.';
      throw new Error(errorMsg);
    }
    return { sentCount, failedCount: settledResults.length - sentCount };
  }

  public async shareExternally(input: ExternalShareInput): Promise<boolean> {
    const nativeShare = ReactNative.Share ?? (ReactNative as unknown as { default?: { Share?: typeof ReactNative.Share } }).default?.Share;
    if (!nativeShare) throw new Error('Share is not supported on this platform');
    const result = await nativeShare.share({ title: input.title, message: input.message, url: input.url });
    return result.action === nativeShare.sharedAction;
  }
}

export const contentShareService = ContentShareService.getInstance();
