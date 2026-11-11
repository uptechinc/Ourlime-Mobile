import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebaseConfig';
import { appServerService } from './AppServerService';
import {
  DEFAULT_BASE_COLORS, DEFAULT_LISTING_CATEGORIES, LISTING_CONDITIONS, LISTING_MAX_IMAGE_BYTES, marketListingFormService,
} from './MarketListingFormService';
import type {
  ListingBaseOption, ListingCategoryOption, ListingColorOption, ListingCondition, ListingFormState, ListingImage, ListingMutationResult,
  ListingPublicationState, ListingSaveBody, ListingSizeOption, ListingStatus, ListingStatusAction, ListingVariantDraft, SellerEligibility,
  SellerListing, SellerListingDetail, SellerOrder, SellerOrderAddress, SellerOrderFulfillment, SellerOrderItem, SellerOrderStatus,
} from '@/lib/types/marketListing';

type GatewayMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type GatewayResponse = { status: number; body: unknown };
type JsonRecord = { [key: string]: unknown };

const ORDER_STATUSES: readonly SellerOrderStatus[] = ['pending_payment', 'paid', 'processing', 'shipped', 'ready_for_pickup', 'delivered', 'cancelled', 'refund_pending', 'refunded', 'disputed'];
const LISTING_STATUSES: readonly ListingStatus[] = ['pending', 'approved', 'active', 'rejected', 'inactive', 'archived'];
const PUBLICATION_STATES: readonly ListingPublicationState[] = ['pending', 'published', 'hidden', 'deleted'];
const MAX_IMAGE_SIDE = 2048;

const asRecord = (value: unknown): JsonRecord | null => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
const asString = (value: unknown): string => typeof value === 'string' ? value : '';
const asNumber = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asMillis = (value: unknown): number => {
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (typeof value === 'number') return value;
  const record = asRecord(value);
  const seconds = record ? asNumber(record.seconds) ?? asNumber(record._seconds) : null;
  return seconds === null ? 0 : seconds * 1000;
};

/** An error the Market server sent back (HTTP status of the web route plus its message). */
export class MarketListingError extends Error {
  public constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'MarketListingError';
  }
}

/**
 * The seller side of the Market through the `marketApi` callable (docs/market-api.md), which runs the website's own
 * /api/profile/products and /api/market/orders handlers. Clients cannot write listings or read unpublished ones, so
 * every listing and order change goes through it; listing images go to the owner-only Storage staging folder first.
 */
export class MarketListingClient {
  private static instance: MarketListingClient;
  private categoriesCache: ListingCategoryOption[] | null = null;
  private colorsCache: ListingBaseOption[] | null = null;

  private constructor() {}

  public static getInstance(): MarketListingClient {
    if (!MarketListingClient.instance) MarketListingClient.instance = new MarketListingClient();
    return MarketListingClient.instance;
  }

  // ── Seller eligibility (read directly; publicStores is readable by signed-in members) ────────────────────────

  /** Mirrors the server gate: publicStores/{uid}.verificationStatus 'approved' and an active, unsuspended account. */
  public async getEligibility(): Promise<SellerEligibility> {
    const userId = auth.currentUser?.uid;
    if (!userId) return { status: 'signed_out', storeName: '' };
    try {
      const [store, profile] = await Promise.all([
        getDoc(doc(db, 'publicStores', userId)),
        getDoc(doc(db, 'users', userId)).catch(() => null),
      ]);
      const account = profile?.exists() ? profile.data() : null;
      const blocked = ['suspended', 'banned', 'archived', 'deleted'];
      if (account && (account.isSuspended === true || account.isBanned === true || blocked.includes(asString(account.accountStatus)) || blocked.includes(asString(account.accountLifecycleStatus)))) {
        return { status: 'suspended', storeName: '' };
      }
      const data = store.exists() ? store.data() : null;
      const verification = asString(data?.verificationStatus);
      const storeName = asString(data?.storeName);
      if (verification === 'approved') return { status: 'approved', storeName };
      if (verification === 'rejected') return { status: 'rejected', storeName };
      if (verification) return { status: 'pending', storeName };
      return { status: 'none', storeName };
    } catch (error: unknown) {
      console.error('[MarketListingClient.getEligibility] Error:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Your seller status could not be checked. Check your connection and try again.');
    }
  }

  // ── Listings ────────────────────────────────────────────────────────────────────────────────────────────────

