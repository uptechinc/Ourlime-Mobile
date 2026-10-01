import { useCallback, useEffect, useState } from 'react';
import { marketplacePreferenceService, type MarketplacePreferences } from '@/lib/services/MarketplacePreferenceService';

const EMPTY_PREFERENCES: MarketplacePreferences = Object.freeze({ favoriteIds: [], recentIds: [] });

export function useMarketplacePreferences() {
  const [preferences, setPreferences] = useState<MarketplacePreferences>(EMPTY_PREFERENCES);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void marketplacePreferenceService.read().then((saved) => { if (active) setPreferences(saved); });
    return () => { active = false; };
  }, []);

  const toggleFavorite = useCallback(async (productId: string) => {
    try { setPreferences(await marketplacePreferenceService.toggleFavorite(productId)); setError(null); }
    catch { setError('Favorites could not be saved on this device.'); }
  }, []);

  const recordViewed = useCallback(async (productId: string) => {
    try { setPreferences(await marketplacePreferenceService.recordViewed(productId)); setError(null); }
    catch { setError('Recently viewed items could not be saved on this device.'); }
  }, []);

  return { ...preferences, error, toggleFavorite, recordViewed };
}
