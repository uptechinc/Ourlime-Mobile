import { create } from 'zustand';
import { onAuthStateChanged, type Unsubscribe } from 'firebase/auth';
import { toast } from 'sonner-native';
import { auth } from '@/lib/firebaseConfig';
import { savedService } from '@/lib/services/SavedService';
import { SavedItemCatalog } from '@/lib/services/SavedItemCatalog';
import { marketplacePreferenceService } from '@/lib/services/MarketplacePreferenceService';
import { eHubCommerceService } from '@/lib/services/EHubCommerceService';
import type { SavedItemType, SaveTarget } from '@/lib/types/saved';

type SavedStoreState = {
  userId: string | null;
  ready: boolean;
  /** Saved `${type}_${itemId}` keys as last confirmed by Firestore. */
  confirmedKeys: Set<string>;
  /** Optimistic overrides while a write is in flight: key -> intended saved state. */
  pendingKeys: Map<string, boolean>;
  start: () => void;
  isSaved: (type: SavedItemType, itemId: string) => boolean;
  toggle: (target: SaveTarget) => Promise<boolean>;
};

let authUnsubscribe: Unsubscribe | null = null;
let savedUnsubscribe: (() => void) | null = null;

/** Product favorites that used to live only on this device: uploaded once to Saved, then cleared. */
async function uploadDeviceFavorites(): Promise<void> {
  try {
    const marketIds = await marketplacePreferenceService.takeDeviceFavorites();
    if (marketIds.length) await savedService.importDeviceFavorites('market_product', marketIds);
    const eHubIds = await eHubCommerceService.takeDeviceFavorites();
    if (eHubIds.length) await savedService.importDeviceFavorites('ehub_product', eHubIds);
  } catch (error) {
    console.error('[uploadDeviceFavorites] Error:', error);
  }
}

/** The member's saved keys (live) with optimistic toggles, shared by every SaveButton. */
export const useSavedStore = create<SavedStoreState>((set, get) => ({
  userId: null,
  ready: false,
  confirmedKeys: new Set<string>(),
  pendingKeys: new Map<string, boolean>(),

  start: () => {
    if (authUnsubscribe) return;
    authUnsubscribe = onAuthStateChanged(auth, (user) => {
      savedUnsubscribe?.();
      savedUnsubscribe = null;
      set({ userId: user?.uid ?? null, ready: !user, confirmedKeys: new Set<string>(), pendingKeys: new Map<string, boolean>() });
      if (!user) return;
      void uploadDeviceFavorites();
      savedUnsubscribe = savedService.subscribeToSavedKeys(
        user.uid,
        (keys) => set({ confirmedKeys: keys, ready: true }),
        (error) => {
          console.error('[useSavedStore.subscribe] Error:', error);
          set({ ready: true });
        },
      );
    });
  },

  isSaved: (type, itemId) => {
    const key = SavedItemCatalog.buildDocumentId(type, itemId);
    const pending = get().pendingKeys.get(key);
    return pending ?? get().confirmedKeys.has(key);
  },

  toggle: async (target) => {
    if (!get().userId) {
      toast.error('Sign in to save items.');
      return false;
    }
    const key = SavedItemCatalog.buildDocumentId(target.type, target.itemId);
    if (get().pendingKeys.has(key)) return get().isSaved(target.type, target.itemId);
    const wasSaved = get().isSaved(target.type, target.itemId);
    set((state) => ({ pendingKeys: new Map(state.pendingKeys).set(key, !wasSaved) }));
    try {
      const nowSaved = await savedService.toggle(target, wasSaved);
      set((state) => {
        const confirmedKeys = new Set(state.confirmedKeys);
        if (nowSaved) confirmedKeys.add(key);
        else confirmedKeys.delete(key);
        const pendingKeys = new Map(state.pendingKeys);
        pendingKeys.delete(key);
        return { confirmedKeys, pendingKeys };
      });
      return nowSaved;
    } catch (error) {
      console.error('[useSavedStore.toggle] Error:', error);
      set((state) => {
        const pendingKeys = new Map(state.pendingKeys);
        pendingKeys.delete(key);
        return { pendingKeys };
      });
      toast.error(wasSaved ? 'Could not remove this from Saved. Try again.' : 'Could not save this. Try again.');
      return wasSaved;
    }
  },
}));
