import { ApiService } from './ApiService';
import { auth, db } from '@/lib/firebaseConfig';
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  addDoc,
  limit,
  serverTimestamp,
} from 'firebase/firestore';

type RelationshipActionResponse = {
  success: boolean;
  error?: string;
  message?: string;
};

export type RelationshipUser = { id: string; firstName: string; lastName: string; userName: string; profileImage?: string };
export type RelationshipSuggestion = RelationshipUser & { reason?: string };
export type RelationshipNetworkStats = { friends: number; followers: number; following: number };
type RelationshipSource = {
  id?: unknown;
  userId?: unknown;
  uid?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  userName?: unknown;
  profileImage?: unknown;
  profilePicture?: unknown;
  reason?: unknown;
};
const isRelationshipSource = (value: unknown): value is RelationshipSource => typeof value === 'object' && value !== null && !Array.isArray(value);
const readString = (value: unknown): string => typeof value === 'string' ? value : '';

export class RelationshipService {
  private static instance: RelationshipService;
  private readonly apiService = ApiService.getInstance();

  private constructor() {}

  public static getInstance(): RelationshipService {
    if (!RelationshipService.instance) RelationshipService.instance = new RelationshipService();
    return RelationshipService.instance;
  }

  public async setFollowing(followerId: string, followeeId: string, shouldFollow: boolean): Promise<void> {
    const response = await this.apiService.request<RelationshipActionResponse>('/api/relationships/followers', {
      method: 'POST',
      authenticated: true,
      body: { followerId, followeeId, action: shouldFollow ? 'follow' : 'unfollow' },
    });
    if (!response.success) throw new Error(response.error || response.message || 'Failed to update follow status');
  }

