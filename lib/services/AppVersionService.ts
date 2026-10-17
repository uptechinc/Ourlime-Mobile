import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

/**
 * siteConfig/mobileApp (public read, admin write in firestore.rules). Every field is optional; a missing doc or
 * field means "no minimum" and "no update".
 */
export type MobileAppConfig = {
  minimumVersion?: unknown;
  androidStoreUrl?: unknown;
  iosStoreUrl?: unknown;
  updateMessage?: unknown;
  latestVersion?: unknown;
  latestVersionCode?: unknown;
  apkUrl?: unknown;
  apkSha256?: unknown;
  apkSizeBytes?: unknown;
  releaseNotes?: unknown;
  releasedAt?: unknown;
  otaAvailable?: unknown;
  sideloadUpdates?: unknown;
};

/** The newest published build, validated. Fields that failed validation are null (never trusted half-way). */
export type AppRelease = {
  version: string;
  versionCode: number | null;
  apkUrl: string | null;
  apkSha256: string | null;
  apkSizeBytes: number | null;
  releaseNotes: string[];
  releasedAtMs: number | null;
  otaAvailable: boolean;
  /** Kill switch: false turns the in-app APK installer off (the store link is used instead). */
  sideloadUpdates: boolean;
};

/** What this device is running. versionCode is null when the native build number can't be read. */
export type InstalledBuild = {
  version: string;
  versionCode: number | null;
};

export type AppVersionCheck =
  | { status: 'supported' }
  | {
    status: 'update_available';
    installedVersion: string;
    installedVersionCode: number | null;
    storeUrl: string;
    release: AppRelease;
  }
  | {
    status: 'update_required';
    installedVersion: string;
    minimumVersion: string;
    storeUrl: string;
    message: string;
    release: AppRelease | null;
  };

// The app keeps running while this loads (the screen appears when the answer arrives), so the wait can be long.
const CONFIG_TIMEOUT_MS = 30000;
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.ourlime.app';
const WEBSITE_URL = 'https://ourlime.com';
const STORE_URL_PATTERN = /^(https:\/\/|market:\/\/|itms-apps:\/\/)/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DEFAULT_MESSAGE = 'This version of Ourlime is no longer supported. Update to the latest version to keep using the app.';
const MAX_RELEASE_NOTES = 12;
const MAX_RELEASE_NOTE_LENGTH = 240;

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const readPositiveInteger = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;

const readHttpsUrl = (value: unknown): string | null => {
  const text = readString(value);
  if (!text.startsWith('https://')) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' && Boolean(url.hostname) ? text : null;
  } catch {
    return null;
  }
};

const readTimestampMs = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  const timestamp = value as { toMillis?: () => number } | null | undefined;
  if (typeof timestamp?.toMillis === 'function') {
    const millis = timestamp.toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  return null;
};

/**
 * Minimum supported app version and the newest published release. Builds older than
 * siteConfig/mobileApp.minimumVersion are blocked with an update screen, because the server rules change underneath
 * them (registration and feed reads are denied to old builds). Newer releases are offered, never forced.
 * Fails open: if the config can't be read in time or is malformed, the app runs and nothing is offered.
 */
export class AppVersionService {
  private static instance: AppVersionService;

  private constructor() {}

  public static getInstance(): AppVersionService {
    if (!AppVersionService.instance) AppVersionService.instance = new AppVersionService();
    return AppVersionService.instance;
  }

  public getInstalledVersion(): string {
    return readString(Constants.expoConfig?.version);
  }

  /** versionName from the app config, versionCode from the native build (never parsed from app.json at runtime). */
  public getInstalledBuild(): InstalledBuild {
    let versionCode: number | null = null;
    try {
      // Lazy: dev clients built before expo-application was added don't have the native module.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Application = require('expo-application') as typeof import('expo-application');
      const parsed = Number(Application.nativeBuildVersion);
      versionCode = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
    } catch (error) {
      console.warn('[AppVersionService.getInstalledBuild] Error:', error instanceof Error ? error.message : 'Unknown error');
    }
    return { version: this.getInstalledVersion(), versionCode };
  }

  public async check(): Promise<AppVersionCheck> {
    try {
      const config = await this.loadConfig();
      const installed = this.getInstalledBuild();
      return this.evaluate(installed.version, config, Platform.OS, installed.versionCode);
    } catch (error) {
      console.warn('[AppVersionService.check] Error:', error instanceof Error ? error.message : 'Unknown error');
      return { status: 'supported' };
    }
  }

