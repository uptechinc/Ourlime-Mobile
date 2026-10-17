import type { AppRelease, AppVersionCheck } from '@/lib/services/AppVersionService';

export type AppUpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'verifying'
  | 'ready_to_restart'
  | 'ready_to_install'
  | 'installing'
  | 'error'
  | 'up_to_date';

/** ota = a JavaScript-only update applied by restarting; apk = a new Android build installed by the system installer. */
export type AppUpdateSource = 'ota' | 'apk';

export type AppUpdateState = {
  status: AppUpdateStatus;
  source: AppUpdateSource | null;
  release: AppRelease | null;
  /** The last answer from siteConfig/mobileApp (drives the blocking screen too). */
  versionCheck: AppVersionCheck;
  progress: number;
  bytesReceived: number;
  totalBytes: number;
  errorMessage: string | null;
  /** A downloaded APK waiting on disk (ready_to_install / installing). */
  apkPath: string | null;
};

export type AppUpdateEvent =
  | { type: 'check_started' }
  | { type: 'check_finished'; versionCheck: AppVersionCheck; otaReady: boolean }
  | { type: 'ota_found' }
  | { type: 'download_started'; source: AppUpdateSource; totalBytes: number }
  | { type: 'download_progress'; bytesReceived: number; totalBytes: number }
  | { type: 'verify_started' }
  | { type: 'ota_ready' }
  | { type: 'apk_ready'; apkPath: string }
  | { type: 'install_started' }
  | { type: 'install_cancelled' }
  | { type: 'download_cancelled' }
  | { type: 'failed'; message: string };

export const INITIAL_APP_UPDATE_STATE: AppUpdateState = {
  status: 'idle',
  source: null,
  release: null,
  versionCheck: { status: 'supported' },
  progress: 0,
  bytesReceived: 0,
  totalBytes: 0,
  errorMessage: null,
  apkPath: null,
};

/** States in which work is under way; a new check must not interrupt them. */
const BUSY_STATUSES: ReadonlySet<AppUpdateStatus> = new Set(['downloading', 'verifying', 'installing']);
/** States that already hold a finished download; a re-check keeps them. */
const READY_STATUSES: ReadonlySet<AppUpdateStatus> = new Set(['ready_to_restart', 'ready_to_install']);

const clampProgress = (bytesReceived: number, totalBytes: number): number =>
  totalBytes > 0 ? Math.min(1, Math.max(0, bytesReceived / totalBytes)) : 0;

/**
 * Pure transitions of the in-app update flow (no I/O), so every step can be tested. An event that doesn't fit the
 * current state returns the state unchanged, so stray native events or double taps can't corrupt the flow.
 */
export class AppUpdateStateMachine {
  private static instance: AppUpdateStateMachine;

  private constructor() {}

  public static getInstance(): AppUpdateStateMachine {
    if (!AppUpdateStateMachine.instance) AppUpdateStateMachine.instance = new AppUpdateStateMachine();
    return AppUpdateStateMachine.instance;
  }

  public isBusy(state: AppUpdateState): boolean {
    return BUSY_STATUSES.has(state.status);
  }

  public transition(state: AppUpdateState, event: AppUpdateEvent): AppUpdateState {
    switch (event.type) {
      case 'check_started':
        if (this.isBusy(state) || READY_STATUSES.has(state.status)) return state;
        return { ...state, status: 'checking', errorMessage: null };

      case 'check_finished': {
        const versionCheck = event.versionCheck;
        if (this.isBusy(state)) return { ...state, versionCheck };
        if (READY_STATUSES.has(state.status)) return { ...state, versionCheck };
        if (event.otaReady) {
          return { ...state, versionCheck, status: 'ready_to_restart', source: 'ota', progress: 1, errorMessage: null };
        }
        if (versionCheck.status === 'update_available') {
          return { ...state, versionCheck, status: 'available', source: null, release: versionCheck.release, errorMessage: null };
        }
        if (versionCheck.status === 'update_required') {
          return { ...state, versionCheck, status: 'available', source: null, release: versionCheck.release, errorMessage: null };
        }
        // Keep an OTA offer that was found on its own (no Firestore release needed for JS-only updates).
        if (state.status === 'available' && state.source === 'ota') return { ...state, versionCheck };
        return { ...state, versionCheck, status: 'up_to_date', source: null, release: null, errorMessage: null };
      }

      case 'ota_found':
        if (this.isBusy(state) || READY_STATUSES.has(state.status) || state.status === 'available') return state;
        return { ...state, status: 'available', source: 'ota', errorMessage: null };

      case 'download_started':
        if (state.status !== 'available' && state.status !== 'error') return state;
        return {
          ...state,
          status: 'downloading',
          source: event.source,
          progress: 0,
          bytesReceived: 0,
          totalBytes: Math.max(0, event.totalBytes),
          errorMessage: null,
          apkPath: null,
        };

      case 'download_progress':
        if (state.status !== 'downloading') return state;
        return {
          ...state,
          bytesReceived: event.bytesReceived,
          totalBytes: event.totalBytes > 0 ? event.totalBytes : state.totalBytes,
          progress: clampProgress(event.bytesReceived, event.totalBytes > 0 ? event.totalBytes : state.totalBytes),
        };

      case 'verify_started':
        if (state.status !== 'downloading') return state;
        return { ...state, status: 'verifying', progress: 1 };

      case 'ota_ready':
        if (state.status !== 'downloading' && state.status !== 'verifying' && state.status !== 'available') return state;
        return { ...state, status: 'ready_to_restart', source: 'ota', progress: 1, errorMessage: null };

      case 'apk_ready':
        if (state.status !== 'verifying' && state.status !== 'downloading') return state;
        return { ...state, status: 'ready_to_install', source: 'apk', progress: 1, apkPath: event.apkPath, errorMessage: null };

      case 'install_started':
        if (state.status !== 'ready_to_install') return state;
        return { ...state, status: 'installing' };

      case 'install_cancelled':
        // The person backed out of Android's installer: the verified file is still there, so they can try again.
        if (state.status !== 'installing') return state;
        return { ...state, status: 'ready_to_install' };

      case 'download_cancelled':
        if (state.status !== 'downloading' && state.status !== 'verifying') return state;
        return { ...state, status: 'available', progress: 0, bytesReceived: 0, errorMessage: null };

      case 'failed':
        return { ...state, status: 'error', errorMessage: event.message, progress: 0 };

      default:
        return state;
    }
  }
}

export const appUpdateStateMachine = AppUpdateStateMachine.getInstance();
