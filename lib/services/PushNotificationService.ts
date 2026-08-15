import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type { Href } from 'expo-router';
import { ApiService } from './ApiService';
import { DiagnosticLogService } from './DiagnosticLogService';
import { notificationDestinationRegistry } from '@/lib/navigation/NotificationDestinationRegistry';

const DEVICE_TOKEN_KEY = 'ourlime_device_push_token';

export type PushMessageType = 'message' | 'voice_call' | 'video_call';
export type PushMessagePayload = { title: string; body: string; type: PushMessageType; senderId: string; channelId?: string };

type PushTokenResponse = { success: boolean; error?: string };

// expo-notifications remote push support was removed from Expo Go in SDK 53.
// We load it lazily so the module never throws at import time.
// In Expo Go the require() will still throw at CALL time, which we catch per-method.
function getNotifications(): typeof import('expo-notifications') | null {
  if (Constants.appOwnership === 'expo') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as typeof import('expo-notifications');
  } catch {
    return null;
  }
}

export class PushNotificationService {
  private static instance: PushNotificationService;
  private readonly apiService = ApiService.getInstance();
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) PushNotificationService.instance = new PushNotificationService();
    return PushNotificationService.instance;
  }

  public configureForegroundPresentation(): void {
    const Notifications = getNotifications();
    if (!Notifications) return;
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
    } catch {
      // Not supported in Expo Go — silently skip.
    }
  }

  public async getDevicePushToken(): Promise<string | null> {
    if (Platform.OS === 'web' || !Device.isDevice) return null;
    const Notifications = getNotifications();
    if (!Notifications) return null;
    try {
      const existingPermission = await Notifications.getPermissionsAsync();
      const permission = existingPermission.status === 'granted'
        ? existingPermission
        : await Notifications.requestPermissionsAsync();
      if (permission.status !== 'granted') return null;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Ourlime notifications',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
        });
        await Notifications.setNotificationChannelAsync('calls', {
          name: 'Ourlime calls',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        this.logger.warn('PushNotificationService', 'token:no-project-id');
        return null;
      }
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);
      return token;
    } catch (error: unknown) {
      this.logger.warn('PushNotificationService', 'token:unavailable', {
        reason: error instanceof Error ? error.message : 'Unknown notification error',
      });
      return null;
    }
  }

  public async registerForPushNotifications(userId: string): Promise<string | null> {
    if (!userId) return null;
    const token = await this.getDevicePushToken();
    if (!token) return null;
    try {
      await this.apiService.request<PushTokenResponse>('/api/push-tokens', {
        method: 'POST', authenticated: true, body: { token, platform: Platform.OS },
      });
      this.logger.success('PushNotificationService', 'token:registered', { userId, platform: Platform.OS });
      return token;
    } catch (error: unknown) {
      this.logger.warn('PushNotificationService', 'token:registration-failed', {
        userId,
        platform: Platform.OS,
        reason: error instanceof Error ? error.message : 'Unknown registration error',
      });
      return null;
    }
  }

  public async unregisterCurrentDevice(): Promise<void> {
    const token = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
    if (!token) return;
    try {
      await this.apiService.request<PushTokenResponse>('/api/push-tokens', {
        method: 'DELETE', authenticated: true, body: { token },
      });
    } finally {
      await AsyncStorage.removeItem(DEVICE_TOKEN_KEY);
    }
  }

  public async isChatMuted(userId: string, friendId: string): Promise<boolean> {
    const value = await AsyncStorage.getItem(`ourlime_chat_muted_${userId}_${friendId}`);
    if (!value) return false;
    if (value === 'indefinite') return true;
    const mutedUntil = Number(value);
    return Number.isFinite(mutedUntil) && Date.now() < mutedUntil;
  }

  public async setChatMuted(userId: string, friendId: string, durationMs: number | 'indefinite' | false): Promise<void> {
    const key = `ourlime_chat_muted_${userId}_${friendId}`;
    if (durationMs === false) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, durationMs === 'indefinite' ? durationMs : String(Date.now() + durationMs));
  }

  public async sendPushNotification(receiverId: string, payload: PushMessagePayload): Promise<void> {
    if (!receiverId) return;
    await this.apiService.request<{ success: boolean }>('/api/push-messages', {
      method: 'POST',
      authenticated: true,
      body: {
        receiverId,
        message: payload.type === 'video_call'
          ? '[SYS:VIDEO_CALL_INVITE]'
          : payload.type === 'voice_call'
            ? '[SYS:VOICE_CALL_INVITE]'
            : payload.body,
      },
    });
  }

  public resolveNotificationDestination(data: unknown): Href {
    return notificationDestinationRegistry.resolve(notificationDestinationRegistry.normalize(data));
  }
}

export const pushNotificationService = PushNotificationService.getInstance();
