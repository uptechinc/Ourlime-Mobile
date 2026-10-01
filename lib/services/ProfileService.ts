import { collection, doc, getDoc, getDocs, limit, query, where, type DocumentData, type DocumentSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import type { UserProfile } from './AuthService';
import { communityDataService } from './CommunityDataService';

const readString = (value: unknown): string => typeof value === 'string' ? value : '';
const readNumber = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const readStringList = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
const FIRESTORE_IN_LIMIT = 30;

export type PublicProfileResult = {
  profile: UserProfile;
  isBlockedByMe: boolean;
  isBlockedByOther: boolean;
  friends: { id: string; name: string; userName: string; profileImage: string | null }[];
  communities: { id: string; title: string; membershipCount: number }[];
};

/** Reads another user's profile directly from Firestore, following the website's viewOtherProfile service. */
export class ProfileService {
  private static instance: ProfileService;

  private constructor() {}

  public static getInstance(): ProfileService {
    if (!ProfileService.instance) ProfileService.instance = new ProfileService();
    return ProfileService.instance;
  }

  public async fetchPublicProfile(username: string): Promise<PublicProfileResult> {
    const normalized = username.replace(/^@/, '').trim();
    if (!normalized) throw new Error('Username or User ID is required');

    const userDocument = await this.findUser(normalized);
    if (!userDocument) throw new Error('Profile not found');
    const userId = userDocument.id;
    const user = userDocument.data() ?? {};
    const viewerId = auth.currentUser?.uid ?? null;

    if (viewerId && viewerId !== userId) {
      const viewer = await getDoc(doc(db, 'users', viewerId)).catch(() => null);
      const isBlockedByMe = readStringList(viewer?.data()?.blockList).includes(userId);
      const isBlockedByOther = readStringList(user.blockList).includes(viewerId);
      if (isBlockedByMe || isBlockedByOther) {
        return {
          profile: { ...this.toProfile(userId, user, {}, 0, 0), bio: '', location: '', coverPhoto: undefined, coverImage: '', profilePicture: null },
          isBlockedByMe,
          isBlockedByOther,
          friends: [],
          communities: [],
        };
      }
    }

    const [profileImages, friendsAsFirst, friendsAsSecond, memberships, followers, accountSettings] = await Promise.all([
      this.loadProfileImages(userId),
      getDocs(query(collection(db, 'friendship'), where('userId1', '==', userId), where('friendshipStatus', '==', 'accepted'))),
      getDocs(query(collection(db, 'friendship'), where('userId2', '==', userId), where('friendshipStatus', '==', 'accepted'))),
      getDocs(query(collection(db, 'communityVariantMembership'), where('userId', '==', userId))),
      getDocs(query(collection(db, 'followers'), where('followeeId', '==', userId))),
      getDoc(doc(db, 'users', userId, 'userSettings', 'account')).catch(() => null),
    ]);

    const friendIds = [
      ...friendsAsFirst.docs.map((friendship) => readString(friendship.data().userId2)),
      ...friendsAsSecond.docs.map((friendship) => readString(friendship.data().userId1)),
    ].filter(Boolean);
    const communityIds = [...new Set(memberships.docs
      .filter((membership) => membership.data().isMember !== false)
      .map((membership) => readString(membership.data().communityVariantId))
      .filter(Boolean))];

    const [friends, communities] = await Promise.all([this.loadFriendCards(friendIds), this.loadCommunities(communityIds)]);
    const visibilityValue = readString(user.visibility) || readString(accountSettings?.data()?.profileVisibility);
    return {
      profile: {
        ...this.toProfile(userId, user, profileImages, followers.size, friendIds.length),
        visibility: visibilityValue === 'private' || visibilityValue === 'friends' ? visibilityValue : 'public',
      },
      isBlockedByMe: false,
      isBlockedByOther: false,
      friends,
      communities,
    };
  }

  /** Website order: username first, then a direct user id. */
  private async findUser(identifier: string): Promise<DocumentSnapshot<DocumentData> | null> {
    const byUserName = await getDocs(query(collection(db, 'users'), where('userName', '==', identifier), limit(1)));
    if (!byUserName.empty) return byUserName.docs[0];
    const byId = await getDoc(doc(db, 'users', identifier));
    return byId.exists() ? byId : null;
  }

  private toProfile(userId: string, user: DocumentData, profileImages: Record<string, string>, followersCount: number, friendsCount: number): UserProfile {
    return {
      uid: userId,
      firstName: readString(user.firstName),
      lastName: readString(user.lastName),
      userName: readString(user.userName),
      email: '',
      accountType: readString(user.accountType) || 'regular',
      bio: readString(user.bio),
      location: readString(user.location),
      coverPhoto: profileImages.cover || readString(user.coverPhoto) || undefined,
      coverImage: readString(user.coverImage),
      profilePicture: profileImages.profile || readString(user.profilePicture) || readString(user.profileImage) || null,
      visibility: 'public',
      followersCount: followersCount || readNumber(user.followersCount),
      friendsCount: friendsCount || readNumber(user.friendsCount),
      isAdmin: user.isAdmin === true,
    };
  }

  /** The image selected for each slot (profile, cover) in profileImageSetAs. */
  private async loadProfileImages(userId: string): Promise<Record<string, string>> {
    const selections = await getDocs(query(collection(db, 'profileImageSetAs'), where('userId', '==', userId))).catch(() => null);
    if (!selections) return {};
    const entries = await Promise.all(selections.docs.map(async (selection) => {
      const slot = readString(selection.data().setAs);
      const imageId = readString(selection.data().profileImageId);
      if (!slot || !imageId) return null;
      const image = await getDoc(doc(db, 'profileImages', imageId)).catch(() => null);
      const url = readString(image?.data()?.imageURL);
      return url ? [slot, url] as const : null;
    }));
    return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null));
  }

  private async loadFriendCards(friendIds: string[]): Promise<PublicProfileResult['friends']> {
    const [users, pictures] = await Promise.all([
      Promise.all(friendIds.map((friendId) => getDoc(doc(db, 'users', friendId)).catch(() => null))),
      communityDataService.loadProfilePictures(friendIds).catch(() => new Map<string, string>()),
    ]);
    return users.flatMap((friend): PublicProfileResult['friends'] => {
      if (!friend?.exists()) return [];
      const data = friend.data();
      const userName = readString(data.userName);
      return [{
        id: friend.id,
        name: `${readString(data.firstName)} ${readString(data.lastName)}`.trim() || userName,
        userName,
        profileImage: pictures.get(friend.id) || readString(data.profileImage) || null,
      }];
    });
  }

  private async loadCommunities(communityIds: string[]): Promise<PublicProfileResult['communities']> {
    if (communityIds.length === 0) return [];
    const [communities, countSnapshots] = await Promise.all([
      Promise.all(communityIds.map((communityId) => getDoc(doc(db, 'communityVariant', communityId)).catch(() => null))),
      Promise.all(Array.from({ length: Math.ceil(communityIds.length / FIRESTORE_IN_LIMIT) }, (_, index) => getDocs(query(
        collection(db, 'communityVariantMembershipAndLikeCount'),
        where('communityVariantId', 'in', communityIds.slice(index * FIRESTORE_IN_LIMIT, (index + 1) * FIRESTORE_IN_LIMIT)),
      )).catch(() => null))),
    ]);
    const memberCounts = new Map(countSnapshots.flatMap((snapshot) => snapshot?.docs ?? [])
      .map((count) => [readString(count.data().communityVariantId), readNumber(count.data().membershipCount)] as const));
    return communities.flatMap((community): PublicProfileResult['communities'] => {
      if (!community?.exists()) return [];
      const data = community.data();
      return [{ id: community.id, title: readString(data.title) || readString(data.name) || 'Community', membershipCount: memberCounts.get(community.id) ?? 0 }];
    });
  }
}
