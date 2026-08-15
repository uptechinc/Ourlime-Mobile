import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { Unsubscribe } from 'firebase/firestore';
import { auth } from '@/lib/firebaseConfig';
import { agoraCallService } from '@/lib/services/AgoraCallService';
import { callService } from '@/lib/services/CallService';
import { nativeCallService } from '@/lib/services/NativeCallService';
import { ApiServiceError } from '@/lib/services/ApiService';
import { DiagnosticLogService } from '@/lib/services/DiagnosticLogService';
import { useCallStore } from '@/lib/store/useCallStore';
import type { CallAction, CallPushPayload, CallSession, CallType } from '@/lib/types/call';

type CallContextValue = {
  startCall: (calleeId: string, type: CallType) => Promise<void>;
  answerCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleSpeaker: () => void;
  switchCamera: () => void;
  minimize: () => void;
  restore: () => void;
};

type CallProviderProps = { children: ReactNode };

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: CallProviderProps) {
  const logger = useMemo(() => DiagnosticLogService.getInstance(), []);
  const callUnsubscribeRef = useRef<Unsubscribe | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const operationRef = useRef<Promise<void> | null>(null);
  const session = useCallStore((state) => state.session);
  const isMuted = useCallStore((state) => state.isMuted);
  const isVideoMuted = useCallStore((state) => state.isVideoMuted);
  const isSpeakerEnabled = useCallStore((state) => state.isSpeakerEnabled);

  const subscribeToCall = useCallback((callId: string) => {
    callUnsubscribeRef.current?.();
    callUnsubscribeRef.current = callService.subscribe(callId, (nextSession) => {
      const currentSession = useCallStore.getState().session;
      useCallStore.getState().setSession(nextSession);
      if (nextSession.state === 'connecting') useCallStore.getState().setConnectionStatus('connecting');
      if (nextSession.state === 'active') {
        useCallStore.getState().setConnectionStatus('active');
        void nativeCallService.markConnected(nextSession.id);
      }
      if (nextSession.state === 'ended') {
        void agoraCallService.leave();
        void nativeCallService.endNativeCall(nextSession.id, nextSession.endReason);
        useCallStore.getState().setConnectionStatus('ending');
        setTimeout(() => useCallStore.getState().reset(), 350);
      } else if (currentSession?.state === 'ringing' && nextSession.state === 'connecting' && nextSession.answeredByDeviceId) {
        void callService.getDeviceId().then((deviceId) => {
          if (nextSession.answeredByDeviceId !== deviceId && auth.currentUser?.uid === nextSession.callee.userId) {
            void nativeCallService.endNativeCall(nextSession.id, 'answered_elsewhere');
            useCallStore.getState().reset();
          }
        });
      }
    }, (message) => useCallStore.getState().setError(message));
  }, []);

  const joinRtc = useCallback(async (activeSession: CallSession) => {
    const credentials = await callService.getRtcCredentials(activeSession.id);
    await agoraCallService.join(credentials, activeSession.type, {
      onConnected: () => {
        const current = useCallStore.getState().session;
        if (current?.state === 'connecting') {
          useCallStore.getState().setConnectionStatus('active');
          void callService.updateCall(activeSession.id, 'connected').catch((error: unknown) => logger.error('CallCoordinator', 'connected', error, { callId: activeSession.id }));
        }
        if (current?.state === 'connecting' || current?.state === 'active') void nativeCallService.markConnected(activeSession.id);
      },
      onRemoteJoined: (uid) => useCallStore.getState().setRemoteUid(uid),
      onRemoteLeft: () => useCallStore.getState().setRemoteUid(null),
      onError: (message) => useCallStore.getState().setError(message),
    });
  }, [logger]);

  const handleIncomingPayload = useCallback(async (payload: CallPushPayload) => {
    if (payload.type === 'call_state') {
      if (payload.state === 'ended') {
        await nativeCallService.endNativeCall(payload.callId, payload.endReason ?? null);
        if (useCallStore.getState().session?.id === payload.callId) useCallStore.getState().reset();
      }
      return;
    }
    try {
      const incomingSession = await callService.getCall(payload.callId);
      if (incomingSession.state !== 'ringing' || incomingSession.expiresAtMs <= Date.now()) return;
      useCallStore.getState().setSession(incomingSession);
      useCallStore.getState().setConnectionStatus('ringing');
      subscribeToCall(incomingSession.id);
    } catch (error: unknown) {
      logger.error('CallCoordinator', 'incoming', error, { callId: payload.callId });
    }
  }, [logger, subscribeToCall]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user?.emailVerified) {
        void nativeCallService.initialize({
          onIncomingCall: (payload) => { void handleIncomingPayload(payload); },
          onAnswer: (callId) => {
            void callService.getCall(callId).then((current) => {
              useCallStore.getState().setSession(current);
              subscribeToCall(callId);
              return callService.updateCall(callId, 'answer');
            }).then((answered) => {
              useCallStore.getState().setSession(answered);
              return joinRtc(answered);
            }).catch((error: unknown) => {
              if (error instanceof ApiServiceError && error.status === 409) {
                void nativeCallService.endNativeCall(callId, 'answered_elsewhere');
                useCallStore.getState().reset();
              }
              logger.error('CallCoordinator', 'native-answer', error, { callId });
            });
          },
          onDecline: (callId) => {
            void callService.getCall(callId).then((current) => callService.updateCall(callId, current.state === 'ringing' ? (current.caller.userId === auth.currentUser?.uid ? 'cancel' : 'decline') : 'end')).catch((error: unknown) => logger.error('CallCoordinator', 'native-end', error, { callId }));
          },
          onTimeout: (callId) => {
            void callService.updateCall(callId, 'expire').catch((error: unknown) => logger.error('CallCoordinator', 'native-timeout', error, { callId }));
          },
        }).catch((error: unknown) => logger.warn('CallCoordinator', 'native-unavailable', { message: error instanceof Error ? error.message : String(error) }));
      } else {
        callUnsubscribeRef.current?.();
        callUnsubscribeRef.current = null;
        void agoraCallService.leave();
        nativeCallService.dispose();
        useCallStore.getState().reset();
      }
    });
    return () => {
      unsubscribeAuth();
      callUnsubscribeRef.current?.();
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
      void agoraCallService.leave();
      nativeCallService.dispose();
    };
  }, [handleIncomingPayload, joinRtc, logger, subscribeToCall]);

  useEffect(() => {
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    if (!session || session.state !== 'ringing') return;
    const remainingMs = Math.max(0, session.expiresAtMs - Date.now());
    expiryTimerRef.current = setTimeout(() => {
      if (useCallStore.getState().session?.id !== session.id) return;
      void callService.updateCall(session.id, 'expire').then((expired) => nativeCallService.endNativeCall(expired.id, expired.endReason)).finally(() => useCallStore.getState().reset());
    }, remainingMs);
    return () => { if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current); };
  }, [session]);

  const runExclusive = useCallback(async (operation: () => Promise<void>) => {
    if (operationRef.current) return operationRef.current;
    const pending = operation().finally(() => { operationRef.current = null; });
    operationRef.current = pending;
    return pending;
  }, []);

  const startCall = useCallback(async (calleeId: string, type: CallType) => runExclusive(async () => {
    useCallStore.getState().setError(null);
    useCallStore.getState().setConnectionStatus('connecting');
    try {
      if (!agoraCallService.isAvailable()) throw new Error('Calls require an Ourlime development or production build.');
      const created = await callService.createCall(calleeId, type);
      useCallStore.getState().setSession(created);
      useCallStore.getState().setConnectionStatus('ringing');
      subscribeToCall(created.id);
      await nativeCallService.startOutgoingCall(created);
      await joinRtc(created);
    } catch (error: unknown) {
      useCallStore.getState().setError(error instanceof Error ? error.message : 'The call could not be started.');
    }
  }), [joinRtc, runExclusive, subscribeToCall]);

  const performAction = useCallback(async (action: CallAction) => runExclusive(async () => {
    const current = useCallStore.getState().session;
    if (!current) return;
    try {
      useCallStore.getState().setConnectionStatus(action === 'answer' ? 'connecting' : 'ending');
      const updated = await callService.updateCall(current.id, action);
      useCallStore.getState().setSession(updated);
      if (action === 'answer') await joinRtc(updated);
      if (action !== 'answer' && action !== 'connected') {
        await agoraCallService.leave();
        await nativeCallService.endNativeCall(updated.id, updated.endReason);
        useCallStore.getState().reset();
      }
    } catch (error: unknown) {
      useCallStore.getState().setError(error instanceof Error ? error.message : 'The call could not be updated.');
    }
  }), [joinRtc, runExclusive]);

  const answerCall = useCallback(() => performAction('answer'), [performAction]);
  const declineCall = useCallback(() => performAction('decline'), [performAction]);
  const endCall = useCallback(() => {
    const current = useCallStore.getState().session;
    return performAction(current?.state === 'ringing' && current.caller.userId === auth.currentUser?.uid ? 'cancel' : 'end');
  }, [performAction]);
  const toggleMute = useCallback(() => { const next = !useCallStore.getState().isMuted; agoraCallService.setMuted(next); useCallStore.getState().setMuted(next); }, []);
  const toggleVideo = useCallback(() => { const next = !useCallStore.getState().isVideoMuted; agoraCallService.setVideoMuted(next); useCallStore.getState().setVideoMuted(next); }, []);
  const toggleSpeaker = useCallback(() => { const next = !useCallStore.getState().isSpeakerEnabled; agoraCallService.setSpeakerEnabled(next); useCallStore.getState().setSpeakerEnabled(next); }, []);
  const switchCamera = useCallback(() => agoraCallService.switchCamera(), []);
  const minimize = useCallback(() => useCallStore.getState().setMinimized(true), []);
  const restore = useCallback(() => useCallStore.getState().setMinimized(false), []);

  const value = useMemo<CallContextValue>(() => ({ startCall, answerCall, declineCall, endCall, toggleMute, toggleVideo, toggleSpeaker, switchCamera, minimize, restore }), [answerCall, declineCall, endCall, minimize, restore, startCall, switchCamera, toggleMute, toggleSpeaker, toggleVideo]);
  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCallCoordinator(): CallContextValue {
  const context = useContext(CallContext);
  if (!context) throw new Error('CallProvider is required');
  return context;
}
