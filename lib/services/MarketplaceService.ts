import { ALL_COUNTRIES } from '@/lib/constants/countries';
import { nativeSessionService } from './NativeSessionService';
import { reliabilityDecoder as decode } from './ReliabilityDecoderService';
import { db } from '@/lib/firebaseConfig';
import { sharedDocumentReader } from './SharedDocumentReader';
import { firestoreBatchReadService } from './FirestoreBatchReadService';
import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { CatalogCursor, CatalogPage, MarketContactItem, MarketContactType, MarketDimensions, MarketProduct, MarketProductCondition, MarketSellerType, MarketVariant, MarketWeight, CartLine } from '@/lib/types/reliability';
import type { CheckoutContact } from '@/lib/types/ehub';
import { privateProfileService } from './PrivateProfileService';

export const MARKET_BASE_VARIANT_ID = 'base';
const MARKET_CONTACT_TYPES: readonly MarketContactType[] = ['phone', 'email', 'website'];
export type MarketCheckoutTotals = { subtotal: number; shipping: number; tax: number; total: number };
export type MarketSellerGroup = { sellerId: string; sellerName: string; lines: CartLine[]; subtotal: number; shippingCost: number };
export type CheckoutLineReview = { line: CartLine; currentPrice: number | null; reason: string | null; priceChanged: boolean };
export type MarketSupportConfig = { email: string; helpUrl: string };
export type MarketSupportDestination =
  | { kind: 'email'; url: string; display: string }
  | { kind: 'help'; url: string; display: string }
  | { kind: 'fallback'; url: null; display: string };

export class MarketplaceService {
  private static instance: MarketplaceService;
  private inFlight = new Map<string, Promise<CatalogPage>>();
  public static getInstance(): MarketplaceService { return this.instance ??= new MarketplaceService(); }

  public async catalog(_ownerId: string | null, search: string, category: string, cursor: CatalogCursor | null = null): Promise<CatalogPage> {
    const normalized = search.normalize('NFKC').toLocaleLowerCase('en-US').trim().slice(0, 100);
    if (cursor && (cursor.search !== normalized || cursor.category !== category)) throw new Error('Search changed. Restart pagination.');
    const key = JSON.stringify([normalized, category, cursor]);
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const promise = this.fetchCatalog(normalized, category, cursor);
    this.inFlight.set(key, promise);
    try { return await promise; } finally { this.inFlight.delete(key); }
  }

  private async fetchCatalog(search: string, category: string, cursor: CatalogCursor | null): Promise<CatalogPage> {
    const products = collection(db, 'products');
    const constraints: QueryConstraint[] = [where('publicationState', '==', 'published')];
    if (category) constraints.push(where('category', '==', category));
    if (search) {
      constraints.push(where('titleNormalized', '>=', search), where('titleNormalized', '<=', `${search}\uf8ff`), orderBy('titleNormalized'), orderBy(documentId()));
      if (cursor) constraints.push(startAfter(cursor.title, cursor.id));
    } else {
      constraints.push(orderBy(documentId()));
      if (cursor) constraints.push(startAfter(cursor.id));
    }
    constraints.push(limit(30));
    const productQuery = query(products, ...constraints);

    // Only published products are readable (firestore.rules /products). The old unfiltered "legacy schema" fallback was
    // refused for members and, for admins, surfaced unpublished listings whose images and variants are then refused.
    const snapshot = await getDocs(productQuery);
    const usesLegacySchema = false;
    const decodedProducts: MarketProduct[] = [];
    const visibleDocuments = snapshot.docs.filter((document) => {
      const data = document.data();
      if (!this.isPublicListing(data)) return false;
      const normalizedTitle = typeof data.titleNormalized === 'string'
        ? data.titleNormalized
        : (typeof data.title === 'string' ? data.title : '').normalize('NFKC').toLocaleLowerCase('en-US').trim();
      if (search && !normalizedTitle.startsWith(search)) return false;
      return !category || decode.string(data.category) === category;
    }).slice(0, 30);
    // Every listing's gallery images in one batched read, shared by the per-product decoding below.
    const subImagesByProduct = this.loadSubImageNames(visibleDocuments.map((document) => document.id));
    for (let offset = 0; offset < visibleDocuments.length; offset += 4) {
      decodedProducts.push(...await Promise.all(visibleDocuments.slice(offset, offset + 4).map((document: QueryDocumentSnapshot<DocumentData>) => this.decodeProduct(document.id, document.data(), subImagesByProduct))));
    }
    const last = visibleDocuments[visibleDocuments.length - 1];
    return {
      products: decodedProducts,
      cursor: last && (usesLegacySchema ? snapshot.docs.length >= 90 : snapshot.docs.length >= 30)
        ? { search, category, title: decode.string((last.data() as { titleNormalized?: string }).titleNormalized), id: last.id }
        : null,
    };
  }

