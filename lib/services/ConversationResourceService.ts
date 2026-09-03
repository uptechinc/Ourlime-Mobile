import { collection, doc, getDoc, limit, onSnapshot, query, where, Timestamp, type DocumentData, type QueryDocumentSnapshot, type Unsubscribe } from 'firebase/firestore';
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

  public startRealtime(userId: string): void {
    if (this.activeUserId === userId && this.unsubs.length > 0) return;
    this.stopRealtime();
    this.activeUserId = userId;
    this.logger.info('ConversationResourceService', 'listener:start', { userId });

    // 1. Listen to user's conversationSummaries subcollection
    let isInitialSummaries = true;
    const summariesQuery = query(collection(db, 'users', userId, 'conversationSummaries'), limit(100));
    const summariesUnsub = onSnapshot(summariesQuery, (snapshot) => {
      const incoming = snapshot.docs.map((document) => this.mapSummary(document)).filter((item): item is ConversationEntry => item !== null);
      this.logger.info('ConversationResourceService', 'summaries:reconcile', { changeCount: snapshot.docChanges().length, recordCount: incoming.length });
      if (incoming.length > 0) {
        const existing = useResourceStore.getState().conversations.data ?? [];
        this.scheduleCommit(userId, [...incoming, ...existing]);
      }

      if (isInitialSummaries) {
        isInitialSummaries = false;
        return;
      }

      // Check for incoming new messages from modified summaries after initial load
      for (const change of snapshot.docChanges()) {
        if (change.type === 'modified' || change.type === 'added') {
          const item = this.mapSummary(change.doc);
          if (item && item.unreadCount > 0 && item.lastMessage) {
            if (item.isArchived || item.isMuted) continue;
            const isCall = item.lastMessage.includes('call') || item.lastMessage.includes('Call') || item.lastMessage.includes('[SYS:');
            if (!isCall) {
              inAppNotificationService.showNotification({
                peerId: item.uid,
                senderName: `${item.firstName} ${item.lastName}`.trim() || item.userName || 'Ourlime User',
                avatarUrl: item.profilePicture ?? null,
                messageText: item.lastMessage,
              });
            }
          }
        }
      }
    }, (error) => {
      this.logger.warn('ConversationResourceService', 'summaries:error', { error: error.message });
    });
    this.unsubs.push(summariesUnsub);

    // 2. Listen to global chats collection for real-time updates when messages arrive
    let isInitialChats = true;
    const chatsQuery = query(collection(db, 'chats'), where('participants', 'array-contains', userId), limit(50));
    const chatsUnsub = onSnapshot(chatsQuery, async (snapshot) => {
      const changes = snapshot.docChanges();
      if (changes.length === 0) return;
      this.logger.info('ConversationResourceService', 'chats:reconcile', { changeCount: changes.length });

      if (isInitialChats) {
        isInitialChats = false;
        return;
      }

      const currentList = [...(useResourceStore.getState().conversations.data ?? [])];
      let hasUpdates = false;

      for (const change of changes) {
        const data = change.doc.data();
        const participants = Array.isArray(data.participants) ? data.participants as string[] : [];
        const messages = Array.isArray(data.messages) ? data.messages as Array<Record<string, unknown>> : [];
        const latestMsg = messages[messages.length - 1] as Record<string, unknown> | undefined;

        const peerId = latestMsg?.senderId && latestMsg.senderId !== userId
          ? String(latestMsg.senderId)
          : participants.find((p) => p !== userId);

        if (!peerId || peerId === userId) continue;

        const lastMessageTime = data.lastMessageTime instanceof Timestamp ? data.lastMessageTime : undefined;
        const lastMessage = typeof data.lastMessage === 'string' ? data.lastMessage : (typeof latestMsg?.message === 'string' ? latestMsg.message : '');
        const lastMessageSenderId = typeof data.lastMessageSenderId === 'string'
          ? data.lastMessageSenderId
          : typeof latestMsg?.senderId === 'string'
            ? latestMsg.senderId
            : undefined;
        const unreadCount = typeof data.unreadCount === 'number' ? data.unreadCount : 0;

        const existingIndex = currentList.findIndex((item) => item.uid === peerId);
        if (existingIndex >= 0) {
          const prev = currentList[existingIndex];
          currentList[existingIndex] = {
            ...prev,
            lastMessage: lastMessage || prev.lastMessage,
            lastMessageSenderId: lastMessageSenderId ?? prev.lastMessageSenderId,
            lastMessageTime: lastMessageTime ?? prev.lastMessageTime,
            unreadCount: unreadCount > 0 ? unreadCount : prev.unreadCount,
          };
          hasUpdates = true;
        } else {
          try {
            const userDoc = await getDoc(doc(db, 'users', peerId));
            if (userDoc.exists()) {
              const u = userDoc.data();
              currentList.push({
                uid: peerId,
                firstName: typeof u.firstName === 'string' ? u.firstName : 'User',
                lastName: typeof u.lastName === 'string' ? u.lastName : '',
                userName: typeof u.userName === 'string' ? u.userName : 'user',
                email: typeof u.email === 'string' ? u.email : '',
                accountType: typeof u.accountType === 'string' ? u.accountType : 'user',
                profilePicture: typeof u.profilePicture === 'string' ? u.profilePicture : null,
                lastMessage,
                lastMessageSenderId,
                lastMessageTime,
                unreadCount,
                isOnline: u.isOnline === true,
              });
              hasUpdates = true;
            }
          } catch {
            // Silently continue
          }
        }

        const isCall = lastMessage.includes('call') || lastMessage.includes('Call') || lastMessage.includes('[SYS:');
        if (change.type === 'modified' && latestMsg?.senderId === peerId && lastMessage && !isCall) {
          const peerEntry = currentList.find((item) => item.uid === peerId);
          inAppNotificationService.showNotification({
            peerId,
            senderName: peerEntry ? `${peerEntry.firstName} ${peerEntry.lastName}`.trim() || peerEntry.userName : 'Ourlime User',
            avatarUrl: peerEntry?.profilePicture ?? null,
            messageText: lastMessage,
          });
        }
      }

      if (hasUpdates) {
        this.scheduleCommit(userId, currentList);
      }
    }, (error) => {
      this.logger.warn('ConversationResourceService', 'chats:error', { error: error.message });
    });
    this.unsubs.push(chatsUnsub);
  }

  private commitTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingCommitData: { userId: string; list: ConversationEntry[] } | null = null;

  public scheduleCommit(userId: string, list: ConversationEntry[]): void {
    const sorted = [...list].sort(this.sortByActivity);
    const unique = Array.from(new Map(sorted.map((item) => [item.uid, item])).values()).slice(0, 200);
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
    return {
      uid: peerId,
      firstName: typeof record.peerFirstName === 'string' ? record.peerFirstName : 'User',
      lastName: typeof record.peerLastName === 'string' ? record.peerLastName : '',
      userName: typeof record.peerUserName === 'string' ? record.peerUserName : 'user',
      email: '',
      accountType: 'user',
      profilePicture: typeof record.peerProfileImage === 'string' ? record.peerProfileImage : null,
      lastMessage: typeof record.lastMessagePreview === 'string' ? record.lastMessagePreview : '',
      lastMessageSenderId: typeof record.lastMessageSenderId === 'string' ? record.lastMessageSenderId : undefined,
      lastMessageTime: timestamp,
      unreadCount: typeof record.unreadCount === 'number' ? record.unreadCount : 0,
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
