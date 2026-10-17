import { useShallow } from 'zustand/react/shallow';
import { appUpdateService } from '@/lib/services/AppUpdateService';
import { useAppUpdateStore } from '@/lib/store/useAppUpdateStore';

const actions = {
  openSheet: () => appUpdateService.openSheet(),
  dismissSheet: () => appUpdateService.dismissSheet(),
  startUpdate: () => appUpdateService.startUpdate(),
  cancelDownload: () => appUpdateService.cancelDownload(),
  checkNow: () => appUpdateService.refresh(true),
  confirmMeteredDownload: () => appUpdateService.confirmMeteredDownload(),
  openInstallPermissionSettings: () => appUpdateService.openInstallPermissionSettings(),
  dismissPrompt: () => appUpdateService.dismissPrompt(),
  openExternalUpdate: () => appUpdateService.openExternalUpdate(useAppUpdateStore.getState().release),
};

/** In-app update state and actions (AppUpdateService owns the flow; this only binds it to React). */
export function useAppUpdate() {
  const state = useAppUpdateStore(useShallow((store) => ({
    status: store.status,
    source: store.source,
    release: store.release,
    versionCheck: store.versionCheck,
    progress: store.progress,
    bytesReceived: store.bytesReceived,
    totalBytes: store.totalBytes,
    errorMessage: store.errorMessage,
    isSheetVisible: store.isSheetVisible,
    sheetMode: store.sheetMode,
    whatsNewVersion: store.whatsNewVersion,
    whatsNewNotes: store.whatsNewNotes,
    prompt: store.prompt,
    installedVersion: store.installedVersion,
    installedVersionCode: store.installedVersionCode,
    canInstallInApp: store.canInstallInApp,
  })));
  return { ...state, ...actions, sizeLabel: appUpdateService.describeSize(state.release) };
}
