import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, storage } from '@/lib/firebaseConfig';
import { eHubService } from './EHubService';
import type {
  EHubDraft, EHubDraftAction, EHubDraftInput, EHubImageScope, EHubProductDraftPayload, EHubProductInput,
  EHubPublicationState, EHubSellerProduct, EHubSellerWorkspace, EHubStore, EHubStoreDraftPayload, EHubStoreInput,
} from '@/lib/types/ehubSeller';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const EHUB_SELLER_TERMS_URL = 'https://ourlime.com/ehub/terms#seller';
export const EHUB_PROVIDER_TERMS_URL = 'https://ourlime.com/ehub/terms#provider';
export const EHUB_BUSINESS_ACCOUNT_URL = 'https://ourlime.com/profile/business-account';

export const EMPTY_EHUB_STORE: EHubStoreDraftPayload = {
  storeName: '', description: '', logoUrl: '', coverUrl: '', businessHours: '', sellerPolicies: '', returnPolicy: '', categories: [], services: [], serviceAreas: [],
};
export const EMPTY_EHUB_PRODUCT: EHubProductDraftPayload = {
  productId: null, title: '', description: '', category: '', imageUrl: '', imageUrls: [], price: 0, salePrice: null, inventory: 0,
  brand: '', sku: '', variants: [], sizes: [], colours: [], deliveryAvailable: false, pickupAvailable: false, warrantyInformation: '',
};

/**
 * The website's Seller Center (/profile/ehub/seller) through the ehubApi function, which runs the same
 * /api/ehub/seller route handlers: the server verifies the ID token, seller eligibility, the current agreements and
 * ownership. Images go straight to Storage under ehub/{uid}/{scope}/ like the website's uploads.
 */
export class EHubSellerService {
  private static instance: EHubSellerService;

  private constructor() {}

  public static getInstance(): EHubSellerService {
    if (!EHubSellerService.instance) EHubSellerService.instance = new EHubSellerService();
    return EHubSellerService.instance;
  }

  public getWorkspace(): Promise<EHubSellerWorkspace> {
    return eHubService.request<EHubSellerWorkspace>('GET', '/api/ehub/seller');
  }

  public saveDraft(input: EHubDraftInput): Promise<EHubDraft> {
    return eHubService.request<EHubDraft>('PUT', '/api/ehub/seller/drafts', { body: input });
  }

  public updateDraftStatus(draftId: string, action: EHubDraftAction): Promise<EHubDraft> {
    return eHubService.request<EHubDraft>('PATCH', '/api/ehub/seller/drafts', { body: { draftId, action } });
  }

  /** Only drafts already in Recently Deleted can be removed for good; the server checks this too. */
  public async permanentlyDeleteDraft(draftId: string): Promise<void> {
    await eHubService.request<null>('DELETE', '/api/ehub/seller/drafts', { query: `draftId=${encodeURIComponent(draftId)}`, allowEmpty: true });
  }

  public async saveStore(input: EHubStoreInput): Promise<EHubStore> {
    const store = await eHubService.request<EHubStore>('PUT', '/api/ehub/seller', { body: input });
    eHubService.clearCaches();
    return store;
  }

  public async saveProduct(input: EHubProductInput): Promise<EHubSellerProduct> {
    const product = await eHubService.request<EHubSellerProduct>('PUT', '/api/ehub/seller/products', { body: input });
    eHubService.clearCaches();
    return product;
  }

  /** Publishes or unpublishes a saved product; the route saves the whole product, so every field is sent back. */
  public setPublicationState(product: EHubSellerProduct, publicationState: EHubPublicationState): Promise<EHubSellerProduct> {
    return this.saveProduct({ ...this.toDraftPayload(product), publicationState });
  }

  public async deleteProduct(productId: string): Promise<void> {
    if (!productId) throw new Error('Product is required.');
    await eHubService.request<null>('DELETE', '/api/ehub/seller/products', { query: `productId=${encodeURIComponent(productId)}`, allowEmpty: true });
    eHubService.clearCaches();
  }

  public toDraftPayload(product: EHubSellerProduct): EHubProductDraftPayload {
    return {
      productId: product.id, title: product.title, description: product.description, category: product.category, imageUrl: product.imageUrl ?? '',
      imageUrls: product.imageUrls, price: product.price, salePrice: product.salePrice, inventory: product.inventory, brand: product.brand ?? '',
      sku: product.sku ?? '', variants: product.variants, sizes: product.sizes, colours: product.colours, deliveryAvailable: product.deliveryAvailable,
      pickupAvailable: product.pickupAvailable, warrantyInformation: product.warrantyInformation ?? '',
    };
  }

  public toStoreDraftPayload(store: EHubStore): EHubStoreDraftPayload {
    return {
      storeName: store.storeName, description: store.description, logoUrl: store.logoUrl ?? '', coverUrl: store.coverUrl ?? '', businessHours: store.businessHours,
      sellerPolicies: store.sellerPolicies, returnPolicy: store.returnPolicy, categories: store.categories, services: store.services, serviceAreas: store.serviceAreas,
    };
  }

  public calculateStoreCompletion(form: EHubStoreDraftPayload): number {
    return Math.round(([form.storeName, form.description, form.categories.length, form.logoUrl, form.businessHours, form.sellerPolicies].filter(Boolean).length / 6) * 100);
  }

  public calculateProductCompletion(form: EHubProductDraftPayload): number {
    return Math.round(([form.title, form.description, form.category, form.imageUrl, form.price > 0, form.inventory >= 0].filter(Boolean).length / 6) * 100);
  }

  /** Resizes the picked image to a JPEG (the Storage rules accept raster images up to 8 MB) and returns its URL. */
  public async uploadImage(localUri: string, scope: EHubImageScope): Promise<string> {
    const ownerId = auth.currentUser?.uid;
    if (!ownerId) throw new Error('Please sign in to upload images.');
    const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
    const image = await manipulateAsync(localUri, [{ resize: { width: scope === 'product' ? 1600 : 1800 } }], { compress: 0.85, format: SaveFormat.JPEG });
    const blob = await (await fetch(image.uri)).blob();
    if (blob.size > MAX_IMAGE_BYTES) throw new Error('Images must be 8 MB or smaller.');
    const fileId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const storageReference = ref(storage, `ehub/${ownerId}/${scope}/${fileId}.jpg`);
    await uploadBytes(storageReference, blob, { contentType: 'image/jpeg', customMetadata: { ownerId, scope } });
    return getDownloadURL(storageReference);
  }
}

export const eHubSellerService = EHubSellerService.getInstance();
