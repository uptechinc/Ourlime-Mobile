import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSavedStore } from '@/lib/store/useSavedStore';
import { savedService } from '@/lib/services/SavedService';
import { SavedItemCatalog } from '@/lib/services/SavedItemCatalog';
import type { ResolvedSavedItem, SavedItemType, SaveTarget } from '@/lib/types/saved';

type UseSavedResult = {
  isSaved: boolean;
  isPending: boolean;
  isSignedIn: boolean;
  toggle: () => Promise<boolean>;
};

/** Saved state for one item with an optimistic toggle (rolled back with a toast if the write fails). */
export function useSaved(target: SaveTarget | null): UseSavedResult {
  const start = useSavedStore((state) => state.start);
  const key = target ? SavedItemCatalog.buildDocumentId(target.type, target.itemId) : '';
  const isSaved = useSavedStore((state) => {
    if (!key) return false;
    const pending = state.pendingKeys.get(key);
    return pending ?? state.confirmedKeys.has(key);
  });
  const isPending = useSavedStore((state) => (key ? state.pendingKeys.has(key) : false));
  const isSignedIn = useSavedStore((state) => state.userId !== null);
  const toggleInStore = useSavedStore((state) => state.toggle);

  useEffect(() => { start(); }, [start]);

  const toggle = useCallback(async (): Promise<boolean> => (target ? toggleInStore(target) : false), [target, toggleInStore]);

  return { isSaved, isPending, isSignedIn, toggle };
}

/** Saved item ids of one type, live (list filters such as Favorites and the feed's Saved chip). */
export function useSavedIds(type: SavedItemType): Set<string> {
  const start = useSavedStore((state) => state.start);
  const confirmedKeys = useSavedStore((state) => state.confirmedKeys);
  const pendingKeys = useSavedStore((state) => state.pendingKeys);
  useEffect(() => { start(); }, [start]);
  return useMemo(() => {
    const prefix = `${type}_`;
    const ids = new Set<string>();
    confirmedKeys.forEach((key) => { if (key.startsWith(prefix) && pendingKeys.get(key) !== false) ids.add(key.slice(prefix.length)); });
    pendingKeys.forEach((saved, key) => { if (saved && key.startsWith(prefix)) ids.add(key.slice(prefix.length)); });
    return ids;
  }, [confirmedKeys, pendingKeys, type]);
}

type SavedListState = {
  items: ResolvedSavedItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  hasMore: boolean;
};

const PAGE_SIZE = 20;

/** The Saved screen's list: newest first, optionally one type, resolved against live content, paginated. */
export function useSavedItemsList(type: SavedItemType | null) {
  const start = useSavedStore((state) => state.start);
  const userId = useSavedStore((state) => state.userId);
  const ready = useSavedStore((state) => state.ready);
  const confirmedKeys = useSavedStore((state) => state.confirmedKeys);
  const [state, setState] = useState<SavedListState>({ items: [], isLoading: true, isLoadingMore: false, error: null, hasMore: false });
  const cursorRef = useRef<unknown>(null);
  const requestRef = useRef(0);

  useEffect(() => { start(); }, [start]);

  const fetchFirstPage = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!userId) {
      setState({ items: [], isLoading: false, isLoadingMore: false, error: null, hasMore: false });
      return;
    }
    setState((current) => ({ ...current, isLoading: true, error: null }));
    try {
      const page = await savedService.list({ type, pageSize: PAGE_SIZE });
      const items = await savedService.resolveItems(page.items);
      if (requestId !== requestRef.current) return;
      cursorRef.current = page.cursor;
      setState({ items, isLoading: false, isLoadingMore: false, error: null, hasMore: page.hasMore });
    } catch (error) {
      console.error('[useSavedItemsList.fetchFirstPage] Error:', error);
      if (requestId !== requestRef.current) return;
      setState((current) => ({ ...current, isLoading: false, error: 'Your saved items could not be loaded.' }));
    }
  }, [type, userId]);

  const fetchMore = useCallback(async () => {
    if (!userId || state.isLoadingMore || !state.hasMore || !cursorRef.current) return;
    const requestId = requestRef.current;
    setState((current) => ({ ...current, isLoadingMore: true }));
    try {
      const page = await savedService.list({ type, pageSize: PAGE_SIZE, cursor: cursorRef.current });
      const items = await savedService.resolveItems(page.items);
      if (requestId !== requestRef.current) return;
      cursorRef.current = page.cursor;
      setState((current) => ({ ...current, items: [...current.items, ...items.filter((item) => !current.items.some((existing) => existing.id === item.id))], isLoadingMore: false, hasMore: page.hasMore }));
    } catch (error) {
      console.error('[useSavedItemsList.fetchMore] Error:', error);
      setState((current) => ({ ...current, isLoadingMore: false, error: 'More saved items could not be loaded.' }));
    }
  }, [state.hasMore, state.isLoadingMore, type, userId]);

  useEffect(() => { if (ready) void fetchFirstPage(); }, [fetchFirstPage, ready]);

  // Unsaved elsewhere (or here): drop the row without refetching.
  const items = useMemo(() => state.items.filter((item) => confirmedKeys.has(item.id)), [confirmedKeys, state.items]);

  return { ...state, items, isSignedIn: userId !== null, refresh: fetchFirstPage, fetchMore };
}
