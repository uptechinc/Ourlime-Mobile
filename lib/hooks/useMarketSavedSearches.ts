import { useCallback, useEffect, useState } from 'react';
import { marketplacePreferenceService, type MarketViewMode } from '@/lib/services/MarketplacePreferenceService';
import type { MarketSavedSearch } from '@/lib/types/reliability';

/** Saved searches and the grid/list choice, kept on this device (web MarketFavoritesContext + viewMode). */
export function useMarketSavedSearches() {
  const [searches, setSearches] = useState<MarketSavedSearch[]>([]);
  const [viewMode, setViewModeState] = useState<MarketViewMode>('grid');

  useEffect(() => {
    let active = true;
    void marketplacePreferenceService.readSavedSearches().then((saved) => { if (active) setSearches(saved); });
    void marketplacePreferenceService.readViewMode().then((mode) => { if (active) setViewModeState(mode); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const save = useCallback(async (query: string, categories: string[]) => {
    setSearches(await marketplacePreferenceService.saveSearch(query, categories));
  }, []);
  const remove = useCallback(async (searchId: string) => {
    setSearches(await marketplacePreferenceService.removeSavedSearch(searchId));
  }, []);
  const setViewMode = useCallback(async (mode: MarketViewMode) => {
    setViewModeState(mode);
    await marketplacePreferenceService.writeViewMode(mode).catch(() => undefined);
  }, []);

  return { searches, save, remove, viewMode, setViewMode };
}
