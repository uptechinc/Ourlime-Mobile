import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { notificationHelpers } from '@/lib/helpers/notificationHelpers';
import type { RelationshipHubPage, RelationshipHubSection, RelationshipHubUser, RelationshipRequestDirection } from '@/lib/types/relationshipHub';

export type FriendProfile = { id: string; firstName: string; lastName: string; userName: string; profileImage?: string; relationshipId?: string; mutualFriendsCount: number };
export type BlockStatus = { isBlocked: boolean; isBlockedByFirstUser: boolean; isBlockedBySecondUser: boolean };

const readString = (value: unknown): string => (typeof value === 'string' ? value : '');
const friendshipStatusOf = (data: DocumentData): string => readString(data.friendshipStatus) || readString(data.status);
const chunk = <TValue>(values: TValue[], size = 30): TValue[][] => {
  const chunks: TValue[][] = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
};
const readMillis = (value: unknown): number | null => {
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis();
  return null;
};

/**
 * Friends, follows and blocks for the app, reading and writing Firestore directly with the same logic
 * as the website's /api/relationships/* and /api/profile/blocklist routes.
 */
export class RelationshipDataService {
  private static instance: RelationshipDataService;

  private constructor() {}

  public static getInstance(): RelationshipDataService {
    if (!RelationshipDataService.instance) RelationshipDataService.instance = new RelationshipDataService();
    return RelationshipDataService.instance;
  }

  private requireViewerId(): string {
    const viewerId = auth.currentUser?.uid;
    if (!viewerId) throw new Error('Authentication required');
    return viewerId;
  }

  // ── Blocking (web blockingServer + /api/profile/blocklist) ──

  public async getBlockStatus(firstUserId: string, secondUserId: string): Promise<BlockStatus> {
    if (!firstUserId || !secondUserId || firstUserId === secondUserId) return { isBlocked: false, isBlockedByFirstUser: false, isBlockedBySecondUser: false };
    const [first, second] = await Promise.all([getDoc(doc(db, 'users', firstUserId)), getDoc(doc(db, 'users', secondUserId))]);
    const firstList: unknown[] = Array.isArray(first.data()?.blockList) ? first.data()?.blockList : [];
    const secondList: unknown[] = Array.isArray(second.data()?.blockList) ? second.data()?.blockList : [];
    const isBlockedByFirstUser = firstList.includes(secondUserId);
    const isBlockedBySecondUser = secondList.includes(firstUserId);
    return { isBlocked: isBlockedByFirstUser || isBlockedBySecondUser, isBlockedByFirstUser, isBlockedBySecondUser };
  }

  public async blockUser(userIdToBlock: string): Promise<number> {
    const viewerId = this.requireViewerId();
    if (!userIdToBlock) throw new Error('User ID to block is required');
    if (userIdToBlock === viewerId) throw new Error('You cannot block yourself');
    const [target, fromViewer, fromTarget, viewerFollowing, targetFollowing] = await Promise.all([
      getDoc(doc(db, 'users', userIdToBlock)),
      getDocs(query(collection(db, 'friendship'), where('userId1', '==', viewerId), where('userId2', '==', userIdToBlock))),
      getDocs(query(collection(db, 'friendship'), where('userId1', '==', userIdToBlock), where('userId2', '==', viewerId))),
      getDocs(query(collection(db, 'followers'), where('followerId', '==', viewerId), where('followeeId', '==', userIdToBlock))),
      getDocs(query(collection(db, 'followers'), where('followerId', '==', userIdToBlock), where('followeeId', '==', viewerId))),
    ]);
    if (!target.exists()) throw new Error('User to block was not found');
    const related = [...fromViewer.docs, ...fromTarget.docs, ...viewerFollowing.docs, ...targetFollowing.docs];
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', viewerId), { blockList: arrayUnion(userIdToBlock) });
    related.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    await this.removeConversationSummaries(viewerId, userIdToBlock);
    return related.length;
  }

  public async unblockUser(userIdToUnblock: string): Promise<void> {
    const viewerId = this.requireViewerId();
    if (!userIdToUnblock) throw new Error('User ID to unblock is required');
    await updateDoc(doc(db, 'users', viewerId), { blockList: arrayRemove(userIdToUnblock) });
  }

