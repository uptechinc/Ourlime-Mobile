import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Linking, Platform, type AppStateStatus, type EmitterSubscription } from 'react-native';
import { appVersionService, type AppRelease, type InstalledBuild, type MobileAppConfig } from './AppVersionService';
import { appUpdateStateMachine, type AppUpdateEvent } from './AppUpdateStateMachine';
import { otaUpdateService } from './OtaUpdateService';
import { nativeAppUpdateService, type ApkInstallEvent } from './NativeAppUpdateService';
import { DiagnosticLogService } from './DiagnosticLogService';
import { useAppUpdateStore, type AppUpdatePrompt } from '@/lib/store/useAppUpdateStore';
import { useCallStore } from '@/lib/store/useCallStore';
import { usePostSubmissionStore } from '@/lib/store/usePostSubmissionStore';

const RECHECK_INTERVAL_MS = 10 * 60 * 1000;
const SNOOZE_MS = 24 * 60 * 60 * 1000;
/** If siteConfig/mobileApp doesn't answer in time, "What's new" still runs (without release notes). */
const WHATS_NEW_CONFIG_WAIT_MS = 8000;
const SNOOZE_KEY_PREFIX = 'ourlime_update_snoozed_until_';
const LAST_SEEN_BUILD_KEY = 'ourlime_last_seen_version_code';
const LAST_SEEN_OTA_KEY = 'ourlime_last_seen_update_id';
const ANDROID_MARKET_URL = 'market://details?id=com.ourlime.mobile';
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=com.ourlime.mobile';

const readStorage = async (key: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = async (key: string, value: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error: unknown) {
    console.warn('[AppUpdateService.writeStorage] Error:', error instanceof Error ? error.message : error);
  }
};

const formatMegabytes = (bytes: number): string => `${Math.max(1, Math.round(bytes / (1024 * 1024)))} MB`;

/**
 * The one place the update flow lives (UI talks to it through useAppUpdate). Signals: a live listener on
 * siteConfig/mobileApp, a throttled foreground re-check (Firestore + EAS Update), app_update pushes, and the Settings
 * row. Releases are offered in a sheet; the APK path downloads, verifies and hands over to Android's installer, the
 * OTA path downloads and restarts on a tap. Nothing restarts, reloads or opens the installer on its own during a call
 * or an upload. Every failure falls back to "no update" so a broken update system never gets in the way.
 */
export class AppUpdateService {
  private static instance: AppUpdateService;
  private readonly logger = DiagnosticLogService.getInstance();
  private isStarted = false;
  private installed: InstalledBuild = { version: '', versionCode: null };
  private lastCheckedAt = 0;
  private hasHandledWhatsNew = false;
  /** An automatic prompt that waited for a call or upload to end. */
  private hasDeferredPrompt = false;
  /** Releases already offered automatically this session (the sheet doesn't pop up again on every snapshot). */
  private readonly promptedKeys = new Set<string>();
  private isAwaitingInstallPermission = false;
  private releaseSubscriptions: Array<() => void> = [];

  private constructor() {}

  public static getInstance(): AppUpdateService {
    if (!AppUpdateService.instance) AppUpdateService.instance = new AppUpdateService();
    return AppUpdateService.instance;
  }

