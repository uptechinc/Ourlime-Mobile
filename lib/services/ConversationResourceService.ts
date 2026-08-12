import { collection, limit, onSnapshot, orderBy, query, Timestamp, type DocumentData, type QueryDocumentSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { MessagingService, type ConversationEntry } from '@/lib/messaging/MessagingService';
import { LocalCacheService } from './LocalCacheService';
import { ResourceErrorService } from './ResourceErrorService';
import { useResourceStore } from '@/lib/store/useResourceStore';
import { DiagnosticLogService } from './DiagnosticLogService';

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
  private inFlight: Promise<void> | null = null;
  private unsubscribe: Unsubscribe | null = null;
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
    const cached = await this.cacheService.read<ConversationEntry[]>(userId, CONVERSATION_NAMESPACE, CONVERSATION_CACHE_KEY);
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
    this.inFlight = this.performRefresh(userId).finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  public startRealtime(userId: string): void {
    if (this.activeUserId === userId && this.unsubscribe) return;
    this.stopRealtime();
    this.activeUserId = userId;
    this.logger.info('ConversationResourceService', 'listener:start', { limit: 50 });
    const summariesQuery = query(collection(db, 'users', userId, 'conversationSummaries'), orderBy('lastActivityAt', 'desc'), limit(50));
    this.unsubscribe = onSnapshot(summariesQuery, (snapshot) => {
      const incoming = snapshot.docs.map((document) => this.mapSummary(document)).filter((item): item is ConversationEntry => item !== null);
      this.logger.info('ConversationResourceService', 'listener:reconcile', { changeCount: snapshot.docChanges().length, recordCount: incoming.length, fromCache: snapshot.metadata.fromCache });
      if (incoming.length === 0) {
        if (!snapshot.metadata.fromCache) void this.refresh(userId, true);
        return;
      }
      const existing = useResourceStore.getState().conversations.data ?? [];
      void this.commit(userId, [...incoming, ...existing]);
    }, (error) => {
      const current = useResourceStore.getState().conversations;
      useResourceStore.getState().setConversations({ ...current, status: current.data ? 'ready' : 'error', isStale: true, error: this.errorService.normalize(error, 'Realtime conversations are unavailable.') });
    });
  }

  public stopRealtime(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.activeUserId = null;
    this.logger.info('ConversationResourceService', 'listener:stop', {});
  }

  public async patchConversation(userId: string, peerId: string, updates: Partial<ConversationEntry>): Promise<void> {
    const current = useResourceStore.getState().conversations;
    if (!current.data) return;
    const conversations = current.data.map((item) => item.uid === peerId ? { ...item, ...updates } : item).sort(this.sortByActivity);
    await this.commit(userId, conversations);
  }

  public async loadMore(userId: string): Promise<void> {
    if (!this.nextCursor || this.inFlight) return;
    this.inFlight = this.messagingService.fetchConversationPage(userId, this.nextCursor).then(async (page) => {
      this.nextCursor = page.nextCursor;
      await this.commit(userId, [...(useResourceStore.getState().conversations.data ?? []), ...page.items]);
    }).finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  public hasMore(): boolean {
    return this.nextCursor !== null;
  }

  private async performRefresh(userId: string): Promise<void> {
    const current = useResourceStore.getState().conversations;
    useResourceStore.getState().setConversations({ ...current, status: current.data ? 'refreshing' : 'hydrating', error: null });
    try {
      const page = await this.messagingService.fetchConversationPage(userId, null);
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
      lastMessageTime: timestamp,
      unreadCount: typeof record.unreadCount === 'number' ? record.unreadCount : 0,
      isOnline: record.isOnline === true,
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
