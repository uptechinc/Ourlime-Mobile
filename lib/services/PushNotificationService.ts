import { contentDraftService } from './ContentDraftService';
import { auth } from '@/lib/firebaseConfig';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { appServerService } from './AppServerService';
import { DiagnosticLogService } from './DiagnosticLogService';
import { platformEnvironmentService } from './PlatformEnvironmentService';
import { notificationDestinationRegistry, type NotificationDestinationResult } from '@/lib/navigation/NotificationDestinationRegistry';
import type { NotificationType } from '@/lib/types/notification';
import { notificationSoundPreferenceService } from './NotificationSoundPreferenceService';

const DEVICE_TOKEN_KEY = 'ourlime_device_push_token';
const MESSAGE_CHANNEL_ID = 'ourlime-messages-v3';
const CALL_CHANNEL_ID = 'ourlime-calls-v3';
const CALL_NOTIFICATION_CATEGORY_ID = 'ourlime-incoming-call';
const CALL_ANSWER_ACTION_ID = 'ourlime-call-answer';
const CALL_DECLINE_ACTION_ID = 'ourlime-call-decline';

export type PushMessageType = 'message' | 'voice_call' | 'video_call' | NotificationType;
export type PushMessagePayload = {
  title: string;
  body: string;
  type: PushMessageType;
  senderId: string;
  channelId?: string;
  path?: string;
  imageUrl?: string;
};



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
  private unsubscribeToken: (() => void) | null = null;
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
          if (data?.type === 'message') {
            const customSoundPlayed = await notificationSoundPreferenceService.playMessageSound().catch(() => false);
            return {
              shouldShowBanner: true,
              shouldShowList: true,
              shouldPlaySound: !customSoundPlayed,
              shouldSetBadge: true,
            };
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
    if (!userId || Platform.OS === 'web' || platformEnvironmentService.isExpoGo()) return null;
    this.unsubscribeToken?.(); this.unsubscribeToken = null;
    // The permission request occurs before registration on either platform.
    const expoToken = await this.getDevicePushToken();
    const notifications = getNotifications();
    if (!notifications || (await notifications.getPermissionsAsync()).status !== 'granted') return null;
    if (auth.currentUser?.uid !== userId) return null;
    let deviceId = await AsyncStorage.getItem('ourlime_push_device_id');
    if (!deviceId) { deviceId = await contentDraftService.newId(); await AsyncStorage.setItem('ourlime_push_device_id', deviceId); }
    const register = async (token: string, transport: 'fcm' | 'expo') => {
      // Skip if the account changed while the token was being fetched.
      if (auth.currentUser?.uid !== userId) return;
      await appServerService.call('registerNativePush', { token, transport, platform: Platform.OS, deviceId }, 10_000);
      await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);
    };
    if (Platform.OS === 'android' && platformEnvironmentService.hasNativeFirebaseMessaging()) {
      const messaging = await import('@react-native-firebase/messaging');
      const token = await messaging.getToken(messaging.getMessaging());
      await register(token, 'fcm');
      this.unsubscribeToken = messaging.onTokenRefresh(messaging.getMessaging(), (next) => { void register(next, 'fcm').catch(() => {}); });
      return token;
    }
    if (expoToken) await register(expoToken, 'expo');
    return expoToken;
  }

  public async unregisterCurrentDevice(): Promise<void> {
    this.unsubscribeToken?.(); this.unsubscribeToken = null;
    const token = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
    const ownerId = auth.currentUser?.uid;
    try {
      if (token && ownerId) {
        await appServerService.call('registerNativePush', { token, remove: true }, 10_000);
      }
    } finally {
      if (Platform.OS === 'android' && platformEnvironmentService.hasNativeFirebaseMessaging()) {
        const messaging = await import('@react-native-firebase/messaging');
        await messaging.deleteToken(messaging.getMessaging()).catch(() => {});
      }
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
    await appServerService.call('sendMessagePush', {
      receiverId,
      title: payload.title,
      type: payload.type,
      path: payload.path,
      message: payload.type === 'video_call'
        ? '[SYS:VIDEO_CALL_INVITE]'
        : payload.type === 'voice_call'
          ? '[SYS:VOICE_CALL_INVITE]'
          : payload.body,
    });
  }

  public async presentRichNotificationAsync(options: {
    title: string;
    body: string;
    imageUrl?: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    const Notifications = getNotifications();
    if (!Notifications) return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: options.title,
          body: options.body,
          data: options.data,
          ...(options.imageUrl ? {
            attachments: [{
              url: options.imageUrl,
              identifier: 'media',
              type: 'image',
            }],
          } : {}),
        },
        trigger: null,
      });
    } catch (error) {
      this.logger.warn('PushNotificationService', 'presentRichNotificationAsync:failed', { error });
    }
  }

  public resolveNotificationDestination(data: unknown): NotificationDestinationResult {
    return notificationDestinationRegistry.resolve(notificationDestinationRegistry.normalize(data));
  }
}

export const pushNotificationService = PushNotificationService.getInstance();
