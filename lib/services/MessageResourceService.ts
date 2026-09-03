import { collection, limit, onSnapshot, orderBy, query, Timestamp, where, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { ApiService } from './ApiService';
import { LocalCacheService } from './LocalCacheService';
import { ResourceErrorService } from './ResourceErrorService';
import { MessagingService, type FullMessage } from '@/lib/messaging/MessagingService';
import { useResourceStore, type MessageResourceData } from '@/lib/store/useResourceStore';
import type { ResourceState } from '@/lib/types/resourceState';
import { DiagnosticLogService } from './DiagnosticLogService';

const MESSAGE_NAMESPACE = 'messages';
const MESSAGE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MESSAGE_PAGE_SIZE = 30;

type MessagePageResponse = {
  status: 'success' | 'error';
  data?: { items?: unknown[]; nextCursor?: string | null; hasMore?: boolean; clearedAt?: number | null };
  message?: string;
};

export class MessageResourceService {
  private static instance: MessageResourceService;
  private readonly apiService = ApiService.getInstance();
  private readonly cacheService = LocalCacheService.getInstance();
  private readonly errorService = ResourceErrorService.getInstance();
  private readonly messagingService = MessagingService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly listeners = new Map<string, Unsubscribe>();
  private readonly listenerContexts = new Map<string, { userId: string; peerId: string; chatId: string }>();

  private constructor() {}

  public static getInstance(): MessageResourceService {
    if (!MessageResourceService.instance) MessageResourceService.instance = new MessageResourceService();
    return MessageResourceService.instance;
  }

  public async hydrate(userId: string, chatId: string): Promise<void> {
    const current = useResourceStore.getState().messages[chatId];
    if (current?.data) {
      const headMessages = this.mergeMessages(current.data.messages).slice(-MESSAGE_PAGE_SIZE);
      this.logger.info('MessageResourceService', 'hydrate:memory-head', {
        chatId,
        sourceCount: current.data.messages.length,
        hydratedCount: headMessages.length,
      });
      useResourceStore.getState().setMessages(chatId, {
        ...current,
        data: {
          ...current.data,
          messages: headMessages,
          nextCursor: null,
          hasMore: false,
          pagination: { status: 'idle', errorMessage: null },
        },
      });
      return;
    }
    useResourceStore.getState().setMessages(chatId, this.withState(current, { status: 'hydrating', error: null }));
    const cached = await this.cacheService.read<MessageResourceData>(userId, MESSAGE_NAMESPACE, chatId);
    if (!cached) {
      useResourceStore.getState().setMessages(chatId, this.withState(null, { status: 'idle' }));
      return;
    }
    const data: MessageResourceData = {
      ...cached.data,
      messages: this.mergeMessages(
        cached.data.messages
          .map((message) => this.messagingService.normalizeMessage(message))
          .filter((message): message is FullMessage => message !== null),
      ).slice(-MESSAGE_PAGE_SIZE),
      nextCursor: null,
      hasMore: false,
      pagination: cached.data.pagination ?? { status: 'idle', errorMessage: null },
    };
    this.logger.info('MessageResourceService', 'hydrate:disk-head', {
      chatId,
      sourceCount: cached.data.messages.length,
      hydratedCount: data.messages.length,
    });
    useResourceStore.getState().setMessages(chatId, { data, status: 'ready', source: 'disk', updatedAt: cached.updatedAt, isStale: true, error: null });
  }

  public async refresh(userId: string, peerId: string, chatId: string, force = false): Promise<void> {
    if (this.inFlight.has(chatId)) return this.inFlight.get(chatId);
    const current = useResourceStore.getState().messages[chatId];
    if (!force && current?.status === 'refreshing') return;
    const operation = (async () => {
      try {
        await this.fetchPage(userId, peerId, chatId, null, false);
      } finally {
        this.inFlight.delete(chatId);
      }
    })();
    this.inFlight.set(chatId, operation);
    return operation;
  }

  public async loadOlder(userId: string, peerId: string, chatId: string): Promise<void> {
    const current = useResourceStore.getState().messages[chatId];
    const requestKey = `${chatId}:older`;
    if (!current?.data?.hasMore || !current.data.nextCursor || this.inFlight.has(requestKey)) return;
    useResourceStore.getState().setMessages(chatId, {
      ...current,
      data: { ...current.data, pagination: { status: 'loading', errorMessage: null } },
    });
    const operation = (async () => {
      try {
        await this.fetchPage(userId, peerId, chatId, current.data!.nextCursor, true);
      } finally {
        this.inFlight.delete(requestKey);
      }
    })();
    this.inFlight.set(requestKey, operation);
    return operation;
  }

  public startRealtime(userId: string, peerId: string, chatId: string): void {
    this.listenerContexts.set(chatId, { userId, peerId, chatId });
    if (this.listeners.has(chatId)) return;
    const clearedAt = useResourceStore.getState().messages[chatId]?.data?.clearedAt;
    const headQuery = clearedAt
      ? query(collection(db, 'chats', chatId, 'messages'), where('timestamp', '>', Timestamp.fromMillis(clearedAt)), orderBy('timestamp', 'desc'), limit(MESSAGE_PAGE_SIZE))
      : query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'desc'), limit(MESSAGE_PAGE_SIZE));
    this.logger.info('MessageResourceService', 'listener:start', { chatId, limit: MESSAGE_PAGE_SIZE });
    const unsubscribe = onSnapshot(headQuery, (snapshot) => {
      if (snapshot.empty && snapshot.metadata.fromCache) return;
      const head = snapshot.docs.map((document) => this.messagingService.normalizeMessage({ id: document.id, ...document.data() })).filter((message): message is FullMessage => message !== null);
      this.logger.info('MessageResourceService', 'listener:reconcile', { chatId, changeCount: snapshot.docChanges().length, recordCount: head.length, fromCache: snapshot.metadata.fromCache });
      if (head.length === 0) return;
      const current = useResourceStore.getState().messages[chatId];
      const data: MessageResourceData = {
        messages: this.mergeMessages([...(current?.data?.messages ?? []), ...head]),
        nextCursor: current?.data?.nextCursor ?? null,
        hasMore: current?.data?.hasMore ?? false,
        clearedAt: current?.data?.clearedAt,
        pagination: current?.data?.pagination ?? { status: 'idle', errorMessage: null },
      };
      void this.commit(userId, chatId, data, 'network');
    }, (error) => {
      const current = useResourceStore.getState().messages[chatId];
      useResourceStore.getState().setMessages(chatId, { ...this.withState(current, { status: current?.data ? 'ready' : 'error' }), isStale: true, error: this.errorService.normalize(error, 'Realtime messages are unavailable.') });
    });
    this.listeners.set(chatId, unsubscribe);
  }

  public stopRealtime(chatId: string): void {
    this.listeners.get(chatId)?.();
    this.listeners.delete(chatId);
    this.listenerContexts.delete(chatId);
    this.logger.info('MessageResourceService', 'listener:stop', { chatId });
  }

  public pauseRealtime(): void {
    this.listeners.forEach((unsubscribe) => unsubscribe());
    this.listeners.clear();
  }

  public resumeRealtime(): void {
    this.listenerContexts.forEach(({ userId, peerId, chatId }) => this.startRealtime(userId, peerId, chatId));
  }

  public async markRead(peerId: string): Promise<void> {
    await this.apiService.request('/api/messaging', { method: 'PATCH', authenticated: true, body: { peerId } });
  }

  public async insertOptimistic(userId: string, chatId: string, message: FullMessage): Promise<void> {
    const current = useResourceStore.getState().messages[chatId];
    const data: MessageResourceData = { messages: this.mergeMessages([...(current?.data?.messages ?? []), message]), nextCursor: current?.data?.nextCursor ?? null, hasMore: current?.data?.hasMore ?? false, clearedAt: current?.data?.clearedAt, pagination: current?.data?.pagination ?? { status: 'idle', errorMessage: null } };
    await this.commit(userId, chatId, data, 'memory');
  }

  public async reconcileOptimistic(userId: string, chatId: string, optimisticId: string, serverMessage: FullMessage | null): Promise<void> {
    const current = useResourceStore.getState().messages[chatId];
    if (!current?.data) return;
    const retained = current.data.messages.filter((message) => message.id !== optimisticId);
    await this.commit(userId, chatId, { ...current.data, messages: this.mergeMessages(serverMessage ? [...retained, serverMessage] : retained) }, serverMessage ? 'network' : current.source);
  }

  public async clearLocal(userId: string, chatId: string): Promise<void> {
    await this.commit(userId, chatId, { messages: [], nextCursor: null, hasMore: false, clearedAt: Date.now(), pagination: { status: 'idle', errorMessage: null } }, 'memory');
    const context = this.listenerContexts.get(chatId);
    this.listeners.get(chatId)?.();
    this.listeners.delete(chatId);
    if (context) this.startRealtime(context.userId, context.peerId, context.chatId);
  }

  private async fetchPage(userId: string, peerId: string, chatId: string, cursor: string | null, appendOlder: boolean): Promise<void> {
    const current = useResourceStore.getState().messages[chatId];
    useResourceStore.getState().setMessages(chatId, this.withState(current, { status: current?.data ? 'refreshing' : 'hydrating', error: null }));
    try {
      const search = new URLSearchParams({ peerId, limit: String(MESSAGE_PAGE_SIZE) });
      if (cursor) search.set('cursor', cursor);
      const response = await this.apiService.request<MessagePageResponse>(`/api/messaging?${search.toString()}`, { authenticated: true });
      if (response.status !== 'success') throw new Error(response.message ?? 'Could not load messages.');
      const page = (response.data?.items ?? []).map((item) => this.messagingService.normalizeMessage(item)).filter((message): message is FullMessage => message !== null);
      const clearedAt = response.data?.clearedAt ?? current?.data?.clearedAt;
      const currentMessages = (current?.data?.messages ?? []).filter((message) => !clearedAt || message.timestamp.toMillis() > clearedAt);
      const messages = appendOlder ? this.mergeMessages([...page, ...currentMessages]) : this.mergeMessages([...currentMessages, ...page]);
      await this.commit(userId, chatId, { messages, nextCursor: response.data?.nextCursor ?? null, hasMore: response.data?.hasMore === true, clearedAt, pagination: { status: 'idle', errorMessage: null } }, 'network');
      if (clearedAt && clearedAt !== current?.data?.clearedAt && this.listenerContexts.has(chatId)) {
        const context = this.listenerContexts.get(chatId);
        this.listeners.get(chatId)?.();
        this.listeners.delete(chatId);
        if (context) this.startRealtime(context.userId, context.peerId, context.chatId);
      }
    } catch (error: unknown) {
      const latest = useResourceStore.getState().messages[chatId];
      const normalizedError = this.errorService.normalize(error, appendOlder ? 'Could not load earlier messages.' : 'Could not load messages.');
      useResourceStore.getState().setMessages(chatId, {
        ...this.withState(latest, { status: latest?.data ? 'ready' : 'error' }),
        data: latest?.data
          ? { ...latest.data, pagination: appendOlder ? { status: 'error', errorMessage: normalizedError.message } : latest.data.pagination }
          : null,
        isStale: true,
        error: appendOlder && latest?.data ? latest.error : normalizedError,
      });
    }
  }

  private async commit(userId: string, chatId: string, data: MessageResourceData, source: ResourceState<MessageResourceData>['source']): Promise<void> {
    const bounded = { ...data, messages: data.messages.slice(-100) };
    const updatedAt = Date.now();
    useResourceStore.getState().setMessages(chatId, { data: bounded, status: 'ready', source, updatedAt, isStale: false, error: null });
    await this.cacheService.write(userId, MESSAGE_NAMESPACE, chatId, bounded, { expiresAt: updatedAt + MESSAGE_RETENTION_MS });
    await this.cacheService.prune({ userId, namespace: MESSAGE_NAMESPACE, maximumRecords: 30, maximumExpiredAgeMs: MESSAGE_RETENTION_MS });
  }

  private mergeMessages(messages: FullMessage[]): FullMessage[] {
    const unique = new Map<string, FullMessage>();
    messages.forEach((message) => unique.set(this.messagingService.getMessageFingerprint(message), message));
    return [...unique.values()].sort((left, right) => {
      if (left.timestamp.seconds !== right.timestamp.seconds) return left.timestamp.seconds - right.timestamp.seconds;
      return left.timestamp.nanoseconds - right.timestamp.nanoseconds;
    });
  }

  private withState(current: ResourceState<MessageResourceData> | null | undefined, changes: Partial<ResourceState<MessageResourceData>>): ResourceState<MessageResourceData> {
    return { data: current?.data ?? null, status: current?.status ?? 'idle', source: current?.source ?? 'memory', updatedAt: current?.updatedAt ?? null, isStale: current?.isStale ?? true, error: current?.error ?? null, ...changes };
  }
}

export const messageResourceService = MessageResourceService.getInstance();
