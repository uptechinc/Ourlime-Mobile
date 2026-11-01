import { useCallback, useEffect, useRef, useState } from 'react';
import { eHubService } from '@/lib/services/EHubService';
import type {
  EHubCatalogProduct, EHubEnquiry, EHubEnquiryMode, EHubManageableEnquiryStatus, EHubProductDetail,
  EHubProvider, EHubProviderDetail, EHubProviderFilters,
} from '@/lib/types/ehubDiscovery';

export type EHubResource<TData> = {
  data: TData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

function readError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Loads one eHub resource, ignores answers that arrive after the inputs changed, and keeps the last data while
 * refreshing. load receives force=true on pull-to-refresh so cached lists are fetched again.
 */
function useEHubResource<TData>(load: ((force: boolean) => Promise<TData>) | null, fallbackError: string, delayMs = 0): EHubResource<TData> {
  const [data, setData] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState(load !== null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const run = useCallback(async (force: boolean): Promise<void> => {
    if (!load) { setIsLoading(false); return; }
    const requestId = ++requestRef.current;
    if (force) setIsRefreshing(true); else setIsLoading(true);
    try {
      const nextData = await load(force);
      if (requestId !== requestRef.current) return;
      setData(nextData);
      setError(null);
    } catch (loadError: unknown) {
      if (requestId !== requestRef.current) return;
      console.error('[useEHubResource] Error:', readError(loadError, fallbackError));
      setError(readError(loadError, fallbackError));
    } finally {
      if (requestId === requestRef.current) { setIsLoading(false); setIsRefreshing(false); }
    }
  }, [fallbackError, load]);

  useEffect(() => {
    if (delayMs <= 0) { void run(false); return; }
    const timer = setTimeout(() => void run(false), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, run]);

  useEffect(() => () => { requestRef.current += 1; }, []);

  const refresh = useCallback(() => run(true), [run]);
  return { data, isLoading, isRefreshing, error, refresh };
}

export function useEHubCatalog(): EHubResource<EHubCatalogProduct[]> {
  const load = useCallback((force: boolean) => eHubService.getCatalog(force), []);
  return useEHubResource(load, 'E-Hub catalog products are temporarily unavailable.');
}

/** Typing in the search box waits 250 ms before asking the server, like the website's discovery page. */
export function useEHubProviders(filters: EHubProviderFilters = {}): EHubResource<EHubProvider[]> {
  const { search, category, location, kind } = filters;
  const load = useCallback((force: boolean) => eHubService.getProviders({ search, category, location, kind }, force), [category, kind, location, search]);
  return useEHubResource(load, 'Storefronts and professionals are temporarily unavailable.', search ? 250 : 0);
}

export function useEHubProduct(productId: string | undefined): EHubResource<EHubProductDetail | null> {
  const load = useCallback(() => eHubService.getProduct(productId ?? ''), [productId]);
  return useEHubResource(productId ? load : null, 'E-Hub could not load this product right now. Please try again.');
}

export function useEHubProvider(providerId: string | undefined): EHubResource<EHubProviderDetail | null> {
  const load = useCallback(() => eHubService.getProvider(providerId ?? ''), [providerId]);
  return useEHubResource(providerId ? load : null, 'E-Hub could not load this provider right now. Please try again.');
}

export type EHubEnquiriesResource = EHubResource<EHubEnquiry[]> & {
  update: (enquiryId: string, status: EHubManageableEnquiryStatus, responseMessage?: string) => Promise<void>;
};

/** The signed-in member's sent or received enquiries; nothing loads while signed out. */
export function useEHubEnquiries(userId: string | null, mode: EHubEnquiryMode): EHubEnquiriesResource {
  const load = useCallback(() => eHubService.getEnquiries(mode), [mode]);
  const resource = useEHubResource(userId ? load : null, 'Unable to load enquiries.');
  const [updates, setUpdates] = useState<{ [enquiryId: string]: EHubEnquiry }>({});

  useEffect(() => { setUpdates({}); }, [resource.data]);

  const update = useCallback(async (enquiryId: string, status: EHubManageableEnquiryStatus, responseMessage?: string) => {
    const updatedEnquiry = await eHubService.updateEnquiry(enquiryId, status, responseMessage);
    setUpdates((current) => ({ ...current, [enquiryId]: updatedEnquiry }));
  }, []);

  const data = resource.data ? resource.data.map((enquiry) => updates[enquiry.id] ?? enquiry) : null;
  return { ...resource, data, update };
}
