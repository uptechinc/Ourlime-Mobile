import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { ApiService } from '@/lib/services/ApiService';

export type SettingsVisibility = 'public' | 'friends' | 'private';
export type BlockedUserSummary = { id: string; userName: string; firstName: string; lastName: string; profileImage: string | null };
export type MobileSettings = {
  firstName: string;
  lastName: string;
  userName: string;
  bio: string;
  visibility: SettingsVisibility;
  allowDirectMessages: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
  mentionAlerts: boolean;
  blockedUsers: BlockedUserSummary[];
};

const readString = (value: unknown): string => typeof value === 'string' ? value : '';
const readRecord = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};

export class SettingsService {
  private static instance: SettingsService;
  private readonly apiService = ApiService.getInstance();

  private constructor() {}

  public static getInstance(): SettingsService {
    if (!SettingsService.instance) SettingsService.instance = new SettingsService();
    return SettingsService.instance;
  }

  public async getMobileSettings(userId: string): Promise<MobileSettings> {
    const [userSnapshot, notificationsSnapshot, blockResponse] = await Promise.all([
      getDoc(doc(db, 'users', userId)),
      getDoc(doc(db, `users/${userId}/userSettings/notifications`)),
      this.apiService.request<{ success: boolean; data?: unknown[] }>('/api/profile/blocklist', { authenticated: true }),
    ]);
    if (!userSnapshot.exists()) throw new Error('User profile not found');
    const user = userSnapshot.data();
    const notifications = notificationsSnapshot.data() ?? {};
    const visibility = user.visibility === 'friends' || user.visibility === 'private' ? user.visibility : 'public';
    const blockedUsers = (blockResponse.data ?? []).flatMap((value): BlockedUserSummary[] => {
      const record = readRecord(value);
      const id = readString(record.id);
      if (!id) return [];
      return [{ id, userName: readString(record.userName), firstName: readString(record.firstName), lastName: readString(record.lastName), profileImage: readString(record.profileImage) || null }];
    });
    return {
      firstName: readString(user.firstName), lastName: readString(user.lastName), userName: readString(user.userName), bio: readString(user.bio), visibility,
      allowDirectMessages: user.allowDirectMessages !== false,
      pushEnabled: notifications.pushNotifications !== false,
      emailEnabled: notifications.emailNotifications !== false,
      mentionAlerts: notifications.mentionAlerts !== false,
      blockedUsers,
    };
  }

  public async updateMobileSettings(userId: string, settings: Omit<MobileSettings, 'blockedUsers'>): Promise<void> {
    await Promise.all([
      updateDoc(doc(db, 'users', userId), {
        firstName: settings.firstName.trim(), lastName: settings.lastName.trim(), userName: settings.userName.trim().toLowerCase(), bio: settings.bio.trim(), visibility: settings.visibility, allowDirectMessages: settings.allowDirectMessages,
      }),
      setDoc(doc(db, `users/${userId}/userSettings/notifications`), { pushNotifications: settings.pushEnabled, emailNotifications: settings.emailEnabled, mentionAlerts: settings.mentionAlerts }, { merge: true }),
    ]);
  }

  public async unblockUser(userId: string): Promise<void> {
    const response = await this.apiService.request<{ success: boolean; message?: string }>('/api/profile/blocklist', { method: 'DELETE', authenticated: true, body: { userIdToUnblock: userId } });
    if (!response.success) throw new Error(response.message || 'Failed to unblock user');
  }
}
