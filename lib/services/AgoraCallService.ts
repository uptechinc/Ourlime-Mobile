import { Asset } from 'expo-asset';
import { DiagnosticLogService } from './DiagnosticLogService';
import { nativeCallService } from './NativeCallService';
import { platformEnvironmentService } from './PlatformEnvironmentService';
import type { AgoraParticipantCredentials, CallType } from '@/lib/types/call';

type AgoraStateListener = {
  onConnected: () => void;
  onRemoteJoined: (uid: number) => void;
  onRemoteLeft: (uid: number) => void;
  onError: (message: string) => void;
  onLocalPreviewReady: () => void;
  /** True once the peer's video frames are actually being decoded (not just "peer joined"). */
  onRemoteVideoChanged: (ready: boolean) => void;
};

type AgoraModule = typeof import('react-native-agora');

// Standard ringback tone (440 + 480 Hz, 2 s on / 4 s off) the caller hears while the other phone rings.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RINGBACK_TONE = require('@/assets/sounds/ringback.wav') as number;
const RINGBACK_SOUND_ID = 1;

export class AgoraCallService {
  private static instance: AgoraCallService;
  private readonly logger = DiagnosticLogService.getInstance();
  private engine: import('react-native-agora').IRtcEngine | null = null;
  private eventHandler: import('react-native-agora').IRtcEngineEventHandler | null = null;
  private listener: AgoraStateListener | null = null;
  /** Engine created for the ringing camera preview; join() reuses it instead of recreating the camera. */
  private isPreviewOnly = false;
  private previewAppId: string | null = null;
  private isRingbackPlaying = false;
  private previewPromise: Promise<void> | null = null;

  private isSwitchingCamera = false;

  private constructor() {}

  public static getInstance(): AgoraCallService {
    if (!AgoraCallService.instance) AgoraCallService.instance = new AgoraCallService();
    return AgoraCallService.instance;
  }

  public isAvailable(): boolean {
    return platformEnvironmentService.isNativeCallingSupported();
  }

  /**
   * Shows the callee's own camera while an incoming video call rings (WhatsApp-style). Nothing is published until
   * join(); leave() turns the camera off if the call is declined, canceled or expires.
   */
  public startPreview(appId: string, onReady: () => void): Promise<void> {
    if (!this.isAvailable() || this.engine) return Promise.resolve();
    if (this.previewPromise) return this.previewPromise;
    this.previewPromise = (async () => {
      try {
        const Camera = await import('expo-camera');
        const cameraPermission = await Camera.Camera.requestCameraPermissionsAsync();
        if (!cameraPermission.granted || this.engine) return;
        const Agora = await import('react-native-agora');
        const engine = this.createEngine(Agora, appId);
        this.configureVideo(engine, Agora);
        this.engine = engine;
        this.isPreviewOnly = true;
        this.previewAppId = appId;
        onReady();
        this.logger.info('AgoraCallService', 'preview:start', {});
      } finally {
        this.previewPromise = null;
      }
    })();
    return this.previewPromise;
  }

  public async join(credentials: AgoraParticipantCredentials, type: CallType, peerName: string, listener: AgoraStateListener): Promise<void> {
    if (!this.isAvailable()) throw new Error('Calls require an Ourlime development or production build.');
    if (this.previewPromise) await this.previewPromise.catch(() => {});
    const canReusePreview = this.engine !== null && this.isPreviewOnly && type === 'video' && this.previewAppId === credentials.appId;
    if (!canReusePreview) await this.leave();
    const Camera = await import('expo-camera');
    const microphonePermission = await Camera.Camera.requestMicrophonePermissionsAsync();
    if (!microphonePermission.granted) throw new Error('Microphone permission is required for calls.');
    if (type === 'video' && !canReusePreview) {
      const cameraPermission = await Camera.Camera.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) throw new Error('Camera permission is required for video calls.');
    }
    const Agora = await import('react-native-agora');
    this.listener = listener;
    const engine = canReusePreview && this.engine ? this.engine : this.createEngine(Agora, credentials.appId);
    this.isPreviewOnly = false;

    // High quality speech audio scenario with platform ducking
    engine.setAudioProfile(
      Agora.AudioProfileType.AudioProfileSpeechStandard,
      Agora.AudioScenarioType.AudioScenarioDefault
    );

