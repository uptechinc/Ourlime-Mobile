import { useCallback, useEffect, useMemo, useState } from 'react';
import { marketplacePreferenceService, type MarketplacePreferences } from '@/lib/services/MarketplacePreferenceService';
import { useSavedIds } from '@/lib/hooks/useSavedItems';

const EMPTY_PREFERENCES: MarketplacePreferences = Object.freeze({ favoriteIds: [], recentIds: [] });

export function useMarketplacePreferences() {
  const [preferences, setPreferences] = useState<MarketplacePreferences>(EMPTY_PREFERENCES);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void marketplacePreferenceService.read().then((saved) => { if (active) setPreferences(saved); });
    return () => { active = false; };
  }, []);

  const recordViewed = useCallback(async (productId: string) => {
    try { setPreferences(await marketplacePreferenceService.recordViewed(productId)); setError(null); }
    catch { setError('Recently viewed items could not be saved on this device.'); }
  }, []);

  // Favorites are saved items (users/{uid}/saved, type market_product); SaveButton toggles them.
  const savedIds = useSavedIds('market_product');
  const favoriteIds = useMemo(() => [...savedIds], [savedIds]);

  return { ...preferences, favoriteIds, error, recordViewed };
}
