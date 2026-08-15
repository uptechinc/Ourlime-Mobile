import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { ApiService } from './ApiService';
import { MessagingService, type FullMessage } from '@/lib/messaging/MessagingService';

const RECENT_MESSAGE_LIMIT = 50;

type RecentMessagesResponse = {
  status: 'success' | 'error';
  data?: { items?: unknown[] };
  message?: string;
};

export class SimpleChatMessageService {
  private static instance: SimpleChatMessageService;
  private readonly apiService = ApiService.getInstance();
  private readonly messagingService = MessagingService.getInstance();

  private constructor() {}

  public static getInstance(): SimpleChatMessageService {
    if (!SimpleChatMessageService.instance) {
      SimpleChatMessageService.instance = new SimpleChatMessageService();
    }
    return SimpleChatMessageService.instance;
  }

  public async loadRecent(peerId: string): Promise<FullMessage[]> {
    const search = new URLSearchParams({ peerId, limit: String(RECENT_MESSAGE_LIMIT) });
    const response = await this.apiService.request<RecentMessagesResponse>(
      `/api/messaging?${search.toString()}`,
      { authenticated: true },
    );
    if (response.status !== 'success') {
      throw new Error(response.message ?? 'Could not load messages.');
    }
    return this.normalizeRecent(response.data?.items ?? []);
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

  public async markRead(peerId: string): Promise<void> {
    await this.apiService.request('/api/messaging', {
      authenticated: true,
      method: 'PATCH',
      body: { peerId },
    });
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
