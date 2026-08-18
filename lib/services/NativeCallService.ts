import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from './ApiService';
import { callService } from './CallService';
import { DiagnosticLogService } from './DiagnosticLogService';
import { platformEnvironmentService } from './PlatformEnvironmentService';
import type { CallEndReason, CallPushPayload, CallSession } from '@/lib/types/call';

type NativeCallCallbacks = {
  onIncomingCall: (payload: CallPushPayload) => void;
  onAnswer: (callId: string) => void;
  onDecline: (callId: string) => void;
  onTimeout: (callId: string) => void;
};

type NativeSubscription = { remove: () => void };
type StoredNativeToken = { token: string; platform: 'android' | 'ios'; transport: 'fcm' | 'apns_voip' };
type PushTokenResponse = { success: boolean };

const TOKENS_KEY = 'ourlime:native-call-tokens';

function isStoredNativeToken(value: unknown): value is StoredNativeToken {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { token?: unknown; platform?: unknown; transport?: unknown };
  return typeof candidate.token === 'string'
    && (candidate.platform === 'android' || candidate.platform === 'ios')
    && (candidate.transport === 'fcm' || candidate.transport === 'apns_voip');
}

export class NativeCallService {
  private static instance: NativeCallService;
  private readonly logger = DiagnosticLogService.getInstance();
  private callbacks: NativeCallCallbacks | null = null;
  private subscriptions: NativeSubscription[] = [];
  private readonly ringingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private initialized = false;
  private backgroundHandlerRegistered = false;

  private constructor() {}

  public static getInstance(): NativeCallService {
    if (!NativeCallService.instance) NativeCallService.instance = new NativeCallService();
    return NativeCallService.instance;
  }

  public isAvailable(): boolean {
    return platformEnvironmentService.isNativeCallingSupported();
  }

