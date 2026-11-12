import { arrayRemove, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { sharedDocumentReader } from '@/lib/services/SharedDocumentReader';
import { AuthService } from '@/lib/services/AuthService';

export type SettingsVisibility = 'public' | 'friends' | 'private';
export type SettingsTheme = 'system' | 'light' | 'dark';
export type ResolvedSettingsTheme = Exclude<SettingsTheme, 'system'>;
export type MessagePermission = 'everyone' | 'friends' | 'nobody';
export type BlockedUserSummary = { id: string; userName: string; firstName: string; lastName: string; profileImage: string | null };
export type MobileSettings = {
  firstName: string;
  lastName: string;
  userName: string;
  bio: string;
  theme: SettingsTheme;
  visibility: SettingsVisibility;
  activityStatus: boolean;
  searchVisibility: boolean;
  messagePermissions: MessagePermission;
  /** Website "Show Email on Profile" (userPrivacySettings/privacy.showEmailOnProfile). */
  showEmailOnProfile: boolean;
  allowDirectMessages: boolean;
  analyticsSharing: boolean;
  marketingSharing: boolean;
  thirdPartySharing: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  mentionAlerts: boolean;
  newMessageAlerts: boolean;
  newCommentAlerts: boolean;
  loginNotifications: boolean;
  suspiciousActivityAlerts: boolean;
  twoFactorEnabled: boolean;
  twoFactorMethod: 'app' | 'sms' | 'email' | null;
  blockedUsers: BlockedUserSummary[];
};

export type MobileSettingsUpdate = Omit<MobileSettings, 'blockedUsers'>;
/** The privacy fields the website reads from users/{uid}/userPrivacySettings/privacy. */
export type WebPrivacySettings = Pick<MobileSettings, 'searchVisibility' | 'showEmailOnProfile' | 'messagePermissions'>;

type SettingsDocument = {
  theme?: unknown;
  profileVisibility?: unknown;
  activityStatus?: unknown;
  searchVisibility?: unknown;
  messagePermissions?: unknown;
  showEmailOnProfile?: unknown;
  allowDirectMessages?: unknown;
  pushNotifications?: unknown;
  emailNotifications?: unknown;
  emailUpdates?: unknown;
  smsAlerts?: unknown;
  mentionAlerts?: unknown;
  mentions?: unknown;
  newMessages?: unknown;
  newComments?: unknown;
  loginNotifications?: unknown;
  suspiciousActivityAlerts?: unknown;
  twoFactorEnabled?: unknown;
  twoFactorMethod?: unknown;
  dataSharing?: { analytics?: unknown; marketing?: unknown; thirdParty?: unknown };
};

type UserSettingsSource = SettingsDocument & {
  firstName?: unknown;
  lastName?: unknown;
  userName?: unknown;
  bio?: unknown;
  visibility?: unknown;
  blockList?: unknown;
};

const readString = (value: unknown): string => typeof value === 'string' ? value : '';
const readBoolean = (value: unknown, fallback: boolean): boolean => typeof value === 'boolean' ? value : fallback;
const asSettingsDocument = (value: unknown): SettingsDocument => typeof value === 'object' && value !== null ? value as SettingsDocument : {};
const asUserSource = (value: unknown): UserSettingsSource => typeof value === 'object' && value !== null ? value as UserSettingsSource : {};

export class SettingsService {
  private static instance: SettingsService;
  private readonly authService = AuthService.getInstance();

  private constructor() {}

  public static getInstance(): SettingsService {
    if (!SettingsService.instance) SettingsService.instance = new SettingsService();
    return SettingsService.instance;
  }

  public async getMobileSettings(userId: string): Promise<MobileSettings> {
    const [userSnapshot, accountSnapshot, notificationsSnapshot, appearanceSnapshot, privacySnapshot, securitySnapshot, webPrivacySnapshot] = await Promise.all([
      getDoc(doc(db, 'users', userId)),
      getDoc(doc(db, `users/${userId}/userSettings/account`)),
      getDoc(doc(db, `users/${userId}/userSettings/notifications`)),
      getDoc(doc(db, `users/${userId}/userSettings/appearance`)),
      getDoc(doc(db, `users/${userId}/userSettings/privacy`)),
      getDoc(doc(db, `users/${userId}/userSettings/security`)),
      getDoc(doc(db, `users/${userId}/userPrivacySettings/privacy`)).catch(() => null),
    ]);
    if (!userSnapshot.exists()) throw new Error('User profile not found');

    const user = asUserSource(userSnapshot.data());
    const account = asSettingsDocument(accountSnapshot.data());
    const notifications = asSettingsDocument(notificationsSnapshot.data());
    const appearance = asSettingsDocument(appearanceSnapshot.data());
    const privacy = asSettingsDocument(privacySnapshot.data());
    const security = asSettingsDocument(securitySnapshot.data());
    // The website stores search visibility, email display and message permissions here; it wins when present.
    const webPrivacy = asSettingsDocument(webPrivacySnapshot?.data());
    const visibilityValue = readString(privacy.profileVisibility) || readString(account.profileVisibility) || readString(user.visibility);
    const visibility: SettingsVisibility = visibilityValue === 'friends' || visibilityValue === 'private' ? visibilityValue : 'public';
    const messagePermissions = this.readMessagePermission(webPrivacy.messagePermissions) ?? this.readMessagePermission(privacy.messagePermissions) ?? 'everyone';
    const themeValue = readString(appearance.theme);
    const theme: SettingsTheme = themeValue === 'light' || themeValue === 'dark' ? themeValue : 'system';
    const twoFactorMethodValue = readString(security.twoFactorMethod);
    const twoFactorMethod = twoFactorMethodValue === 'app' || twoFactorMethodValue === 'sms' || twoFactorMethodValue === 'email' ? twoFactorMethodValue : null;
    const blockedIds = Array.isArray(user.blockList) ? user.blockList.filter((blockedId): blockedId is string => typeof blockedId === 'string') : [];
    const blockedUsers = await this.fetchBlockedUsers(blockedIds);

    return {
      firstName: readString(user.firstName),
      lastName: readString(user.lastName),
      userName: readString(user.userName),
      bio: readString(user.bio),
      theme,
      visibility,
      activityStatus: readBoolean(privacy.activityStatus, readBoolean(account.activityStatus, true)),
      searchVisibility: readBoolean(webPrivacy.searchVisibility, readBoolean(privacy.searchVisibility, true)),
      messagePermissions,
      showEmailOnProfile: readBoolean(webPrivacy.showEmailOnProfile, readBoolean(privacy.showEmailOnProfile, false)),
      allowDirectMessages: readBoolean(privacy.allowDirectMessages, readBoolean(user.allowDirectMessages, true)),
      analyticsSharing: readBoolean(privacy.dataSharing?.analytics, true),
      marketingSharing: readBoolean(privacy.dataSharing?.marketing, false),
      thirdPartySharing: readBoolean(privacy.dataSharing?.thirdParty, false),
      pushEnabled: readBoolean(notifications.pushNotifications, true),
      emailEnabled: readBoolean(notifications.emailUpdates, readBoolean(notifications.emailNotifications, true)),
      smsEnabled: readBoolean(notifications.smsAlerts, false),
      mentionAlerts: readBoolean(notifications.mentions, readBoolean(notifications.mentionAlerts, true)),
      newMessageAlerts: readBoolean(notifications.newMessages, true),
      newCommentAlerts: readBoolean(notifications.newComments, true),
      loginNotifications: readBoolean(security.loginNotifications, true),
      suspiciousActivityAlerts: readBoolean(security.suspiciousActivityAlerts, true),
      twoFactorEnabled: readBoolean(security.twoFactorEnabled, false),
      twoFactorMethod,
      blockedUsers,
    };
  }

  public async updateMobileSettings(userId: string, settings: MobileSettingsUpdate): Promise<void> {
    await Promise.all([
      updateDoc(doc(db, 'users', userId), {
        firstName: settings.firstName.trim(),
        lastName: settings.lastName.trim(),
        userName: settings.userName.trim().toLowerCase(),
        bio: settings.bio.trim(),
        visibility: settings.visibility,
        allowDirectMessages: settings.allowDirectMessages,
      }),
      setDoc(doc(db, `users/${userId}/userSettings/account`), {
        profileVisibility: settings.visibility,
        activityStatus: settings.activityStatus,
        updatedAt: serverTimestamp(),
      }, { merge: true }),
      setDoc(doc(db, `users/${userId}/userSettings/appearance`), { theme: settings.theme, updatedAt: serverTimestamp() }, { merge: true }),
      setDoc(doc(db, `users/${userId}/userSettings/notifications`), {
        pushNotifications: settings.pushEnabled,
        emailUpdates: settings.emailEnabled,
        emailNotifications: settings.emailEnabled,
        smsAlerts: settings.smsEnabled,
        mentions: settings.mentionAlerts,
        mentionAlerts: settings.mentionAlerts,
        newMessages: settings.newMessageAlerts,
        newComments: settings.newCommentAlerts,
        updatedAt: serverTimestamp(),
      }, { merge: true }),
      setDoc(doc(db, `users/${userId}/userSettings/privacy`), {
        profileVisibility: settings.visibility,
        activityStatus: settings.activityStatus,
        searchVisibility: settings.searchVisibility,
        messagePermissions: settings.messagePermissions,
        showEmailOnProfile: settings.showEmailOnProfile,
        allowDirectMessages: settings.allowDirectMessages,
        dataSharing: { analytics: settings.analyticsSharing, marketing: settings.marketingSharing, thirdParty: settings.thirdPartySharing },
        updatedAt: serverTimestamp(),
      }, { merge: true }),
      setDoc(doc(db, `users/${userId}/userSettings/security`), {
        loginNotifications: settings.loginNotifications,
        suspiciousActivityAlerts: settings.suspiciousActivityAlerts,
        twoFactorEnabled: settings.twoFactorEnabled,
        twoFactorMethod: settings.twoFactorMethod,
        updatedAt: serverTimestamp(),
      }, { merge: true }),
    ]);
    sharedDocumentReader.invalidate(`users/${userId}`);
    sharedDocumentReader.invalidate(`users/${userId}/userSettings/account`);
  }

  /**
   * Mirrors the website-read privacy fields into users/{uid}/userPrivacySettings/privacy. The website saves them
   * there through its server; Firestore rules currently reject client writes, so this throws until that is opened.
   */
  public async updateWebPrivacySettings(userId: string, settings: WebPrivacySettings): Promise<void> {
    await setDoc(doc(db, `users/${userId}/userPrivacySettings/privacy`), {
      searchVisibility: settings.searchVisibility,
      showEmailOnProfile: settings.showEmailOnProfile,
      // Website value for "No One" is 'none'; calls (userSettings/privacy) check 'nobody'.
      messagePermissions: settings.messagePermissions === 'nobody' ? 'none' : settings.messagePermissions,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  private readMessagePermission(value: unknown): MessagePermission | null {
    if (value === 'everyone' || value === 'friends' || value === 'nobody') return value;
    if (value === 'none') return 'nobody';
    return null;
  }

  public async updateTheme(userId: string, theme: SettingsTheme): Promise<void> {
    await setDoc(doc(db, `users/${userId}/userSettings/appearance`), { theme, updatedAt: serverTimestamp() }, { merge: true });
  }

  public async unblockUser(currentUserId: string, blockedUserId: string): Promise<void> {
    await updateDoc(doc(db, 'users', currentUserId), { blockList: arrayRemove(blockedUserId) });
  }

  private async fetchBlockedUsers(blockedIds: string[]): Promise<BlockedUserSummary[]> {
    const profiles = await Promise.all(blockedIds.map((blockedId) => this.authService.getUserProfile(blockedId)));
    return profiles.flatMap((profile, index): BlockedUserSummary[] => {
      if (!profile) return [];
      return [{
        id: blockedIds[index] ?? profile.uid,
        userName: profile.userName ?? '',
        firstName: profile.firstName ?? '',
        lastName: profile.lastName ?? '',
        profileImage: profile.profilePicture ?? null,
      }];
    });
  }
}