  // ── Friend requests (web POST /api/relationships/friends) ──

  private async findFriendship(userId1: string, userId2: string): Promise<QueryDocumentSnapshot | null> {
    const [forward, reverse] = await Promise.all([
      getDocs(query(collection(db, 'friendship'), where('userId1', '==', userId1), where('userId2', '==', userId2), limit(1))),
      getDocs(query(collection(db, 'friendship'), where('userId1', '==', userId2), where('userId2', '==', userId1), limit(1))),
    ]);
    return forward.docs[0] ?? reverse.docs[0] ?? null;
  }

  /**
   * Sends a friend request. An earlier declined or cancelled request is reopened instead of blocking the new one
   * (the website refuses forever once any record exists), and a request already sent counts as sent.
   */
  public async sendFriendRequest(receiverId: string): Promise<void> {
    const senderId = this.requireViewerId();
    if (!receiverId || receiverId === senderId) throw new Error('A valid user is required.');
    if ((await this.getBlockStatus(senderId, receiverId)).isBlocked) throw new Error('You cannot connect with this user because one of you has blocked the other.');
    const existing = await this.findFriendship(senderId, receiverId);
    if (existing) {
      const status = friendshipStatusOf(existing.data());
      if (status === 'accepted') throw new Error('You are already friends.');
      if (status === 'pending' && existing.data().userId1 === senderId) return;
      if (status === 'pending') throw new Error('This person already sent you a friend request. Accept it from your friend requests.');
      await updateDoc(existing.ref, { userId1: senderId, userId2: receiverId, friendshipStatus: 'pending', typeOfFriendship: 'friend', updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, 'friendship'), {
        userId1: senderId, userId2: receiverId, friendshipStatus: 'pending', typeOfFriendship: 'friend', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }
    await notificationHelpers.createFriendRequestNotification(receiverId, senderId).catch(() => false);
  }

  /** The viewer accepts or declines a request that requesterId sent them. */
  public async respondToFriendRequest(requesterId: string, action: 'accept' | 'decline'): Promise<void> {
    const viewerId = this.requireViewerId();
    if (action === 'accept' && (await this.getBlockStatus(requesterId, viewerId)).isBlocked) {
      throw new Error('You cannot connect with this user because one of you has blocked the other.');
    }
    const friendship = await this.findFriendship(requesterId, viewerId);
    if (!friendship) throw new Error('Friendship not found');
    const status = action === 'accept' ? 'accepted' : 'declined';
    await updateDoc(friendship.ref, { friendshipStatus: status, updatedAt: serverTimestamp() });
    if (status === 'accepted') {
      await Promise.all([
        notificationHelpers.createFriendAcceptedNotification(requesterId, viewerId).catch(() => false),
        this.ensureFriendConversationSummaries(requesterId, viewerId),
      ]);
    } else {
      await Promise.all([
        this.removeFriendRequestNotification(viewerId, requesterId),
        this.removeFriendRequestNotification(requesterId, viewerId),
        notificationHelpers.createFriendRequestDeclinedNotification(requesterId, viewerId).catch(() => false),
      ]);
    }
  }

  /** Web 'cancel' / 'remove' actions: delete the friendship and clean up both sides. */
  public async cancelOrRemoveFriendship(otherUserId: string): Promise<void> {
    const viewerId = this.requireViewerId();
    const friendship = await this.findFriendship(viewerId, otherUserId);
    const batch = writeBatch(db);
    if (friendship) batch.delete(friendship.ref);
    const plural = await getDocs(query(collection(db, 'friendships'), where('users', 'array-contains', viewerId))).catch(() => null);
    plural?.docs.filter((entry) => (Array.isArray(entry.data().users) ? entry.data().users as unknown[] : []).includes(otherUserId)).forEach((entry) => batch.delete(entry.ref));
    await batch.commit();
    await Promise.all([
      this.removeFriendRequestNotification(otherUserId, viewerId),
      this.removeFriendRequestNotification(viewerId, otherUserId),
      this.removeConversationSummaries(viewerId, otherUserId),
    ]);
  }

  // ── Friends list and stats (web /api/relationships/status) ──

  public async getFriends(userId: string): Promise<FriendProfile[]> {
    const [asFirst, asSecond, blocked] = await Promise.all([
      getDocs(query(collection(db, 'friendship'), where('userId1', '==', userId), where('friendshipStatus', '==', 'accepted'))),
      getDocs(query(collection(db, 'friendship'), where('userId2', '==', userId), where('friendshipStatus', '==', 'accepted'))),
      this.getBlockedUserIds(userId),
    ]);
    const friendshipByFriend = new Map<string, QueryDocumentSnapshot>();
    [...asFirst.docs, ...asSecond.docs].forEach((friendship) => {
      const data = friendship.data();
      const friendId = data.userId1 === userId ? readString(data.userId2) : readString(data.userId1);
      if (friendId && !blocked.has(friendId)) friendshipByFriend.set(friendId, friendship);
    });
    const friendIds = [...friendshipByFriend.keys()];
    const [mutualCounts, pictures] = await Promise.all([this.getMutualFriendCounts(userId, friendIds), this.loadProfilePictures(friendIds)]);
    const users = await Promise.all(friendIds.map((friendId) => getDoc(doc(db, 'users', friendId)).catch(() => null)));
    return users.flatMap((snapshot): FriendProfile[] => {
      if (!snapshot?.exists()) return [];
      const user = snapshot.data();
      const direct = typeof user.profileImage === 'string' ? user.profileImage
        : user.profileImage && typeof user.profileImage === 'object' && typeof user.profileImage.imageURL === 'string' ? user.profileImage.imageURL
          : readString(user.avatar) || readString(user.photoURL) || readString(user.profilePicture);
      return [{
        id: snapshot.id,
        firstName: readString(user.firstName),
        lastName: readString(user.lastName),
        userName: readString(user.userName),
        profileImage: direct || pictures.get(snapshot.id) || undefined,
        relationshipId: friendshipByFriend.get(snapshot.id)?.id,
        mutualFriendsCount: mutualCounts.get(snapshot.id) ?? 0,
      }];
    });
  }

  public async getNetworkStats(userId: string): Promise<{ friends: number; followers: number; following: number }> {
    const [asFirst, asSecond, followers, following] = await Promise.all([
      getDocs(query(collection(db, 'friendship'), where('userId1', '==', userId), where('friendshipStatus', '==', 'accepted'))),
      getDocs(query(collection(db, 'friendship'), where('userId2', '==', userId), where('friendshipStatus', '==', 'accepted'))),
      getDocs(query(collection(db, 'followers'), where('followeeId', '==', userId))),
      getDocs(query(collection(db, 'followers'), where('followerId', '==', userId))),
    ]);
    return { friends: new Set([...asFirst.docs, ...asSecond.docs].map((entry) => entry.id)).size, followers: followers.size, following: following.size };
  }

  private async getBlockedUserIds(userId: string): Promise<Set<string>> {
    const [user, blockedBy] = await Promise.all([
      getDoc(doc(db, 'users', userId)).catch(() => null),
      getDocs(query(collection(db, 'users'), where('blockList', 'array-contains', userId))).catch(() => null),
    ]);
    const ids = new Set<string>(Array.isArray(user?.data()?.blockList) ? (user?.data()?.blockList as unknown[]).filter((id): id is string => typeof id === 'string') : []);
    blockedBy?.docs.forEach((entry) => ids.add(entry.id));
    return ids;
  }

  private async getMutualFriendCounts(viewerId: string, friendIds: string[]): Promise<Map<string, number>> {
    const counts = new Map(friendIds.map((friendId) => [friendId, 0]));
    if (friendIds.length === 0) return counts;
    const friendSet = new Set(friendIds);
    const snapshots = await Promise.all(chunk(friendIds).flatMap((ids) => [
      getDocs(query(collection(db, 'friendship'), where('userId1', 'in', ids))),
      getDocs(query(collection(db, 'friendship'), where('userId2', 'in', ids))),
    ]));
    const unique = new Map(snapshots.flatMap((snapshot) => snapshot.docs).map((entry) => [entry.id, entry.data()]));
    unique.forEach((friendship) => {
      if (friendshipStatusOf(friendship) !== 'accepted') return;
      const first = readString(friendship.userId1);
      const second = readString(friendship.userId2);
      if (first === viewerId || second === viewerId) return;
      if (friendSet.has(first) && friendSet.has(second)) {
        counts.set(first, (counts.get(first) ?? 0) + 1);
        counts.set(second, (counts.get(second) ?? 0) + 1);
      }
    });
    return counts;
  }

  private async loadProfilePictures(userIds: string[]): Promise<Map<string, string>> {
    const pictures = new Map<string, string>();
    const selections = await Promise.all(chunk(userIds).map((ids) => getDocs(query(collection(db, 'profileImageSetAs'), where('userId', 'in', ids), where('setAs', '==', 'profile'))).catch(() => null)));
    const ownerByImage = new Map<string, string>();
    selections.forEach((snapshot) => snapshot?.docs.forEach((entry) => {
      const imageId = readString(entry.data().profileImageId);
      if (imageId) ownerByImage.set(imageId, readString(entry.data().userId));
    }));
    const images = await Promise.all([...ownerByImage.keys()].map((imageId) => getDoc(doc(db, 'profileImages', imageId)).catch(() => null)));
    images.forEach((image) => {
      const url = readString(image?.data()?.imageURL);
      const owner = image ? ownerByImage.get(image.id) : undefined;
      if (owner && url) pictures.set(owner, url);
    });
    return pictures;
  }

  // ── Relationship hub (web GET /api/relationships/hub) ──

  public async getHubPage(ownerId: string, section: RelationshipHubSection, options: { cursor?: string | null; limit?: number; direction?: RelationshipRequestDirection; search?: string } = {}): Promise<RelationshipHubPage> {
    const viewerId = this.requireViewerId();
    if ((section === 'requests' || section === 'suggestions') && ownerId !== viewerId) throw new Error('This section is private');
    const pageLimit = Math.min(Math.max(options.limit ?? 30, 1), 50);
    const offset = Math.max(Number(options.cursor) || 0, 0);
    const searchTerm = (options.search ?? '').trim().toLowerCase().slice(0, 100);
    const [asFirst, asSecond, following, followers] = await Promise.all([
      getDocs(query(collection(db, 'friendship'), where('userId1', '==', ownerId))),
      getDocs(query(collection(db, 'friendship'), where('userId2', '==', ownerId))),
      getDocs(query(collection(db, 'followers'), where('followerId', '==', ownerId))),
      getDocs(query(collection(db, 'followers'), where('followeeId', '==', ownerId))),
    ]);
    const friendships = [...asFirst.docs, ...asSecond.docs];
    const relatedIds = new Set<string>([ownerId]);
    friendships.forEach((entry) => relatedIds.add(entry.data().userId1 === ownerId ? readString(entry.data().userId2) : readString(entry.data().userId1)));

    type Candidate = { userId: string; relationshipId?: string; direction: 'incoming' | 'outgoing' | 'none' };
    let candidates: Candidate[] = [];
    if (section === 'friends' || section === 'active') {
      candidates = friendships.flatMap((entry): Candidate[] => (friendshipStatusOf(entry.data()) === 'accepted'
        ? [{ userId: entry.data().userId1 === ownerId ? readString(entry.data().userId2) : readString(entry.data().userId1), relationshipId: entry.id, direction: 'none' }] : []));
    } else if (section === 'requests') {
      candidates = friendships.flatMap((entry): Candidate[] => {
        if (friendshipStatusOf(entry.data()) !== 'pending') return [];
        const incoming = entry.data().userId2 === ownerId;
        return [{ userId: incoming ? readString(entry.data().userId1) : readString(entry.data().userId2), relationshipId: entry.id, direction: incoming ? 'incoming' : 'outgoing' }];
      }).sort((left, right) => (left.direction === right.direction ? 0 : left.direction === 'incoming' ? -1 : 1));
    } else if (section === 'following') {
      candidates = following.docs.map((entry) => ({ userId: readString(entry.data().followeeId), relationshipId: entry.id, direction: 'none' }));
    } else if (section === 'followers') {
      candidates = followers.docs.map((entry) => ({ userId: readString(entry.data().followerId), relationshipId: entry.id, direction: 'none' }));
    } else {
      following.docs.forEach((entry) => relatedIds.add(readString(entry.data().followeeId)));
      const users = await getDocs(query(collection(db, 'users'), limit(150)));
      candidates = users.docs.filter((entry) => !relatedIds.has(entry.id)).map((entry) => ({ userId: entry.id, direction: 'none' }));
    }

    let filtered = [...new Map(candidates.filter((candidate) => candidate.userId).map((candidate) => [candidate.userId, candidate])).values()];
    if (section === 'requests' && options.direction) filtered = filtered.filter((candidate) => candidate.direction === options.direction);
    if (searchTerm && filtered.length > 0) {
      const searchable = await Promise.all(filtered.map((candidate) => getDoc(doc(db, 'users', candidate.userId)).catch(() => null)));
      const matching = new Set(searchable.filter((snapshot) => {
        const user = snapshot?.data() ?? {};
        return `${readString(user.firstName)} ${readString(user.lastName)} ${readString(user.userName)}`.toLowerCase().includes(searchTerm);
      }).map((snapshot) => snapshot?.id));
      filtered = filtered.filter((candidate) => matching.has(candidate.userId));
    }
    const page = filtered.slice(offset, offset + pageLimit + 1);
    const visible = page.slice(0, pageLimit);
    const ownerFriendIds = new Set(friendships.flatMap((entry): string[] => (friendshipStatusOf(entry.data()) === 'accepted'
      ? [entry.data().userId1 === ownerId ? readString(entry.data().userId2) : readString(entry.data().userId1)] : [])));
    const candidateFriends = new Map<string, Set<string>>(visible.map((candidate) => [candidate.userId, new Set<string>()]));
    for (const ids of chunk(visible.map((candidate) => candidate.userId))) {
      const [first, second] = await Promise.all([
        getDocs(query(collection(db, 'friendship'), where('userId1', 'in', ids))),
        getDocs(query(collection(db, 'friendship'), where('userId2', 'in', ids))),
      ]);
      [...first.docs, ...second.docs].forEach((entry) => {
        const data = entry.data();
        if (friendshipStatusOf(data) !== 'accepted') return;
        candidateFriends.get(readString(data.userId1))?.add(readString(data.userId2));
        candidateFriends.get(readString(data.userId2))?.add(readString(data.userId1));
      });
    }
    const [users, settings] = await Promise.all([
      Promise.all(visible.map((candidate) => getDoc(doc(db, 'users', candidate.userId)).catch(() => null))),
      Promise.all(visible.map((candidate) => getDoc(doc(db, 'users', candidate.userId, 'userSettings', 'account')).catch(() => null))),
    ]);
    const now = Date.now();
    const items = visible.flatMap((candidate, index): RelationshipHubUser[] => {
      const snapshot = users[index];
      if (!snapshot?.exists()) return [];
      const user = snapshot.data();
      if (user.disabled === true || user.deletedAt) return [];
      const activityStatus = settings[index]?.data()?.activityStatus !== false;
      const lastActiveMs = readMillis(user.lastActive);
      const online = activityStatus && user.onlineStatus === 'online' && typeof lastActiveMs === 'number' && now - lastActiveMs < 120_000;
      if (section === 'active' && !online) return [];
      return [{
        id: snapshot.id,
        firstName: readString(user.firstName),
        lastName: readString(user.lastName),
        userName: readString(user.userName),
        profileImage: readString(user.profilePicture) || readString(user.profileImage) || undefined,
        relationshipId: candidate.relationshipId,
        direction: candidate.direction,
        mutualCount: [...(candidateFriends.get(candidate.userId) ?? [])].filter((friendId) => ownerFriendIds.has(friendId)).length,
        presence: { status: online ? 'online' : 'offline', lastActiveMs: activityStatus ? lastActiveMs : null, activityStatus },
        permissions: {
          accept: section === 'requests' && candidate.direction === 'incoming',
          decline: section === 'requests' && candidate.direction === 'incoming',
          cancel: section === 'requests' && candidate.direction === 'outgoing',
          remove: section === 'friends' || section === 'active',
          follow: section === 'suggestions' || section === 'followers',
          unfollow: section === 'following',
        },
      }];
    });
    const hasMore = page.length > pageLimit;
    return { items, nextCursor: hasMore ? String(offset + pageLimit) : null, hasMore };
  }

  // ── Chat summaries and stale notifications (web conversationSummaryServer / notificationServer) ──

  public async ensureFriendConversationSummaries(firstUserId: string, secondUserId: string): Promise<void> {
    const [first, second, pictures] = await Promise.all([
      getDoc(doc(db, 'users', firstUserId)),
      getDoc(doc(db, 'users', secondUserId)),
      this.loadProfilePictures([firstUserId, secondUserId]),
    ]);
    if (!first.exists() || !second.exists()) return;
    const chatId = [firstUserId, secondUserId].sort().join('_');
    const activity = Timestamp.now();
    const summaryFor = (peerId: string, peer: DocumentData) => ({
      chatId, peerId, peerFirstName: readString(peer.firstName), peerLastName: readString(peer.lastName), peerUserName: readString(peer.userName),
      peerProfileImage: pictures.get(peerId) || readString(peer.profilePicture) || readString(peer.profileImage) || null,
      friendshipStatus: 'accepted', unreadCount: 0, lastActivityAt: activity, updatedAt: serverTimestamp(),
    });
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', firstUserId, 'conversationSummaries', secondUserId), summaryFor(secondUserId, second.data()), { merge: true });
    batch.set(doc(db, 'users', secondUserId, 'conversationSummaries', firstUserId), summaryFor(firstUserId, first.data()), { merge: true });
    await batch.commit();
  }

  public async removeConversationSummaries(firstUserId: string, secondUserId: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', firstUserId, 'conversationSummaries', secondUserId));
    batch.delete(doc(db, 'users', secondUserId, 'conversationSummaries', firstUserId));
    await batch.commit();
  }

  /** Removes the friend-request notification actorUserId sent targetUserId (all three storage shapes). */
  public async removeFriendRequestNotification(targetUserId: string, actorUserId: string): Promise<void> {
    if (!targetUserId || !actorUserId) return;
    const parentRef = doc(db, 'userNotifications', targetUserId);
    const [items, parent, root] = await Promise.all([
      getDocs(query(collection(parentRef, 'items'), where('type', '==', 'friend_request'))).catch(() => null),
      getDoc(parentRef).catch(() => null),
      getDocs(query(collection(db, 'notifications'), where('userId', '==', targetUserId), where('type', '==', 'friend_request'))).catch(() => null),
    ]);
    const matchesActor = (data: DocumentData) => {
      const metadata = data.metadata ?? {};
      const sourceId = metadata.sourceUserId || metadata.sourceId || metadata.userId || metadata.senderId;
      return sourceId === actorUserId || (typeof data.message === 'string' && data.message.includes(actorUserId));
    };
    const batch = writeBatch(db);
    let unreadDecrement = 0;
    let hasOperations = false;
    items?.docs.forEach((entry) => {
      if (!matchesActor(entry.data())) return;
      if (!entry.data().isRead) unreadDecrement += 1;
      batch.delete(entry.ref);
      hasOperations = true;
    });
    const map: { [id: string]: DocumentData } = parent?.exists() && parent.data().notificationsMap ? parent.data().notificationsMap : {};
    const mapUpdates: { [field: string]: ReturnType<typeof deleteField> } = {};
    Object.entries(map).forEach(([id, notification]) => {
      if (notification.type !== 'friend_request' || !matchesActor(notification)) return;
      mapUpdates[`notificationsMap.${id}`] = deleteField();
      if (!notification.isRead) unreadDecrement += 1;
    });
    if (Object.keys(mapUpdates).length > 0) { batch.update(parentRef, mapUpdates); hasOperations = true; }
    root?.docs.forEach((entry) => { if (matchesActor(entry.data())) { batch.delete(entry.ref); hasOperations = true; } });
    if (unreadDecrement > 0) { batch.set(parentRef, { unreadCount: increment(-unreadDecrement) }, { merge: true }); hasOperations = true; }
    if (hasOperations) await batch.commit();
  }
}

export const relationshipDataService = RelationshipDataService.getInstance();