  /** Called once from the root layout (before sign-in too). Safe to call again. */
  public start(): void {
    if (this.isStarted) return;
    this.isStarted = true;
    try {
      this.installed = appVersionService.getInstalledBuild();
      useAppUpdateStore.setState({
        installedVersion: this.installed.version,
        installedVersionCode: this.installed.versionCode,
        canInstallInApp: nativeAppUpdateService.isAvailable(),
      });
      otaUpdateService.logLaunchState();

      const unsubscribeConfig = appVersionService.subscribe((config) => this.applyConfig(config));
      const appStateSubscription = AppState.addEventListener('change', (state) => this.handleAppStateChange(state));
      const unsubscribeCalls = useCallStore.subscribe(() => this.flushDeferredPrompt());
      const unsubscribeUploads = usePostSubmissionStore.subscribe(() => this.flushDeferredPrompt());
      const progressSubscription = nativeAppUpdateService.onProgress((progress) => this.dispatch({ type: 'download_progress', ...progress }));
      const installSubscription = nativeAppUpdateService.onInstallStatus((event) => this.handleInstallStatus(event));
      this.releaseSubscriptions = [
        unsubscribeConfig,
        () => appStateSubscription.remove(),
        unsubscribeCalls,
        unsubscribeUploads,
        () => this.removeSubscription(progressSubscription),
        () => this.removeSubscription(installSubscription),
      ];

      setTimeout(() => {
        if (!this.hasHandledWhatsNew) void this.handleWhatsNew(null);
      }, WHATS_NEW_CONFIG_WAIT_MS);
      void this.refresh(false);
    } catch (error: unknown) {
      console.warn('[AppUpdateService.start] Error:', error instanceof Error ? error.message : error);
    }
  }

  public stop(): void {
    this.releaseSubscriptions.forEach((release) => release());
    this.releaseSubscriptions = [];
    this.isStarted = false;
  }

  private removeSubscription(subscription: EmitterSubscription | null): void {
    subscription?.remove();
  }

  private dispatch(event: AppUpdateEvent): void {
    const current = useAppUpdateStore.getState();
    const next = appUpdateStateMachine.transition(current, event);
    if (next === current) return;
    if (next.status !== current.status) {
      this.logger.info('AppUpdateService', 'status', { from: current.status, to: next.status, event: event.type, source: next.source ?? 'none' });
    }
    useAppUpdateStore.setState(next);
  }

  private setPrompt(prompt: AppUpdatePrompt): void {
    useAppUpdateStore.setState({ prompt });
  }

  /** A call or an upload in flight: nothing restarts the app or opens the installer on its own until it ends. */
  public isAppBusy(): boolean {
    const call = useCallStore.getState();
    const isInCall = call.session !== null || (call.connectionStatus !== 'idle' && call.connectionStatus !== 'error');
    const isUploading = usePostSubmissionStore.getState().submission?.status === 'running';
    return isInCall || isUploading;
  }

  // ── Signals ──────────────────────────────────────────────────────────────────

  private applyConfig(config: MobileAppConfig | null): void {
    const versionCheck = appVersionService.evaluate(this.installed.version, config, Platform.OS, this.installed.versionCode);
    this.dispatch({ type: 'check_finished', versionCheck, otaReady: otaUpdateService.hasPendingUpdate() });
    if (!this.hasHandledWhatsNew) void this.handleWhatsNew(config ? appVersionService.readRelease(config) : null);
    void this.maybePromptAutomatically();
  }

  private handleAppStateChange(state: AppStateStatus): void {
    if (state !== 'active') return;
    if (this.isAwaitingInstallPermission) void this.resumeAfterPermission();
    if (Date.now() - this.lastCheckedAt > RECHECK_INTERVAL_MS) void this.refresh(false);
  }

  /** Re-reads siteConfig/mobileApp and asks EAS Update; the safety net when the live listener is offline. */
  public async refresh(isManual: boolean): Promise<void> {
    this.lastCheckedAt = Date.now();
    if (isManual) this.dispatch({ type: 'check_started' });
    try {
      const [versionCheck, otaResult] = await Promise.all([appVersionService.check(), otaUpdateService.check()]);
      this.dispatch({ type: 'check_finished', versionCheck, otaReady: otaUpdateService.hasPendingUpdate() });
      const state = useAppUpdateStore.getState();
      // A JavaScript-only update applies when there's no new APK to install for this device.
      if (otaResult === 'available' && state.status === 'up_to_date') {
        this.dispatch({ type: 'ota_found' });
        await this.downloadOta();
      }
      await this.maybePromptAutomatically();
    } catch (error: unknown) {
      console.warn('[AppUpdateService.refresh] Error:', error instanceof Error ? error.message : error);
      if (isManual) this.dispatch({ type: 'failed', message: 'Could not check for updates. Try again later.' });
    }
  }

