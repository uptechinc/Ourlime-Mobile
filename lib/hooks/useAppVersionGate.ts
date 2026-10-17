import { useCallback } from 'react';
import { appUpdateService } from '@/lib/services/AppUpdateService';
import { useAppUpdateStore } from '@/lib/store/useAppUpdateStore';
import type { AppVersionCheck } from '@/lib/services/AppVersionService';

/**
 * The minimum-version answer. AppUpdateService keeps it current (live listener on siteConfig/mobileApp plus a
 * re-check on launch and when the app returns to the foreground, at most every 10 minutes).
 */
export function useAppVersionGate(): { check: AppVersionCheck; isChecking: boolean; recheck: () => Promise<void> } {
  const check = useAppUpdateStore((store) => store.versionCheck);
  const isChecking = useAppUpdateStore((store) => store.status === 'checking');
  const recheck = useCallback(() => appUpdateService.refresh(true), []);
  return { check, isChecking, recheck };
}