  /**
   * Follows siteConfig/mobileApp live (public read, works before sign-in), so a release shows up within seconds.
   * Errors are reported as null (= nothing to offer); the foreground re-check is the safety net.
   */
  public subscribe(onConfig: (config: MobileAppConfig | null) => void): Unsubscribe {
    try {
      return onSnapshot(
        doc(db, 'siteConfig', 'mobileApp'),
        (snapshot) => onConfig(snapshot.exists() ? (snapshot.data() as MobileAppConfig) : null),
        (error) => console.warn('[AppVersionService.subscribe] Error:', error.message),
      );
    } catch (error) {
      console.warn('[AppVersionService.subscribe] Error:', error instanceof Error ? error.message : 'Unknown error');
      return () => undefined;
    }
  }

  /** Pure decision, so it can be tested without Firestore. */
  public evaluate(
    installedVersion: string,
    config: MobileAppConfig | null,
    platform: string,
    installedVersionCode: number | null = null,
  ): AppVersionCheck {
    if (!config) return { status: 'supported' };
    const installed = this.parseVersion(installedVersion);
    const release = this.readRelease(config);
    const minimumVersion = readString(config.minimumVersion);
    const minimum = this.parseVersion(minimumVersion);
    if (installed && minimum && this.compare(installed, minimum) < 0) {
      return {
        status: 'update_required',
        installedVersion,
        minimumVersion,
        storeUrl: this.storeUrl(config, platform),
        message: readString(config.updateMessage) || DEFAULT_MESSAGE,
        release: release && this.isNewer(release, installed, installedVersionCode, platform) ? release : null,
      };
    }
    if (release && this.isNewer(release, installed, installedVersionCode, platform)) {
      return { status: 'update_available', installedVersion, installedVersionCode, storeUrl: this.storeUrl(config, platform), release };
    }
    return { status: 'supported' };
  }

  /** Validates the release fields; null when the doc names no usable newer build (no version and no versionCode). */
  public readRelease(config: MobileAppConfig): AppRelease | null {
    const version = this.parseVersion(readString(config.latestVersion)) ? readString(config.latestVersion) : '';
    const versionCode = readPositiveInteger(config.latestVersionCode);
    if (!version && versionCode === null) return null;
    const apkSha256 = readString(config.apkSha256).toLowerCase();
    const releaseNotes = Array.isArray(config.releaseNotes)
      ? config.releaseNotes
        .map((note) => readString(note).slice(0, MAX_RELEASE_NOTE_LENGTH))
        .filter((note) => note.length > 0)
        .slice(0, MAX_RELEASE_NOTES)
      : [];
    return {
      version,
      versionCode,
      apkUrl: readHttpsUrl(config.apkUrl),
      apkSha256: SHA256_PATTERN.test(apkSha256) ? apkSha256 : null,
      apkSizeBytes: readPositiveInteger(config.apkSizeBytes),
      releaseNotes,
      releasedAtMs: readTimestampMs(config.releasedAt),
      otaAvailable: config.otaAvailable === true,
      sideloadUpdates: config.sideloadUpdates !== false,
    };
  }

  /** Android compares versionCode (the real APK key) when both sides have one; otherwise the semver names. */
  public isNewer(release: AppRelease, installed: number[] | null, installedVersionCode: number | null, platform: string): boolean {
    if (platform === 'android' && release.versionCode !== null && installedVersionCode !== null) {
      return release.versionCode > installedVersionCode;
    }
    const latest = this.parseVersion(release.version);
    return Boolean(latest && installed && this.compare(latest, installed) > 0);
  }

  /** "1.2.3" → [1, 2, 3]; anything else (empty, "1.x") → null, which never blocks. */
  public parseVersion(version: string): number[] | null {
    if (!/^\d+(\.\d+){0,3}$/.test(version)) return null;
    return version.split('.').map((part) => Number(part));
  }

  public compare(left: number[], right: number[]): number {
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index++) {
      const difference = (left[index] ?? 0) - (right[index] ?? 0);
      if (difference !== 0) return difference;
    }
    return 0;
  }

  private storeUrl(config: MobileAppConfig, platform: string): string {
    const configured = readString(platform === 'ios' ? config.iosStoreUrl : config.androidStoreUrl);
    if (STORE_URL_PATTERN.test(configured)) return configured;
    return platform === 'android' ? ANDROID_STORE_URL : WEBSITE_URL;
  }

  private async loadConfig(): Promise<MobileAppConfig | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Timed out reading siteConfig/mobileApp')), CONFIG_TIMEOUT_MS);
    });
    try {
      const snapshot = await Promise.race([getDoc(doc(db, 'siteConfig', 'mobileApp')), timeout]);
      return snapshot.exists() ? (snapshot.data() as MobileAppConfig) : null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export const appVersionService = AppVersionService.getInstance();
