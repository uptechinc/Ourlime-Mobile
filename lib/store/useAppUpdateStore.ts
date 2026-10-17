import { create } from 'zustand';
import { INITIAL_APP_UPDATE_STATE, type AppUpdateState } from '@/lib/services/AppUpdateStateMachine';

export type AppUpdateSheetMode = 'update' | 'whats_new';

/** A question the update flow is waiting on before it can continue. */
export type AppUpdatePrompt = 'none' | 'install_permission' | 'metered_download' | 'busy';

type AppUpdateStoreState = AppUpdateState & {
  isSheetVisible: boolean;
  sheetMode: AppUpdateSheetMode;
  /** Release notes for the one-time "What's new" after an update. */
  whatsNewVersion: string;
  whatsNewNotes: string[];
  prompt: AppUpdatePrompt;
  installedVersion: string;
  installedVersionCode: number | null;
  /** True on sideload builds with the native installer present (otherwise "Update now" opens the store). */
  canInstallInApp: boolean;
};

// Presentation only: AppUpdateService owns every transition and writes here.
export const useAppUpdateStore = create<AppUpdateStoreState>(() => ({
  ...INITIAL_APP_UPDATE_STATE,
  isSheetVisible: false,
  sheetMode: 'update',
  whatsNewVersion: '',
  whatsNewNotes: [],
  prompt: 'none',
  installedVersion: '',
  installedVersionCode: null,
  canInstallInApp: false,
}));
