import { create } from 'zustand';
import type { CallSession } from '@/lib/types/call';

export type CallConnectionStatus = 'idle' | 'ringing' | 'connecting' | 'active' | 'ending' | 'error';

type CallStoreState = {
  session: CallSession | null;
  connectionStatus: CallConnectionStatus;
  remoteUid: number | null;
  isMuted: boolean;
  isVideoMuted: boolean;
  isSpeakerEnabled: boolean;
  isMinimized: boolean;
  errorMessage: string | null;
  setSession: (session: CallSession | null) => void;
  setConnectionStatus: (status: CallConnectionStatus) => void;
  setRemoteUid: (uid: number | null) => void;
  setMuted: (muted: boolean) => void;
  setVideoMuted: (muted: boolean) => void;
  setSpeakerEnabled: (enabled: boolean) => void;
  setMinimized: (minimized: boolean) => void;
  setError: (message: string | null) => void;
  reset: () => void;
};

const INITIAL_CALL_STATE = {
  session: null,
  connectionStatus: 'idle' as const,
  remoteUid: null,
  isMuted: false,
  isVideoMuted: false,
  isSpeakerEnabled: false,
  isMinimized: false,
  errorMessage: null,
};

export const useCallStore = create<CallStoreState>((set) => ({
  ...INITIAL_CALL_STATE,
  setSession: (session) => set({ session }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setRemoteUid: (remoteUid) => set({ remoteUid }),
  setMuted: (isMuted) => set({ isMuted }),
  setVideoMuted: (isVideoMuted) => set({ isVideoMuted }),
  setSpeakerEnabled: (isSpeakerEnabled) => set({ isSpeakerEnabled }),
  setMinimized: (isMinimized) => set({ isMinimized }),
  setError: (errorMessage) => set({ errorMessage, connectionStatus: errorMessage ? 'error' : 'idle' }),
  reset: () => set(INITIAL_CALL_STATE),
}));