  public async sendFriendRequest(userId1: string, userId2: string): Promise<void> {
    try {
      const response = await this.apiService.request<RelationshipActionResponse>('/api/relationships/friends', {
        method: 'POST',
        authenticated: true,
        body: { userId1, userId2, action: 'send-request' },
        timeoutMs: 18_000,
      });
      if (!response.success) throw new Error(response.error || response.message || 'Failed to send friend request');
    } catch {
      const [asFirst, asSecond] = await Promise.all([
        getDocs(query(collection(db, 'friendship'), where('userId1', '==', userId1))),
        getDocs(query(collection(db, 'friendship'), where('userId2', '==', userId1))),
      ]);
      const existing = [...asFirst.docs, ...asSecond.docs].find((document) => {
        const relationship = document.data();
        return (relationship.userId1 === userId1 && relationship.userId2 === userId2)
          || (relationship.userId1 === userId2 && relationship.userId2 === userId1);
      });
      if (existing) {
        await updateDoc(existing.ref, {
          friendshipStatus: 'pending',
          status: 'pending',
          updatedAt: serverTimestamp(),
        });
        return;
      }
      await addDoc(collection(db, 'friendship'), {
        userId1,
        userId2,
        friendshipStatus: 'pending',
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  public async respondToFriendRequest(requesterId: string, viewerId: string, action: 'accept' | 'decline'): Promise<void> {
    const response = await this.apiService.request<RelationshipActionResponse>('/api/relationships/friends', {
      method: 'POST',
      authenticated: true,
      body: { userId1: requesterId, userId2: viewerId, action },
    });
    if (!response.success) throw new Error(response.error || response.message || `Failed to ${action} friend request`);
  }

  public async getSuggestions(maxResults = 6): Promise<RelationshipSuggestion[]> {
    return this.getSuggestionsFromFirestore(maxResults);
  }

  private normalizeSuggestions(values: unknown[]): RelationshipSuggestion[] {
    return values.flatMap((value): RelationshipSuggestion[] => {
      if (!isRelationshipSource(value)) return [];
      const id = readString(value.id) || readString(value.userId) || readString(value.uid);
      if (!id) return [];
      const profileImage = readString(value.profileImage) || readString(value.profilePicture);
      const reason = readString(value.reason);
      return [{
        id,
        firstName: readString(value.firstName),
        lastName: readString(value.lastName),
        userName: readString(value.userName),
        profileImage: profileImage || undefined,
        reason: reason || undefined,
      }];
    });
  }

  private async getSuggestionsFromFirestore(maxResults: number): Promise<RelationshipSuggestion[]> {
    const viewerId = auth.currentUser?.uid;
    if (!viewerId) return [];
    const [viewerDocument, asFirst, asSecond, pluralFriendships, usersSnapshot] = await Promise.all([
      getDoc(doc(db, 'users', viewerId)),
      getDocs(query(collection(db, 'friendship'), where('userId1', '==', viewerId))),
      getDocs(query(collection(db, 'friendship'), where('userId2', '==', viewerId))),
      getDocs(query(collection(db, 'friendships'), where('users', 'array-contains', viewerId))).catch(() => null),
      getDocs(query(collection(db, 'users'), limit(Math.max(maxResults * 6, 30)))),
    ]);
    const excludedIds = new Set<string>([viewerId]);
    [...asFirst.docs, ...asSecond.docs].forEach((document) => {
      const relationship = document.data();
      const otherId = relationship.userId1 === viewerId ? readString(relationship.userId2) : readString(relationship.userId1);
      if (otherId) excludedIds.add(otherId);
    });
    if (pluralFriendships) {
      pluralFriendships.docs.forEach((d) => {
        const users = d.data().users as string[] | undefined;
        if (Array.isArray(users)) {
          users.forEach((u) => { if (u && u !== viewerId) excludedIds.add(u); });
        }
      });
    }
    const viewerCountry = readString(viewerDocument.data()?.country);
    const candidates = usersSnapshot.docs
      .filter((document) => !excludedIds.has(document.id))
      .filter((document) => {
        const user = document.data();
        return user.deletedAt == null
          && user.disabled !== true
          && user.isPrivate !== true
          && readString(user.accountPrivacy) !== 'private'
          && readString(user.visibility) !== 'private';
      })
      .slice(0, maxResults);

    return Promise.all(candidates.map(async (document): Promise<RelationshipSuggestion> => {
      const user = document.data();
      const imageSelections = await getDocs(
        query(collection(db, 'profileImageSetAs'), where('userId', '==', document.id)),
      ).catch(() => null);
      const preferredSelection = imageSelections?.docs.find((selection) => selection.data().setAs === 'profile')
        ?? imageSelections?.docs.find((selection) => selection.data().setAs === 'postProfile');
      const imageId = preferredSelection ? readString(preferredSelection.data().profileImageId) : '';
      const imageDocument = imageId
        ? await getDoc(doc(db, 'profileImages', imageId)).catch(() => null)
        : null;
      const profileImage = readString(imageDocument?.data()?.imageURL)
        || readString(imageDocument?.data()?.imageUrl)
        || readString(user.profilePicture)
        || readString(user.profileImage);
      const sameCountry = Boolean(viewerCountry && viewerCountry === readString(user.country));
      return {
        id: document.id,
        firstName: readString(user.firstName),
        lastName: readString(user.lastName),
        userName: readString(user.userName),
        profileImage: profileImage || undefined,
        reason: sameCountry ? 'People near you' : 'Suggested for you',
      };
    }));
  }

  public async blockUser(userIdToBlock: string): Promise<void> {
    const response = await this.apiService.request<RelationshipActionResponse>('/api/profile/blocklist', {
      method: 'POST',
      authenticated: true,
      body: { userIdToBlock },
    });
    if (!response.success) throw new Error(response.error || response.message || 'Failed to block user');
  }

  public async unblockUser(userIdToUnblock: string): Promise<void> {
    const response = await this.apiService.request<RelationshipActionResponse>('/api/profile/blocklist', {
      method: 'DELETE',
      authenticated: true,
      body: { userIdToUnblock },
    });
    if (!response.success) throw new Error(response.error || response.message || 'Failed to unblock user');
  }

  public async cancelOrRemoveFriend(userId1: string, userId2: string, status: 'pending' | 'accepted'): Promise<void> {
    const response = await this.apiService.request<RelationshipActionResponse>('/api/relationships/friends', {
      method: 'POST',
      authenticated: true,
      body: { userId1, userId2, action: status === 'pending' ? 'cancel' : 'remove' },
    });
    if (!response.success) throw new Error(response.error || response.message || 'Failed to update friendship');
  }

  /**
   * Block a user directly in Firestore (`users/{currentUserId}.blockList`)
   */
  public async blockUserFirestore(currentUserId: string, targetUserId: string): Promise<void> {
    const userRef = doc(db, 'users', currentUserId);
    await updateDoc(userRef, {
      blockList: arrayUnion(targetUserId),
    });
  }

  /**
   * Unblock a user directly in Firestore (`users/{currentUserId}.blockList`)
   */
  public async unblockUserFirestore(currentUserId: string, targetUserId: string): Promise<void> {
    const userRef = doc(db, 'users', currentUserId);
    await updateDoc(userRef, {
      blockList: arrayRemove(targetUserId),
    });
  }

  /**
   * Remove a friend relationship from Firestore
   */
  public async removeFriendFirestore(currentUserId: string, targetUserId: string): Promise<void> {
    const q1 = query(
      collection(db, 'friendship'),
      where('userId1', '==', currentUserId),
      where('userId2', '==', targetUserId)
    );
    const q2 = query(
      collection(db, 'friendship'),
      where('userId1', '==', targetUserId),
      where('userId2', '==', currentUserId)
    );

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    const docsToDelete = [...snap1.docs, ...snap2.docs];
    for (const d of docsToDelete) {
      await deleteDoc(d.ref);
    }
  }

  /**
   * Check if either user has blocked the other
   */
  public async checkBlockStatus(currentUserId: string, targetUserId: string): Promise<{ isBlockedByMe: boolean; isBlockedByOther: boolean }> {
    try {
      const [myDoc, targetDoc] = await Promise.all([
        getDoc(doc(db, 'users', currentUserId)),
        getDoc(doc(db, 'users', targetUserId)),
      ]);

      const myBlockList: string[] = myDoc.data()?.blockList || [];
      const targetBlockList: string[] = targetDoc.data()?.blockList || [];

      return {
        isBlockedByMe: myBlockList.includes(targetUserId),
        isBlockedByOther: targetBlockList.includes(currentUserId),
      };
    } catch {
      return { isBlockedByMe: false, isBlockedByOther: false };
    }
  }

  public async getFriends(userId: string): Promise<RelationshipUser[]> {
    if (auth.currentUser?.uid === userId) return this.getOwnFriendsFromFirestore(userId);
    const response = await this.apiService.request<{ success: boolean; data?: unknown[]; error?: string }>(
      `/api/relationships/status?userId=${encodeURIComponent(userId)}&type=friends`,
      { authenticated: true, timeoutMs: 18_000 }
    );
    if (!response.success) throw new Error(response.error || 'Failed to load friends');
    return this.normalizeFriends(response.data ?? []);
  }

  private normalizeFriends(values: unknown[]): RelationshipUser[] {
    return values.flatMap((value): RelationshipUser[] => {
      if (!isRelationshipSource(value)) return [];
      const id = readString(value.id) || readString(value.userId);
      const userName = readString(value.userName);
      const firstName = readString(value.firstName);
      const lastName = readString(value.lastName);
      const profileImage = readString(value.profileImage) || readString(value.profilePicture);
      if (!id) return [];
      return [{ id, firstName, lastName, userName, profileImage }];
    });
  }

  private async getOwnFriendsFromFirestore(userId: string): Promise<RelationshipUser[]> {
    const [asFirst, asSecond] = await Promise.all([
      getDocs(query(collection(db, 'friendship'), where('userId1', '==', userId))),
      getDocs(query(collection(db, 'friendship'), where('userId2', '==', userId))),
    ]);
    const friendIds = new Set<string>();
    [...asFirst.docs, ...asSecond.docs].forEach((document) => {
      const relationship = document.data();
      const status = readString(relationship.friendshipStatus) || readString(relationship.status);
      if (status !== 'accepted') return;
      const friendId = relationship.userId1 === userId
        ? readString(relationship.userId2)
        : readString(relationship.userId1);
      if (friendId) friendIds.add(friendId);
    });

    const friends = await Promise.all([...friendIds].map(async (friendId): Promise<RelationshipUser | null> => {
      const userDocument = await getDoc(doc(db, 'users', friendId));
      if (!userDocument.exists()) return null;
      const user = userDocument.data();
      const profileImage = await this.resolveProfileImage(friendId, user.profilePicture, user.profileImage);
      return {
        id: friendId,
        firstName: readString(user.firstName),
        lastName: readString(user.lastName),
        userName: readString(user.userName),
        profileImage: profileImage || undefined,
      };
    }));
    return friends.filter((friend): friend is RelationshipUser => friend !== null);
  }

  private async resolveProfileImage(userId: string, profilePicture: unknown, profileImage: unknown): Promise<string> {
    const imageSelections = await getDocs(
      query(collection(db, 'profileImageSetAs'), where('userId', '==', userId)),
    ).catch(() => null);
    const preferredSelection = imageSelections?.docs.find((selection) => selection.data().setAs === 'profile')
      ?? imageSelections?.docs.find((selection) => selection.data().setAs === 'postProfile');
    const imageId = preferredSelection ? readString(preferredSelection.data().profileImageId) : '';
    const imageDocument = imageId
      ? await getDoc(doc(db, 'profileImages', imageId)).catch(() => null)
      : null;
    return readString(imageDocument?.data()?.imageURL)
      || readString(imageDocument?.data()?.imageUrl)
      || readString(profilePicture)
      || readString(profileImage);
  }

  public async getNetworkStats(userId: string): Promise<RelationshipNetworkStats> {
    try {
      return await this.getNetworkStatsFromFirestore(userId);
    } catch {
      try {
        const response = await this.apiService.request<{ success: boolean; data?: Partial<RelationshipNetworkStats>; error?: string }>(
          `/api/relationships/status?userId1=${encodeURIComponent(userId)}&userId2=${encodeURIComponent(userId)}&type=network-stats`,
          { authenticated: true, timeoutMs: 8_000 }
        );
        if (!response.success || !response.data) throw new Error(response.error || 'Failed to load network stats');
        return {
          friends: typeof response.data.friends === 'number' ? response.data.friends : 0,
          followers: typeof response.data.followers === 'number' ? response.data.followers : 0,
          following: typeof response.data.following === 'number' ? response.data.following : 0,
        };
      } catch {
        return { friends: 0, followers: 0, following: 0 };
      }
    }
  }

  private async getNetworkStatsFromFirestore(userId: string): Promise<RelationshipNetworkStats> {
    const [asFirst, asSecond, followers, following] = await Promise.all([
      getDocs(query(collection(db, 'friendship'), where('userId1', '==', userId))),
      getDocs(query(collection(db, 'friendship'), where('userId2', '==', userId))),
      getDocs(query(collection(db, 'followers'), where('followeeId', '==', userId))),
      getDocs(query(collection(db, 'followers'), where('followerId', '==', userId))),
    ]);
    const friendIds = new Set<string>();
    asFirst.docs.forEach((document) => {
      const relationship = document.data();
      const status = readString(relationship.friendshipStatus) || readString(relationship.status);
      const friendId = readString(relationship.userId2);
      if (status === 'accepted' && friendId) friendIds.add(friendId);
    });
    asSecond.docs.forEach((document) => {
      const relationship = document.data();
      const status = readString(relationship.friendshipStatus) || readString(relationship.status);
      const friendId = readString(relationship.userId1);
      if (status === 'accepted' && friendId) friendIds.add(friendId);
    });
    return { friends: friendIds.size, followers: followers.size, following: following.size };
  }

  public async checkFollowStatus(followerId: string, followeeId: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, 'followers'),
        where('followerId', '==', followerId),
        where('followeeId', '==', followeeId)
      );
      const snap = await getDocs(q);
      return !snap.empty;
    } catch {
      return false;
    }
  }

  public async checkFriendshipStatus(userId1: string, userId2: string): Promise<'none' | 'pending' | 'accepted'> {
    try {
      const q1 = query(collection(db, 'friendship'), where('userId1', '==', userId1), where('userId2', '==', userId2));
      const q2 = query(collection(db, 'friendship'), where('userId1', '==', userId2), where('userId2', '==', userId1));
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const docs = [...snap1.docs, ...snap2.docs];
      if (docs.length === 0) return 'none';
      const data = docs[0].data();
      if (data.status === 'accepted') return 'accepted';
      return 'pending';
    } catch {
      return 'none';
    }
  }
}
