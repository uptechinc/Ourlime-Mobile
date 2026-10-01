import { ALL_COUNTRIES } from '@/lib/constants/countries';
import { nativeSessionService } from './NativeSessionService';
import { reliabilityDecoder as decode } from './ReliabilityDecoderService';
import { db } from '@/lib/firebaseConfig';
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
import type { CatalogCursor, CatalogPage, MarketProduct, MarketProductCondition, MarketVariant, CartLine } from '@/lib/types/reliability';
import type { CheckoutContact } from '@/lib/types/ehub';

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

    let snapshot = await getDocs(productQuery);
    let usesLegacySchema = false;

    // Existing web listings predate publicationState/titleNormalized. Keep the
    // read bounded and compatible until the release migration has verified and
    // backfilled those fields. Once canonical documents exist, security rules
    // can reject this compatibility query without affecting the catalog.
    if (snapshot.empty) {
      const legacyConstraints: QueryConstraint[] = [orderBy(documentId())];
      if (cursor) legacyConstraints.push(startAfter(cursor.id));
      legacyConstraints.push(limit(90));
      snapshot = await getDocs(query(products, ...legacyConstraints));
      usesLegacySchema = true;
    }
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
    for (let offset = 0; offset < visibleDocuments.length; offset += 4) {
      decodedProducts.push(...await Promise.all(visibleDocuments.slice(offset, offset + 4).map((document: QueryDocumentSnapshot<DocumentData>) => this.decodeProduct(document.id, document.data()))));
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

  private async decodeProduct(id: string, value: unknown): Promise<MarketProduct> {
    const product = decode.object(value);
    const directSellerId = typeof product.sellerId === 'string' ? product.sellerId : '';
    const [publishedVariantsSnapshot, ownershipSnapshot, colorSnapshot, sizeSnapshot, subImageSnapshot] = await Promise.all([
      getDocs(query(collection(db, 'variants'), where('productId', '==', id), where('publicationState', '==', 'published'), limit(401))),
      getDocs(query(collection(db, 'ownership'), where('productId', '==', id), limit(2))),
      getDocs(query(collection(db, 'colorVariants'), where('productId', '==', id), limit(200))),
      getDocs(query(collection(db, 'sizeVariants'), where('productId', '==', id), limit(200))),
      getDocs(query(collection(db, 'subImages'), where('productId', '==', id), limit(100))),
    ]);
    const variantsSnapshot = publishedVariantsSnapshot.empty
      ? await getDocs(query(collection(db, 'variants'), where('productId', '==', id), limit(401)))
      : publishedVariantsSnapshot;
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
        available: available && priceValid && Boolean(currency) && stock > 0 && variant.status !== 'inactive' && variant.status !== 'archived',
        image: typeof variant.image === 'string' ? variant.image : null,
        colorName,
        colorCode: typeof color?.colorCode === 'string' ? color.colorCode : null,
        sizeName,
        sku: typeof variant.sku === 'string' ? variant.sku : null,
      };
    });
    const condition: MarketProductCondition = ['new', 'like_new', 'good', 'fair', 'refurbished'].includes(String(product.condition)) ? product.condition as MarketProductCondition : null;
    const finiteNumber = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
    const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
    return {
      id,
      title: typeof product.title === 'string' ? product.title : 'Untitled listing',
      shortDescription: typeof product.shortDescription === 'string' ? product.shortDescription : '',
      description: typeof product.longDescription === 'string' ? product.longDescription : typeof product.shortDescription === 'string' ? product.shortDescription : '',
      category: typeof product.category === 'string' ? product.category : '',
      sellerId,
      sellerName: typeof (store as { storeName?: string } | null)?.storeName === 'string' ? (store as { storeName: string }).storeName : typeof ownership?.userName === 'string' ? ownership.userName : typeof product.sellerName === 'string' ? product.sellerName : 'Seller information unavailable',
      sellerVerified: (store as { verificationStatus?: string } | null)?.verificationStatus === 'approved',
      images: [
        product.thumbnailImage,
        ...(Array.isArray(product.images) ? product.images : []),
        ...subImageSnapshot.docs.map((document) => document.data().imageName),
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
    };
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
      const profile = (await getDoc(doc(db, 'users', ownerId))).data() as { firstName?: unknown; lastName?: unknown; email?: unknown; phoneNumber?: unknown; phone?: unknown; countryCode?: unknown; city?: unknown } | undefined;
      nativeSessionService.assertOwner(ownerId);
      const text = (v: unknown) => typeof v === 'string' ? v : '';
      return { name: [text(profile?.firstName), text(profile?.lastName)].filter(Boolean).join(' '), email: text(profile?.email), phone: text(profile?.phoneNumber || profile?.phone), country: text(profile?.countryCode), address: '', city: text(profile?.city), postalCode: '' };
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
