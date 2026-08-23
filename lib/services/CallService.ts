import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';
import { apiService } from './ApiService';
import { DiagnosticLogService } from './DiagnosticLogService';
import { db } from '@/lib/firebaseConfig';
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
    const incomingQuery = query(
      collection(db, 'calls'),
      where('callee.userId', '==', userId)
    );

    return onSnapshot(incomingQuery, (snapshot) => {
      const newestRingingCall = snapshot.docs
        .map((documentSnapshot) => this.normalizeFirestoreSession(documentSnapshot.id, documentSnapshot.data() as FirestoreCallRecord))
        .filter((session): session is CallSession => Boolean(
          session
          && session.callee.userId === userId
          && session.caller.userId !== userId
          && session.state === 'ringing'
          && session.expiresAtMs > Date.now(),
        ))
        .sort((firstCall, secondCall) => secondCall.createdAtMs - firstCall.createdAtMs)[0];
      if (newestRingingCall) {
        this.logger.info('CallService', 'incoming:detected-via-calls', { callId: newestRingingCall.id, type: newestRingingCall.type });
        onIncomingCall(newestRingingCall);
      }
    }, (error) => {
      this.logger.warn('CallService', 'incoming:calls-listener-error', { userId, message: error.message });
      onError(error.message);
    });
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