  /** From an app_update push: a push for a build this device already has is ignored. */
  public isStalePush(versionCode: number | null): boolean {
    return versionCode !== null && this.installed.versionCode !== null && this.installed.versionCode >= versionCode;
  }

  public openFromPush(versionCode: number | null): void {
    if (this.isStalePush(versionCode)) return;
    this.openSheet();
  }

  // ── Sheet ────────────────────────────────────────────────────────────────────

  /** Settings row / push / banner: shows the sheet even if "Later" was picked, and checks again. */
  public openSheet(): void {
    useAppUpdateStore.setState({ isSheetVisible: true, sheetMode: 'update' });
    const { status } = useAppUpdateStore.getState();
    if (status === 'idle' || status === 'up_to_date' || status === 'error') void this.refresh(true);
  }

  /** "Later" (or closing the sheet): the release is snoozed for 24 h; a newer release prompts again right away. */
  public dismissSheet(): void {
    const state = useAppUpdateStore.getState();
    useAppUpdateStore.setState({ isSheetVisible: false, prompt: 'none' });
    if (state.sheetMode === 'update' && state.status === 'available' && state.release) {
      void writeStorage(this.snoozeKey(state.release), String(Date.now() + SNOOZE_MS));
    }
  }

  private snoozeKey(release: AppRelease): string {
    return `${SNOOZE_KEY_PREFIX}${release.versionCode ?? release.version}`;
  }

  private async isSnoozed(release: AppRelease): Promise<boolean> {
    const until = Number(await readStorage(this.snoozeKey(release)));
    return Number.isFinite(until) && until > Date.now();
  }

  private async maybePromptAutomatically(): Promise<void> {
    const state = useAppUpdateStore.getState();
    if (state.isSheetVisible || state.versionCheck.status === 'update_required') return;
    const isReleaseOffer = state.status === 'available' && state.source === null && state.release !== null;
    const isRestartOffer = state.status === 'ready_to_restart';
    if (!isReleaseOffer && !isRestartOffer) return;
    const promptKey = isRestartOffer ? 'ota' : `release:${state.release?.versionCode ?? state.release?.version}`;
    if (this.promptedKeys.has(promptKey)) return;
    if (isReleaseOffer && state.release && await this.isSnoozed(state.release)) return;
    if (this.isAppBusy()) {
      this.hasDeferredPrompt = true;
      return;
    }
    this.promptedKeys.add(promptKey);
    useAppUpdateStore.setState({ isSheetVisible: true, sheetMode: 'update' });
  }

  private flushDeferredPrompt(): void {
    if (!this.hasDeferredPrompt || this.isAppBusy()) return;
    this.hasDeferredPrompt = false;
    void this.maybePromptAutomatically();
  }

  // ── What's new ───────────────────────────────────────────────────────────────

  /** Once after the build (or the OTA update) changes; a fresh install only records what it runs. */
  private async handleWhatsNew(release: AppRelease | null): Promise<void> {
    if (this.hasHandledWhatsNew) return;
    this.hasHandledWhatsNew = true;
    try {
      const buildKey = String(this.installed.versionCode ?? this.installed.version);
      const updateId = otaUpdateService.getRunningUpdateId();
      const [lastBuild, lastUpdateId] = await Promise.all([readStorage(LAST_SEEN_BUILD_KEY), readStorage(LAST_SEEN_OTA_KEY)]);
      await writeStorage(LAST_SEEN_BUILD_KEY, buildKey);
      if (updateId) await writeStorage(LAST_SEEN_OTA_KEY, updateId);
      const isNewBuild = lastBuild !== null && lastBuild !== buildKey;
      const isNewOta = !isNewBuild && updateId !== null && lastUpdateId !== null && lastUpdateId !== updateId;
      if (!isNewBuild && !isNewOta) return;
      if (isNewBuild) void nativeAppUpdateService.clearDownloads();
      const notesMatchThisBuild = release !== null
        && ((release.versionCode !== null && release.versionCode === this.installed.versionCode) || release.version === this.installed.version);
      useAppUpdateStore.setState({
        whatsNewVersion: this.installed.version,
        whatsNewNotes: notesMatchThisBuild ? release.releaseNotes : [],
      });
      this.logger.info('AppUpdateService', 'whats-new', { build: buildKey, isNewOta });
      if (!useAppUpdateStore.getState().isSheetVisible) useAppUpdateStore.setState({ isSheetVisible: true, sheetMode: 'whats_new' });
    } catch (error: unknown) {
      console.warn('[AppUpdateService.handleWhatsNew] Error:', error instanceof Error ? error.message : error);
    }
  }