  private isPublicListing(value: DocumentData): boolean {
    if (value.isDeleted === true || value.isProhibited === true) return false;
    if (value.deletedAt || value.archivedAt || value.bannedAt || value.suspendedAt) return false;
    const publicationState = typeof value.publicationState === 'string' ? value.publicationState : '';
    if (publicationState) return publicationState === 'published';
    const status = typeof value.status === 'string' ? value.status : 'approved';
    return status === 'approved' || status === 'active';
  }

  public async product(_ownerId: string | null, id: string): Promise<MarketProduct> {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error('Invalid product link.');
    const snapshot = await getDoc(doc(db, 'products', id));
    if (!snapshot.exists()) throw new Error('This listing was removed or is unavailable.');
    const product = await this.decodeProduct(id, snapshot.data());
    if (!this.isPublicListing(snapshot.data())) throw new Error('This listing was removed or is unavailable.');
    return product;
  }

  /** subImages for many products, grouped by product and capped at 100 each like the single-product query. */
  private async loadSubImageNames(productIds: string[]): Promise<Map<string, unknown[]>> {
    const documents = await firestoreBatchReadService.getDocumentsByField('subImages', 'productId', productIds, 100);
    const namesByProduct = new Map<string, unknown[]>();
    documents.forEach((document) => {
      const productId = document.data().productId;
      if (typeof productId !== 'string') return;
      const names = namesByProduct.get(productId) ?? [];
      if (names.length < 100) names.push(document.data().imageName);
      namesByProduct.set(productId, names);
    });
    return namesByProduct;
  }

