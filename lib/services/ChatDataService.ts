import {
  arrayUnion,
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { communityDataService } from './CommunityDataService';
import { sharedContentMessageService } from './SharedContentMessageService';
import { appServerService } from './AppServerService';
import { serverClockService } from './ServerClockService';

export type ChatFriendRecord = {
  id: string;
  firstName: string;
  lastName: string;
  userName: string;
  profileImage: string | null;
  unreadCount: number;
  lastMessage: string;
  lastMessageSenderId?: string;
  lastMessageTime: Timestamp | null;
  isOnline: boolean;
  isPinned: boolean;
  isArchived: boolean;
  isMuted: boolean;
  mutedUntil: number | null;
};

export type ChatFriendsPage = { items: ChatFriendRecord[]; nextCursor: string | null };

export type ChatMessagePage = {
  items: DocumentData[];
  nextCursor: string | null;
  hasMore: boolean;
  clearedAt: number | null;
};

export type OutgoingMessage = {
  receiverId: string;
  message: string;
  replyTo?: unknown;
  attachment?: { fileName: string } & Record<string, unknown>;
  stickerData?: Record<string, unknown>;
  voiceNoteData?: Record<string, unknown>;
  isForwarded?: boolean;
};

// Mark-as-read updates at most this many messages per batch (Firestore allows 500 writes per batch).
const READ_BATCH_SIZE = 400;
const READ_MAX_BATCHES = 25;

export type ConversationAction = 'read' | 'unread' | 'archive' | 'unarchive' | 'pin' | 'unpin' | 'mute' | 'unmute';

export type MessageAction =
  | { action: 'react'; chatId: string; messageId?: string; timestampSeconds?: number; emoji: string }
  | { action: 'edit'; chatId: string; messageId?: string; timestampSeconds?: number; message: string }
  | { action: 'delete'; chatId: string; messageId?: string; timestampSeconds?: number; deleteForEveryone: boolean }
  | { action: 'clear'; chatId: string };

type FriendshipPhase = 'userId1' | 'userId2';
type FriendsCursor = { phase: FriendshipPhase; afterId: string | null };
type MessageType = 'text' | 'attachment' | 'sticker' | 'voiceNote' | 'system';

const CHAT_FRIEND_PAGE_SIZE = 20;
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const EDIT_WINDOW_MS = 20 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const readString = (value: unknown): string => (typeof value === 'string' ? value : '');
const readStringList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []);
const readMillis = (value: unknown): number | null => {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
const readSeconds = (value: unknown): number => {
  if (value instanceof Timestamp) return value.seconds;
  if (!isRecord(value)) return 0;
  if (typeof value.seconds === 'number') return value.seconds;
  return typeof value._seconds === 'number' ? value._seconds : 0;
};
const compareNewestFirst = (left: DocumentData, right: DocumentData): number => {
  const leftTime = left.timestamp instanceof Timestamp ? left.timestamp : null;
  const rightTime = right.timestamp instanceof Timestamp ? right.timestamp : null;
  const secondsDelta = (rightTime?.seconds ?? 0) - (leftTime?.seconds ?? 0);
  return secondsDelta !== 0 ? secondsDelta : (rightTime?.nanoseconds ?? 0) - (leftTime?.nanoseconds ?? 0);
};
const createMessageId = (): string => {
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

/**
 * One-to-one chat for the app, reading and writing Firestore directly with the same logic as the website's
 * /api/chat/friends, /api/messaging and /api/messaging/actions routes.
 * The receiver's push notification is sent through the app's own sendMessagePush function.
 */
export class ChatDataService {
  private static instance: ChatDataService;
  /** Message ID per failed send (by content), reused when the same message is sent again. */
  private readonly pendingSendIds = new Map<string, string>();

  private constructor() {}

  public static getInstance(): ChatDataService {
    if (!ChatDataService.instance) ChatDataService.instance = new ChatDataService();
    return ChatDataService.instance;
  }

  public getChatId(firstUserId: string, secondUserId: string): string {
    return [firstUserId, secondUserId].sort().join('_');
  }

  private requireViewerId(): string {
    const viewerId = auth.currentUser?.uid;
    if (!viewerId) throw new Error('Authentication required');
    return viewerId;
  }

  // ── Conversation list (web chatFriendsServer) ──

  public async getChatFriendsPage(requestedLimit = CHAT_FRIEND_PAGE_SIZE, cursor: string | null = null): Promise<ChatFriendsPage> {
    const viewerId = this.requireViewerId();
    const { friendIds, nextCursor } = await this.getFriendshipPage(viewerId, requestedLimit, cursor);
    if (friendIds.length === 0) return { items: [], nextCursor };

    const [users, chats, accountSettings, summaries, pictures] = await Promise.all([
      Promise.all(friendIds.map((friendId) => getDoc(doc(db, 'users', friendId)).catch(() => null))),
      Promise.all(friendIds.map((friendId) => getDoc(doc(db, 'chats', this.getChatId(viewerId, friendId))).catch(() => null))),
      Promise.all(friendIds.map((friendId) => getDoc(doc(db, 'users', friendId, 'userSettings', 'account')).catch(() => null))),
      Promise.all(friendIds.map((friendId) => getDoc(doc(db, 'users', viewerId, 'conversationSummaries', friendId)).catch(() => null))),
      communityDataService.loadProfilePictures(friendIds).catch(() => new Map<string, string>()),
    ]);
    const fallbackSenderIds = await Promise.all(friendIds.map((friendId, index) => this.lastSenderFallback(viewerId, friendId, summaries[index], chats[index])));

    const items = friendIds.flatMap((friendId, index): ChatFriendRecord[] => {
      const userDocument = users[index];
      if (!userDocument?.exists()) return [];
      const user = userDocument.data();
      const activityStatus = accountSettings[index]?.data()?.activityStatus !== false;
      const lastActiveMs = readMillis(user.lastActive) ?? 0;
      const isOnline = activityStatus && lastActiveMs > 0 && Date.now() - lastActiveMs <= ONLINE_WINDOW_MS && readString(user.onlineStatus).toLowerCase() !== 'offline';
      const chat = chats[index]?.data() ?? {};
      const clearedAt = isRecord(chat.clearedAt) ? readSeconds(chat.clearedAt[viewerId]) : 0;
      const legacyMessages = (Array.isArray(chat.messages) ? chat.messages : []).filter(isRecord)
        .filter((message) => !clearedAt || readSeconds(message.timestamp) > clearedAt);
      const lastLegacyMessage = legacyMessages.at(-1) ?? {};
      const summary = summaries[index]?.data() ?? {};
      const mutedUntil = typeof summary.mutedUntil === 'number' ? summary.mutedUntil : null;
      const summaryTime = summary.lastMessageTime instanceof Timestamp ? summary.lastMessageTime : null;
      const legacyTime = lastLegacyMessage.timestamp instanceof Timestamp ? lastLegacyMessage.timestamp : null;
      return [{
        id: friendId,
        firstName: readString(user.firstName) || 'User',
        lastName: readString(user.lastName),
        userName: readString(user.userName) || 'user',
        profileImage: pictures.get(friendId) || this.profileImageFromUser(user),
        unreadCount: typeof summary.unreadCount === 'number'
          ? summary.unreadCount
          : legacyMessages.filter((message) => message.receiverId === viewerId && message.status === 'sent').length,
        lastMessage: typeof summary.lastMessagePreview === 'string' ? summary.lastMessagePreview : readString(lastLegacyMessage.message),
        lastMessageSenderId: readString(summary.lastMessageSenderId) || readString(lastLegacyMessage.senderId) || readString(chat.lastMessageSenderId) || fallbackSenderIds[index],
        lastMessageTime: summaryTime ?? legacyTime,
        isOnline,
        isPinned: summary.isPinned === true,
        isArchived: summary.isArchived === true,
        isMuted: mutedUntil !== null && mutedUntil > Date.now(),
        mutedUntil,
      }];
    });
    items.sort((first, second) => (second.lastMessageTime?.seconds ?? 0) - (first.lastMessageTime?.seconds ?? 0));
    void this.reconcileFriendConversationSummaries(viewerId, items.map((item) => item.id)).catch((error: unknown) => {
      console.error('[ChatDataService.reconcileFriendConversationSummaries] Error:', error instanceof Error ? error.message : 'Unknown error');
    });
    return { items, nextCursor };
  }

  private decodeFriendsCursor(value: string | null): FriendsCursor {
    if (!value) return { phase: 'userId1', afterId: null };
    try {
      const decoded: unknown = JSON.parse(value);
      if (isRecord(decoded) && (decoded.phase === 'userId1' || decoded.phase === 'userId2') && (decoded.afterId === null || typeof decoded.afterId === 'string')) {
        return { phase: decoded.phase, afterId: decoded.afterId };
      }
    } catch {
      // Invalid cursors are handled uniformly below.
    }
    throw new Error('Invalid cursor');
  }

  /** Accepted friendships where the viewer is userId1, then userId2, paged by document id. */
  private async getFriendshipPage(viewerId: string, requestedLimit: number, encodedCursor: string | null): Promise<{ friendIds: string[]; nextCursor: string | null }> {
    const pageSize = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), CHAT_FRIEND_PAGE_SIZE) : CHAT_FRIEND_PAGE_SIZE;
    const friendIds: string[] = [];
    let { phase, afterId } = this.decodeFriendsCursor(encodedCursor);
    for (let phaseIndex = 0; phaseIndex < 2 && friendIds.length < pageSize; phaseIndex += 1) {
      const remaining = pageSize - friendIds.length;
      const constraints: QueryConstraint[] = [where(phase, '==', viewerId), where('friendshipStatus', '==', 'accepted'), orderBy(documentId())];
      if (afterId) constraints.push(startAfter(afterId));
      const snapshot = await getDocs(query(collection(db, 'friendship'), ...constraints, limit(remaining + 1)));
      const pageDocuments = snapshot.docs.slice(0, remaining);
      pageDocuments.forEach((friendship) => {
        const friendId = readString(friendship.data()[phase === 'userId1' ? 'userId2' : 'userId1']);
        if (friendId && friendId !== viewerId && !friendIds.includes(friendId)) friendIds.push(friendId);
      });
      if (snapshot.docs.length > remaining) {
        const lastDocument = pageDocuments.at(-1);
        return { friendIds, nextCursor: lastDocument ? JSON.stringify({ phase, afterId: lastDocument.id }) : null };
      }
      if (phase === 'userId2') break;
      phase = 'userId2';
      afterId = null;
    }
    return { friendIds, nextCursor: null };
  }

  private async lastSenderFallback(viewerId: string, friendId: string, summary: DocumentSnapshot | null, chat: DocumentSnapshot | null): Promise<string | undefined> {
    const summaryData = summary?.data() ?? {};
    const chatData = chat?.data() ?? {};
    const known = readString(summaryData.lastMessageSenderId) || readString(chatData.lastMessageSenderId);
    if (known) return known;
    const hasPreview = typeof summaryData.lastMessagePreview === 'string' ? summaryData.lastMessagePreview.length > 0 : readString(chatData.lastMessage).length > 0;
    if (!hasPreview) return undefined;
    const latest = await getDocs(query(collection(db, 'chats', this.getChatId(viewerId, friendId), 'messages'), orderBy('timestamp', 'desc'), limit(1))).catch(() => null);
    return readString(latest?.docs[0]?.data().senderId) || undefined;
  }

  private profileImageFromUser(user: DocumentData): string | null {
    if (typeof user.profileImage === 'string' && user.profileImage) return user.profileImage;
    if (isRecord(user.profileImage) && typeof user.profileImage.imageURL === 'string') return user.profileImage.imageURL;
    return readString(user.profilePicture) || readString(user.avatar) || readString(user.photoURL) || null;
  }

  /** Web resolvedProfileImage: the postProfile selection first, then profile, then fields on the user document. */
  private async resolvedProfileImage(userId: string, user: DocumentData): Promise<string> {
    const selections = await getDocs(query(collection(db, 'profileImageSetAs'), where('userId', '==', userId))).catch(() => null);
    const selection = selections?.docs.find((item) => item.data().setAs === 'postProfile') ?? selections?.docs.find((item) => item.data().setAs === 'profile');
    const imageId = readString(selection?.data().profileImageId);
    if (imageId) {
      const image = await getDoc(doc(db, 'profileImages', imageId)).catch(() => null);
      const url = readString(image?.data()?.imageURL);
      if (url) return url;
    }
    return this.profileImageFromUser(user) ?? '';
  }

  private async reconcileFriendConversationSummaries(userId: string, peerIds: string[]): Promise<void> {
    const uniquePeerIds = [...new Set(peerIds.filter((peerId) => peerId && peerId !== userId))].slice(0, 50);
    if (uniquePeerIds.length === 0) return;
    const existing = await Promise.all(uniquePeerIds.map((peerId) => getDoc(doc(db, 'users', userId, 'conversationSummaries', peerId))));
    const missingIds = uniquePeerIds.filter((_peerId, index) => !existing[index].exists());
    if (missingIds.length === 0) return;
    const peers = await Promise.all(missingIds.map((peerId) => getDoc(doc(db, 'users', peerId))));
    const images = await Promise.all(peers.map((peer) => (peer.exists() ? this.resolvedProfileImage(peer.id, peer.data()) : Promise.resolve(''))));
    const activity = Timestamp.now();
    const batch = writeBatch(db);
    peers.forEach((peer, index) => {
      if (!peer.exists()) return;
      const data = peer.data();
      batch.set(doc(db, 'users', userId, 'conversationSummaries', peer.id), {
        chatId: this.getChatId(userId, peer.id),
        peerId: peer.id,
        peerFirstName: readString(data.firstName),
        peerLastName: readString(data.lastName),
        peerUserName: readString(data.userName),
        peerProfileImage: images[index],
        friendshipStatus: 'accepted',
        unreadCount: 0,
        lastActivityAt: activity,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();
  }

  // ── Message pages (web GET /api/messaging) ──

  public async getMessagePage(peerId: string, requestedLimit = 30, cursor: string | null = null): Promise<ChatMessagePage> {
    const viewerId = this.requireViewerId();
    if (!peerId) throw new Error('peerId is required');
    const pageLimit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 50) : 30;
    const chatId = this.getChatId(viewerId, peerId);
    const chat = await getDoc(doc(db, 'chats', chatId));
    if (chat.exists() && !readStringList(chat.data().participants).includes(viewerId)) throw new Error('Conversation access denied');

    const chatData = chat.data() ?? {};
    const clearedAtValue = isRecord(chatData.clearedAt) ? chatData.clearedAt[viewerId] : null;
    const clearedAt = clearedAtValue instanceof Timestamp ? clearedAtValue : null;
    const clearedAtMillis = clearedAt?.toMillis() ?? null;
    const migrationComplete = isRecord(chatData.legacyMessageMigration) && chatData.legacyMessageMigration.completed === true;
    const allLegacyMessages = !migrationComplete && Array.isArray(chatData.messages)
      ? chatData.messages.filter(isRecord)
        .filter((message) => !clearedAt || !(message.timestamp instanceof Timestamp) || message.timestamp.toMillis() > clearedAt.toMillis())
        .sort(compareNewestFirst)
      : [];
    const messagesCollection = collection(db, 'chats', chatId, 'messages');

    if (cursor?.startsWith('legacy:')) {
      const migratedHead = await getDocs(query(messagesCollection, orderBy('timestamp', 'desc'), limit(100)));
      const migratedIds = new Set(migratedHead.docs.map((document) => document.id));
      const legacyMessages = allLegacyMessages.filter((message) => typeof message.id !== 'string' || !migratedIds.has(message.id));
      const start = Number(cursor.slice(7));
      const items = legacyMessages.slice(start, start + pageLimit);
      const nextOffset = start + items.length;
      const hasMore = nextOffset < legacyMessages.length;
      return { items, nextCursor: hasMore ? `legacy:${nextOffset}` : null, hasMore, clearedAt: clearedAtMillis };
    }

    const constraints: QueryConstraint[] = clearedAt ? [where('timestamp', '>', clearedAt), orderBy('timestamp', 'desc')] : [orderBy('timestamp', 'desc')];
    if (cursor) {
      const cursorDocument = await getDoc(doc(messagesCollection, cursor));
      if (cursorDocument.exists()) constraints.push(startAfter(cursorDocument));
    }
    const messageSnapshot = await getDocs(query(messagesCollection, ...constraints, limit(pageLimit + 1)));
    if (!messageSnapshot.empty) {
      const documents = messageSnapshot.docs.slice(0, pageLimit);
      const pageItems = documents.map((document) => ({ ...document.data(), id: document.id }));
      if (messageSnapshot.docs.length > pageLimit) {
        return { items: pageItems, nextCursor: documents.at(-1)?.id ?? null, hasMore: true, clearedAt: clearedAtMillis };
      }
      const messageIds = new Set(documents.map((document) => document.id));
      const legacyMessages = allLegacyMessages.filter((message) => typeof message.id !== 'string' || !messageIds.has(message.id));
      const legacyFill = legacyMessages.slice(0, Math.max(0, pageLimit - documents.length));
      const hasMore = legacyFill.length < legacyMessages.length;
      return { items: [...pageItems, ...legacyFill], nextCursor: hasMore ? `legacy:${legacyFill.length}` : null, hasMore, clearedAt: clearedAtMillis };
    }
    const items = allLegacyMessages.slice(0, pageLimit);
    const hasMore = items.length < allLegacyMessages.length;
    return { items, nextCursor: hasMore ? `legacy:${items.length}` : null, hasMore, clearedAt: clearedAtMillis };
  }

  // ── Sending (web POST /api/messaging) ──

  public async sendMessage(payload: OutgoingMessage): Promise<DocumentData> {
    const senderId = this.requireViewerId();
    const receiverId = payload.receiverId.trim();
    const text = payload.message.trim();
    if (!receiverId || (!text && !payload.attachment && !payload.stickerData && !payload.voiceNoteData)) throw new Error('Message content is required');

    const [sender, receiver] = await Promise.all([getDoc(doc(db, 'users', senderId)), getDoc(doc(db, 'users', receiverId))]);
    const restriction = this.messagingRestriction(sender.data());
    if (restriction) throw new Error(restriction);
    if (!receiver.exists()) throw new Error('Recipient not found');
    if (readStringList(sender.data()?.blockList).includes(receiverId) || readStringList(receiver.data().blockList).includes(senderId)) {
      throw new Error('Message cannot be sent due to active block restrictions');
    }

    const chatId = this.getChatId(senderId, receiverId);
    const sendKey = JSON.stringify([senderId, receiverId, text, payload.attachment ?? null, payload.stickerData ?? null, payload.voiceNoteData ?? null]);
    const messageId = this.pendingSendIds.get(sendKey) ?? createMessageId();
    this.pendingSendIds.set(sendKey, messageId);
    const timestamp = Timestamp.fromMillis(serverClockService.nowSync());
    const preview = this.previewFor(payload, text);
    const messageRecord: DocumentData = {
      id: messageId,
      senderId,
      receiverId,
      message: text,
      status: 'sent',
      timestamp,
      ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
      ...(payload.attachment ? { attachment: payload.attachment } : {}),
      ...(payload.stickerData ? { ...payload.stickerData, type: 'sticker' } : {}),
      ...(payload.voiceNoteData ? { ...payload.voiceNoteData, type: 'voiceNote' } : {}),
      ...(payload.isForwarded ? { isForwarded: true } : {}),
    };
    const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
    const alreadySent = await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(messageRef);
      if (existing.exists()) return true;
      transaction.set(messageRef, messageRecord);
      // 7.4: unread counts are per person (the old single unreadCount was shared by both people).
      transaction.set(doc(db, 'chats', chatId), { participants: [senderId, receiverId], lastMessageTime: timestamp, lastMessage: preview.preview, lastMessageSenderId: senderId, unreadCounts: { [receiverId]: increment(1) }, updatedAt: serverTimestamp() }, { merge: true });
      return false;
    });
    this.pendingSendIds.delete(sendKey);
    if (alreadySent) {
      const existing = await getDoc(messageRef);
      return { ...(existing.data() ?? messageRecord), id: messageId };
    }
    await this.updateConversationSummaries(chatId, senderId, sender.data() ?? {}, receiverId, receiver.data(), preview.preview, preview.type, timestamp);
    // The receiver's device notification is sent by the app's server; a failed push never fails the send.
    if (preview.type !== 'system') {
      void appServerService.call('sendMessagePush', { receiverId, message: preview.preview || 'Sent you a message' }).catch(() => undefined);
    }
    return messageRecord;
  }

  private previewFor(payload: OutgoingMessage, text: string): { preview: string; type: MessageType } {
    if (payload.voiceNoteData) return { preview: 'Voice note', type: 'voiceNote' };
    if (payload.stickerData) return { preview: 'Sticker', type: 'sticker' };
    if (payload.attachment) return { preview: payload.attachment.fileName || 'Attachment', type: 'attachment' };
    const sharedContent = sharedContentMessageService.parse(text);
    if (sharedContent) return { preview: sharedContent.summary, type: 'text' };
    return { preview: text, type: text.startsWith('[SYS:') ? 'system' : 'text' };
  }

  /** Web getModerationRestriction(userId, 'messaging'). */
  private messagingRestriction(user: DocumentData | undefined): string | null {
    if (!user) return null;
    const now = Date.now();
    if (user.accountStatus === 'banned' || user.isBanned === true) return readString(user.statusReason) || 'This account has been banned.';
    if (user.accountStatus === 'suspended' || user.isSuspended === true) {
      const suspendedUntil = readMillis(user.suspendedUntil);
      if (!suspendedUntil || suspendedUntil > now) return readString(user.statusReason) || 'This account is currently suspended.';
    }
    const restrictions = isRecord(user.accountRestrictions) ? user.accountRestrictions : {};
    const restrictionExpiry = readMillis(restrictions.expiresAt);
    if (restrictions.messaging === true && (!restrictionExpiry || restrictionExpiry > now)) return readString(restrictions.reason) || 'This account cannot use messaging right now.';
    if (user.isMessagingDisabled === true) {
      const messagingExpiry = readMillis(user.messagingDisabledUntil);
      if (!messagingExpiry || messagingExpiry > now) return readString(user.messagingDisabledReason) || 'Private messaging is temporarily disabled for this account.';
    }
    return null;
  }

  private async updateConversationSummaries(chatId: string, senderId: string, sender: DocumentData, receiverId: string, receiver: DocumentData, preview: string, messageType: MessageType, timestamp: Timestamp): Promise<void> {
    const [senderImage, receiverImage] = await Promise.all([this.resolvedProfileImage(senderId, sender), this.resolvedProfileImage(receiverId, receiver)]);
    const common = {
      chatId,
      lastMessagePreview: preview.slice(0, 240),
      lastMessageSenderId: senderId,
      lastMessageType: messageType,
      lastMessageTime: timestamp,
      lastActivityAt: timestamp,
      friendshipStatus: 'accepted',
      updatedAt: serverTimestamp(),
    };
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', senderId, 'conversationSummaries', receiverId), {
      ...common, peerId: receiverId, peerFirstName: readString(receiver.firstName), peerLastName: readString(receiver.lastName), peerUserName: readString(receiver.userName), peerProfileImage: receiverImage, unreadCount: 0,
    }, { merge: true });
    batch.set(doc(db, 'users', receiverId, 'conversationSummaries', senderId), {
      ...common, peerId: senderId, peerFirstName: readString(sender.firstName), peerLastName: readString(sender.lastName), peerUserName: readString(sender.userName), peerProfileImage: senderImage, unreadCount: increment(1),
    }, { merge: true });
    await batch.commit();
  }

  // ── Conversation state (web PATCH /api/messaging) ──

  public async updateConversation(peerId: string, action: ConversationAction = 'read', mutedUntil?: number | null): Promise<void> {
    const viewerId = this.requireViewerId();
    if (!peerId) throw new Error('peerId is required');
    const summaryRef = doc(db, 'users', viewerId, 'conversationSummaries', peerId);
    const setSummary = (fields: DocumentData) => writeBatch(db).set(summaryRef, { ...fields, updatedAt: serverTimestamp() }, { merge: true }).commit();
    if (action === 'unread') return setSummary({ unreadCount: 1 });
    if (action === 'archive' || action === 'unarchive') return setSummary({ isArchived: action === 'archive' });
    if (action === 'pin' || action === 'unpin') return setSummary({ isPinned: action === 'pin' });
    if (action === 'mute') return setSummary({ mutedUntil: typeof mutedUntil === 'number' ? mutedUntil : Number.MAX_SAFE_INTEGER });
    if (action === 'unmute') return setSummary({ mutedUntil: null });

    const chatRef = doc(db, 'chats', this.getChatId(viewerId, peerId));
    await this.markReceivedMessagesRead(chatRef, viewerId);
    const chat = await getDoc(chatRef);
    const batch = writeBatch(db);
    if (chat.exists()) batch.set(chatRef, { unreadCount: 0, unreadCounts: { [viewerId]: 0 }, updatedAt: serverTimestamp() }, { merge: true });
    batch.set(summaryRef, { unreadCount: 0, updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
    const legacyMessages = chat.exists() && Array.isArray(chat.data().messages) ? chat.data().messages.filter(isRecord) as Record<string, unknown>[] : [];
    if (legacyMessages.some((message) => message.receiverId === viewerId && message.status !== 'read')) {
      await updateDoc(chatRef, { messages: legacyMessages.map((message) => (message.receiverId === viewerId ? { ...message, status: 'read' } : message)) })
        .catch((error: unknown) => console.warn('[ChatDataService.updateConversation] Error:', error instanceof Error ? error.message : 'legacy read state not saved'));
    }
  }

  /** Marks all of the viewer's unread received messages as read, in batches, until none are left. */
  private async markReceivedMessagesRead(chatRef: DocumentReference, viewerId: string): Promise<void> {
    const messages = collection(chatRef, 'messages');
    for (let round = 0; round < READ_MAX_BATCHES; round += 1) {
      // Equality-only filters, so no composite index is needed.
      const unread = await getDocs(query(messages, where('receiverId', '==', viewerId), where('status', 'in', ['sent', 'delivered']), limit(READ_BATCH_SIZE)));
      if (unread.empty) return;
      const batch = writeBatch(db);
      unread.docs.forEach((message) => batch.update(message.ref, { status: 'read', readAt: serverTimestamp() }));
      await batch.commit();
      if (unread.size < READ_BATCH_SIZE) return;
    }
  }

  // ── Message actions (web POST /api/messaging/actions) ──

  public async applyMessageAction(payload: MessageAction): Promise<DocumentData | null> {
    const viewerId = this.requireViewerId();
    const chatRef = doc(db, 'chats', payload.chatId);
    const chat = await getDoc(chatRef);
    if (!chat.exists()) throw new Error('Conversation not found');
    const participants = readStringList(chat.data().participants);
    if (!participants.includes(viewerId)) throw new Error('Conversation access denied');
    const peerId = participants.find((participant) => participant !== viewerId);

    if (payload.action === 'clear') {
      const batch = writeBatch(db);
      batch.set(chatRef, { clearedAt: { [viewerId]: Timestamp.now() }, updatedAt: serverTimestamp() }, { merge: true });
      if (peerId) batch.delete(doc(db, 'users', viewerId, 'conversationSummaries', peerId));
      const existingMessages = await getDocs(query(collection(chatRef, 'messages'), limit(300)));
      existingMessages.docs.forEach((message) => {
        if (!readStringList(message.data().deletedFor).includes(viewerId)) batch.update(message.ref, { deletedFor: arrayUnion(viewerId) });
      });
      const legacyMessages = chat.data().messages;
      if (Array.isArray(legacyMessages)) {
        batch.set(chatRef, {
          messages: legacyMessages.map((message: unknown) => {
            if (!isRecord(message)) return message;
            const deletedFor = readStringList(message.deletedFor);
            return deletedFor.includes(viewerId) ? message : { ...message, deletedFor: [...deletedFor, viewerId] };
          }),
        }, { merge: true });
      }
      await batch.commit();
      return null;
    }

    const matches = (message: Record<string, unknown>): boolean => {
      if (payload.messageId && message.id === payload.messageId) return true;
      return Boolean(payload.timestampSeconds) && readSeconds(message.timestamp) === payload.timestampSeconds;
    };
    const legacyMessages = Array.isArray(chat.data().messages) ? chat.data().messages.filter(isRecord) as Record<string, unknown>[] : [];
    const messageDocument = payload.messageId ? await getDoc(doc(chatRef, 'messages', payload.messageId)) : null;
    const legacyTarget = legacyMessages.find(matches);
    const target: Record<string, unknown> | undefined = messageDocument?.exists() ? { id: messageDocument.id, ...messageDocument.data() } : legacyTarget;
    if (!target) throw new Error('Message not found');
    if ((payload.action === 'delete' && payload.deleteForEveryone) || payload.action === 'edit') {
      if (target.senderId !== viewerId) throw new Error('Only the sender can modify this message');
    }

    let nextTarget: Record<string, unknown>;
    if (payload.action === 'react') {
      const emoji = payload.emoji.trim();
      if (!emoji) throw new Error('Reaction is required');
      const reactions: Record<string, unknown> = isRecord(target.reactions) ? { ...target.reactions } : {};
      const existing = readStringList(reactions[emoji]);
      const updated = existing.includes(viewerId) ? existing.filter((userId) => userId !== viewerId) : [...existing, viewerId];
      if (updated.length === 0) delete reactions[emoji];
      else reactions[emoji] = updated;
      nextTarget = { ...target, reactions };
    } else if (payload.action === 'edit') {
      const createdAt = target.timestamp instanceof Timestamp ? target.timestamp.toMillis() : 0;
      if (!createdAt || serverClockService.nowSync() - createdAt > EDIT_WINDOW_MS || target.isDeletedForEveryone === true) throw new Error('This message can no longer be edited');
      const message = payload.message.trim();
      if (!message) throw new Error('Message is required');
      nextTarget = { ...target, message, isEdited: true, editedAt: Timestamp.now() };
    } else if (payload.deleteForEveryone) {
      nextTarget = { ...target, message: 'This message was deleted', isDeletedForEveryone: true, type: 'text' };
      ['attachment', 'stickerData', 'voiceNoteData', 'stickerUrl', 'audioUrl'].forEach((key) => delete nextTarget[key]);
    } else {
      nextTarget = { ...target, deletedFor: [...new Set([...readStringList(target.deletedFor), viewerId])] };
    }

    const batch = writeBatch(db);
    batch.update(chatRef, legacyTarget
      ? { messages: legacyMessages.map((message) => (message === legacyTarget ? nextTarget : message)), updatedAt: serverTimestamp() }
      : { updatedAt: serverTimestamp() });
    const messageId = readString(target.id) || payload.messageId;
    if (messageId) batch.set(doc(chatRef, 'messages', messageId), nextTarget, { merge: true });
    const lastMessageTime = chat.data().lastMessageTime;
    const isLatest = lastMessageTime instanceof Timestamp && lastMessageTime.seconds === readSeconds(target.timestamp);
    if (isLatest && payload.action !== 'react' && peerId) {
      const preview = readString(nextTarget.message).slice(0, 240);
      const ownSummary = doc(db, 'users', viewerId, 'conversationSummaries', peerId);
      if (payload.action === 'delete' && !payload.deleteForEveryone) {
        batch.set(ownSummary, { lastMessagePreview: '', updatedAt: serverTimestamp() }, { merge: true });
      } else {
        batch.set(ownSummary, { lastMessagePreview: preview, updatedAt: serverTimestamp() }, { merge: true });
        batch.set(doc(db, 'users', peerId, 'conversationSummaries', viewerId), { lastMessagePreview: preview, updatedAt: serverTimestamp() }, { merge: true });
        batch.set(chatRef, { lastMessage: preview }, { merge: true });
      }
    }
    await batch.commit();
    return nextTarget;
  }
}

export const chatDataService = ChatDataService.getInstance();
