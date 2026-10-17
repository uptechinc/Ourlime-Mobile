import Constants from 'expo-constants';
import { NativeEventEmitter, NativeModules, Platform, type EmitterSubscription } from 'react-native';
import { DiagnosticLogService } from './DiagnosticLogService';

export type AppDistribution = 'sideload' | 'play';

export type NativeInstalledInfo = {
  versionName: string;
  versionCode: number;
  signingCertSha256: string;
};

export type ApkDownloadProgress = {
  bytesReceived: number;
  totalBytes: number;
};

/** pending_user_action: Android's confirm screen is showing. success: the new build is installed (the process ends). */
export type ApkInstallStatus = 'pending_user_action' | 'success' | 'failure' | 'aborted';

export type ApkInstallEvent = {
  status: ApkInstallStatus;
  message: string;
};

/** Error codes the native module rejects with; each has a readable message from the module. */
export type NativeAppUpdateErrorCode =
  | 'UPDATE_UNAVAILABLE'
  | 'UPDATE_BUSY'
  | 'UPDATE_CANCELLED'
  | 'UPDATE_NETWORK'
  | 'UPDATE_HTTP'
  | 'UPDATE_NO_SPACE'
  | 'UPDATE_CHECKSUM'
  | 'UPDATE_SIZE'
  | 'UPDATE_WRONG_PACKAGE'
  | 'UPDATE_NOT_NEWER'
  | 'UPDATE_WRONG_SIGNATURE'
  | 'UPDATE_INVALID_APK'
  | 'UPDATE_INSTALL_PERMISSION'
  | 'UPDATE_INSTALL_FAILED';

type NativeDownloadResult = { path: string; sizeBytes: number; sha256: string };

type NativeAppUpdateModule = {
  getInstalledInfo: () => Promise<NativeInstalledInfo>;
  canInstallPackages: () => Promise<boolean>;
  openInstallPermissionSettings: () => Promise<void>;
  isMeteredConnection: () => Promise<boolean>;
  downloadApk: (url: string, expectedSha256: string, expectedSizeBytes: number) => Promise<NativeDownloadResult>;
  cancelDownload: () => Promise<void>;
  verifyApk: (path: string) => Promise<{ versionCode: number; versionName: string }>;
  installApk: (path: string) => Promise<void>;
  clearDownloads: () => Promise<void>;
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
};

const PROGRESS_EVENT = 'OurlimeAppUpdateProgress';
const INSTALL_EVENT = 'OurlimeAppUpdateInstallStatus';
const INSTALL_STATUSES: ReadonlySet<string> = new Set(['pending_user_action', 'success', 'failure', 'aborted']);

const readDistribution = (): AppDistribution => {
  const extra = Constants.expoConfig?.extra as { distribution?: unknown } | undefined;
  return extra?.distribution === 'play' ? 'play' : 'sideload';
};

function getNativeModule(): NativeAppUpdateModule | null {
  if (Platform.OS !== 'android') return null;
  const modules = NativeModules as { OurlimeAppUpdate?: NativeAppUpdateModule };
  return modules.OurlimeAppUpdate?.downloadApk ? modules.OurlimeAppUpdate : null;
}

export class NativeAppUpdateError extends Error {
  public constructor(public readonly code: NativeAppUpdateErrorCode | 'UNKNOWN', message: string) {
    super(message);
  }
}

const toUpdateError = (error: unknown): NativeAppUpdateError => {
  const source = error as { code?: unknown; message?: unknown } | null;
  const code = typeof source?.code === 'string' && source.code.startsWith('UPDATE_') ? source.code as NativeAppUpdateErrorCode : 'UNKNOWN';
  const message = typeof source?.message === 'string' && source.message ? source.message : 'The update could not be completed.';
  return new NativeAppUpdateError(code, message);
};

/**
 * In-app APK updates on sideload builds (plugins/native-update, Kotlin): download with resume and a SHA-256 check,
 * verify package / versionCode / signing certificate, then hand the file to Android's package installer (which always
 * asks the person to confirm). Not available on iOS, Play builds, or binaries built before the module existed.
 */