  /** My listings (website /profile/products); archived (deleted) listings are left out. */
  public async listListings(): Promise<SellerListing[]> {
    const body = await this.request('GET', '/api/profile/products/listProducts');
    return asArray(body.products)
      .map((entry) => asRecord(entry))
      .filter((entry): entry is JsonRecord => entry !== null)
      .map((entry) => this.toListing(entry))
      .filter((listing) => listing.publicationState !== 'deleted' && listing.status !== 'archived')
      .sort((first, second) => second.updatedAtMs - first.updatedAtMs);
  }

  /** A listing with its options, variants and images, mapped into the editor's form. */
  public async getListing(productId: string): Promise<SellerListingDetail> {
    const body = await this.request('GET', '/api/profile/products/getProduct', { query: `productId=${encodeURIComponent(productId)}` });
    const product = asRecord(body.product);
    if (!product) throw new MarketListingError('This listing could not be loaded.', 404);
    const ownerId = asString(asRecord(product.ownership)?.userId);
    if (ownerId && ownerId !== auth.currentUser?.uid) throw new MarketListingError('You do not have permission to edit this product.', 403);
    return { listing: this.toListing(product), form: this.toForm(product) };
  }

  public async changeStatus(listing: SellerListing, action: ListingStatusAction, operationId: string): Promise<ListingMutationResult> {
    if (listing.revision === null) throw new MarketListingError('Refresh the listing before changing its status.', 409);
    const body = await this.request('PATCH', '/api/profile/products/updateStatus', { body: { productId: listing.id, expectedRevision: listing.revision, operationId, action } });
    return this.toMutationResult(body.result);
  }

  public async deleteListing(listing: SellerListing, operationId: string): Promise<ListingMutationResult> {
    if (listing.revision === null) throw new MarketListingError('Refresh the listing before deleting it.', 409);
    const body = await this.request('DELETE', '/api/profile/products/deleteProduct', { body: { productId: listing.id, expectedRevision: listing.revision, operationId } });
    return this.toMutationResult(body.result);
  }

  /**
   * Saves a new listing (addProduct) or an edit (updateProduct). Every local image must already be uploaded
   * (uploadPath set); reuse the same operationId when retrying the same save.
   */
  public async saveListing(form: ListingFormState, operationId: string, productId: string | null): Promise<ListingMutationResult> {
    const localPath = (image: ListingImage | null): string | undefined => image?.kind === 'local' ? image.uploadPath ?? undefined : undefined;
    if ([form.cover, ...form.gallery].some((image) => image?.kind === 'local' && !image.uploadPath)) throw new MarketListingError('Upload every image before saving.', 400);
    const thumbnailUpload = localPath(form.cover);
    const mediaUploads = form.gallery.map((image) => localPath(image)).filter((path): path is string => Boolean(path));
    const payload: ListingSaveBody = {
      operationId,
      productData: marketListingFormService.buildProductData(form),
      ...(thumbnailUpload ? { thumbnailUpload } : {}),
      ...(mediaUploads.length ? { mediaUploads } : {}),
      ...(productId ? { productId, deletedImages: JSON.stringify(form.deletedImageIds) } : {}),
    };
    if (!productId && !thumbnailUpload) throw new MarketListingError('A cover image is required.', 400);
    const body = await this.request('POST', productId ? '/api/profile/products/updateProduct' : '/api/profile/products/addProduct', { body: payload });
    return this.toMutationResult(body.data);
  }

  /**
   * Converts a picked image to JPEG (longest side ≤ 2048, quality 0.85), checks it is ≤ 10 MB and writes it once to
   * products/{uid}/uploads/{id}.jpg. Returns the Storage path the save call references.
   */
  public async uploadListingImage(localUri: string): Promise<string> {
    const ownerId = auth.currentUser?.uid;
    if (!ownerId) throw new Error('Please sign in to upload images.');
    const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
    let image = await manipulateAsync(localUri, [], { compress: 0.85, format: SaveFormat.JPEG });
    if (Math.max(image.width, image.height) > MAX_IMAGE_SIDE) {
      const resize = image.width >= image.height ? { width: MAX_IMAGE_SIDE } : { height: MAX_IMAGE_SIDE };
      image = await manipulateAsync(image.uri, [{ resize }], { compress: 0.85, format: SaveFormat.JPEG });
    }
    const blob = await (await fetch(image.uri)).blob();
    if (!blob.size || blob.size > LISTING_MAX_IMAGE_BYTES) throw new Error('Listing images must be JPEG, PNG or WebP up to 10 MB.');
    const path = `products/${ownerId}/uploads/${marketListingFormService.createId()}${marketListingFormService.createId()}.jpg`;
    try {
      await uploadBytes(ref(storage, path), blob, { contentType: 'image/jpeg' });
      return path;
    } catch (error: unknown) {
      console.error('[MarketListingClient.uploadListingImage] Error:', error instanceof Error ? error.message : 'Unknown error');
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (code === 'storage/unauthorized') throw new Error('Listing photos could not be uploaded. Verify your email address and make sure your account is active, then try again.');
      if (code === 'storage/retry-limit-exceeded' || code === 'storage/canceled') throw new Error('A photo did not finish uploading. Check your connection and try again.');
      throw new Error('Unable to upload this photo. Please try another one.');
    }
  }

