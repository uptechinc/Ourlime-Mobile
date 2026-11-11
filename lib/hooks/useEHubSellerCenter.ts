import { useCallback, useEffect, useRef, useState } from 'react';
import { EMPTY_EHUB_PRODUCT, EMPTY_EHUB_STORE, eHubSellerService } from '@/lib/services/EHubSellerService';
import type {
  EHubDraft, EHubDraftType, EHubImageScope, EHubProductDraftPayload, EHubPublicationState, EHubSellerProduct,
  EHubSellerWorkspace, EHubStoreDraftPayload,
} from '@/lib/types/ehubSeller';
import { withCleanup } from '@/lib/utils/withCleanup';

export type EHubSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type EHubSellerNotice = { tone: 'success' | 'error'; text: string };
export type EHubStoreImageField = 'logoUrl' | 'coverUrl';

type DraftForms = { storefront: EHubStoreDraftPayload; product: EHubProductDraftPayload };
type PerDraftType<TValue> = { [type in EHubDraftType]: TValue };

const AUTOSAVE_DELAY_MS = 900;

function readError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Seller Center state for one signed-in owner, mirroring the website's EHubSellerCenter: the workspace, the
 * storefront and product forms, and autosaved private drafts. Each draft type has its own timer and draft id (in
 * refs, so a save scheduled before the first save returned still reuses that draft), and a pending save is sent
 * straight away when the screen closes. Publishing keeps the draft active, as on the website.
 */