export class NativeAppUpdateService {
  private static instance: NativeAppUpdateService;
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): NativeAppUpdateService {
    if (!NativeAppUpdateService.instance) NativeAppUpdateService.instance = new NativeAppUpdateService();
    return NativeAppUpdateService.instance;
  }

  public getDistribution(): AppDistribution {
    return readDistribution();
  }

  public isAvailable(): boolean {
    return readDistribution() === 'sideload' && getNativeModule() !== null;
  }

  private requireModule(): NativeAppUpdateModule {
    const nativeModule = getNativeModule();
    if (!nativeModule || readDistribution() !== 'sideload') {
      throw new NativeAppUpdateError('UPDATE_UNAVAILABLE', 'In-app updates are not available in this build.');
    }
    return nativeModule;
  }

  public async getInstalledInfo(): Promise<NativeInstalledInfo | null> {
    try {
      return await this.requireModule().getInstalledInfo();
    } catch (error: unknown) {
      console.warn('[NativeAppUpdateService.getInstalledInfo] Error:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  public async canInstallPackages(): Promise<boolean> {
    try {
      return await this.requireModule().canInstallPackages();
    } catch {
      return false;
    }
  }

  public async openInstallPermissionSettings(): Promise<void> {
    try {
      await this.requireModule().openInstallPermissionSettings();
    } catch (error: unknown) {
      throw toUpdateError(error);
    }
  }

  /** True on mobile data / metered Wi-Fi; false when unknown (we don't nag without a reason). */
  public async isMeteredConnection(): Promise<boolean> {
    try {
      return await this.requireModule().isMeteredConnection();
    } catch {
      return false;
    }
  }

  public onProgress(listener: (progress: ApkDownloadProgress) => void): EmitterSubscription | null {
    const nativeModule = getNativeModule();
    if (!nativeModule) return null;
    return new NativeEventEmitter(nativeModule).addListener(PROGRESS_EVENT, (event: Partial<ApkDownloadProgress>) => {
      listener({
        bytesReceived: typeof event.bytesReceived === 'number' ? event.bytesReceived : 0,
        totalBytes: typeof event.totalBytes === 'number' ? event.totalBytes : 0,
      });
    });
  }

  public onInstallStatus(listener: (event: ApkInstallEvent) => void): EmitterSubscription | null {
    const nativeModule = getNativeModule();
    if (!nativeModule) return null;
    return new NativeEventEmitter(nativeModule).addListener(INSTALL_EVENT, (event: { status?: unknown; message?: unknown }) => {
      const status = typeof event.status === 'string' && INSTALL_STATUSES.has(event.status) ? event.status as ApkInstallStatus : 'failure';
      listener({ status, message: typeof event.message === 'string' ? event.message : '' });
    });
  }

  /** Streams the APK into the app cache (resuming a partial file) and checks size and SHA-256; resolves with its path. */
  public async downloadApk(url: string, expectedSha256: string, expectedSizeBytes: number): Promise<string> {
    const startedAt = Date.now();
    try {
      const result = await this.requireModule().downloadApk(url, expectedSha256, expectedSizeBytes);
      this.logger.info('NativeAppUpdateService', 'download', { sizeBytes: result.sizeBytes, elapsedMs: Date.now() - startedAt });
      return result.path;
    } catch (error: unknown) {
      const updateError = toUpdateError(error);
      if (updateError.code !== 'UPDATE_CANCELLED') {
        this.logger.warn('NativeAppUpdateService', 'download:failed', { code: updateError.code, reason: updateError.message });
      }
      throw updateError;
    }
  }

  public async cancelDownload(): Promise<void> {
    await getNativeModule()?.cancelDownload().catch(() => undefined);
  }

  /** Same package, higher versionCode, same signing certificate as the installed app; rejects with a readable reason. */
  public async verifyApk(path: string): Promise<void> {
    try {
      const result = await this.requireModule().verifyApk(path);
      this.logger.info('NativeAppUpdateService', 'verify', { versionCode: result.versionCode, versionName: result.versionName });
    } catch (error: unknown) {
      const updateError = toUpdateError(error);
      this.logger.warn('NativeAppUpdateService', 'verify:failed', { code: updateError.code, reason: updateError.message });
      throw updateError;
    }
  }

  /** Opens Android's installer for the verified file; progress arrives through onInstallStatus. */
  public async installApk(path: string): Promise<void> {
    try {
      await this.requireModule().installApk(path);
      this.logger.info('NativeAppUpdateService', 'install:started', {});
    } catch (error: unknown) {
      const updateError = toUpdateError(error);
      this.logger.warn('NativeAppUpdateService', 'install:failed', { code: updateError.code, reason: updateError.message });
      throw updateError;
    }
  }

  /** Removes downloaded update files (after a successful update, or when the release is withdrawn). */
  public async clearDownloads(): Promise<void> {
    await getNativeModule()?.clearDownloads().catch(() => undefined);
  }
}

export const nativeAppUpdateService = NativeAppUpdateService.getInstance();
