import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { DiagnosticLogService } from './DiagnosticLogService';
import { platformEnvironmentService } from './PlatformEnvironmentService';

export class CrashReportingService {
  private static instance: CrashReportingService;
  private readonly logger = DiagnosticLogService.getInstance();
  private initialization: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): CrashReportingService {
    if (!CrashReportingService.instance) {
      CrashReportingService.instance = new CrashReportingService();
    }
    return CrashReportingService.instance;
  }

  public initialize(): Promise<void> {
    if (!platformEnvironmentService.hasNativeFirebaseApp()) return Promise.resolve();
    if (this.initialization) return this.initialization;
    this.initialization = this.performInitialize().catch((error: unknown) => {
      this.logger.warn('CrashReportingService', 'initialize:unavailable', {
        message: error instanceof Error ? error.message : String(error),
      });
    });
    return this.initialization;
  }

  public async setUserId(userId: string | null): Promise<void> {
    await this.initialize();
    if (!platformEnvironmentService.hasNativeFirebaseApp()) return;
    try {
      const crashlyticsModule = await import('@react-native-firebase/crashlytics');
      await crashlyticsModule.setUserId(crashlyticsModule.getCrashlytics(), userId ?? 'signed-out');
    } catch {
      // Crash reporting must never become a crash source.
    }
  }

  public recordError(error: Error, context: string): void {
    void this.initialize().then(async () => {
      if (!platformEnvironmentService.hasNativeFirebaseApp()) return;
      try {
        const crashlyticsModule = await import('@react-native-firebase/crashlytics');
        crashlyticsModule.log(crashlyticsModule.getCrashlytics(), `context=${context}`);
        crashlyticsModule.recordError(crashlyticsModule.getCrashlytics(), error, context);
      } catch {
        // Crash reporting must never become a crash source.
      }
    });
  }

  public log(message: string): void {
    void this.initialize().then(async () => {
      if (!platformEnvironmentService.hasNativeFirebaseApp()) return;
      try {
        const crashlyticsModule = await import('@react-native-firebase/crashlytics');
        crashlyticsModule.log(crashlyticsModule.getCrashlytics(), message.slice(0, 1_000));
      } catch {
        // Crash reporting must never become a crash source.
      }
    });
  }

  private async performInitialize(): Promise<void> {
    const crashlyticsModule = await import('@react-native-firebase/crashlytics');
    const crashlytics = crashlyticsModule.getCrashlytics();
    await crashlyticsModule.setCrashlyticsCollectionEnabled(crashlytics, true);
    await crashlyticsModule.setAttributes(crashlytics, {
      appVersion: Constants.expoConfig?.version ?? 'unknown',
      platform: Platform.OS,
      reactNativeArchitecture: 'legacy',
    });
    const didCrashPreviously = await crashlyticsModule.didCrashOnPreviousExecution(crashlytics);
    this.logger.info('CrashReportingService', 'initialize', { didCrashPreviously });
    if (didCrashPreviously) crashlyticsModule.log(crashlytics, 'Previous execution ended in a native crash.');
  }
}

export const crashReportingService = CrashReportingService.getInstance();