  private async decodeProduct(id: string, value: unknown, subImagesByProduct?: Promise<Map<string, unknown[]>>): Promise<MarketProduct> {
    const product = decode.object(value);
    const directSellerId = typeof product.sellerId === 'string' ? product.sellerId : '';
    const [publishedVariantsSnapshot, ownershipSnapshot, colorSnapshot, sizeSnapshot, subImageNames] = await Promise.all([
      getDocs(query(collection(db, 'variants'), where('productId', '==', id), where('publicationState', '==', 'published'), limit(401))),
      getDocs(query(collection(db, 'ownership'), where('productId', '==', id), limit(2))),
      getDocs(query(collection(db, 'colorVariants'), where('productId', '==', id), limit(200))),
      getDocs(query(collection(db, 'sizeVariants'), where('productId', '==', id), limit(200))),
      subImagesByProduct
        ? subImagesByProduct.then((namesByProduct) => namesByProduct.get(id) ?? [])
        : getDocs(query(collection(db, 'subImages'), where('productId', '==', id), limit(100))).then((snapshot) => snapshot.docs.map((document) => document.data().imageName)),
    ]);
    // Only published variants are readable (firestore.rules /variants). An unfiltered fallback query is refused for
    // members and would fail the whole catalog batch, so a listing without readable variants uses its base price.
    const variantsSnapshot = publishedVariantsSnapshot;
    const ownership = ownershipSnapshot.docs[0]?.data();
    const sellerId = directSellerId || (typeof ownership?.userId === 'string' ? ownership.userId : '');
    const storeSnapshot = sellerId ? await getDoc(doc(db, 'publicStores', sellerId)) : null;
    if (variantsSnapshot.size > 400) throw new Error('This listing has too many variants to display safely. Contact the seller.');
    const store = storeSnapshot && 'data' in storeSnapshot ? storeSnapshot.data() : null;
    const available = Boolean(sellerId) && this.isPublicListing(product) && (store as { verificationStatus?: string } | null)?.verificationStatus !== 'suspended';
    const decodedVariants: MarketVariant[] = variantsSnapshot.docs.map((document: QueryDocumentSnapshot<DocumentData>) => {
      const variant = decode.object(document.data());
      const color = colorSnapshot.docs.find((entry) => entry.id === variant.colorVariantId)?.data();
      const size = sizeSnapshot.docs.find((entry) => entry.id === variant.sizeVariantId)?.data();
      const colorName = typeof color?.colorVariantName === 'string' ? color.colorVariantName : typeof variant.colorVariantName === 'string' ? variant.colorVariantName : null;
      const sizeName = typeof size?.sizeVariantName === 'string' ? size.sizeVariantName : typeof variant.sizeVariantName === 'string' ? variant.sizeVariantName : null;
      const currency = typeof variant.currency === 'string' && /^[A-Z]{3}$/.test(variant.currency) ? variant.currency : '';
      const priceValid = typeof variant.price === 'number' && Number.isFinite(variant.price) && variant.price >= 0;
      const stock = typeof variant.quantity === 'number' && Number.isSafeInteger(variant.quantity) && variant.quantity >= 0 ? variant.quantity : 0;
      return {
        id: document.id,
        productId: id,
        label: typeof variant.label === 'string' ? variant.label : [colorName, sizeName].filter(Boolean).join(' / ') || 'Standard',
        price: priceValid ? Number(variant.price) : 0,
        currency,
        stock,
        available: available && priceValid && stock > 0 && variant.status !== 'inactive' && variant.status !== 'archived',
        image: typeof variant.image === 'string' ? variant.image : null,
        colorName,
        colorCode: typeof color?.colorCode === 'string' ? color.colorCode : null,
        sizeName,
        sku: typeof variant.sku === 'string' ? variant.sku : null,
        colorVariantId: typeof variant.colorVariantId === 'string' && variant.colorVariantId ? variant.colorVariantId : null,
        sizeVariantId: typeof variant.sizeVariantId === 'string' && variant.sizeVariantId ? variant.sizeVariantId : null,
      };
    });
    const finiteNumber = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
    const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
    // Listings without variants are sold at salePrice ?? originalPrice with the web's default stock of 10, under the
    // variant id 'base' (web MarketCartItem id `${productId}-default`).
    if (!decodedVariants.length) {
      const basePrice = finiteNumber(product.salePrice) ?? finiteNumber(product.originalPrice);
      const baseCurrency = typeof product.currency === 'string' && /^[A-Z]{3}$/.test(product.currency) ? product.currency : '';
      if (basePrice !== null && basePrice >= 0) decodedVariants.push({
        id: MARKET_BASE_VARIANT_ID, productId: id, label: 'Standard', price: basePrice, currency: baseCurrency, stock: 10, available,
        image: null, colorName: null, colorCode: null, sizeName: null, sku: text(product.sku), colorVariantId: null, sizeVariantId: null, isBase: true,
      });
    }
    const condition: MarketProductCondition = ['new', 'like_new', 'good', 'fair', 'refurbished'].includes(String(product.condition)) ? product.condition as MarketProductCondition : null;
    const storeName = typeof (store as { storeName?: string } | null)?.storeName === 'string' ? (store as { storeName: string }).storeName : null;
    const listedName = storeName ?? (typeof ownership?.userName === 'string' ? ownership.userName : typeof product.sellerName === 'string' ? product.sellerName : null);
    // Older listings carry no seller name; the website shows the seller's profile name, so read it the same way.
    const sellerProfile = !listedName && sellerId ? (await sharedDocumentReader.read(doc(db, 'users', sellerId)).catch(() => null))?.data() : undefined;
    const profileName = [sellerProfile?.firstName, sellerProfile?.lastName].filter((part): part is string => typeof part === 'string' && Boolean(part.trim())).join(' ')
      || (typeof sellerProfile?.userName === 'string' ? sellerProfile.userName : '');
    const sellerType: MarketSellerType | null = ownership?.sellerType === 'business' || ownership?.sellerType === 'personal' ? ownership.sellerType : null;
    const createdAt = product.createdAt as { toMillis?: () => number; seconds?: unknown } | undefined;
    const createdAtMs = typeof createdAt?.toMillis === 'function' ? createdAt.toMillis() : typeof createdAt?.seconds === 'number' ? createdAt.seconds * 1000 : null;
    return {
      id,
      title: typeof product.title === 'string' ? product.title : 'Untitled listing',
      shortDescription: typeof product.shortDescription === 'string' ? product.shortDescription : '',
      description: typeof product.longDescription === 'string' ? product.longDescription : typeof product.shortDescription === 'string' ? product.shortDescription : '',
      category: typeof product.category === 'string' ? product.category : '',
      sellerId,
      sellerName: listedName ?? (profileName || 'Seller information unavailable'),
      sellerVerified: (store as { verificationStatus?: string } | null)?.verificationStatus === 'approved',
      images: [
        product.thumbnailImage,
        ...(Array.isArray(product.images) ? product.images : []),
        ...subImageNames,
      ].filter((image, index, images): image is string => typeof image === 'string' && /^https:\/\//.test(image) && images.indexOf(image) === index),
      available,
      unavailableReason: available ? null : 'This listing is unavailable.',
      variants: decodedVariants,
      condition,
      brand: text(product.brand),
      sku: text(product.sku),
      tags: Array.isArray(product.tags) ? product.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      rating: finiteNumber(product.rating),
      ratingCount: Math.max(0, Math.trunc(finiteNumber(product.ratingCount) ?? 0)),
      popularity: finiteNumber(product.popularity) ?? 0,
      originalPrice: finiteNumber(product.originalPrice),
      salePrice: finiteNumber(product.salePrice),
      isOnSale: product.isOnSale === true,
      deliveryAvailable: typeof product.deliveryAvailable === 'boolean' ? product.deliveryAvailable : null,
      pickupAvailable: typeof product.pickupAvailable === 'boolean' ? product.pickupAvailable : null,
      returnsAllowed: typeof product.returnsAllowed === 'boolean' ? product.returnsAllowed : null,
      returnPolicy: text(product.returnPolicy),
      warranty: text(product.warranty),
      contactInfo: this.contactItems(product.contactInfo),
      shippingCost: finiteNumber(product.shippingCost),
      estimatedShippingDays: finiteNumber(product.estimatedShippingDays),
      refundPolicy: text(product.refundPolicy),
      dimensions: this.dimensions(product.dimensions),
      weight: this.weight(product.weight),
      sellerType,
      sellerProfileImage: typeof ownership?.profileImage === 'string' && /^https:\/\//.test(ownership.profileImage) ? ownership.profileImage : null,
      createdAtMs,
    };
  }

  /** contactInfo entries in the web's order: phone, email, website (first non-empty of each). */
  public contactItems(value: unknown): MarketContactItem[] {
    const entries: unknown[] = Array.isArray(value) ? value : [];
    return MARKET_CONTACT_TYPES.flatMap((type) => {
      for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        const item = entry as { type?: unknown; value?: unknown };
        if (item.type === type && typeof item.value === 'string' && item.value.trim()) return [{ type, value: item.value.trim() }];
      }
      return [];
    });
  }

