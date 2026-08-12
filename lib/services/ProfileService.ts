import { ApiService } from './ApiService';
import type { UserProfile } from './AuthService';

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const readString = (value: unknown): string => typeof value === 'string' ? value : '';
const readNumber = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;

export type PublicProfileResult = {
  profile: UserProfile;
  isBlockedByMe: boolean;
  isBlockedByOther: boolean;
  friends: Array<{ id: string; name: string; userName: string; profileImage: string | null }>;
  communities: Array<{ id: string; title: string; membershipCount: number }>;
};

export class ProfileService {
  private static instance: ProfileService;
  private readonly apiService = ApiService.getInstance();

  private constructor() {}

  public static getInstance(): ProfileService {
    if (!ProfileService.instance) ProfileService.instance = new ProfileService();
    return ProfileService.instance;
  }

  public async fetchPublicProfile(username: string): Promise<PublicProfileResult> {
    const payload = await this.apiService.request<unknown>(
      `/api/profile/viewOtherProfile?username=${encodeURIComponent(username.replace(/^@/, ''))}`,
      { authenticated: true }
    );
    if (!isRecord(payload) || payload.status !== 'success' || !isRecord(payload.user)) throw new Error('Profile not found');
    const user = payload.user;
    const profileImages = isRecord(user.profileImages) ? user.profileImages : {};
    const accountSettings = isRecord(user.accountSettings) ? user.accountSettings : {};
    const visibilityValue = readString(user.visibility) || readString(accountSettings.profileVisibility);
    const visibility = visibilityValue === 'private' || visibilityValue === 'friends' ? visibilityValue : 'public';
    const friends = Array.isArray(payload.friends) ? payload.friends.flatMap((item): PublicProfileResult['friends'] => {
      if (!isRecord(item) || !isRecord(item.user)) return [];
      const card = item.user;
      const id = readString(card.id) || readString(card.uid);
      if (!id) return [];
      return [{ id, name: `${readString(card.firstName)} ${readString(card.lastName)}`.trim() || readString(card.userName), userName: readString(card.userName), profileImage: readString(card.profileImage) || null }];
    }) : [];
    const communities = Array.isArray(payload.communities) ? payload.communities.flatMap((item): PublicProfileResult['communities'] => {
      if (!isRecord(item)) return [];
      const id = readString(item.id);
      if (!id) return [];
      return [{ id, title: readString(item.title) || readString(item.name) || 'Community', membershipCount: readNumber(item.membershipCount) }];
    }) : [];
    return {
      profile: {
        uid: readString(user.id) || readString(user.uid),
        firstName: readString(user.firstName),
        lastName: readString(user.lastName),
        userName: readString(user.userName),
        email: '',
        accountType: readString(user.accountType) || 'regular',
        bio: readString(user.bio),
        location: readString(user.location),
        coverPhoto: readString(profileImages.cover) || readString(user.coverPhoto),
        coverImage: readString(user.coverImage),
        profilePicture: readString(profileImages.profile) || readString(user.profilePicture) || null,
        visibility,
        followersCount: Array.isArray(payload.followers) ? payload.followers.length : readNumber(user.followersCount),
        friendsCount: friends.length || readNumber(user.friendsCount),
        isAdmin: user.isAdmin === true,
      },
      isBlockedByMe: payload.isBlockedByViewer === true,
      isBlockedByOther: payload.isBlockedByTarget === true,
      friends,
      communities,
    };
  }
}
