import { Share } from 'react-native';
import { messagingService, type ConversationEntry } from '@/lib/messaging/MessagingService';

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
    for (let pageIndex = 0; pageIndex < 5; pageIndex += 1) {
      const page = await messagingService.fetchConversationPage(currentUserId, cursor);
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

    const results = await Promise.allSettled(
      recipientIds.map((recipientId) => messagingService.sendMessage(recipientId, message, currentUserId)),
    );
    const sentCount = results.filter((result) => result.status === 'fulfilled').length;
    return { sentCount, failedCount: results.length - sentCount };
  }

  public async shareExternally(input: ExternalShareInput): Promise<boolean> {
    const result = await Share.share({ title: input.title, message: input.message, url: input.url });
    return result.action === Share.sharedAction;
  }
}

export const contentShareService = ContentShareService.getInstance();