  private dimensions(value: unknown): MarketDimensions | null {
    if (!value || typeof value !== 'object') return null;
    const entry = value as { length?: unknown; width?: unknown; height?: unknown; unit?: unknown };
    const measure = (part: unknown) => typeof part === 'number' && Number.isFinite(part) && part > 0 ? part : null;
    const dimensions = { length: measure(entry.length), width: measure(entry.width), height: measure(entry.height), unit: typeof entry.unit === 'string' ? entry.unit : null };
    return dimensions.length || dimensions.width || dimensions.height ? dimensions : null;
  }

  private weight(value: unknown): MarketWeight | null {
    if (!value || typeof value !== 'object') return null;
    const entry = value as { value?: unknown; unit?: unknown };
    return typeof entry.value === 'number' && Number.isFinite(entry.value) && entry.value > 0 ? { value: entry.value, unit: typeof entry.unit === 'string' ? entry.unit : null } : null;
  }

  /** Up to four other published listings in the same category (web "More in {category}"). */
  public async related(product: MarketProduct): Promise<MarketProduct[]> {
    if (!product.category) return [];
    const page = await this.catalog(null, '', product.category);
    return page.products.filter((entry) => entry.id !== product.id && entry.available).slice(0, 4);
  }

  /** Cart lines with the seller and fulfilment fields checkout needs, read from each live listing. */
  public async enrichLines(ownerId: string, lines: CartLine[]): Promise<CartLine[]> {
    const products = new Map<string, MarketProduct | null>();
    await Promise.all([...new Set(lines.map((line) => line.productId))].map(async (productId) => {
      products.set(productId, await this.product(ownerId, productId).catch(() => null));
    }));
    return lines.map((line) => {
      const product = products.get(line.productId);
      if (!product) return line;
      return { ...line, sellerId: product.sellerId || 'seller', sellerName: product.sellerName, shippingCost: product.shippingCost ?? 0, deliveryAvailable: product.deliveryAvailable ?? true, pickupAvailable: product.pickupAvailable ?? true };
    });
  }

