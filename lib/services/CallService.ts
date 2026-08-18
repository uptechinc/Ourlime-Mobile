import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDoc, limit, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';
import { apiService } from './ApiService';
import { DiagnosticLogService } from './DiagnosticLogService';
import { db } from '@/lib/firebaseConfig';
import { useCallStore } from '@/lib/store/useCallStore';
import type { AgoraParticipantCredentials, CallAction, CallSession, CallState, CallEndReason, CallType } from '@/lib/types/call';

type ApiEnvelope<T> = { success: true; data: T };
type FirestoreCallRecord = {
  caller?: unknown;
  callee?: unknown;
  channelName?: unknown;
  type?: unknown;
  state?: unknown;
  endReason?: unknown;
  answeredByDeviceId?: unknown;
  createdAt?: unknown;
  expiresAt?: unknown;
  answeredAt?: unknown;
  endedAt?: unknown;
};

const DEVICE_ID_KEY = 'ourlime:call-device-id';

export class CallService {
  private static instance: CallService;
  private readonly logger = DiagnosticLogService.getInstance();
  private deviceIdPromise: Promise<string> | null = null;

  private constructor() {}

  public static getInstance(): CallService {
    if (!CallService.instance) CallService.instance = new CallService();
    return CallService.instance;
  }

  public async getDeviceId(): Promise<string> {
    if (!this.deviceIdPromise) this.deviceIdPromise = this.resolveDeviceId();
    return this.deviceIdPromise;
  }

  public async createCall(calleeId: string, type: CallType): Promise<CallSession> {
    const startedAt = Date.now();
    const response = await apiService.request<ApiEnvelope<CallSession>>('/api/calls', {
      method: 'POST', authenticated: true, body: { calleeId, type }, timeoutMs: 15_000,
    });
    this.logger.info('CallService', 'call:create', { callId: response.data.id, type, elapsedMs: Date.now() - startedAt });
    return response.data;
  }

  public async getCall(callId: string): Promise<CallSession> {
    const response = await apiService.request<ApiEnvelope<CallSession>>(`/api/calls/${encodeURIComponent(callId)}`, { authenticated: true });
    return response.data;
  }

  public async updateCall(callId: string, action: CallAction): Promise<CallSession> {
    const deviceId = await this.getDeviceId();
    const response = await apiService.request<ApiEnvelope<CallSession>>(`/api/calls/${encodeURIComponent(callId)}`, {
      method: 'PATCH', authenticated: true, body: { action, deviceId }, timeoutMs: 15_000,
    });
    this.logger.info('CallService', 'call:transition', { callId, action, state: response.data.state, endReason: response.data.endReason });
    return response.data;
  }

  public async getRtcCredentials(callId: string): Promise<AgoraParticipantCredentials> {
    const response = await apiService.request<ApiEnvelope<AgoraParticipantCredentials>>(`/api/calls/${encodeURIComponent(callId)}/rtc-token`, {
      authenticated: true, timeoutMs: 15_000,
    });
    return response.data;
  }

  public subscribe(callId: string, onChange: (session: CallSession) => void, onError: (message: string) => void): Unsubscribe {
    return onSnapshot(doc(db, 'calls', callId), (snapshot) => {
      if (!snapshot.exists()) return;
      const session = this.normalizeFirestoreSession(snapshot.id, snapshot.data() as FirestoreCallRecord);
      if (session) onChange(session);
    }, (error) => {
      this.logger.warn('CallService', 'call:listener', { callId, message: error.message });
      onError(error.message);
    });
  }

