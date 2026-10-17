import { Platform } from 'react-native';
import { DiagnosticLogService } from './DiagnosticLogService';

type UpdatesModule = typeof import('expo-updates');

export type OtaCheckResult = 'available' | 'none' | 'unavailable';

/**
 * JavaScript-only updates over EAS Update (expo-updates). app.json sets checkAutomatically to NEVER, so nothing
 * downloads or reloads by surprise: this service checks and downloads when asked, and the app restarts only when the
 * person taps "Restart now". A downloaded update that isn't applied right away is used on the next cold start.
 * In development, Expo Go, dev clients without the native module, or builds with updates off, every call is a no-op.
 */
export class OtaUpdateService {
  private static instance: OtaUpdateService;
  private readonly logger = DiagnosticLogService.getInstance();
  private updatesModule: UpdatesModule | null | undefined;
  private hasDownloadedUpdate = false;

  private constructor() {}

  public static getInstance(): OtaUpdateService {
    if (!OtaUpdateService.instance) OtaUpdateService.instance = new OtaUpdateService();
    return OtaUpdateService.instance;
  }

  private getModule(): UpdatesModule | null {
    if (this.updatesModule !== undefined) return this.updatesModule;
    this.updatesModule = null;
    if (__DEV__ || Platform.OS === 'web') return null;
    try {
      // Lazy: binaries built before expo-updates was added don't have the native module.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Updates = require('expo-updates') as UpdatesModule;
      this.updatesModule = Updates.isEnabled ? Updates : null;
    } catch (error: unknown) {
      console.warn('[OtaUpdateService.getModule] Error:', error instanceof Error ? error.message : error);
    }
    return this.updatesModule;
  }

  public isAvailable(): boolean {
    return this.getModule() !== null;
  }

  /** The update running now ("embedded" when it's the one built into the APK); used for the one-time "What's new". */
  public getRunningUpdateId(): string | null {
    const Updates = this.getModule();
    if (!Updates) return null;
    return Updates.isEmbeddedLaunch ? 'embedded' : Updates.updateId;
  }

  /** Logs how this launch went: an emergency launch means a downloaded update failed and the embedded one ran. */
  public logLaunchState(): void {
    const Updates = this.getModule();
    if (!Updates) return;
    if (Updates.isEmergencyLaunch) {
      this.logger.warn('OtaUpdateService', 'launch:emergency', { reason: Updates.emergencyLaunchReason ?? 'unknown' });
      return;
    }
    this.logger.info('OtaUpdateService', 'launch', {
      updateId: Updates.updateId ?? 'embedded',
      channel: Updates.channel ?? 'none',
      runtimeVersion: Updates.runtimeVersion ?? 'none',
    });
  }

  /** True once an update has been downloaded in this session (it applies on restart or the next cold start). */
  public hasPendingUpdate(): boolean {
    return this.hasDownloadedUpdate;
  }

  public async check(): Promise<OtaCheckResult> {
    const Updates = this.getModule();
    if (!Updates) return 'unavailable';
    try {
      const result = await Updates.checkForUpdateAsync();
      // A roll-back to the embedded build is applied like an update (it's what the server asks for).
      return result.isAvailable || result.isRollBackToEmbedded ? 'available' : 'none';
    } catch (error: unknown) {
      this.logger.warn('OtaUpdateService', 'check:failed', { reason: error instanceof Error ? error.message : String(error) });
      return 'unavailable';
    }
  }

  /** Downloads the update in the background; true when there's something new to restart into. */
  public async download(): Promise<boolean> {
    const Updates = this.getModule();
    if (!Updates) return false;
    const result = await Updates.fetchUpdateAsync();
    const isReady = result.isNew || result.isRollBackToEmbedded;
    if (isReady) this.hasDownloadedUpdate = true;
    this.logger.info('OtaUpdateService', 'download', { isNew: result.isNew, isRollBackToEmbedded: result.isRollBackToEmbedded });
    return isReady;
  }

  /** Restarts into the downloaded update. Only call from an explicit tap. */
  public async restart(): Promise<void> {
    const Updates = this.getModule();
    if (!Updates) return;
    this.logger.info('OtaUpdateService', 'restart', {});
    await Updates.reloadAsync();
  }
}

export const otaUpdateService = OtaUpdateService.getInstance();
