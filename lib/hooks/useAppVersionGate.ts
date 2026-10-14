import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { appVersionService, type AppVersionCheck } from '@/lib/services/AppVersionService';

const RECHECK_INTERVAL_MS = 10 * 60 * 1000;

/** Checks the minimum app version on launch and again when the app returns to the foreground (at most every 10 minutes). */
export function useAppVersionGate(): { check: AppVersionCheck; isChecking: boolean; recheck: () => Promise<void> } {
  const [check, setCheck] = useState<AppVersionCheck>({ status: 'supported' });
  const [isChecking, setIsChecking] = useState(false);
  const lastCheckedAt = useRef(0);

  const recheck = useCallback(async () => {
    lastCheckedAt.current = Date.now();
    setIsChecking(true);
    const result = await appVersionService.check();
    setCheck(result);
    setIsChecking(false);
  }, []);

  useEffect(() => {
    void recheck();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastCheckedAt.current > RECHECK_INTERVAL_MS) void recheck();
    });
    return () => subscription.remove();
  }, [recheck]);

  return { check, isChecking, recheck };
}