  public async registerAndroidBackgroundHandler(): Promise<void> {
    if (Platform.OS !== 'android' || !this.isAvailable() || this.backgroundHandlerRegistered) return;
    try {
      const messagingModule = await import('@react-native-firebase/messaging');
      const getMessaging = messagingModule.getMessaging || messagingModule.default;
      if (typeof getMessaging !== 'function') return;
      const messaging = getMessaging();
      if (!messaging) return;

      if (typeof messagingModule.setBackgroundMessageHandler === 'function') {
        messagingModule.setBackgroundMessageHandler(messaging, async (message) => {
          const payload = this.parsePayload(message.data);
          if (payload) await this.displayIncomingCall(payload);
        });
        this.backgroundHandlerRegistered = true;
      } else if (typeof messaging.setBackgroundMessageHandler === 'function') {
        messaging.setBackgroundMessageHandler(async (message) => {
          const payload = this.parsePayload(message.data);
          if (payload) await this.displayIncomingCall(payload);
        });
        this.backgroundHandlerRegistered = true;
      }
    } catch (error: unknown) {
      this.logger.warn('NativeCallService', 'fcm:bg-handler-unavailable', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async initialize(callbacks: NativeCallCallbacks): Promise<void> {
    this.callbacks = callbacks;
    if (this.initialized || !this.isAvailable()) return;
    if (Platform.OS === 'ios') {
      try {
        const RNCallKeep = (await import('react-native-callkeep')).default;
        await RNCallKeep.setup({
          ios: { appName: 'Ourlime', supportsVideo: true, maximumCallGroups: '1', maximumCallsPerCallGroup: '1', includesCallsInRecents: true },
          android: {
            alertTitle: 'Calling permission', alertDescription: 'Ourlime needs access to show incoming calls.',
            cancelButton: 'Cancel', okButton: 'Allow', additionalPermissions: [], selfManaged: false,
            foregroundService: { channelId: 'ourlime-calls', channelName: 'Ourlime calls', notificationTitle: 'Ourlime call in progress' },
          },
        });
        this.subscriptions.push(
          RNCallKeep.addEventListener('answerCall', ({ callUUID }) => this.callbacks?.onAnswer(callUUID)),
          RNCallKeep.addEventListener('endCall', ({ callUUID }) => this.callbacks?.onDecline(callUUID)),
          RNCallKeep.addEventListener('didLoadWithEvents', (events) => {
            events.forEach((event) => {
              if (event.name === 'RNCallKeepPerformAnswerCallAction') this.callbacks?.onAnswer(event.data.callUUID);
              if (event.name === 'RNCallKeepPerformEndCallAction') this.callbacks?.onDecline(event.data.callUUID);
            });
          }),
        );
      } catch (error: unknown) {
        this.logger.warn('NativeCallService', 'callkeep:setup-failed', { message: error instanceof Error ? error.message : String(error) });
      }
    }
    await this.initializePushTransports();
    this.initialized = true;
    this.logger.info('NativeCallService', 'initialize', { platform: Platform.OS });
  }

  public async displayIncomingCall(payload: CallPushPayload): Promise<void> {
    this.callbacks?.onIncomingCall(payload);
    if (payload.type !== 'incoming_call' || Date.now() >= payload.expiresAtMs) return;
    if (!this.isAvailable()) return;
    if (Platform.OS === 'ios') {
      try {
        const RNCallKeep = (await import('react-native-callkeep')).default;
        RNCallKeep.displayIncomingCall(payload.callId, payload.callerUserName || payload.callerId, payload.callerName, 'generic', payload.callType === 'video', payload);
      } catch (error: unknown) {
        this.logger.warn('NativeCallService', 'callkeep:display-failed', { message: error instanceof Error ? error.message : String(error) });
      }
    } else if (Platform.OS === 'android') {
      try {
        const Notifications = await import('expo-notifications');
        await Notifications.setNotificationChannelAsync('calls', {
          name: 'Ourlime Calls',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',
          vibrationPattern: [0, 500, 250, 500, 250, 500],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          bypassDnd: true,
        });
        const isVideo = payload.callType === 'video';
        const callerName = payload.callerName || payload.callerUserName || 'Ourlime Caller';
        await Notifications.scheduleNotificationAsync({
          identifier: payload.callId,
          content: {
            title: isVideo ? `Incoming Video Call` : `Incoming Voice Call`,
            body: `${callerName} is calling you...`,
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
            vibrate: [0, 500, 250, 500, 250, 500],
            data: payload as unknown as Record<string, unknown>,
          },
          trigger: null,
        });
      } catch (error: unknown) {
        this.logger.warn('NativeCallService', 'android:display-notification-failed', { message: error instanceof Error ? error.message : String(error) });
      }
    }
    this.clearRingingTimer(payload.callId);
    const remainingMs = Math.max(0, payload.expiresAtMs - Date.now());
    this.ringingTimers.set(payload.callId, setTimeout(() => {
      this.ringingTimers.delete(payload.callId);
      this.callbacks?.onTimeout(payload.callId);
      void this.endNativeCall(payload.callId, 'missed');
    }, remainingMs));
    this.logger.info('NativeCallService', 'incoming:display', { callId: payload.callId, callType: payload.callType, expiresAtMs: payload.expiresAtMs });
  }

  public async displayIncomingCallForSession(session: CallSession): Promise<void> {
    const payload: CallPushPayload = {
      type: 'incoming_call',
      callId: session.id,
      callerId: session.caller.userId,
      callerName: session.caller.displayName,
      callerUserName: session.caller.userName,
      callerProfilePicture: session.caller.profilePicture,
      callType: session.type,
      expiresAtMs: session.expiresAtMs,
    };
    await this.displayIncomingCall(payload);
  }

  public async startOutgoingCall(session: CallSession): Promise<void> {
    if (!this.isAvailable() || Platform.OS !== 'ios') return;
    try {
      const RNCallKeep = (await import('react-native-callkeep')).default;
      RNCallKeep.startCall(session.id, session.callee.userName || session.callee.userId, session.callee.displayName, 'generic', session.type === 'video');
    } catch (error: unknown) {
      this.logger.warn('NativeCallService', 'callkeep:start-failed', { message: error instanceof Error ? error.message : String(error) });
    }
  }

  public async markConnected(callId: string): Promise<void> {
    this.clearRingingTimer(callId);
    if (Platform.OS === 'android') {
      try {
        const Notifications = await import('expo-notifications');
        await Notifications.dismissNotificationAsync(callId).catch(() => {});
      } catch {
        // ignore
      }
    }
    if (!this.isAvailable() || Platform.OS !== 'ios') return;
    try {
      const RNCallKeep = (await import('react-native-callkeep')).default;
      RNCallKeep.reportConnectedOutgoingCallWithUUID(callId);
    } catch (error: unknown) {
      this.logger.warn('NativeCallService', 'callkeep:markConnected-failed', { message: error instanceof Error ? error.message : String(error) });
    }
  }

  public async endNativeCall(callId: string, reason: CallEndReason | null): Promise<void> {
    this.clearRingingTimer(callId);
    if (Platform.OS === 'android') {
      try {
        const Notifications = await import('expo-notifications');
        await Notifications.dismissNotificationAsync(callId).catch(() => {});
      } catch {
        // ignore
      }
    }
    if (!this.isAvailable() || Platform.OS !== 'ios') return;
    try {
      const callKeepModule = await import('react-native-callkeep');
      const RNCallKeep = callKeepModule.default;
      const endReasons = callKeepModule.CONSTANTS.END_CALL_REASONS;
      const nativeReason = reason === 'missed' ? endReasons.UNANSWERED
        : reason === 'answered_elsewhere' ? endReasons.ANSWERED_ELSEWHERE
        : reason === 'failed' ? endReasons.FAILED
        : endReasons.REMOTE_ENDED;
      RNCallKeep.reportEndCallWithUUID(callId, nativeReason);
    } catch (error: unknown) {
      this.logger.warn('NativeCallService', 'callkeep:end-failed', { message: error instanceof Error ? error.message : String(error) });
    }
  }

  public async unregisterTokens(): Promise<void> {
    const tokens = await this.readStoredTokens();
    await Promise.allSettled(tokens.map((token) => apiService.request<PushTokenResponse>('/api/push-tokens', {
      method: 'DELETE', authenticated: true, body: { token: token.token },
    })));
    await AsyncStorage.removeItem(TOKENS_KEY);
  }

  public dispose(): void {
    this.subscriptions.forEach((subscription) => subscription.remove());
    this.subscriptions = [];
    this.callbacks = null;
    this.initialized = false;
    this.ringingTimers.forEach((timer) => clearTimeout(timer));
    this.ringingTimers.clear();
  }

  private async initializePushTransports(): Promise<void> {
    try {
      if (Platform.OS === 'android') await this.initializeFcm();
      if (Platform.OS === 'ios') await this.initializeVoipPush();
    } catch (error: unknown) {
      this.logger.warn('NativeCallService', 'push-transports:unavailable', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async initializeFcm(): Promise<void> {
    try {
      const messagingModule = await import('@react-native-firebase/messaging');
      const getMessaging = messagingModule.getMessaging || messagingModule.default;
      if (typeof getMessaging !== 'function') return;
      const messaging = getMessaging();
      if (!messaging) return;

      await this.registerAndroidBackgroundHandler();

      if (typeof messagingModule.registerDeviceForRemoteMessages === 'function') {
        await messagingModule.registerDeviceForRemoteMessages(messaging).catch(() => {});
      } else if (typeof messaging.registerDeviceForRemoteMessages === 'function') {
        await messaging.registerDeviceForRemoteMessages().catch(() => {});
      }

      if (typeof messagingModule.requestPermission === 'function') {
        await messagingModule.requestPermission(messaging).catch(() => {});
      } else if (typeof messaging.requestPermission === 'function') {
        await messaging.requestPermission().catch(() => {});
      }

      let token: string | null = null;
      if (typeof messagingModule.getToken === 'function') {
        token = await messagingModule.getToken(messaging).catch(() => null);
      } else if (typeof messaging.getToken === 'function') {
        token = await messaging.getToken().catch(() => null);
      }

      if (token) {
        await this.registerToken(token, 'android', 'fcm').catch(() => {});
      }

      const messageHandler = async (message: { data?: unknown }) => {
        const payload = this.parsePayload(message.data);
        if (payload) await this.displayIncomingCall(payload);
      };

      if (typeof messagingModule.onMessage === 'function') {
        const unsub = messagingModule.onMessage(messaging, messageHandler);
        this.subscriptions.push({ remove: unsub });
      } else if (typeof messaging.onMessage === 'function') {
        const unsub = messaging.onMessage(messageHandler);
        this.subscriptions.push({ remove: unsub });
      }

      if (typeof messagingModule.onTokenRefresh === 'function') {
        const unsub = messagingModule.onTokenRefresh(messaging, (nextToken: string) => {
          void this.registerToken(nextToken, 'android', 'fcm').catch(() => {});
        });
        this.subscriptions.push({ remove: unsub });
      } else if (typeof messaging.onTokenRefresh === 'function') {
        const unsub = messaging.onTokenRefresh((nextToken: string) => {
          void this.registerToken(nextToken, 'android', 'fcm').catch(() => {});
        });
        this.subscriptions.push({ remove: unsub });
      }
    } catch (error: unknown) {
      this.logger.warn('NativeCallService', 'fcm:init-failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async initializeVoipPush(): Promise<void> {
    try {
      const VoipPush = (await import('react-native-voip-push-notification')).default;
      if (!VoipPush || typeof VoipPush.addEventListener !== 'function') return;

      VoipPush.addEventListener('register', (token) => { void this.registerToken(token, 'ios', 'apns_voip').catch(() => {}); });
      VoipPush.addEventListener('notification', (notification) => {
        const payload = this.parsePayload(notification);
        if (payload) void this.displayIncomingCall(payload).finally(() => VoipPush.onVoipNotificationCompleted(payload.callId));
      });
      VoipPush.addEventListener('didLoadWithEvents', (events) => {
        events.forEach((event) => {
          if (event.name === 'RNVoipPushRemoteNotificationReceivedEvent') {
            const payload = this.parsePayload(event.data);
            if (payload) void this.displayIncomingCall(payload);
          }
          if (event.name === 'RNVoipPushRemoteNotificationsRegisteredEvent') void this.registerToken(event.data, 'ios', 'apns_voip').catch(() => {});
        });
      });
      VoipPush.registerVoipToken();
      this.subscriptions.push({ remove: () => {
        try {
          VoipPush.removeEventListener('register');
          VoipPush.removeEventListener('notification');
          VoipPush.removeEventListener('didLoadWithEvents');
        } catch {}
      } });
    } catch (error: unknown) {
      this.logger.warn('NativeCallService', 'voip-push:init-failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async registerToken(token: string, platform: 'android' | 'ios', transport: 'fcm' | 'apns_voip'): Promise<void> {
    const deviceId = await callService.getDeviceId();
    await apiService.request<PushTokenResponse>('/api/push-tokens', {
      method: 'POST', authenticated: true, body: { token, platform, transport, deviceId }, timeoutMs: 15_000,
    });
    const tokens = (await this.readStoredTokens()).filter((stored) => stored.transport !== transport);
    tokens.push({ token, platform, transport });
    await AsyncStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    this.logger.info('NativeCallService', 'token:registered', { platform, transport });
  }

  private parsePayload(value: unknown): CallPushPayload | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as { [key: string]: unknown };
    if (record.type !== 'incoming_call' && record.type !== 'call_state') return null;
    const callType = record.callType === 'video' ? 'video' : record.callType === 'voice' ? 'voice' : null;
    const expiresAtMs = typeof record.expiresAtMs === 'number' ? record.expiresAtMs : typeof record.expiresAtMs === 'string' ? Number(record.expiresAtMs) : Number.NaN;
    if (!callType || typeof record.callId !== 'string' || typeof record.callerId !== 'string' || typeof record.callerName !== 'string' || typeof record.callerUserName !== 'string' || !Number.isFinite(expiresAtMs)) return null;
    return {
      type: record.type, callId: record.callId, callType, callerId: record.callerId,
      callerName: record.callerName, callerUserName: record.callerUserName, expiresAtMs,
      ...(typeof record.callerProfilePicture === 'string' ? { callerProfilePicture: record.callerProfilePicture } : {}),
      ...(record.state === 'ringing' || record.state === 'connecting' || record.state === 'active' || record.state === 'ended' ? { state: record.state } : {}),
      endReason: record.endReason === 'declined' || record.endReason === 'canceled' || record.endReason === 'missed' || record.endReason === 'remote_ended' || record.endReason === 'failed' || record.endReason === 'answered_elsewhere' ? record.endReason : null,
    };
  }

  private async readStoredTokens(): Promise<StoredNativeToken[]> {
    const raw = await AsyncStorage.getItem(TOKENS_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isStoredNativeToken);
    } catch { return []; }
  }

  private clearRingingTimer(callId: string): void {
    const timer = this.ringingTimers.get(callId);
    if (timer) clearTimeout(timer);
    this.ringingTimers.delete(callId);
  }
}

export const nativeCallService = NativeCallService.getInstance();
