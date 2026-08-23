import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import type { Href } from 'expo-router';
import { ApiService } from './ApiService';
import { DiagnosticLogService } from './DiagnosticLogService';
import { platformEnvironmentService } from './PlatformEnvironmentService';
import { notificationDestinationRegistry } from '@/lib/navigation/NotificationDestinationRegistry';
import type { NotificationType } from '@/lib/types/notification';

const DEVICE_TOKEN_KEY = 'ourlime_device_push_token';
const MESSAGE_CHANNEL_ID = 'ourlime-messages-v2';
const CALL_CHANNEL_ID = 'ourlime-calls-v2';
const CALL_NOTIFICATION_CATEGORY_ID = 'ourlime-incoming-call';
const CALL_ANSWER_ACTION_ID = 'ourlime-call-answer';
const CALL_DECLINE_ACTION_ID = 'ourlime-call-decline';

export type PushMessageType = 'message' | 'voice_call' | 'video_call' | NotificationType;
export type PushMessagePayload = { title: string; body: string; type: PushMessageType; senderId: string; channelId?: string; path?: string };

type PushTokenResponse = { success: boolean; error?: string };

// expo-notifications remote push support was removed from Expo Go in SDK 53.
// We load it lazily so the module never throws at import time.
// In Expo Go the require() will still throw at CALL time, which we catch per-method.
function getNotifications(): typeof import('expo-notifications') | null {
  if (platformEnvironmentService.isExpoGo() || Platform.OS === 'web') return null;
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
      void this.configureAndroidChannels();
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          const notificationBody = notification?.request?.content?.body?.trim() ?? '';
          if (/^\[SYS:[A-Z0-9_]+\]$/.test(notificationBody)) {
            return {
              shouldShowBanner: false,
              shouldShowList: false,
              shouldPlaySound: false,
              shouldSetBadge: false,
            };
          }
          const data = notification?.request?.content?.data as { type?: unknown; senderId?: unknown } | undefined;
          if (data?.type === 'incoming_call' || data?.type === 'call_state' || data?.type === 'voice_call' || data?.type === 'video_call') {
            return {
              shouldShowBanner: false,
              shouldShowList: false,
              shouldPlaySound: false,
              shouldSetBadge: false,
            };
          }
          const senderId = typeof data?.senderId === 'string' ? data.senderId : undefined;
          if (senderId) {
            try {
              let currentUserId = '';
              try {
                const { authService } = await import('./AuthService');
                currentUserId = authService.getCurrentUser()?.uid ?? '';
              } catch {
                // Ignore fallback
              }
              if (currentUserId) {
                const [archivedRaw, mutedRaw] = await Promise.all([
                  AsyncStorage.getItem(`ourlime_archived_chats_${currentUserId}`),
                  AsyncStorage.getItem(`ourlime_muted_chats_${currentUserId}`),
                ]);
                const archivedList = archivedRaw ? (JSON.parse(archivedRaw) as string[]) : [];
                const mutedList = mutedRaw ? (JSON.parse(mutedRaw) as string[]) : [];
                if (archivedList.includes(senderId) || mutedList.includes(senderId)) {
                  return {
                    shouldShowBanner: false,
                    shouldShowList: false,
                    shouldPlaySound: false,
                    shouldSetBadge: false,
                  };
                }
              }
            } catch {
              // Ignore and use default
            }
          }
          return {
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          };
        },
      });
    } catch {
      // Not supported in Expo Go — silently skip.
    }
  }

  public async configureAndroidChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;
    const Notifications = getNotifications();
    if (!Notifications) return;
    try {
      await Promise.all([
        Notifications.setNotificationChannelAsync(MESSAGE_CHANNEL_ID, {
          name: 'Ourlime messages',
          description: 'Messages and social activity from Ourlime',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          enableVibrate: true,
          vibrationPattern: [0, 250, 150, 250],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          showBadge: true,
          audioAttributes: {
            usage: Notifications.AndroidAudioUsage.NOTIFICATION_COMMUNICATION_INSTANT,
            contentType: Notifications.AndroidAudioContentType.SONIFICATION,
          },
        }),
        Notifications.setNotificationChannelAsync(CALL_CHANNEL_ID, {
          name: 'Ourlime incoming calls',
          description: 'Incoming Ourlime voice and video calls',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
          enableVibrate: true,
          vibrationPattern: [0, 700, 350, 700, 350, 700],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          showBadge: false,
          audioAttributes: {
            usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE,
            contentType: Notifications.AndroidAudioContentType.SONIFICATION,
          },
        }),
        Notifications.setNotificationCategoryAsync(CALL_NOTIFICATION_CATEGORY_ID, [
          { identifier: CALL_DECLINE_ACTION_ID, buttonTitle: 'Decline', options: { opensAppToForeground: true, isDestructive: true } },
          { identifier: CALL_ANSWER_ACTION_ID, buttonTitle: 'Answer', options: { opensAppToForeground: true } },
        ]),
      ]);
    } catch (error: unknown) {
      this.logger.warn('PushNotificationService', 'channels:configuration-failed', {
        reason: error instanceof Error ? error.message : String(error),
      });
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
        await this.configureAndroidChannels();
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
    const Notifications = getNotifications();

    // 1. On Android: Fetch and register the direct native Google FCM token
    if (Platform.OS === 'android') {
      try {
        if (Notifications) {
          const deviceTokenResult = await Notifications.getDevicePushTokenAsync().catch(() => null);
          if (deviceTokenResult && deviceTokenResult.data) {
            const fcmToken = deviceTokenResult.data;
            const tokenType = deviceTokenResult.type ?? 'unknown';
            this.logger.info('PushNotificationService', 'getDevicePushTokenAsync', { type: tokenType });
            try {
              const result = await this.apiService.request<PushTokenResponse>('/api/push-tokens', {
                method: 'POST',
                authenticated: true,
                body: { token: fcmToken, platform: 'android', transport: 'fcm' },
              });
              this.logger.success('PushNotificationService', 'fcm-device-token:registered', { userId });
            } catch (saveErr) {
              this.logger.error('PushNotificationService', 'fcm-device-token:failed-to-save', saveErr, { userId });
            }
          }
        }

        // Also ensure @react-native-firebase/messaging token is synced ONLY if native module exists
        if (platformEnvironmentService.hasNativeFirebaseMessaging()) {
          try {
            const messagingModule = await import('@react-native-firebase/messaging');
            const getMessaging = messagingModule.getMessaging || messagingModule.default;
            if (typeof getMessaging === 'function') {
              const messaging = getMessaging();
              let fcmToken: string | null = null;
              if (typeof messagingModule.getToken === 'function') {
                fcmToken = await messagingModule.getToken(messaging).catch(() => null);
              } else if (typeof messaging?.getToken === 'function') {
                fcmToken = await messaging.getToken().catch(() => null);
              }
              if (fcmToken) {
                try {
                  const result = await this.apiService.request<PushTokenResponse>('/api/push-tokens', {
                    method: 'POST',
                    authenticated: true,
                    body: { token: fcmToken, platform: 'android', transport: 'fcm' },
                  });
                  this.logger.success('PushNotificationService', 'fcm-firebase-token:registered', { userId });
                } catch (saveErr) {
                  this.logger.error('PushNotificationService', 'fcm-firebase-token:failed-to-save', saveErr, { userId });
                }
              }
            }
          } catch (fcmImportErr) {
            this.logger.warn('PushNotificationService', 'fcm:module-import-skipped', {
              message: fcmImportErr instanceof Error ? fcmImportErr.message : String(fcmImportErr),
            });
          }
        }
      } catch (fcmError) {
        this.logger.warn('PushNotificationService', 'fcm:token-failed', {
          message: fcmError instanceof Error ? fcmError.message : String(fcmError),
        });
      }
    }

    // 2. Register Expo Push Token as auxiliary transport
    const expoToken = await this.getDevicePushToken();
    if (expoToken) {
      try {
        await this.apiService.request<PushTokenResponse>('/api/push-tokens', {
          method: 'POST',
          authenticated: true,
          body: { token: expoToken, platform: Platform.OS, transport: 'expo' },
        });
        this.logger.success('PushNotificationService', 'expo-token:registered', { userId, platform: Platform.OS });
      } catch (error: unknown) {
        this.logger.warn('PushNotificationService', 'token:registration-failed', {
          userId,
          platform: Platform.OS,
          reason: error instanceof Error ? error.message : 'Unknown registration error',
        });
      }
    }

    return expoToken;
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
        title: payload.title,
        type: payload.type,
        path: payload.path,
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
