import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { db } from '@/lib/firebaseConfig';
import { collection, doc, setDoc, query, where, getDocs, Timestamp } from 'firebase/firestore';

const DEVICE_TOKEN_KEY = 'ourlime_device_push_token';

export class PushNotificationService {
  private static instance: PushNotificationService;

  private constructor() {}

  public static getInstance(): PushNotificationService {
    if (!PushNotificationService.instance) {
      PushNotificationService.instance = new PushNotificationService();
    }
    return PushNotificationService.instance;
  }

  /**
   * Get or generate a stable device installation token
   */
  public async getDevicePushToken(): Promise<string> {
    try {
      const existing = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
      if (existing) return existing;

      const deviceId = Constants.installationId ?? `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const token = `ExponentPushToken[${deviceId}]`;
      await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);
      return token;
    } catch {
      const fallbackToken = `ExponentPushToken[dev_${Date.now()}]`;
      return fallbackToken;
    }
  }

  /**
   * Register device push token in Firestore under pushTokens collection
   */
  public async registerForPushNotifications(userId: string): Promise<string | null> {
    if (!userId) return null;

    try {
      const token = await this.getDevicePushToken();
      const docId = `${userId}_${token.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const tokenDocRef = doc(db, 'pushTokens', docId);

      await setDoc(tokenDocRef, {
        userId,
        token,
        platform: Platform.OS,
        updatedAt: Timestamp.now(),
      }, { merge: true });

      console.log('[PushNotificationService] Push token registered in Firestore:', token);
      return token;
    } catch (error) {
      console.error('[PushNotificationService.registerForPushNotifications]', error);
      return null;
    }
  }

  /**
   * Check if user muted chat notifications for a friend
   */
  public async isChatMuted(userId: string, friendId: string): Promise<boolean> {
    try {
      const key = `ourlime_chat_muted_${userId}_${friendId}`;
      const val = await AsyncStorage.getItem(key);
      if (!val) return false;
      if (val === 'indefinite' || val === 'true') return true;
      const mutedUntil = parseInt(val, 10);
      if (isNaN(mutedUntil)) return false;
      return Date.now() < mutedUntil;
    } catch {
      return false;
    }
  }

  /**
   * Set chat mute status
   */
  public async setChatMuted(userId: string, friendId: string, durationMs: number | 'indefinite' | false): Promise<void> {
    const key = `ourlime_chat_muted_${userId}_${friendId}`;
    if (durationMs === false) {
      await AsyncStorage.removeItem(key);
    } else if (durationMs === 'indefinite') {
      await AsyncStorage.setItem(key, 'indefinite');
    } else {
      const until = Date.now() + durationMs;
      await AsyncStorage.setItem(key, String(until));
    }
  }

  /**
   * Send a high-priority push notification (call or message) to a user's tokens in Firestore
   */
  public async sendPushNotification(receiverId: string, payload: {
    title: string;
    body: string;
    type: 'message' | 'voice_call' | 'video_call';
    senderId: string;
    channelId?: string;
  }): Promise<void> {
    if (!receiverId) return;

    try {
      // Check if receiver has muted notifications from this sender
      const muted = await this.isChatMuted(receiverId, payload.senderId);
      if (muted) {
        console.log(`[PushNotificationService] Push notification suppressed because receiver muted chat with ${payload.senderId}`);
        return;
      }

      // Query push tokens for receiver from Firestore pushTokens collection
      const q = query(collection(db, 'pushTokens'), where('userId', '==', receiverId));
      const snap = await getDocs(q);
      const tokens = snap.docs.map((d) => d.data().token as string).filter(Boolean);

      if (tokens.length === 0) return;

      const isCall = payload.type === 'voice_call' || payload.type === 'video_call';

      const messages = tokens.map((token) => ({
        to: token,
        sound: isCall ? 'default' : 'default',
        title: payload.title,
        body: payload.body,
        priority: 'high',
        channelId: isCall ? 'calls' : 'default',
        data: {
          type: payload.type,
          senderId: payload.senderId,
          timestamp: Date.now(),
        },
      }));

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
    } catch (error) {
      console.error('[PushNotificationService.sendPushNotification]', error);
    }
  }
}

export const pushNotificationService = PushNotificationService.getInstance();
