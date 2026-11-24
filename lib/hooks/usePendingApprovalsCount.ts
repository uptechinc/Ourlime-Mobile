import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { usePageAccess } from '@/lib/contexts/PageAccessContext';
import { pendingApprovalsService } from '@/lib/services/PendingApprovalsService';

const REFRESH_INTERVAL_MS = 60_000;

export type PendingApprovalsCount = {
  /** Items waiting across every queue that loaded; 0 for members who are not administrators. */
  total: number;
  totalIsLowerBound: boolean;
  refresh: () => void;
};

/**
 * The number of items waiting for an administrator, for navigation badges. Runs only for administrators; refreshes when
 * the app returns to the foreground and every minute while mounted. Counts only, no realtime listeners.
 */
export function usePendingApprovalsCount(): PendingApprovalsCount {
  const { authorization, loading } = usePageAccess();
  const enabled = !loading && authorization.isAdmin;
  const [count, setCount] = useState(() => {
    const cached = pendingApprovalsService.peek();
    return { total: cached?.total ?? 0, totalIsLowerBound: cached?.totalIsLowerBound ?? false };
  });

  const refresh = useCallback(() => {
    if (!enabled) return;
    pendingApprovalsService.fetchSummary().catch((error: unknown) => {
      console.warn(`[usePendingApprovalsCount] Error: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setCount({ total: 0, totalIsLowerBound: false });
      return undefined;
    }
    const unsubscribe = pendingApprovalsService.subscribe((snapshot) => {
      setCount({ total: snapshot.total, totalIsLowerBound: snapshot.totalIsLowerBound });
    });
    const cached = pendingApprovalsService.peek();
    if (cached) setCount({ total: cached.total, totalIsLowerBound: cached.totalIsLowerBound });
    refresh();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') refresh();
    }, REFRESH_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      unsubscribe();
      clearInterval(interval);
      subscription.remove();
    };
  }, [enabled, refresh]);

  return { ...count, refresh };
}
