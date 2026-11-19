import { Platform } from 'react-native';
import { DiagnosticLogService } from './DiagnosticLogService';

export type NativeAppCheckStatus = 'idle' | 'initializing' | 'ready' | 'unavailable';

/** Initializes native App Check before Expo Router loads Firebase-backed screens. */
export class NativeAppCheckService {
  private static instance: NativeAppCheckService;
  private readonly logger = DiagnosticLogService.getInstance();
  private status: NativeAppCheckStatus = 'idle';
  private initialization: Promise<void> | null = null;

  public static getInstance(): NativeAppCheckService {
    return this.instance ??= new NativeAppCheckService();
  }

  public initialize(): Promise<void> {
    if (Platform.OS !== 'ios') {
      this.status = 'unavailable';
      return Promise.resolve();
    }
    this.initialization ??= this.initializeNative();
    return this.initialization;
  }

  public getStatus(): NativeAppCheckStatus {
    return this.status;
  }

  private async initializeNative(): Promise<void> {
    this.status = 'initializing';
    try {
      const [firebaseAppModule, appCheckModule] = await Promise.all([
        import('@react-native-firebase/app'),
        import('@react-native-firebase/app-check'),
      ]);
      const provider = new appCheckModule.ReactNativeFirebaseAppCheckProvider();
      provider.configure({
        apple: { provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback' },
      });
      await appCheckModule.initializeAppCheck(firebaseAppModule.getApp(), {
        provider,
        isTokenAutoRefreshEnabled: true,
      });
      this.status = 'ready';
      this.logger.info('NativeAppCheckService', 'initialize:ready', {
        platform: Platform.OS,
        provider: __DEV__ ? 'debug' : 'app-attest-device-check-fallback',
      });
    } catch (error: unknown) {
      this.status = 'unavailable';
      this.logger.warn('NativeAppCheckService', 'initialize:unavailable', {
        platform: Platform.OS,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const nativeAppCheckService = NativeAppCheckService.getInstance();
