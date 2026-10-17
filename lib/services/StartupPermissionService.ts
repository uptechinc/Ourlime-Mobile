import { Platform } from 'react-native';
import { DiagnosticLogService } from './DiagnosticLogService';

/**
 * After sign-in, right after the notifications prompt (like WhatsApp): asks for the microphone (voice notes and calls)
 * and the camera (video calls) up front, so the first call or voice note doesn't stop to ask. Each is asked only once;
 * anything declined is asked again by that feature when it's used.
 */
export class StartupPermissionService {
  private static instance: StartupPermissionService;
  private readonly logger = DiagnosticLogService.getInstance();
  private hasRequested = false;

  private constructor() {}

  public static getInstance(): StartupPermissionService {
    if (!StartupPermissionService.instance) StartupPermissionService.instance = new StartupPermissionService();
    return StartupPermissionService.instance;
  }

  public async requestCallAndVoicePermissions(): Promise<void> {
    if (this.hasRequested || Platform.OS === 'web') return;
    this.hasRequested = true;
    try {
      const { Camera } = await import('expo-camera');
      const microphone = await Camera.getMicrophonePermissionsAsync();
      if (microphone.status === 'undetermined') await Camera.requestMicrophonePermissionsAsync();
      const camera = await Camera.getCameraPermissionsAsync();
      if (camera.status === 'undetermined') await Camera.requestCameraPermissionsAsync();
      this.logger.info('StartupPermissionService', 'requested', { microphone: microphone.status, camera: camera.status });
    } catch (error: unknown) {
      console.warn('[StartupPermissionService.requestCallAndVoicePermissions] Error:', error instanceof Error ? error.message : error);
    }
  }
}

export const startupPermissionService = StartupPermissionService.getInstance();