  public subscribeToIncomingCalls(userId: string, onIncomingCall: (session: CallSession) => void, onError: (message: string) => void): Unsubscribe {
    const unsubs: Unsubscribe[] = [];

    // 1. Direct calls collection listener
    let isInitialCalls = true;
    const incomingQuery = query(
      collection(db, 'calls'),
      where('callee.userId', '==', userId)
    );

    const callsUnsub = onSnapshot(incomingQuery, (snapshot) => {
      snapshot.docs.forEach((docSnapshot) => {
        const session = this.normalizeFirestoreSession(docSnapshot.id, docSnapshot.data() as FirestoreCallRecord);
        if (session && session.state === 'ringing' && session.expiresAtMs > Date.now()) {
          this.logger.info('CallService', 'incoming:detected-via-calls', { callId: session.id, type: session.type });
          onIncomingCall(session);
        }
      });
      isInitialCalls = false;
    }, (error) => {
      this.logger.warn('CallService', 'incoming:calls-listener-error', { userId, message: error.message });
      onError(error.message);
    });
    unsubs.push(callsUnsub);

    // 2. Real-time chats collection listener for legacy/immediate call invites
    let isInitialChats = true;
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', userId),
      limit(20)
    );

    const chatsUnsub = onSnapshot(chatsQuery, async (snapshot) => {
      if (isInitialChats) {
        isInitialChats = false;
        return;
      }

      for (const change of snapshot.docChanges()) {
        if (change.type !== 'modified' && change.type !== 'added') continue;

        const data = change.doc.data();
        const lastMsg = typeof data.lastMessage === 'string' ? data.lastMessage : '';
        const participants = Array.isArray(data.participants) ? data.participants as string[] : [];
        const callerId = participants.find((p) => p !== userId);
        const ts = data.lastMessageTime;
        const tsMs = ts && typeof ts.toMillis === 'function' ? ts.toMillis() : 0;

        if (lastMsg.includes('Call ended') || lastMsg.includes('[SYS:CALL_ENDED]')) {
          const currentActive = useCallStore.getState().session;
          if (currentActive && currentActive.state !== 'ended') {
            onIncomingCall({
              ...currentActive,
              state: 'ended',
              endReason: 'remote_ended',
              endedAtMs: Date.now(),
            });
          }
          continue;
        }

        const isCallInvite = lastMsg.includes('call') || lastMsg.includes('Call') || lastMsg.includes('[SYS:');
        if (!isCallInvite || !callerId) continue;
        if (Date.now() - tsMs > 45_000) continue;

        const messages = Array.isArray(data.messages) ? data.messages as Array<Record<string, unknown>> : [];
        const latestMsg = messages[messages.length - 1] as Record<string, unknown> | undefined;
        if (latestMsg?.senderId === userId) continue;

        const callEvent = latestMsg?.callEvent as Record<string, unknown> | undefined;
        const rawCallId = typeof callEvent?.callId === 'string' ? callEvent.callId : typeof latestMsg?.id === 'string' ? latestMsg.id.replace(/^call_/, '') : null;
        const isVideo = lastMsg.toLowerCase().includes('video');
        let sessionToEmit: CallSession | null = null;

        if (rawCallId) {
          try {
            const callDoc = await getDoc(doc(db, 'calls', rawCallId));
            if (callDoc.exists()) {
              const session = this.normalizeFirestoreSession(callDoc.id, callDoc.data() as FirestoreCallRecord);
              if (session && session.state === 'ringing' && session.expiresAtMs > Date.now()) {
                sessionToEmit = session;
              }
            }
          } catch {
            // Silently continue
          }
        }

        if (!sessionToEmit) {
          try {
            const [callerDoc, myDoc] = await Promise.all([
              getDoc(doc(db, 'users', callerId)).catch(() => null),
              getDoc(doc(db, 'users', userId)).catch(() => null),
            ]);
            const callerData = callerDoc?.data?.() ?? {};
            const myData = myDoc?.data?.() ?? {};
            const callerPic = typeof callerData.profilePicture === 'string'
              ? callerData.profilePicture
              : typeof callerData.profileImage === 'string'
              ? callerData.profileImage
              : typeof callerData.avatar === 'string'
              ? callerData.avatar
              : typeof callerData.photoURL === 'string'
              ? callerData.photoURL
              : null;
            const myPic = typeof myData.profilePicture === 'string'
              ? myData.profilePicture
              : typeof myData.profileImage === 'string'
              ? myData.profileImage
              : null;

            sessionToEmit = {
              id: rawCallId || `call_${Date.now()}`,
              channelName: `ourlime_${(rawCallId || callerId).replace(/[^a-zA-Z0-9]/g, '')}`,
              caller: {
                userId: callerId,
                displayName: `${callerData.firstName ?? 'Friend'} ${callerData.lastName ?? ''}`.trim() || callerData.userName || 'Ourlime user',
                userName: callerData.userName ?? 'user',
                profilePicture: callerPic ?? undefined,
              },
              callee: {
                userId,
                displayName: `${myData.firstName ?? 'Me'} ${myData.lastName ?? ''}`.trim() || myData.userName || 'Me',
                userName: myData.userName ?? 'me',
                profilePicture: myPic ?? undefined,
              },
              type: isVideo ? 'video' : 'voice',
              state: 'ringing',
              endReason: null,
              answeredByDeviceId: null,
              createdAtMs: tsMs || Date.now(),
              expiresAtMs: (tsMs || Date.now()) + 45_000,
              answeredAtMs: null,
              endedAtMs: null,
            };
          } catch {
            // Silently continue
          }
        }

        if (sessionToEmit && sessionToEmit.state === 'ringing' && sessionToEmit.expiresAtMs > Date.now()) {
          this.logger.info('CallService', 'incoming:detected-via-chat-message', { callId: sessionToEmit.id });
          onIncomingCall(sessionToEmit);
        }
      }
    }, (error) => {
      this.logger.warn('CallService', 'incoming:chats-listener-error', { userId, message: error.message });
    });
    unsubs.push(chatsUnsub);

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }

  private async resolveDeviceId(): Promise<string> {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;
    const segments = [8, 4, 4, 4, 12].map((length) => Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join(''));
    const deviceId = segments.join('-');
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
  }

  private normalizeFirestoreSession(id: string, record: FirestoreCallRecord): CallSession | null {
    const caller = this.readParticipant(record.caller);
    const callee = this.readParticipant(record.callee);
    const state = this.readState(record.state);
    const type = record.type === 'video' ? 'video' : record.type === 'voice' ? 'voice' : null;
    if (!caller || !callee || !state || !type || typeof record.channelName !== 'string') return null;
    return {
      id, caller, callee, channelName: record.channelName, type, state,
      endReason: this.readEndReason(record.endReason),
      answeredByDeviceId: typeof record.answeredByDeviceId === 'string' ? record.answeredByDeviceId : null,
      createdAtMs: this.readTimestamp(record.createdAt), expiresAtMs: this.readTimestamp(record.expiresAt),
      answeredAtMs: this.readNullableTimestamp(record.answeredAt), endedAtMs: this.readNullableTimestamp(record.endedAt),
    };
  }

  private readParticipant(value: unknown): CallSession['caller'] | null {
    if (!value || typeof value !== 'object') return null;
    const participant = value as { userId?: unknown; displayName?: unknown; userName?: unknown; profilePicture?: unknown };
    if (typeof participant.userId !== 'string' || typeof participant.displayName !== 'string' || typeof participant.userName !== 'string') return null;
    return { userId: participant.userId, displayName: participant.displayName, userName: participant.userName, ...(typeof participant.profilePicture === 'string' ? { profilePicture: participant.profilePicture } : {}) };
  }

  private readState(value: unknown): CallState | null {
    return value === 'ringing' || value === 'connecting' || value === 'active' || value === 'ended' ? value : null;
  }

  private readEndReason(value: unknown): CallEndReason | null {
    return value === 'declined' || value === 'canceled' || value === 'missed' || value === 'remote_ended' || value === 'failed' || value === 'answered_elsewhere' ? value : null;
  }

  private readTimestamp(value: unknown): number {
    if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis();
    return Date.now();
  }

  private readNullableTimestamp(value: unknown): number | null {
    return value ? this.readTimestamp(value) : null;
  }
}

export const callService = CallService.getInstance();
