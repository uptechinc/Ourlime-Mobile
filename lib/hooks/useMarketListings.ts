import { useCallback, useEffect, useRef, useState } from 'react';
import { marketListingClient } from '@/lib/services/MarketListingClient';
import { marketListingFormService } from '@/lib/services/MarketListingFormService';
import type { ListingDraft, SellerEligibility, SellerListing } from '@/lib/types/marketListing';

const errorMessage = (error: unknown, fallback: string): string => error instanceof Error && error.message ? error.message : fallback;

/** The seller's approval state, re-checked on demand (e.g. after the seller application modal closes). */
export function useSellerEligibility(userId: string | null) {
  const [eligibility, setEligibility] = useState<SellerEligibility | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setEligibility(await marketListingClient.getEligibility());
    } catch (failure: unknown) {
      setError(errorMessage(failure, 'Your seller status could not be checked.'));
    }
  }, []);

  useEffect(() => {
    setEligibility(null);
    if (!userId) { setEligibility({ status: 'signed_out', storeName: '' }); return; }
    void refresh();
  }, [refresh, userId]);

  return { eligibility, error, refresh };
}

/**
 * My listings (website /profile/products): the seller's listings, the local draft, and unpublish/republish, delete
 * and duplicate. Each action reuses its operation id until it succeeds, so a retried tap is idempotent on the server.
 */
export function useMarketListings(userId: string | null) {
  const [listings, setListings] = useState<SellerListing[]>([]);
  const [draft, setDraft] = useState<ListingDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const operationIds = useRef(new Map<string, string>());

  const operationId = (key: string): string => {
    const existing = operationIds.current.get(key);
    if (existing) return existing;
    const created = marketListingFormService.createId();
    operationIds.current.set(key, created);
    return created;
  };

  const load = useCallback(async (isRefresh = false) => {
    if (!userId) { setListings([]); setIsLoading(false); return; }
    if (isRefresh) setIsRefreshing(true); else setIsLoading(true);
    setError(null);
    try {
      const [nextListings, nextDraft] = await Promise.all([marketListingClient.listListings(), marketListingFormService.loadDraft()]);
      setListings(nextListings);
      setDraft(nextDraft);
    } catch (failure: unknown) {
      setError(errorMessage(failure, 'Your listings could not be loaded.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  /** Website quick toggle: an approved/active listing is unpublished, anything else is resubmitted for review. */
  const toggleStatus = useCallback(async (listing: SellerListing): Promise<string> => {
    const action = listing.status === 'approved' || listing.status === 'active' ? 'unpublish' : 'republish';
    const key = `${action}:${listing.id}:${listing.revision ?? 0}`;
    setBusyId(listing.id);
    try {
      const result = await marketListingClient.changeStatus(listing, action, operationId(key));
      operationIds.current.delete(key);
      setListings((current) => current.map((entry) => entry.id === listing.id ? { ...entry, revision: result.revision, status: result.status, publicationState: result.publicationState, rejectionReason: '' } : entry));
      return action === 'unpublish' ? 'Listing unpublished.' : 'Listing submitted for review.';
    } finally {
      setBusyId(null);
    }
  }, []);

  const remove = useCallback(async (listing: SellerListing): Promise<void> => {
    const key = `delete:${listing.id}:${listing.revision ?? 0}`;
    setBusyId(listing.id);
    try {
      await marketListingClient.deleteListing(listing, operationId(key));
      operationIds.current.delete(key);
      setListings((current) => current.filter((entry) => entry.id !== listing.id));
    } finally {
      setBusyId(null);
    }
  }, []);

  const duplicate = useCallback(async (listing: SellerListing): Promise<void> => {
    await marketListingFormService.saveDuplicateDraft(listing);
    setDraft(await marketListingFormService.loadDraft());
  }, []);

  const discardDraft = useCallback(async () => {
    await marketListingFormService.clearDraft();
    setDraft(null);
  }, []);

  const refresh = useCallback(() => load(true), [load]);
  const reload = useCallback(() => load(false), [load]);

  return { listings, draft, isLoading, isRefreshing, busyId, error, refresh, reload, toggleStatus, remove, duplicate, discardDraft };
}

export type MarketListingsState = ReturnType<typeof useMarketListings>;
