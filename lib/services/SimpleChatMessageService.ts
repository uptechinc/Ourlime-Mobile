import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { chatDataService, type MessageWindowTarget } from './ChatDataService';
import { MessagingService, type FullMessage } from '@/lib/messaging/MessagingService';

const RECENT_MESSAGE_LIMIT = 50;
const HISTORY_PAGE_LIMIT = 30;

/** A run of messages (oldest first) and the cursor for the next page in the same direction. */
export type ChatMessageRange = {
  messages: FullMessage[];
  cursor: string | null;
  hasMore: boolean;
};

/** Messages around a jumped-to message (oldest first), with cursors for scrolling either way. */
export type ChatMessageWindowRange = {
  messages: FullMessage[];
  targetId: string;
  olderCursor: string | null;
  hasOlder: boolean;
  newerCursor: string | null;
  hasNewer: boolean;
};

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

  public async loadLatest(peerId: string): Promise<ChatMessageRange> {
    const page = await this.chatData.getMessagePage(peerId, RECENT_MESSAGE_LIMIT);
    return { messages: this.normalizeRecent(page.items), cursor: page.nextCursor, hasMore: page.hasMore };
  }

  public async loadOlder(peerId: string, cursor: string): Promise<ChatMessageRange> {
    const page = await this.chatData.getMessagePage(peerId, HISTORY_PAGE_LIMIT, cursor);
    return { messages: this.normalizeRecent(page.items), cursor: page.nextCursor, hasMore: page.hasMore };
  }

  public async loadNewer(peerId: string, cursor: string): Promise<ChatMessageRange> {
    const page = await this.chatData.getNewerPage(peerId, cursor, HISTORY_PAGE_LIMIT);
    return { messages: this.normalizeRecent(page.items), cursor: page.nextCursor, hasMore: page.hasMore };
  }

  /** Loads only the messages around the target (not everything after it). Null when it no longer exists. */
  public async loadWindow(peerId: string, target: MessageWindowTarget): Promise<ChatMessageWindowRange | null> {
    const messageWindow = await this.chatData.getMessageWindow(peerId, target);
    if (!messageWindow) return null;
    const targetMessage = this.messagingService.normalizeMessage(messageWindow.items[messageWindow.targetIndex]);
    if (!targetMessage) return null;
    return {
      messages: this.normalizeRecent(messageWindow.items),
      targetId: this.messagingService.getMessageIdentity(targetMessage),
      olderCursor: messageWindow.olderCursor,
      hasOlder: messageWindow.hasOlder,
      newerCursor: messageWindow.newerCursor,
      hasNewer: messageWindow.hasNewer,
    };
  }

  /** Re-reads one message after an edit, reaction or delete so it can be updated in place. */
  public async loadMessage(peerId: string, chatId: string, message: FullMessage): Promise<FullMessage | null> {
    if (message.id && !message.id.startsWith('legacy:') && !message.id.includes('/')) {
      const snapshot = await getDoc(doc(db, 'chats', chatId, 'messages', message.id));
      if (snapshot.exists()) return this.messagingService.normalizeMessage({ ...snapshot.data(), id: snapshot.id });
    }
    // Older messages live in the chat document's array; find them the same way a jump does.
    const messageWindow = await this.chatData.getMessageWindow(peerId, {
      messageId: message.id,
      timestampSeconds: message.timestamp.seconds,
      senderId: message.senderId,
    });
    return messageWindow ? this.messagingService.normalizeMessage(messageWindow.items[messageWindow.targetIndex]) : null;
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

  /** Merges messages into one list, oldest first. Keeps every loaded page (older pages are not trimmed). */
  public mergeMessages(current: FullMessage[], incoming: FullMessage[]): FullMessage[] {
    const messagesById = new Map<string, FullMessage>();
    current.forEach((message) => messagesById.set(this.messagingService.getMessageIdentity(message), message));
    incoming.forEach((message) => messagesById.set(this.messagingService.getMessageIdentity(message), message));
    return this.sortOldestFirst([...messagesById.values()]);
  }

  /** Applies realtime changes (edits, reactions, deletes, status) only to messages already in the list. */
  public updateShownMessages(current: FullMessage[], incoming: FullMessage[]): FullMessage[] {
    const incomingById = new Map(incoming.map((message) => [this.messagingService.getMessageIdentity(message), message]));
    let changed = false;
    const next = current.map((message) => {
      const update = incomingById.get(this.messagingService.getMessageIdentity(message));
      if (!update || update === message) return message;
      changed = true;
      return update;
    });
    return changed ? next : current;
  }

  public getMessageId(message: FullMessage): string {
    return this.messagingService.getMessageIdentity(message);
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
    return this.mergeMessages([], messages);
  }

  private sortOldestFirst(messages: FullMessage[]): FullMessage[] {
    return messages.sort((left, right) => {
      if (left.timestamp.seconds !== right.timestamp.seconds) {
        return left.timestamp.seconds - right.timestamp.seconds;
      }
      return left.timestamp.nanoseconds - right.timestamp.nanoseconds;
    });
  }
}

export const simpleChatMessageService = SimpleChatMessageService.getInstance();