  // ── Update actions ───────────────────────────────────────────────────────────

  /** "Update now" / "Restart now" / "Install": continues the flow from wherever it is. */
  public async startUpdate(): Promise<void> {
    const state = useAppUpdateStore.getState();
    if (state.status === 'ready_to_restart') return this.restart();
    if (state.status === 'ready_to_install') return this.install();
    if (state.status !== 'available' && state.status !== 'error') return;
    if (state.source === 'ota') return this.downloadOta();
    const release = state.release;
    if (!release) return;
    if (this.canDownloadApk(release)) return this.startApkDownload(false);
    return this.openExternalUpdate(release);
  }

  private canDownloadApk(release: AppRelease): boolean {
    return Platform.OS === 'android'
      && nativeAppUpdateService.isAvailable()
      && release.sideloadUpdates
      && release.apkUrl !== null
      && release.apkSha256 !== null
      && release.apkSizeBytes !== null;
  }

  /** No in-app installer (iOS, Play builds, older binaries): the APK link on sideload builds, else the store. */
  public async openExternalUpdate(release: AppRelease | null): Promise<void> {
    const state = useAppUpdateStore.getState();
    const storeUrl = state.versionCheck.status === 'supported' ? (Platform.OS === 'android' ? ANDROID_STORE_URL : 'https://ourlime.com') : state.versionCheck.storeUrl;
    const isSideload = nativeAppUpdateService.getDistribution() === 'sideload';
    const urls = Platform.OS === 'android' && isSideload && release?.apkUrl && release.sideloadUpdates
      ? [release.apkUrl]
      : storeUrl === ANDROID_STORE_URL ? [ANDROID_MARKET_URL, ANDROID_STORE_URL] : [storeUrl];
    for (const url of urls) {
      try {
        await Linking.openURL(url);
        return;
      } catch (error: unknown) {
        console.warn('[AppUpdateService.openExternalUpdate] Error:', error instanceof Error ? error.message : error);
      }
    }
  }

  private async downloadOta(): Promise<void> {
    this.dispatch({ type: 'download_started', source: 'ota', totalBytes: 0 });
    try {
      const isReady = await otaUpdateService.download();
      if (isReady) {
        this.dispatch({ type: 'ota_ready' });
        await this.maybePromptAutomatically();
      } else {
        this.dispatch({ type: 'download_cancelled' });
      }
    } catch (error: unknown) {
      console.warn('[AppUpdateService.downloadOta] Error:', error instanceof Error ? error.message : error);
      this.dispatch({ type: 'failed', message: 'The update could not be downloaded. Check your connection and try again.' });
    }
  }

  private async restart(): Promise<void> {
    if (this.isAppBusy()) {
      this.setPrompt('busy');
      return;
    }
    try {
      await otaUpdateService.restart();
    } catch (error: unknown) {
      console.warn('[AppUpdateService.restart] Error:', error instanceof Error ? error.message : error);
      this.dispatch({ type: 'failed', message: 'Ourlime could not restart. Close and reopen the app to finish updating.' });
    }
  }

  /** The metered-data question was answered "Download anyway". */
  public confirmMeteredDownload(): void {
    this.setPrompt('none');
    void this.startApkDownload(true);
  }

