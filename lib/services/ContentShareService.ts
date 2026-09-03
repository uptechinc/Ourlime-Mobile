import { Share } from 'react-native';
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

export class ContentShareService {
  private static instance: ContentShareService;

  private constructor() {}

  public static getInstance(): ContentShareService {
    if (!ContentShareService.instance) ContentShareService.instance = new ContentShareService();
    return ContentShareService.instance;
  }

  public async loadRecipients(currentUserId: string): Promise<ConversationEntry[]> {
    if (!currentUserId) return [];
    const recipients: ConversationEntry[] = [];
    let cursor: string | null = null;
    const messaging = MessagingService.getInstance();
    for (let pageIndex = 0; pageIndex < 5; pageIndex += 1) {
      const page = await messaging.fetchConversationPage(currentUserId, cursor);
      recipients.push(...page.items);
      cursor = page.nextCursor;
      if (!cursor || page.items.length === 0) break;
    }
    return Array.from(new Map(recipients.map((recipient) => [recipient.uid, recipient])).values());
  }

  public async sendToChats(
    currentUserId: string,
    recipientIds: string[],
    message: string,
  ): Promise<ChatShareResult> {
    if (!currentUserId) throw new Error('Sign in to share inside Ourlime.');
    if (recipientIds.length === 0) throw new Error('Choose at least one person.');

    const messaging = MessagingService.getInstance();

    // Promise.allSettled is not available in all Hermes builds — use manual settle
    const settledResults = await Promise.all(
      recipientIds.map((recipientId) =>
        messaging.sendMessage(recipientId, message, currentUserId)
          .then(() => ({ ok: true as const }))
          .catch((err: unknown) => ({ ok: false as const, error: err })),
      ),
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
    const result = await Share.share({ title: input.title, message: input.message, url: input.url });
    return result.action === Share.sharedAction;
  }
}

export const contentShareService = ContentShareService.getInstance();
