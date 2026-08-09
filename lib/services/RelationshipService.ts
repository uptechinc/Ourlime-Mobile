import { ApiService } from './ApiService';
import { db } from '@/lib/firebaseConfig';
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
} from 'firebase/firestore';

type RelationshipActionResponse = {
  success: boolean;
  error?: string;
  message?: string;
};

export type RelationshipUser = { id: string; firstName: string; lastName: string; userName: string; profileImage?: string };
type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
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
    const response = await this.apiService.request<RelationshipActionResponse>('/api/relationships/friends', {
      method: 'POST',
      authenticated: true,
      body: { userId1, userId2, action: 'send-request' },
    });
    if (!response.success) throw new Error(response.error || response.message || 'Failed to send friend request');
  }

  public async blockUser(userIdToBlock: string): Promise<void> {
    const response = await this.apiService.request<RelationshipActionResponse>('/api/profile/blocklist', {
      method: 'POST',
      authenticated: true,
      body: { userIdToBlock },
    });
    if (!response.success) throw new Error(response.error || response.message || 'Failed to block user');
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
    const response = await this.apiService.request<{ success: boolean; data?: unknown[]; error?: string }>(
      `/api/relationships/status?userId=${encodeURIComponent(userId)}&type=friends`,
      { authenticated: true }
    );
    if (!response.success) throw new Error(response.error || 'Failed to load friends');
    return (response.data ?? []).flatMap((value): RelationshipUser[] => {
      if (!isRecord(value)) return [];
      const id = readString(value.id) || readString(value.userId);
      const userName = readString(value.userName);
      const firstName = readString(value.firstName);
      const lastName = readString(value.lastName);
      const profileImage = readString(value.profileImage) || readString(value.profilePicture);
      if (!id) return [];
      return [{ id, firstName, lastName, userName, profileImage }];
    });
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