  public dismissPrompt(): void {
    this.isAwaitingInstallPermission = false;
    this.setPrompt('none');
  }

  public async openInstallPermissionSettings(): Promise<void> {
    this.isAwaitingInstallPermission = true;
    try {
      await nativeAppUpdateService.openInstallPermissionSettings();
    } catch (error: unknown) {
      this.isAwaitingInstallPermission = false;
      this.dispatch({ type: 'failed', message: error instanceof Error ? error.message : 'Android settings could not be opened.' });
    }
  }

  /** Back from Android settings: carry on where the flow stopped if "Install unknown apps" is now allowed. */
  private async resumeAfterPermission(): Promise<void> {
    if (!(await nativeAppUpdateService.canInstallPackages())) return;
    this.isAwaitingInstallPermission = false;
    this.setPrompt('none');
    const { status } = useAppUpdateStore.getState();
    if (status === 'ready_to_install') await this.install();
    else if (status === 'available' || status === 'error') await this.startApkDownload(true);
  }

  private async startApkDownload(allowMetered: boolean): Promise<void> {
    const release = useAppUpdateStore.getState().release;
    if (!release?.apkUrl || !release.apkSha256 || !release.apkSizeBytes) return;
    // Ask for "Install unknown apps" first, so nobody downloads 400+ MB and then hits a wall.
    if (!(await nativeAppUpdateService.canInstallPackages())) {
      this.setPrompt('install_permission');
      return;
    }
    if (!allowMetered && await nativeAppUpdateService.isMeteredConnection()) {
      this.setPrompt('metered_download');
      return;
    }
    this.setPrompt('none');
    this.dispatch({ type: 'download_started', source: 'apk', totalBytes: release.apkSizeBytes });
    try {
      const apkPath = await nativeAppUpdateService.downloadApk(release.apkUrl, release.apkSha256, release.apkSizeBytes);
      this.dispatch({ type: 'verify_started' });
      await nativeAppUpdateService.verifyApk(apkPath);
      this.dispatch({ type: 'apk_ready', apkPath });
      await this.install();
    } catch (error: unknown) {
      const code = (error as { code?: unknown } | null)?.code;
      if (code === 'UPDATE_CANCELLED') {
        this.dispatch({ type: 'download_cancelled' });
        return;
      }
      if (code === 'UPDATE_INSTALL_PERMISSION') {
        this.setPrompt('install_permission');
        return;
      }
      this.dispatch({ type: 'failed', message: error instanceof Error ? error.message : 'The update could not be downloaded.' });
    }
  }

  public async cancelDownload(): Promise<void> {
    if (useAppUpdateStore.getState().source !== 'apk') return;
    await nativeAppUpdateService.cancelDownload();
  }

  private async install(): Promise<void> {
    const { apkPath, status } = useAppUpdateStore.getState();
    if (!apkPath || status !== 'ready_to_install') return;
    if (this.isAppBusy()) {
      this.setPrompt('busy');
      return;
    }
    if (!(await nativeAppUpdateService.canInstallPackages())) {
      this.setPrompt('install_permission');
      return;
    }
    this.dispatch({ type: 'install_started' });
    try {
      await nativeAppUpdateService.installApk(apkPath);
    } catch (error: unknown) {
      this.dispatch({ type: 'failed', message: error instanceof Error ? error.message : 'The update could not be installed.' });
    }
  }

  private handleInstallStatus(event: ApkInstallEvent): void {
    this.logger.info('AppUpdateService', 'install:status', { status: event.status });
    if (event.status === 'aborted') this.dispatch({ type: 'install_cancelled' });
    else if (event.status === 'failure') this.dispatch({ type: 'failed', message: event.message || 'Android could not install the update.' });
  }

  /** Size line for the sheet and the metered-data question. */
  public describeSize(release: AppRelease | null): string {
    return release?.apkSizeBytes ? formatMegabytes(release.apkSizeBytes) : '';
  }
}

export const appUpdateService = AppUpdateService.getInstance();
