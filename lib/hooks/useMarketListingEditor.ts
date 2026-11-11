import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { auth } from '@/lib/firebaseConfig';
import { marketListingClient } from '@/lib/services/MarketListingClient';
import { LISTING_MAX_GALLERY_IMAGES, marketListingFormService } from '@/lib/services/MarketListingFormService';
import type {
  ListingBaseOption, ListingCategoryOption, ListingEditorStep, ListingFormState, ListingImage, ListingMutationResult, SellerListing,
} from '@/lib/types/marketListing';

type EditorLoadState = 'loading' | 'ready' | 'error';
export type ListingSaveProgress = { phase: 'idle' | 'uploading' | 'saving'; uploaded: number; total: number };

const errorMessage = (error: unknown, fallback: string): string => error instanceof Error && error.message ? error.message : fallback;

/**
 * The 4-step listing editor (website /profile/products/add and /profile/products/edit/[id]): loads the listing or the
 * local draft, keeps the variant matrix in step with colours and sizes, autosaves new listings to the device draft,
 * validates each step like the web and saves through the Market server (uploading picked photos right before).
 */
export function useMarketListingEditor(productId: string | null) {
  const isEditing = Boolean(productId);
  const [form, setForm] = useState<ListingFormState>(() => marketListingFormService.createEmptyForm());
  const [listing, setListing] = useState<SellerListing | null>(null);
  const [loadState, setLoadState] = useState<EditorLoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [step, setStep] = useState<ListingEditorStep>(0);
  const [categories, setCategories] = useState<ListingCategoryOption[]>([]);
  const [baseColors, setBaseColors] = useState<ListingBaseOption[]>([]);
  const [progress, setProgress] = useState<ListingSaveProgress>({ phase: 'idle', uploaded: 0, total: 0 });
  const [saveError, setSaveError] = useState<string | null>(null);
  const operationIdRef = useRef(marketListingFormService.createId());
  const isSubmittedRef = useRef(false);
  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    let active = true;
    void Promise.all([marketListingClient.getCategories(), marketListingClient.getBaseColors()]).then(([nextCategories, nextColors]) => {
      if (!active) return;
      setCategories(nextCategories);
      setBaseColors(nextColors);
    });
    return () => { active = false; };
  }, []);

  const load = useCallback(async () => {
    setLoadState('loading');
    setLoadError(null);
    try {
      if (productId) {
        const detail = await marketListingClient.getListing(productId);
        if (detail.listing.status === 'pending') throw new Error('This listing is pending review and cannot be edited until a decision is made.');
        setListing(detail.listing);
        setForm(detail.form);
      } else {
        const user = auth.currentUser;
        const empty = marketListingFormService.createEmptyForm(user?.email ?? '', user?.phoneNumber ?? '');
        const draft = await marketListingFormService.loadDraft();
        if (draft) {
          const restored = marketListingFormService.applyDraft(empty, draft);
          setForm({ ...restored, contactEmail: restored.contactEmail || empty.contactEmail, contactPhone: restored.contactPhone || empty.contactPhone });
          setHasRestoredDraft(true);
        } else {
          setForm(empty);
        }
      }
      setLoadState('ready');
    } catch (failure: unknown) {
      setLoadError(errorMessage(failure, 'This listing could not be loaded.'));
      setLoadState('error');
    }
  }, [productId]);

  useEffect(() => { void load(); }, [load]);

  // Autosave the device draft for new listings (website: localStorage on every change).
  useEffect(() => {
    if (isEditing || loadState !== 'ready') return;
    const timer = setTimeout(() => { if (!isSubmittedRef.current) void marketListingFormService.saveDraft(form); }, 600);
    return () => clearTimeout(timer);
  }, [form, isEditing, loadState]);

  const update = useCallback((patch: Partial<ListingFormState>) => {
    setForm((current) => {
      const next = { ...current, ...patch };
      if (patch.colors || patch.sizes) next.variants = marketListingFormService.rebuildVariants(next);
      return next;
    });
  }, []);

  const updateVariant = useCallback((variantId: string, patch: Partial<ListingFormState['variants'][number]>) => {
    setForm((current) => ({ ...current, variants: current.variants.map((variant) => variant.id === variantId ? { ...variant, ...patch } : variant) }));
  }, []);

  /** Currency applies to every variant on the server; kept upper-case like the web. */
  const setCurrency = useCallback((currency: string) => update({ currency: currency.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3) }), [update]);

  const setCover = useCallback((uri: string) => {
    update({ cover: { key: `cover-${marketListingFormService.createId()}`, kind: 'local', uri, uploadPath: null } });
  }, [update]);

  const addGalleryImages = useCallback((uris: string[]) => {
    setForm((current) => {
      const room = LISTING_MAX_GALLERY_IMAGES - current.gallery.length;
      const added: ListingImage[] = uris.slice(0, Math.max(0, room)).map((uri) => ({ key: `local-${marketListingFormService.createId()}`, kind: 'local', uri, uploadPath: null }));
      return { ...current, gallery: [...current.gallery, ...added] };
    });
  }, []);

  const removeGalleryImage = useCallback((key: string) => {
    setForm((current) => {
      const image = current.gallery.find((entry) => entry.key === key);
      const deletedImageIds = image?.kind === 'remote' && image.subImageId ? [...current.deletedImageIds, image.subImageId] : current.deletedImageIds;
      return { ...current, gallery: current.gallery.filter((entry) => entry.key !== key), deletedImageIds };
    });
  }, []);

  const discardDraft = useCallback(async () => {
    await marketListingFormService.clearDraft();
    const user = auth.currentUser;
    setForm(marketListingFormService.createEmptyForm(user?.email ?? '', user?.phoneNumber ?? ''));
    setHasRestoredDraft(false);
    setStep(0);
  }, []);

  const stepErrors = useMemo(() => marketListingFormService.validateAll(form, isEditing), [form, isEditing]);

  /** Uploads photos not yet uploaded (keeping their paths so a retry reuses them), then saves; null when it failed. */
  const save = useCallback(async (): Promise<ListingMutationResult | null> => {
    setSaveError(null);
    const current = formRef.current;
    const errors = marketListingFormService.validateAll(current, isEditing);
    const firstInvalid = ([0, 1, 2, 3] as const).find((index) => errors[index].length > 0);
    if (firstInvalid !== undefined) {
      setStep(firstInvalid);
      setSaveError(errors[firstInvalid][0]);
      return null;
    }
    try {
      const pending = [current.cover, ...current.gallery].filter((image): image is Extract<ListingImage, { kind: 'local' }> => image?.kind === 'local' && !image.uploadPath);
      setProgress({ phase: 'uploading', uploaded: 0, total: pending.length });
      let working = current;
      for (const [index, image] of pending.entries()) {
        const uploadPath = await marketListingClient.uploadListingImage(image.uri);
        const withPath = (entry: ListingImage | null): ListingImage | null => entry && entry.key === image.key && entry.kind === 'local' ? { ...entry, uploadPath } : entry;
        working = { ...working, cover: withPath(working.cover), gallery: working.gallery.map((entry) => withPath(entry) ?? entry) };
        setForm((latest) => ({ ...latest, cover: withPath(latest.cover), gallery: latest.gallery.map((entry) => withPath(entry) ?? entry) }));
        setProgress({ phase: 'uploading', uploaded: index + 1, total: pending.length });
      }
      setProgress({ phase: 'saving', uploaded: pending.length, total: pending.length });
      const result = await marketListingClient.saveListing(working, operationIdRef.current, productId);
      operationIdRef.current = marketListingFormService.createId();
      if (!isEditing) {
        isSubmittedRef.current = true;
        await marketListingFormService.clearDraft();
      }
      return result;
    } catch (failure: unknown) {
      console.error('[useMarketListingEditor.save] Error:', failure instanceof Error ? failure.message : 'Unknown error');
      setSaveError(errorMessage(failure, 'The listing could not be saved. Try again.'));
      return null;
    } finally {
      setProgress({ phase: 'idle', uploaded: 0, total: 0 });
    }
  }, [isEditing, productId]);

  return {
    isEditing, form, listing, loadState, loadError, reload: load, hasRestoredDraft, step, setStep, categories, baseColors, stepErrors,
    update, updateVariant, setCurrency, setCover, addGalleryImages, removeGalleryImage, discardDraft, save, progress, saveError, clearSaveError: () => setSaveError(null),
  };
}

export type MarketListingEditor = ReturnType<typeof useMarketListingEditor>;
