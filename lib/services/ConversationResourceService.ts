import { collection, limit, onSnapshot, query, Timestamp, type DocumentData, type QueryDocumentSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { MessagingService, type ConversationEntry } from '@/lib/messaging/MessagingService';
import { LocalCacheService, type CachedRecord } from './LocalCacheService';
import { ResourceErrorService } from './ResourceErrorService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { DiagnosticLogService } from './DiagnosticLogService';
import { RequestTimeoutService } from './RequestTimeoutService';

import { inAppNotificationService } from './InAppNotificationService';

const CONVERSATION_NAMESPACE = 'conversations';
const CONVERSATION_CACHE_KEY = 'latest';
const CONVERSATION_STALE_MS = 30_000;
const CONVERSATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export class ConversationResourceService {
  private static instance: ConversationResourceService;
  private readonly messagingService = MessagingService.getInstance();
  private readonly cacheService = LocalCacheService.getInstance();
  private readonly errorService = ResourceErrorService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly timeoutService = RequestTimeoutService.getInstance();
  private inFlight: Promise<void> | null = null;
  private unsubs: Unsubscribe[] = [];
  private activeUserId: string | null = null;
  private nextCursor: string | null = null;

  private constructor() {}

  public static getInstance(): ConversationResourceService {
    if (!ConversationResourceService.instance) ConversationResourceService.instance = new ConversationResourceService();
    return ConversationResourceService.instance;
  }

  public async hydrate(userId: string): Promise<void> {
    const current = useResourceStore.getState().conversations;
    if (current.data) return;
    useResourceStore.getState().setConversations({ ...current, status: 'hydrating', error: null });
    let cached: CachedRecord<ConversationEntry[]> | null;
    try {
      cached = await this.cacheService.read<ConversationEntry[]>(userId, CONVERSATION_NAMESPACE, CONVERSATION_CACHE_KEY);
    } catch (error: unknown) {
      this.logger.warn('ConversationResourceService', 'hydrate:cache-unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
      useResourceStore.getState().setConversations({ ...current, status: 'idle', error: null });
      return;
    }
    if (!cached) {
      useResourceStore.getState().setConversations({ ...current, status: 'idle' });
      return;
    }
    useResourceStore.getState().setConversations({ data: cached.data.map((item) => this.normalizeCachedEntry(item)), status: 'ready', source: 'disk', updatedAt: cached.updatedAt, isStale: cached.isExpired || Date.now() - cached.updatedAt >= CONVERSATION_STALE_MS, error: null });
  }

  public async refresh(userId: string, force = false): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const current = useResourceStore.getState().conversations;
    if (!force && current.data && current.updatedAt && Date.now() - current.updatedAt < CONVERSATION_STALE_MS) return;
    this.inFlight = (async () => {
      try {
        await this.performRefresh(userId);
      } finally {
        this.inFlight = null;
      }
    })();
    return this.inFlight;
  }

  /**
   * Live chat list. users/{uid}/conversationSummaries is the single source of truth for unread counts and the last
   * message (the website's chat list does the same); each summary change overwrites that conversation's entry.
   */
  public startRealtime(userId: string): void {
    if (this.activeUserId === userId && this.unsubs.length > 0) return;
    this.stopRealtime();
    this.activeUserId = userId;
    this.logger.info('ConversationResourceService', 'listener:start', { userId });

    let isInitialSnapshot = true;
    const lastUnreadByPeer = new Map<string, number>();
    const summariesQuery = query(collection(db, 'users', userId, 'conversationSummaries'), limit(100));
    const summariesUnsub = onSnapshot(summariesQuery, (snapshot) => {
      const incoming = snapshot.docs.map((document) => this.mapSummary(document)).filter((item): item is ConversationEntry => item !== null);
      this.logger.info('ConversationResourceService', 'summaries:reconcile', { changeCount: snapshot.docChanges().length, recordCount: incoming.length });
      if (incoming.length > 0) this.scheduleCommit(userId, this.mergeSummaries(useResourceStore.getState().conversations.data ?? [], incoming));

      if (isInitialSnapshot) {
        isInitialSnapshot = false;
        incoming.forEach((item) => lastUnreadByPeer.set(item.uid, item.unreadCount));
        return;
      }

      // Drop-down banner only when a conversation's unread count goes up (a new incoming message).
      for (const change of snapshot.docChanges()) {
        if (change.type === 'removed') continue;
        const item = this.mapSummary(change.doc);
        if (!item) continue;
        const previousUnread = lastUnreadByPeer.get(item.uid) ?? 0;
        lastUnreadByPeer.set(item.uid, item.unreadCount);
        if (item.unreadCount <= previousUnread || !item.lastMessage || item.isArchived || item.isMuted) continue;
        if (change.doc.data().lastMessageType === 'system') continue;
        inAppNotificationService.showNotification({
          id: `message:${item.uid}:${item.lastMessageTime?.toMillis() ?? Date.now()}`,
          kind: 'message',
          title: `${item.firstName} ${item.lastName}`.trim() || item.userName || 'Ourlime User',
          body: item.lastMessage,
          avatarUrl: item.profilePicture ?? null,
          peerId: item.uid,
          destination: { type: 'message', senderId: item.uid, chatId: item.uid },
        });
      }
    }, (error) => {
      this.logger.warn('ConversationResourceService', 'summaries:error', { error: error.message });
    });
    this.unsubs.push(summariesUnsub);
  }

  /** Fresh summaries win per conversation; details the summary lacks (online state, a missing photo) are kept. */
  private mergeSummaries(existing: ConversationEntry[], incoming: ConversationEntry[]): ConversationEntry[] {
    const byId = new Map(existing.map((item) => [item.uid, item]));
    incoming.forEach((item) => {
      const previous = byId.get(item.uid);
      byId.set(item.uid, previous
        ? { ...previous, ...item, isOnline: previous.isOnline, profilePicture: item.profilePicture ?? previous.profilePicture }
        : item);
    });
    return [...byId.values()];
  }

  private commitTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCommitData: { userId: string; list: ConversationEntry[] } | null = null;

  public scheduleCommit(userId: string, list: ConversationEntry[]): void {
    const unique = Array.from(new Map(list.map((item) => [item.uid, item])).values()).sort(this.sortByActivity).slice(0, 200);
    useResourceStore.getState().setConversations({
      data: unique,
      updatedAt: Date.now(),
      status: 'ready',
      source: 'network',
      isStale: false,
      error: null,
    });

    this.pendingCommitData = { userId, list: unique };
    if (this.commitTimer) clearTimeout(this.commitTimer);
    this.commitTimer = setTimeout(() => {
      const data = this.pendingCommitData;
      this.pendingCommitData = null;
      this.commitTimer = null;
      if (data) {
        void this.commit(data.userId, data.list);
      }
    }, 300);
  }

  public stopRealtime(): void {
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = null;
    }
    this.pendingCommitData = null;
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
    this.activeUserId = null;
    this.logger.info('ConversationResourceService', 'listener:stop', {});
  }

  public async patchConversation(userId: string, peerId: string, updates: Partial<ConversationEntry>): Promise<void> {
    const current = useResourceStore.getState().conversations;
    if (!current.data) return;
    const conversations = current.data.map((item) => item.uid === peerId ? { ...item, ...updates } : item).sort(this.sortByActivity);
    await this.commit(userId, conversations);
  }

  public async removeConversation(userId: string, peerId: string): Promise<void> {
    const current = useResourceStore.getState().conversations;
    const currentList = current.data ?? [];
    const filtered = currentList.filter((item) => item.uid !== peerId);
    useResourceStore.getState().setConversations({
      ...current,
      data: filtered,
      updatedAt: Date.now(),
      status: 'ready',
      error: null,
    });
    await this.commit(userId, filtered);
  }

  public removeUserFromCachedConversations(userId: string, peerId: string): void {
    const current = useResourceStore.getState().conversations;
    const currentList = current.data ?? [];
    const filtered = currentList.filter((item) => item.uid !== peerId);
    useResourceStore.getState().setConversations({
      ...current,
      data: filtered,
      updatedAt: Date.now(),
      status: 'ready',
      error: null,
    });
    void this.cacheService.write(userId, CONVERSATION_NAMESPACE, CONVERSATION_CACHE_KEY, filtered, { expiresAt: Date.now() + CONVERSATION_STALE_MS });
  }

  public async loadMore(userId: string): Promise<void> {
    if (!this.nextCursor || this.inFlight) return;
    this.inFlight = (async () => {
      try {
        const page = await this.timeoutService.run(this.messagingService.fetchConversationPage(userId, this.nextCursor), 'Conversation pagination request');
        this.nextCursor = page.nextCursor;
        await this.commit(userId, [...(useResourceStore.getState().conversations.data ?? []), ...page.items]);
      } finally {
        this.inFlight = null;
      }
    })();
    return this.inFlight;
  }

  public hasMore(): boolean {
    return this.nextCursor !== null;
  }

  private async performRefresh(userId: string): Promise<void> {
    const current = useResourceStore.getState().conversations;
    useResourceStore.getState().setConversations({ ...current, status: current.data ? 'refreshing' : 'hydrating', error: null });
    try {
      const page = await this.timeoutService.run(this.messagingService.fetchConversationPage(userId, null), 'Conversation request');
      this.nextCursor = page.nextCursor;
      await this.commit(userId, page.items);
    } catch (error: unknown) {
      const latest = useResourceStore.getState().conversations;
      useResourceStore.getState().setConversations({ ...latest, status: latest.data ? 'ready' : 'error', isStale: true, error: this.errorService.normalize(error, 'Could not load conversations.') });
    }
  }

  private async commit(userId: string, conversations: ConversationEntry[]): Promise<void> {
    const updatedAt = Date.now();
    const bounded = Array.from(new Map(conversations.map((item) => [item.uid, item])).values()).sort(this.sortByActivity).slice(0, 200);
    useResourceStore.getState().setConversations({ data: bounded, status: 'ready', source: 'network', updatedAt, isStale: false, error: null });
    await this.cacheService.write(userId, CONVERSATION_NAMESPACE, CONVERSATION_CACHE_KEY, bounded, { expiresAt: updatedAt + CONVERSATION_STALE_MS });
    await this.cacheService.prune({ userId, namespace: CONVERSATION_NAMESPACE, maximumRecords: 1, maximumExpiredAgeMs: CONVERSATION_RETENTION_MS });
  }

  private mapSummary(document: QueryDocumentSnapshot<DocumentData>): ConversationEntry | null {
    const record = document.data();
    const peerId = typeof record.peerId === 'string' ? record.peerId : document.id;
    if (!peerId) return null;
    const timestamp = record.lastMessageTime instanceof Timestamp ? record.lastMessageTime : record.lastActivityAt instanceof Timestamp ? record.lastActivityAt : undefined;
    const lastMessageSenderId = typeof record.lastMessageSenderId === 'string' ? record.lastMessageSenderId : undefined;
    return {
      uid: peerId,
      firstName: typeof record.peerFirstName === 'string' ? record.peerFirstName : 'User',
      lastName: typeof record.peerLastName === 'string' ? record.peerLastName : '',
      userName: typeof record.peerUserName === 'string' ? record.peerUserName : 'user',
      email: '',
      accountType: 'user',
      profilePicture: typeof record.peerProfileImage === 'string' ? record.peerProfileImage : null,
      lastMessage: typeof record.lastMessagePreview === 'string' ? record.lastMessagePreview : '',
      lastMessageSenderId,
      lastMessageTime: timestamp,
      unreadCount: (this.activeUserId && lastMessageSenderId === this.activeUserId)
        ? 0
        : (typeof record.unreadCount === 'number' ? record.unreadCount : 0),
      isOnline: record.isOnline === true,
      isPinned: record.isPinned === true,
      isArchived: record.isArchived === true,
      isMuted: typeof record.mutedUntil === 'number' ? record.mutedUntil > Date.now() : false,
      mutedUntil: typeof record.mutedUntil === 'number' ? record.mutedUntil : null,
    };
  }

  private normalizeCachedEntry(item: ConversationEntry): ConversationEntry {
    const raw = item.lastMessageTime as unknown;
    if (raw instanceof Timestamp || !raw || typeof raw !== 'object') return item;
    const record = raw as Record<string, unknown>;
    const seconds = typeof record.seconds === 'number' ? record.seconds : 0;
    const nanoseconds = typeof record.nanoseconds === 'number' ? record.nanoseconds : 0;
    return { ...item, lastMessageTime: seconds > 0 ? new Timestamp(seconds, nanoseconds) : undefined };
  }

  private readonly sortByActivity = (left: ConversationEntry, right: ConversationEntry): number => (right.lastMessageTime?.seconds ?? 0) - (left.lastMessageTime?.seconds ?? 0);
}

export const conversationResourceService = ConversationResourceService.getInstance();