export function useEHubSellerCenter(ownerId: string | null) {
  const [workspace, setWorkspace] = useState<EHubSellerWorkspace | null>(null);
  const [isLoading, setIsLoading] = useState(ownerId !== null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storeForm, setStoreForm] = useState<EHubStoreDraftPayload>(EMPTY_EHUB_STORE);
  const [productForm, setProductForm] = useState<EHubProductDraftPayload>(EMPTY_EHUB_PRODUCT);
  const [saveStatus, setSaveStatus] = useState<EHubSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<EHubSellerNotice | null>(null);
  const hasLoadedForms = useRef(false);
  const timers = useRef<PerDraftType<ReturnType<typeof setTimeout> | null>>({ storefront: null, product: null });
  const draftIds = useRef<PerDraftType<string | undefined>>({ storefront: undefined, product: undefined });
  const pendingForms = useRef<Partial<DraftForms>>({});

  const loadWorkspace = useCallback(async (): Promise<EHubSellerWorkspace> => {
    const data = await eHubSellerService.getWorkspace();
    setWorkspace(data);
    setLoadError(null);
    if (!hasLoadedForms.current) {
      if (data.store) setStoreForm(eHubSellerService.toStoreDraftPayload(data.store));
      hasLoadedForms.current = true;
    }
    return data;
  }, []);

  useEffect(() => {
    if (!ownerId) { setIsLoading(false); return; }
    let isActive = true;
    setIsLoading(true);
    // withCleanup, not .finally(): the runtime Promise can lack finally (lib/utils/withCleanup.ts).
    void withCleanup(loadWorkspace(), () => { if (isActive) setIsLoading(false); })
      .catch((error: unknown) => {
        console.error('[useEHubSellerCenter.load] Error:', readError(error, 'Unknown error'));
        if (isActive) setLoadError(readError(error, 'Unable to load Seller Center.'));
      });
    return () => { isActive = false; };
  }, [loadWorkspace, ownerId]);

  const refresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    try { await loadWorkspace(); }
    catch (error: unknown) { setLoadError(readError(error, 'Unable to load Seller Center.')); }
    finally { setIsRefreshing(false); }
  }, [loadWorkspace]);

  const sendDraft = useCallback(async (type: EHubDraftType, form: EHubStoreDraftPayload | EHubProductDraftPayload): Promise<void> => {
    const isStorefront = type === 'storefront';
    const title = isStorefront ? (form as EHubStoreDraftPayload).storeName || 'Storefront setup' : (form as EHubProductDraftPayload).title || 'Untitled product';
    const completion = isStorefront ? eHubSellerService.calculateStoreCompletion(form as EHubStoreDraftPayload) : eHubSellerService.calculateProductCompletion(form as EHubProductDraftPayload);
    const draft = await eHubSellerService.saveDraft({ draftId: draftIds.current[type], type, title, payload: form, completion, clientUpdatedAt: Date.now() });
    draftIds.current[type] = draft.id;
    setLastSavedAt(draft.updatedAt);
    setSaveStatus('saved');
    setWorkspace((current) => current ? { ...current, drafts: [draft, ...current.drafts.filter((item) => item.id !== draft.id)] } : current);
  }, []);

  const scheduleAutosave = useCallback((type: EHubDraftType, form: EHubStoreDraftPayload | EHubProductDraftPayload): void => {
    if (!ownerId || !hasLoadedForms.current) return;
    const pendingTimer = timers.current[type];
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingForms.current = { ...pendingForms.current, [type]: form };
    setSaveStatus('saving');
    timers.current[type] = setTimeout(() => {
      timers.current[type] = null;
      delete pendingForms.current[type];
      sendDraft(type, form).catch((error: unknown) => {
        console.error('[useEHubSellerCenter.scheduleAutosave] Error:', readError(error, 'Unknown error'));
        setSaveStatus('error');
      });
    }, AUTOSAVE_DELAY_MS);
  }, [ownerId, sendDraft]);

  // Leaving Seller Center sends any edit still waiting for its autosave instead of dropping it.
  useEffect(() => () => {
    (['storefront', 'product'] as const).forEach((type) => {
      const pendingTimer = timers.current[type];
      const pendingForm = pendingForms.current[type];
      if (!pendingTimer || !pendingForm) return;
      clearTimeout(pendingTimer);
      timers.current[type] = null;
      const completion = type === 'storefront' ? eHubSellerService.calculateStoreCompletion(pendingForm as EHubStoreDraftPayload) : eHubSellerService.calculateProductCompletion(pendingForm as EHubProductDraftPayload);
      const title = type === 'storefront' ? (pendingForm as EHubStoreDraftPayload).storeName || 'Storefront setup' : (pendingForm as EHubProductDraftPayload).title || 'Untitled product';
      eHubSellerService.saveDraft({ draftId: draftIds.current[type], type, title, payload: pendingForm, completion, clientUpdatedAt: Date.now() })
        .catch((error: unknown) => console.error('[useEHubSellerCenter.flush] Error:', readError(error, 'Unknown error')));
    });
  }, []);

  /**
   * After publishing, the draft stays active like on the website (it is not moved to Recently Deleted). A pending
   * autosave is sent now so the draft holds the published edits. The storefront keeps its draft; a product starts the
   * next product on a fresh draft, as the website resets its product draft id.
   */
  const finishDraft = useCallback(async (type: EHubDraftType): Promise<void> => {
    const pendingTimer = timers.current[type];
    const pendingForm = pendingForms.current[type];
    if (pendingTimer) clearTimeout(pendingTimer);
    timers.current[type] = null;
    delete pendingForms.current[type];
    if (pendingTimer && pendingForm) {
      await sendDraft(type, pendingForm).catch((error: unknown) => console.error('[useEHubSellerCenter.finishDraft] Error:', readError(error, 'Unknown error')));
    }
    if (type === 'product') {
      draftIds.current.product = undefined;
      setSaveStatus('idle');
    }
  }, [sendDraft]);

  const runAction = useCallback(async (action: () => Promise<void>, fallbackError: string): Promise<boolean> => {
    setIsWorking(true);
    setNotice(null);
    try {
      await action();
      return true;
    } catch (error: unknown) {
      console.error('[useEHubSellerCenter.runAction] Error:', readError(error, fallbackError));
      setNotice({ tone: 'error', text: readError(error, fallbackError) });
      return false;
    } finally {
      setIsWorking(false);
    }
  }, []);

  const updateStoreForm = (updates: Partial<EHubStoreDraftPayload>): void => {
    const nextForm = { ...storeForm, ...updates };
    setStoreForm(nextForm);
    scheduleAutosave('storefront', nextForm);
  };

  const updateProductForm = (updates: Partial<EHubProductDraftPayload>): void => {
    const nextForm = { ...productForm, ...updates };
    setProductForm(nextForm);
    scheduleAutosave('product', nextForm);
  };

  const uploadImage = async (localUri: string, scope: EHubImageScope, field?: EHubStoreImageField): Promise<void> => {
    setIsUploading(true);
    setNotice(null);
    try {
      const imageUrl = await eHubSellerService.uploadImage(localUri, scope);
      if (scope === 'storefront' && field) updateStoreForm({ [field]: imageUrl });
      else updateProductForm({ imageUrl });
    } catch (error: unknown) {
      console.error('[useEHubSellerCenter.uploadImage] Error:', readError(error, 'Unknown error'));
      setNotice({ tone: 'error', text: readError(error, 'Unable to upload image.') });
    } finally {
      setIsUploading(false);
    }
  };

  const publishStore = (sellerAgreementAccepted: boolean, providerDeclarationAccepted: boolean): Promise<boolean> => runAction(async () => {
    await eHubSellerService.saveStore({ ...storeForm, sellerAgreementAccepted, providerDeclarationAccepted });
    await finishDraft('storefront');
    await loadWorkspace();
    setNotice({ tone: 'success', text: 'Storefront published successfully.' });
  }, 'Unable to publish storefront.');

  const saveProduct = (publicationState: EHubPublicationState): Promise<boolean> => runAction(async () => {
    await eHubSellerService.saveProduct({ ...productForm, publicationState });
    await finishDraft('product');
    await loadWorkspace();
    setProductForm(EMPTY_EHUB_PRODUCT);
    setNotice({ tone: 'success', text: publicationState === 'published' ? 'Product published.' : 'Product saved as unpublished.' });
  }, 'Unable to save product.');

  const setProductState = (product: EHubSellerProduct, publicationState: EHubPublicationState): Promise<boolean> => runAction(async () => {
    await eHubSellerService.setPublicationState(product, publicationState);
    await loadWorkspace();
    setNotice({ tone: 'success', text: publicationState === 'published' ? 'Product published.' : 'Product unpublished.' });
  }, 'Unable to update product.');

  const deleteProduct = (product: EHubSellerProduct): Promise<boolean> => runAction(async () => {
    await eHubSellerService.deleteProduct(product.id);
    await loadWorkspace();
    setNotice({ tone: 'success', text: 'Product deleted.' });
  }, 'Unable to delete product.');

  const startNewProduct = (): void => {
    setProductForm(EMPTY_EHUB_PRODUCT);
    draftIds.current.product = undefined;
    setSaveStatus('idle');
  };

  const editProduct = (product: EHubSellerProduct): void => {
    setProductForm(eHubSellerService.toDraftPayload(product));
    draftIds.current.product = undefined;
    setSaveStatus('idle');
  };

  const resumeDraft = (draft: EHubDraft): void => {
    if (draft.type === 'storefront') setStoreForm({ ...EMPTY_EHUB_STORE, ...(draft.payload as EHubStoreDraftPayload) });
    else setProductForm({ ...EMPTY_EHUB_PRODUCT, ...(draft.payload as EHubProductDraftPayload) });
    draftIds.current[draft.type] = draft.id;
    setLastSavedAt(draft.updatedAt);
    setSaveStatus('saved');
  };

  const deleteDraft = (draft: EHubDraft, permanent: boolean): Promise<boolean> => runAction(async () => {
    if (permanent) await eHubSellerService.permanentlyDeleteDraft(draft.id);
    else await eHubSellerService.updateDraftStatus(draft.id, 'delete');
    if (draftIds.current[draft.type] === draft.id) draftIds.current[draft.type] = undefined;
    await loadWorkspace();
    setNotice({ tone: 'success', text: permanent ? 'Draft permanently deleted.' : 'Draft moved to Recently Deleted.' });
  }, 'Unable to update draft.');

  const restoreDraft = (draft: EHubDraft): Promise<boolean> => runAction(async () => {
    await eHubSellerService.updateDraftStatus(draft.id, 'restore');
    await loadWorkspace();
    setNotice({ tone: 'success', text: 'Draft restored.' });
  }, 'Unable to restore draft.');

  return {
    workspace, isLoading, isRefreshing, loadError, refresh,
    storeForm, productForm, saveStatus, lastSavedAt, isWorking, isUploading, notice, setNotice,
    updateStoreForm, updateProductForm, uploadImage, publishStore, saveProduct, setProductState, deleteProduct,
    startNewProduct, editProduct, resumeDraft, deleteDraft, restoreDraft,
  };
}

export type EHubSellerCenter = ReturnType<typeof useEHubSellerCenter>;