  /** Admin categories (productCategories; customCategories when readable) first, then the web's built-in ones. */
  public async getCategories(): Promise<ListingCategoryOption[]> {
    if (this.categoriesCache) return this.categoriesCache;
    const read = async (name: string): Promise<ListingCategoryOption[]> => {
      try {
        const snapshot = await getDocs(collection(db, name));
        return snapshot.docs.map((entry) => {
          const data = entry.data();
          const label = asString(data.name) || asString(data.categoryName);
          return { value: asString(data.slug) || label.toLowerCase().replace(/\s+/g, '-'), label };
        }).filter((option) => option.label && option.value);
      } catch {
        return [];
      }
    };
    const [product, custom] = await Promise.all([read('productCategories'), read('customCategories')]);
    const combined: ListingCategoryOption[] = [];
    for (const option of [...product, ...custom, ...DEFAULT_LISTING_CATEGORIES]) {
      if (!combined.some((entry) => entry.value === option.value || entry.label.toLowerCase() === option.label.toLowerCase())) combined.push(option);
    }
    this.categoriesCache = combined.sort((first, second) => first.label.localeCompare(second.label));
    return this.categoriesCache;
  }

  /** The `colors` collection merged with the web's base colours, alphabetically (website PricingDetails). */
  public async getBaseColors(): Promise<ListingBaseOption[]> {
    if (this.colorsCache) return this.colorsCache;
    let stored: ListingBaseOption[] = [];
    try {
      stored = (await getDocs(collection(db, 'colors'))).docs.map((entry) => ({ id: entry.id, name: asString(entry.data().colorName).toLowerCase() })).filter((color) => color.name);
    } catch {
      stored = [];
    }
    const names = [...new Set([...DEFAULT_BASE_COLORS, ...stored.map((color) => color.name)])].sort();
    this.colorsCache = names.map((name) => stored.find((color) => color.name === name) ?? { id: `base_col_${name}`, name });
    return this.colorsCache;
  }

  // ── Orders ──────────────────────────────────────────────────────────────────────────────────────────────────

