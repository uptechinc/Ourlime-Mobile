import { useCallback, useEffect, useState } from 'react';
import { businessAccountService } from '@/lib/services/BusinessAccountService';
import type { BusinessAccount, BusinessAccountForm } from '@/lib/types/businessAccount';
import { withCleanup } from '@/lib/utils/withCleanup';

function readError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** The signed-in member's business account: load, request one, and save edits (each save reloads it). */
export function useBusinessAccount(ownerId: string | null) {
  const [account, setAccount] = useState<BusinessAccount | null>(null);
  const [isLoading, setIsLoading] = useState(ownerId !== null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setAccount(await businessAccountService.getAccount());
    setError(null);
  }, []);

  useEffect(() => {
    if (!ownerId) { setIsLoading(false); return; }
    let isActive = true;
    setIsLoading(true);
    // withCleanup, not .finally(): the runtime Promise can lack finally (lib/utils/withCleanup.ts).
    void withCleanup(load(), () => { if (isActive) setIsLoading(false); })
      .catch((loadError: unknown) => {
        console.error('[useBusinessAccount.load] Error:', readError(loadError, 'Unknown error'));
        if (isActive) setError(readError(loadError, 'Unable to load your business account.'));
      });
    return () => { isActive = false; };
  }, [load, ownerId]);

  const refresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    try { await load(); }
    catch (loadError: unknown) { setError(readError(loadError, 'Unable to load your business account.')); }
    finally { setIsRefreshing(false); }
  }, [load]);

  const run = async (action: () => Promise<void>, fallback: string): Promise<boolean> => {
    setIsWorking(true);
    setError(null);
    try {
      await action();
      await load();
      return true;
    } catch (actionError: unknown) {
      console.error('[useBusinessAccount.run] Error:', readError(actionError, fallback));
      setError(readError(actionError, fallback));
      return false;
    } finally {
      setIsWorking(false);
    }
  };

  const requestAccount = (businessName: string) => run(() => businessAccountService.requestAccount(businessName), 'Unable to request a business account.');
  const saveAccount = (form: BusinessAccountForm) => run(() => businessAccountService.updateAccount(form), 'Unable to save your business account.');

  return { account, isLoading, isRefreshing, isWorking, error, refresh, requestAccount, saveAccount };
}
