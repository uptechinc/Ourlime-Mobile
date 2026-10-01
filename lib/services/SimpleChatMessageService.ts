import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { chatDataService } from './ChatDataService';
import { MessagingService, type FullMessage } from '@/lib/messaging/MessagingService';

const RECENT_MESSAGE_LIMIT = 50;

export class SimpleChatMessageService {
  private static instance: SimpleChatMessageService;
  private readonly chatData = chatDataService;
  private readonly messagingService = MessagingService.getInstance();

  private constructor() {}

  public static getInstance(): SimpleChatMessageService {
    if (!SimpleChatMessageService.instance) {
      SimpleChatMessageService.instance = new SimpleChatMessageService();
    }
    return SimpleChatMessageService.instance;
  }

  public async loadRecent(peerId: string): Promise<FullMessage[]> {
    const page = await this.chatData.getMessagePage(peerId, RECENT_MESSAGE_LIMIT);
    return this.normalizeRecent(page.items);
  }

  public subscribeToRecent(
    chatId: string,
    onMessages: (messages: FullMessage[]) => void,
    onError: (error: Error) => void,
  ): Unsubscribe {
    const recentQuery = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(RECENT_MESSAGE_LIMIT),
    );
    return onSnapshot(
      recentQuery,
      (snapshot) => {
        const messages = snapshot.docs
          .map((messageDocument) => this.messagingService.normalizeMessage({
            id: messageDocument.id,
            ...messageDocument.data(),
          }))
          .filter((message): message is FullMessage => message !== null);
        onMessages(this.normalizeRecent(messages));
      },
      (error) => onError(error instanceof Error ? error : new Error('Realtime messages are unavailable.')),
    );
  }

  public mergeRecent(current: FullMessage[], incoming: FullMessage[]): FullMessage[] {
    const messagesById = new Map<string, FullMessage>();
    current.forEach((message) => messagesById.set(this.messagingService.getMessageIdentity(message), message));
    incoming.forEach((message) => messagesById.set(this.messagingService.getMessageIdentity(message), message));
    return this.sortNewestFirst([...messagesById.values()]).slice(0, RECENT_MESSAGE_LIMIT);
  }

  private readonly markReadInFlight = new Set<string>();

  public async markRead(peerId: string): Promise<void> {
    if (this.markReadInFlight.has(peerId)) return;
    this.markReadInFlight.add(peerId);
    try {
      await this.chatData.updateConversation(peerId, 'read');
    } catch {
      // Non-fatal: the next open marks the conversation read again.
    } finally {
      setTimeout(() => this.markReadInFlight.delete(peerId), 2000);
    }
  }

  public async markUnread(peerId: string): Promise<void> {
    try {
      await this.chatData.updateConversation(peerId, 'unread');
    } catch {
      // Non-fatal
    }
  }

  public async setArchiveStatus(peerId: string, isArchived: boolean): Promise<void> {
    try {
      await this.chatData.updateConversation(peerId, isArchived ? 'archive' : 'unarchive');
    } catch {
      // Non-fatal
    }
  }

  public async setPinStatus(peerId: string, isPinned: boolean): Promise<void> {
    try {
      await this.chatData.updateConversation(peerId, isPinned ? 'pin' : 'unpin');
    } catch {
      // Non-fatal
    }
  }

  private normalizeRecent(values: unknown[]): FullMessage[] {
    const messages = values
      .map((value) => this.messagingService.normalizeMessage(value))
      .filter((message): message is FullMessage => message !== null);
    return this.mergeRecent([], messages);
  }

  private sortNewestFirst(messages: FullMessage[]): FullMessage[] {
    return messages.sort((left, right) => {
      if (left.timestamp.seconds !== right.timestamp.seconds) {
        return right.timestamp.seconds - left.timestamp.seconds;
      }
      return right.timestamp.nanoseconds - left.timestamp.nanoseconds;
    });
  }
}

export const simpleChatMessageService = SimpleChatMessageService.getInstance();
