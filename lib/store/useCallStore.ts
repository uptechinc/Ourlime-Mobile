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
  isLocalPreviewReady: boolean;
  isLocalPrimary: boolean;
  /** Peer video frames are rendering (drives the in-call video layout). */
  isRemoteVideoReady: boolean;
  /** When the call became active, for the running call timer. */
  connectedAt: number | null;
  /** Android picture-in-picture: the app is shrunk into the floating call window. */
  isPictureInPicture: boolean;
  setSession: (session: CallSession | null) => void;
  setConnectionStatus: (status: CallConnectionStatus) => void;
  setRemoteUid: (uid: number | null) => void;
  setMuted: (muted: boolean) => void;
  setVideoMuted: (muted: boolean) => void;
  setSpeakerEnabled: (enabled: boolean) => void;
  setMinimized: (minimized: boolean) => void;
  setError: (message: string | null) => void;
  setLocalPreviewReady: (ready: boolean) => void;
  setLocalPrimary: (primary: boolean) => void;
  setRemoteVideoReady: (ready: boolean) => void;
  setPictureInPicture: (isPictureInPicture: boolean) => void;
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
  isLocalPreviewReady: false,
  isLocalPrimary: false,
  isRemoteVideoReady: false,
  connectedAt: null,
};

export const useCallStore = create<CallStoreState>((set) => ({
  ...INITIAL_CALL_STATE,
  isPictureInPicture: false,
  setSession: (session) => set({ session }),
  setConnectionStatus: (connectionStatus) => set((state) => ({
    connectionStatus,
    connectedAt: connectionStatus === 'active' ? (state.connectedAt ?? Date.now()) : state.connectedAt,
  })),
  setRemoteUid: (remoteUid) => set(remoteUid === null ? { remoteUid, isRemoteVideoReady: false } : { remoteUid }),
  setMuted: (isMuted) => set({ isMuted }),
  setVideoMuted: (isVideoMuted) => set({ isVideoMuted }),
  setSpeakerEnabled: (isSpeakerEnabled) => set({ isSpeakerEnabled }),
  setMinimized: (isMinimized) => set({ isMinimized }),
  setError: (errorMessage) => set({ errorMessage, connectionStatus: errorMessage ? 'error' : 'idle' }),
  setLocalPreviewReady: (isLocalPreviewReady) => set({ isLocalPreviewReady }),
  setLocalPrimary: (isLocalPrimary) => set({ isLocalPrimary }),
  setRemoteVideoReady: (isRemoteVideoReady) => set({ isRemoteVideoReady }),
  setPictureInPicture: (isPictureInPicture) => set({ isPictureInPicture }),
  // Picture-in-picture is window state, not call state: it survives a call ending while the window is small.
  reset: () => set((state) => ({ ...INITIAL_CALL_STATE, isPictureInPicture: state.isPictureInPicture })),
}));