  /** Web MarketCartContext totals: subtotal + per-line shipping (shipping only) + 5% tax on the subtotal. */
  public totals(lines: CartLine[], deliveryMethod: 'shipping' | 'pickup'): MarketCheckoutTotals {
    const active = lines.filter((line) => !line.removed);
    const subtotal = Math.round(active.reduce((total, line) => total + line.price * line.quantity, 0) * 100) / 100;
    const shipping = deliveryMethod === 'shipping' ? Math.round(active.reduce((total, line) => total + (line.shippingCost ?? 0), 0) * 100) / 100 : 0;
    const tax = Math.round(subtotal * 0.05 * 100) / 100;
    return { subtotal, shipping, tax, total: Math.round((subtotal + shipping + tax) * 100) / 100 };
  }

  /** Lines grouped by seller, in first-seen order (web sellerGroups). */
  public sellerGroups(lines: CartLine[]): MarketSellerGroup[] {
    const groups = new Map<string, MarketSellerGroup>();
    lines.filter((line) => !line.removed).forEach((line) => {
      const sellerId = line.sellerId ?? 'seller';
      const group = groups.get(sellerId) ?? { sellerId, sellerName: line.sellerName ?? 'Seller', lines: [], subtotal: 0, shippingCost: 0 };
      group.lines.push(line);
      group.subtotal += line.price * line.quantity;
      group.shippingCost += line.shippingCost ?? 0;
      groups.set(sellerId, group);
    });
    return [...groups.values()];
  }

