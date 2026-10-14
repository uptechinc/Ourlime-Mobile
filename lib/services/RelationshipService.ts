import { relationshipDataService } from './RelationshipDataService';
import { auth, db } from '@/lib/firebaseConfig';
import { notificationHelpers } from '@/lib/helpers/notificationHelpers';
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
  type DocumentData,
} from 'firebase/firestore';
import { firestoreBatchReadService } from './FirestoreBatchReadService';

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
  private readonly data = relationshipDataService;

  private constructor() {}

  public static getInstance(): RelationshipService {
    if (!RelationshipService.instance) RelationshipService.instance = new RelationshipService();
    return RelationshipService.instance;
  }

  public async setFollowing(followerId: string, followeeId: string, shouldFollow: boolean): Promise<void> {
    if (!followerId || !followeeId || followerId === followeeId) throw new Error('A valid user is required.');
    const snapshot = await getDocs(query(
      collection(db, 'followers'),
      where('followerId', '==', followerId),
      where('followeeId', '==', followeeId),
    ));
    if (shouldFollow) {
      if (snapshot.empty) {
        await addDoc(collection(db, 'followers'), { followerId, followeeId, createdAt: serverTimestamp() });
        await notificationHelpers.createFollowNotification(followeeId);
      }
    } else {
      await Promise.all(snapshot.docs.map((document) => deleteDoc(document.ref)));
      await this.deleteRelationshipNotifications(followeeId, ['follow']);
    }
    const persistedState = await this.checkFollowStatus(followerId, followeeId);
    if (persistedState !== shouldFollow) throw new Error('The follow status could not be confirmed. Please try again.');
  }

  /** userId1 is the signed-in sender; same checks and notification as the website friends route. */
  public async sendFriendRequest(userId1: string, userId2: string): Promise<void> {
    if (auth.currentUser?.uid !== userId1) throw new Error('Please sign in again to send friend requests.');
    await this.data.sendFriendRequest(userId2);
  }

  public async respondToFriendRequest(requesterId: string, viewerId: string, action: 'accept' | 'decline'): Promise<void> {
    if (auth.currentUser?.uid !== viewerId) throw new Error('Please sign in again to respond to friend requests.');
    await this.data.respondToFriendRequest(requesterId, action);
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

    // Image selections and images for every candidate in two batched reads instead of two reads per person.
    const imageSelections = await firestoreBatchReadService
      .getDocumentsByField('profileImageSetAs', 'userId', candidates.map((document) => document.id))
      .catch((error: unknown) => {
        console.error('[RelationshipService.getSuggestionsFromFirestore] Error: profile image selections', error);
        return [];
      });
    const imageIdByUser = new Map<string, string>();
    candidates.forEach((document) => {
      const selections = imageSelections.filter((selection) => selection.data().userId === document.id);
      const preferredSelection = selections.find((selection) => selection.data().setAs === 'profile')
        ?? selections.find((selection) => selection.data().setAs === 'postProfile');
      const imageId = preferredSelection ? readString(preferredSelection.data().profileImageId) : '';
      if (imageId) imageIdByUser.set(document.id, imageId);
    });
    const imagesById = await firestoreBatchReadService
      .getDocumentsByIds('profileImages', [...imageIdByUser.values()])
      .catch((error: unknown) => {
        console.error('[RelationshipService.getSuggestionsFromFirestore] Error: profile images', error);
        return new Map<string, DocumentData>();
      });

    return candidates.map((document): RelationshipSuggestion => {
      const user = document.data();
      const imageId = imageIdByUser.get(document.id);
      const imageData = imageId ? imagesById.get(imageId) : undefined;
      const profileImage = readString(imageData?.imageURL)
        || readString(imageData?.imageUrl)
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
    });
  }

  public async blockUser(userIdToBlock: string): Promise<void> {
    await this.data.blockUser(userIdToBlock);
  }

  public async unblockUser(userIdToUnblock: string): Promise<void> {
    await this.data.unblockUser(userIdToUnblock);
  }

  public async cancelOrRemoveFriend(userId1: string, userId2: string, status: 'pending' | 'accepted'): Promise<void> {
    if (status === 'pending') {
      await this.cancelPendingFriendRequest(userId1, userId2);
      return;
    }
    const documents = await this.getDirectFriendshipDocuments(userId1, userId2);
    const hasAcceptedRelationship = documents.some((document) => this.readDocumentFriendshipStatus(document.data()) === 'accepted');
    if (!hasAcceptedRelationship) throw new Error('This friendship no longer exists.');
    await Promise.all(documents.map((document) => deleteDoc(document.ref)));
    const persistedStatus = await this.checkFriendshipStatus(userId1, userId2);
    if (persistedStatus !== 'none') throw new Error('The friendship removal could not be confirmed. Please try again.');
  }

  public async cancelPendingFriendRequest(currentUserId: string, targetUserId: string): Promise<void> {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) {
      throw new Error('A valid pending friend request is required.');
    }
    const documents = await this.getDirectFriendshipDocuments(currentUserId, targetUserId);
    const pendingDocuments = documents.filter((document) => this.readDocumentFriendshipStatus(document.data()) === 'pending');
    if (pendingDocuments.length === 0) {
      const hasAcceptedRelationship = documents.some((document) => this.readDocumentFriendshipStatus(document.data()) === 'accepted');
      if (hasAcceptedRelationship) throw new Error('This friend request has already been accepted.');
      await this.deleteRelationshipNotifications(targetUserId, ['friend_request']);
      return;
    }
    await Promise.all(pendingDocuments.map((document) => deleteDoc(document.ref)));
    await this.deleteRelationshipNotifications(targetUserId, ['friend_request']);
  }

  /** The notices the viewer caused in targetUserId's inbox; the server removes them once the relationship ended. */
  private async deleteRelationshipNotifications(targetUserId: string, types: ('follow' | 'friend_request')[]): Promise<void> {
    await notificationHelpers.clearSocialNotifications(targetUserId, types);
  }

  private async getDirectFriendshipDocuments(userId1: string, userId2: string) {
    const [forwardSnapshot, reverseSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'friendship'), where('userId1', '==', userId1), where('userId2', '==', userId2))),
      getDocs(query(collection(db, 'friendship'), where('userId1', '==', userId2), where('userId2', '==', userId1))),
    ]);
    return [...forwardSnapshot.docs, ...reverseSnapshot.docs];
  }

  private readDocumentFriendshipStatus(value: { friendshipStatus?: unknown; status?: unknown }): 'none' | 'pending' | 'accepted' {
    const status = readString(value.friendshipStatus) || readString(value.status);
    return status === 'accepted' ? 'accepted' : status === 'pending' ? 'pending' : 'none';
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
    const friends = await this.data.getFriends(userId);
    return this.normalizeFriends(friends);
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
      return { friends: 0, followers: 0, following: 0 };
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
      const documents = await this.getDirectFriendshipDocuments(userId1, userId2);
      const statuses = documents.map((document) => this.readDocumentFriendshipStatus(document.data()));
      if (statuses.includes('accepted')) return 'accepted';
      if (statuses.includes('pending')) return 'pending';
      return 'none';
    } catch {
      return 'none';
    }
  }
}
