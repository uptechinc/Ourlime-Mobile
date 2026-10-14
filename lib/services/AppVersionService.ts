import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

/**
 * siteConfig/mobileApp (public read, admin write in firestore.rules). Every field is optional; a missing doc or
 * field means "no minimum".
 */
export type MobileAppConfig = {
  minimumVersion?: unknown;
  androidStoreUrl?: unknown;
  iosStoreUrl?: unknown;
  updateMessage?: unknown;
};

export type AppVersionCheck =
  | { status: 'supported' }
  | { status: 'update_required'; installedVersion: string; minimumVersion: string; storeUrl: string; message: string };

const CONFIG_TIMEOUT_MS = 6000;
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.ourlime.app';
const WEBSITE_URL = 'https://ourlime.com';
const STORE_URL_PATTERN = /^(https:\/\/|market:\/\/|itms-apps:\/\/)/;
const DEFAULT_MESSAGE = 'This version of Ourlime is no longer supported. Update to the latest version to keep using the app.';

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Minimum supported app version. Builds older than siteConfig/mobileApp.minimumVersion are blocked with an update
 * screen, because the server rules change underneath them (registration and feed reads are denied to old builds).
 * Fails open: if the config can't be read in time, the app runs.
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

  public async check(): Promise<AppVersionCheck> {
    try {
      const config = await this.loadConfig();
      return this.evaluate(this.getInstalledVersion(), config, Platform.OS);
    } catch (error) {
      console.warn('[AppVersionService.check] Error:', error instanceof Error ? error.message : 'Unknown error');
      return { status: 'supported' };
    }
  }

  /** Pure decision, so it can be tested without Firestore. */
  public evaluate(installedVersion: string, config: MobileAppConfig | null, platform: string): AppVersionCheck {
    const minimumVersion = readString(config?.minimumVersion);
    const installed = this.parseVersion(installedVersion);
    const minimum = this.parseVersion(minimumVersion);
    if (!config || !installed || !minimum || this.compare(installed, minimum) >= 0) return { status: 'supported' };
    return {
      status: 'update_required',
      installedVersion,
      minimumVersion,
      storeUrl: this.storeUrl(config, platform),
      message: readString(config.updateMessage) || DEFAULT_MESSAGE,
    };
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