  public async listSellerOrders(): Promise<SellerOrder[]> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new MarketListingError('Sign in to see your orders.', 401);
    const body = await this.request('GET', '/api/market/orders', { query: `sellerId=${encodeURIComponent(userId)}` });
    return asArray(body.data).map((entry) => asRecord(entry)).filter((entry): entry is JsonRecord => entry !== null).map((entry) => this.toOrder(entry));
  }

  public async updateOrderStatus(orderId: string, status: SellerOrderStatus, fulfillment?: SellerOrderFulfillment): Promise<void> {
    await this.request('PATCH', '/api/market/orders', { body: { orderId, status, ...(fulfillment ? { fulfillment } : {}), note: `Status updated to ${status} by seller.` } });
  }

  // ── Gateway ─────────────────────────────────────────────────────────────────────────────────────────────────

  private async request(method: GatewayMethod, path: string, options: { query?: string; body?: object } = {}): Promise<JsonRecord> {
    let response: GatewayResponse;
    try {
      response = await appServerService.call<GatewayResponse>('marketApi', { method, path, ...(options.query ? { query: options.query } : {}), ...(options.body ? { body: options.body } : {}) }, 60_000);
    } catch (error: unknown) {
      console.error(`[MarketListingClient.request] Error: ${method} ${path}`, error instanceof Error ? error.message : 'Unknown error');
      throw new MarketListingError(error instanceof Error && error.message ? error.message : 'The Market server could not be reached. Try again.', 503);
    }
    const body = asRecord(response.body) ?? {};
    const failed = response.status >= 400 || body.success === false || body.status === 'error';
    if (failed) {
      const message = asString(body.message);
      throw new MarketListingError(message === 'AUTH_REQUIRED' || response.status === 401 ? 'Please sign in again to continue.' : message || 'The Market server could not complete this request.', response.status);
    }
    return body;
  }

  private toMutationResult(value: unknown): ListingMutationResult {
    const record = asRecord(value);
    const revision = asNumber(record?.revision);
    const productId = asString(record?.productId);
    if (!record || revision === null || !productId) throw new MarketListingError('The server returned an invalid listing result.', 500);
    const status = asString(record.status);
    const publicationState = asString(record.publicationState);
    return {
      productId,
      revision,
      status: status === 'approved' || status === 'rejected' || status === 'inactive' || status === 'archived' ? status : 'pending',
      publicationState: PUBLICATION_STATES.find((state) => state === publicationState) ?? 'pending',
    };
  }

  private toListing(product: JsonRecord): SellerListing {
    const status = asString(product.status);
    const publication = asString(product.publicationState);
    const condition = asString(product.condition);
    const variants = asArray(product.variants).map((entry) => asRecord(entry)).filter((entry): entry is JsonRecord => entry !== null);
    return {
      id: asString(product.id),
      title: asString(product.title) || 'Untitled listing',
      category: asString(product.category),
      shortDescription: asString(product.shortDescription),
      longDescription: asString(product.longDescription),
      thumbnailImage: asString(product.thumbnailImage),
      status: LISTING_STATUSES.find((entry) => entry === status) ?? 'unknown',
      publicationState: PUBLICATION_STATES.find((entry) => entry === publication) ?? (product.isDeleted === true ? 'deleted' : 'unknown'),
      revision: asNumber(product.revision) ?? 0,
      rejectionReason: asString(product.rejection_reason) || asString(product.rejectionReason),
      condition: LISTING_CONDITIONS.find((entry) => entry.value === condition)?.value ?? 'new',
      brand: asString(product.brand),
      currency: asString(product.currency),
      deliveryAvailable: product.deliveryAvailable !== false,
      pickupAvailable: product.pickupAvailable !== false,
      shippingCost: asNumber(product.shippingCost) ?? 0,
      variants: variants.filter((variant) => asString(variant.publicationState) !== 'hidden' || asString(variant.status) === 'active').map((variant) => ({
        price: asNumber(variant.price) ?? 0,
        quantity: asNumber(variant.quantity) ?? 0,
        currency: asString(variant.currency),
        status: asString(variant.status) === 'inactive' ? 'inactive' : 'active',
      })),
      updatedAtMs: asMillis(product.updatedAt) || asMillis(product.submitted_at) || asMillis(product.createdAt),
    };
  }

  /**
   * Maps getProduct into the editor. Each save gives options new ids and retires the old ones, so only active options
   * are kept, and only variants that point at them (one per colour/size pair).
   */
  private toForm(product: JsonRecord): ListingFormState {
    const records = (value: unknown): JsonRecord[] => asArray(value).map((entry) => asRecord(entry)).filter((entry): entry is JsonRecord => entry !== null);
    const colors: ListingColorOption[] = records(product.colorVariants).filter((entry) => asString(entry.status) !== 'inactive')
      .map((entry) => ({ id: asString(entry.id), name: asString(entry.colorVariantName), baseId: asString(entry.colorId) })).filter((color) => color.id && color.name);
    const sizes: ListingSizeOption[] = records(product.sizeVariants).filter((entry) => asString(entry.status) !== 'inactive')
      .map((entry) => ({ id: asString(entry.id), name: asString(entry.sizeVariantName), baseId: asString(entry.sizeId) })).filter((size) => size.id && size.name);
    const variants: ListingVariantDraft[] = [];
    const candidates = records(product.variants).sort((first, second) => Number(asString(second.status) === 'active') - Number(asString(first.status) === 'active'));
    for (const entry of candidates) {
      const colorVariantId = asString(entry.colorVariantId);
      const sizeVariantId = asString(entry.sizeVariantId);
      if (colorVariantId && !colors.some((color) => color.id === colorVariantId)) continue;
      if (sizeVariantId && !sizes.some((size) => size.id === sizeVariantId)) continue;
      if (!colorVariantId && !sizeVariantId && (colors.length || sizes.length)) continue;
      if (variants.some((variant) => variant.colorVariantId === colorVariantId && variant.sizeVariantId === sizeVariantId)) continue;
      const id = asString(entry.id);
      if (!id) continue;
      variants.push({ id, colorVariantId, sizeVariantId, price: asNumber(entry.price), quantity: asNumber(entry.quantity), status: asString(entry.status) === 'inactive' ? 'inactive' : 'active', sku: asString(entry.sku) });
    }
    const contacts = records(product.contactInfo);
    const contact = (type: string): string => asString(contacts.find((entry) => asString(entry.type) === type)?.value);
    const dimensions = asRecord(product.dimensions);
    const weight = asRecord(product.weight);
    const thumbnail = asString(product.thumbnailImage);
    const condition = asString(product.condition);
    const base = marketListingFormService.createEmptyForm();
    const firstCurrency = asString(records(product.variants)[0]?.currency);
    const form: ListingFormState = {
      ...base,
      title: asString(product.title), category: asString(product.category), condition: LISTING_CONDITIONS.find((entry) => entry.value === condition)?.value ?? ('new' as ListingCondition),
      shortDescription: asString(product.shortDescription), longDescription: asString(product.longDescription), brand: asString(product.brand), sku: asString(product.sku),
      tags: asArray(product.tags).filter((tag): tag is string => typeof tag === 'string'),
      cover: thumbnail ? { key: 'cover-remote', kind: 'remote', url: thumbnail, subImageId: null } : null,
      gallery: records(product.subImages).map((entry) => ({ key: `remote-${asString(entry.id)}`, kind: 'remote' as const, url: asString(entry.imageName), subImageId: asString(entry.id) || null })).filter((image) => image.url),
      currency: asString(product.currency) || firstCurrency || base.currency,
      originalPrice: asNumber(product.originalPrice), salePrice: asNumber(product.salePrice), isOnSale: product.isOnSale === true,
      colors, sizes, variants,
      deliveryAvailable: product.deliveryAvailable !== false, pickupAvailable: product.pickupAvailable !== false,
      shippingCost: asNumber(product.shippingCost) ?? 0, estimatedShippingDays: asNumber(product.estimatedShippingDays),
      returnsAllowed: product.returnsAllowed !== false, returnPolicy: asString(product.returnPolicy), refundPolicy: asString(product.refundPolicy), warranty: asString(product.warranty),
      dimensionLength: asNumber(dimensions?.length), dimensionWidth: asNumber(dimensions?.width), dimensionHeight: asNumber(dimensions?.height),
      dimensionUnit: asString(dimensions?.unit) === 'in' ? 'in' : 'cm',
      weightValue: asNumber(weight?.value), weightUnit: asString(weight?.unit) === 'lb' || asString(weight?.unit) === 'g' ? asString(weight?.unit) as 'lb' | 'g' : 'kg',
      contactPhone: contact('phone'), contactEmail: contact('email'), contactWebsite: contact('website'),
    };
    return { ...form, variants: form.variants.length ? form.variants : marketListingFormService.rebuildVariants(form) };
  }

  private toOrder(order: JsonRecord): SellerOrder {
    const status = asString(order.status);
    const address = asRecord(order.shippingAddress);
    const fulfillment = asRecord(order.fulfillmentDetails) ?? {};
    const fulfillmentDetails: SellerOrderFulfillment = {};
    for (const key of ['carrier', 'trackingNumber', 'trackingUrl', 'proofOfShipmentUrl', 'shippedAt', 'dispatchedAt', 'deliveredAt', 'pickupLocation', 'pickupNotes', 'deadlineDate'] as const) {
      const value = asString(fulfillment[key]);
      if (value) fulfillmentDetails[key] = value;
    }
    const shippingAddress: SellerOrderAddress | null = address ? {
      fullName: asString(address.fullName), phone: asString(address.phone), addressLine1: asString(address.addressLine1), addressLine2: asString(address.addressLine2),
      city: asString(address.city), state: asString(address.state), postalCode: asString(address.postalCode), country: asString(address.country),
    } : null;
    const items: SellerOrderItem[] = asArray(order.items).map((entry) => asRecord(entry)).filter((entry): entry is JsonRecord => entry !== null).map((item) => ({
      id: asString(item.id), productId: asString(item.productId), title: asString(item.title) || 'Item', thumbnailImage: asString(item.thumbnailImage),
      price: asNumber(item.price) ?? 0, quantity: asNumber(item.quantity) ?? 1, colorName: asString(item.colorName), sizeName: asString(item.sizeName), sellerId: asString(item.sellerId),
    }));
    return {
      id: asString(order.id), orderNumber: asString(order.orderNumber) || asString(order.id), buyerName: asString(order.buyerName) || 'Buyer', items,
      subtotal: asNumber(order.subtotal) ?? 0, shippingCost: asNumber(order.shippingCost) ?? 0, total: asNumber(order.total) ?? 0,
      status: ORDER_STATUSES.find((entry) => entry === status) ?? 'pending_payment',
      deliveryMethod: asString(order.deliveryMethod) === 'pickup' ? 'pickup' : 'shipping',
      shippingAddress, fulfillmentDetails, createdAtMs: asMillis(order.createdAt),
    };
  }
}

export const marketListingClient = MarketListingClient.getInstance();