  public validateContact(contact: CheckoutContact): void {
    if (contact.name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()) || !/^\+[1-9]\d{6,14}$/.test(contact.phone.replace(/[\s()-]/g, ''))) throw new Error('Enter your name, a valid email, and an international phone number starting with +.');
    if (!ALL_COUNTRIES.some((country) => country.code === contact.country.trim().toUpperCase()) || !contact.address.trim() || !contact.city.trim()) throw new Error('Select a country and enter a delivery address and city/locality.');
    const postalRequired = new Set(['US', 'CA', 'GB', 'DE', 'FR', 'AU', 'NZ', 'JP', 'IN', 'BR', 'IT', 'ES', 'NL']);
    if (postalRequired.has(contact.country.trim().toUpperCase()) && !contact.postalCode.trim()) throw new Error('A postal code is required for this country.');
  }

  public async contact(ownerId: string, value?: CheckoutContact): Promise<CheckoutContact | null> {
    await nativeSessionService.ensure(ownerId);
    const reference = doc(db, 'users', ownerId, 'marketCheckout', 'current');
    if (value) { this.validateContact(value); await setDoc(reference, value); nativeSessionService.assertOwner(ownerId); return value; }
    const snapshot = await getDoc(reference);
    nativeSessionService.assertOwner(ownerId);
    if (!snapshot.exists()) {
      const profile = (await getDoc(doc(db, 'users', ownerId))).data() as { firstName?: unknown; lastName?: unknown; countryCode?: unknown; city?: unknown } | undefined;
      // Email and phone are in the owner's private profile.
      const privateProfile = await privateProfileService.getOwn(ownerId, profile);
      nativeSessionService.assertOwner(ownerId);
      const text = (v: unknown) => typeof v === 'string' ? v : '';
      return { name: [text(profile?.firstName), text(profile?.lastName)].filter(Boolean).join(' '), email: privateProfile.email, phone: privateProfile.phone, country: text(profile?.countryCode), address: '', city: text(profile?.city), postalCode: '' };
    }
    const data = snapshot.data();
    return { name: decode.string(data?.name), email: decode.string(data?.email), phone: decode.string(data?.phone), country: decode.string(data?.country), address: decode.string(data?.address), city: decode.string(data?.city), postalCode: decode.string(data?.postalCode) };
  }

  public async review(ownerId: string, lines: CartLine[]): Promise<CheckoutLineReview[]> {
    const results: CheckoutLineReview[] = [];
    for (const line of lines.filter((entry) => !entry.removed)) {
      try {
        const prod = await this.product(ownerId, line.productId);
        const variant = prod.variants.find((entry) => entry.id === line.variantId);
        const reason = !prod.available ? prod.unavailableReason : !variant?.available ? 'Variant is unavailable or missing a valid price/currency.' : line.quantity > variant.stock ? `Only ${variant.stock} units are currently available.` : variant.currency !== line.currency ? 'Currency changed. Review this item before continuing.' : null;
        results.push({ line, currentPrice: variant?.price ?? null, priceChanged: Boolean(variant && variant.price !== line.price), reason });
      } catch { results.push({ line, currentPrice: null, reason: 'Listing could not be revalidated. Retry or remove the item.', priceChanged: false }); }
    }
    return results;
  }

  public supportDestination(config: MarketSupportConfig): MarketSupportDestination {
    const email = config.email.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { kind: 'email', url: `mailto:${email}`, display: email };
    const helpUrl = config.helpUrl.trim();
    if (/^https:\/\/[^\s]+$/i.test(helpUrl)) return { kind: 'help', url: helpUrl, display: helpUrl };
    return { kind: 'fallback', url: null, display: 'Help from the main menu' };
  }

  public async support(_ownerId: string | null): Promise<MarketSupportConfig> {
    const snapshot = await getDoc(doc(db, 'publicConfig', 'marketplace'));
    const data = snapshot.data() as { supportEmail?: unknown; helpUrl?: unknown } | undefined;
    return { email: typeof data?.supportEmail === 'string' ? data.supportEmail : '', helpUrl: typeof data?.helpUrl === 'string' ? data.helpUrl : '' };
  }
}

export const marketplaceService = MarketplaceService.getInstance();
