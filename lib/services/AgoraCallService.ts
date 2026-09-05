import { DiagnosticLogService } from './DiagnosticLogService';
import { platformEnvironmentService } from './PlatformEnvironmentService';
import type { AgoraParticipantCredentials, CallType } from '@/lib/types/call';

type AgoraStateListener = {
  onConnected: () => void;
  onRemoteJoined: (uid: number) => void;
  onRemoteLeft: (uid: number) => void;
  onError: (message: string) => void;
};

export class AgoraCallService {
  private static instance: AgoraCallService;
  private readonly logger = DiagnosticLogService.getInstance();
  private engine: import('react-native-agora').IRtcEngine | null = null;
  private eventHandler: import('react-native-agora').IRtcEngineEventHandler | null = null;
  private listener: AgoraStateListener | null = null;

  private isSwitchingCamera = false;

  private constructor() {}

  public static getInstance(): AgoraCallService {
    if (!AgoraCallService.instance) AgoraCallService.instance = new AgoraCallService();
    return AgoraCallService.instance;
  }

  public isAvailable(): boolean {
    return platformEnvironmentService.isNativeCallingSupported();
  }

  public async join(credentials: AgoraParticipantCredentials, type: CallType, listener: AgoraStateListener): Promise<void> {
    if (!this.isAvailable()) throw new Error('Calls require an Ourlime development or production build.');
    await this.leave();
    const Camera = await import('expo-camera');
    const microphonePermission = await Camera.Camera.requestMicrophonePermissionsAsync();
    if (!microphonePermission.granted) throw new Error('Microphone permission is required for calls.');
    if (type === 'video') {
      const cameraPermission = await Camera.Camera.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) throw new Error('Camera permission is required for video calls.');
    }
    const Agora = await import('react-native-agora');
    const engine = Agora.createAgoraRtcEngine();
    this.listener = listener;
    this.eventHandler = {
      onJoinChannelSuccess: () => this.listener?.onConnected(),
      onUserJoined: (_connection, remoteUid) => this.listener?.onRemoteJoined(remoteUid),
      onUserOffline: (_connection, remoteUid) => this.listener?.onRemoteLeft(remoteUid),
      onError: (errorCode, message) => this.listener?.onError(`${message || 'Agora connection failed'} (${errorCode})`),
    };
    engine.initialize({ appId: credentials.appId, channelProfile: Agora.ChannelProfileType.ChannelProfileCommunication });
    engine.registerEventHandler(this.eventHandler);
    engine.enableAudio();

    // High quality speech audio scenario with platform ducking
    engine.setAudioProfile(
      Agora.AudioProfileType.AudioProfileSpeechStandard,
      Agora.AudioScenarioType.AudioScenarioDefault
    );

    if (type === 'video') {
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
    this.logger.info('AgoraCallService', 'join', { channel: credentials.channelName, uid: credentials.uid, type });
  }

  public setMuted(muted: boolean): void { this.engine?.muteLocalAudioStream(muted); }
  public setVideoMuted(muted: boolean): void { this.engine?.muteLocalVideoStream(muted); }
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
    if (!this.engine) return;
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