    if (type === 'video') {
      if (!canReusePreview) this.configureVideo(engine, Agora);
    } else {
      engine.disableVideo();
    }
    engine.joinChannel(credentials.token, credentials.channelName, credentials.uid, {
      clientRoleType: Agora.ClientRoleType.ClientRoleBroadcaster,
      publishMicrophoneTrack: true,
      publishCameraTrack: type === 'video',
      autoSubscribeAudio: true,
      autoSubscribeVideo: type === 'video',
    });
    this.engine = engine;
    // Local views mounted before the engine existed never bind; signal the UI to mount them now.
    if (type === 'video') this.listener?.onLocalPreviewReady();
    // Keeps the microphone (and camera) alive while the user switches to another app.
    void nativeCallService.startOngoingCall(peerName, type);
    this.logger.info('AgoraCallService', 'join', { channel: credentials.channelName, uid: credentials.uid, type, reusedPreview: canReusePreview });
  }

  private createEngine(Agora: AgoraModule, appId: string): import('react-native-agora').IRtcEngine {
    const engine = Agora.createAgoraRtcEngine();
    this.eventHandler = {
      onJoinChannelSuccess: () => this.listener?.onConnected(),
      onUserJoined: (_connection, remoteUid) => this.listener?.onRemoteJoined(remoteUid),
      onUserOffline: (_connection, remoteUid) => this.listener?.onRemoteLeft(remoteUid),
      onFirstRemoteVideoFrame: () => this.listener?.onRemoteVideoChanged(true),
      // The peer turning their camera off/on. Without this the last received frame stays frozen on screen.
      onUserMuteVideo: (_connection, _remoteUid, muted) => this.listener?.onRemoteVideoChanged(!muted),
      onUserEnableLocalVideo: (_connection, _remoteUid, enabled) => this.listener?.onRemoteVideoChanged(enabled),
      onRemoteVideoStateChanged: (_connection, _remoteUid, state, reason) => {
        if (state === Agora.RemoteVideoState.RemoteVideoStateDecoding) this.listener?.onRemoteVideoChanged(true);
        const peerStoppedVideo = state === Agora.RemoteVideoState.RemoteVideoStateStopped && (
          reason === Agora.RemoteVideoStateReason.RemoteVideoStateReasonRemoteMuted
          || reason === Agora.RemoteVideoStateReason.RemoteVideoStateReasonRemoteOffline
        );
        if (peerStoppedVideo || state === Agora.RemoteVideoState.RemoteVideoStateFailed) this.listener?.onRemoteVideoChanged(false);
      },
      onError: (errorCode, message) => this.listener?.onError(`${message || 'Agora connection failed'} (${errorCode})`),
    };
    engine.initialize({ appId, channelProfile: Agora.ChannelProfileType.ChannelProfileCommunication });
    engine.registerEventHandler(this.eventHandler);
    engine.enableAudio();
    return engine;
  }

  private configureVideo(engine: import('react-native-agora').IRtcEngine, Agora: AgoraModule): void {
    engine.enableVideo();
    // Configure 720p 30fps encoder before startPreview to prevent hardware readjustment flicker
    engine.setVideoEncoderConfiguration({
      dimensions: { width: 720, height: 1280 },
      frameRate: 30,
      bitrate: 1710,
      orientationMode: Agora.OrientationMode.OrientationModeAdaptive,
      degradationPreference: Agora.DegradationPreference.MaintainQuality,
    });
    engine.startPreview();
  }

  public setMuted(muted: boolean): void { this.engine?.muteLocalAudioStream(muted); }
  /** Camera off really stops the camera (privacy light off) and tells the peer, who then sees my avatar instead of a frozen frame. */
  public setVideoMuted(muted: boolean): void {
    this.engine?.muteLocalVideoStream(muted);
    this.engine?.enableLocalVideo(!muted);
  }

  /** Loops the ringback tone through the call's audio route until the peer answers or the call ends. */
  public async startRingback(): Promise<void> {
    if (!this.engine || this.isRingbackPlaying) return;
    this.isRingbackPlaying = true;
    try {
      const asset = Asset.fromModule(RINGBACK_TONE);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      if (!this.engine || !this.isRingbackPlaying) return;
      this.engine.playEffect(RINGBACK_SOUND_ID, uri.replace(/^file:\/\//, ''), -1, 1, 0, 100, false);
    } catch (error: unknown) {
      this.isRingbackPlaying = false;
      this.logger.warn('AgoraCallService', 'ringback:failed', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  public stopRingback(): void {
    if (!this.isRingbackPlaying) return;
    this.isRingbackPlaying = false;
    this.engine?.stopEffect(RINGBACK_SOUND_ID);
  }
  public setSpeakerEnabled(enabled: boolean): void { this.engine?.setEnableSpeakerphone(enabled); }

  public async switchCamera(): Promise<void> {
    if (!this.engine || this.isSwitchingCamera) return;
    this.isSwitchingCamera = true;
    try {
      this.engine.switchCamera();
    } catch (err: unknown) {
      this.logger.warn('AgoraCallService', 'switchCamera:failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTimeout(() => {
        this.isSwitchingCamera = false;
      }, 650);
    }
  }

  public async leave(): Promise<void> {
    if (this.previewPromise) await this.previewPromise.catch(() => {});
    if (!this.engine) return;
    this.stopRingback();
    const wasPreviewOnly = this.isPreviewOnly;
    this.isPreviewOnly = false;
    this.previewAppId = null;
    if (!wasPreviewOnly) void nativeCallService.stopOngoingCall();
    if (this.eventHandler) this.engine.unregisterEventHandler(this.eventHandler);
    this.engine.stopPreview();
    this.engine.leaveChannel();
    this.engine.release();
    this.engine = null;
    this.eventHandler = null;
    this.listener = null;
    this.isSwitchingCamera = false;
  }
}

export const agoraCallService = AgoraCallService.getInstance();
