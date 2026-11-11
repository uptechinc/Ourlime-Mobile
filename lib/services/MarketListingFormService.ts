import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import type {
  ListingCategoryOption, ListingColorOption, ListingCondition, ListingDraft, ListingEditorStep, ListingFormState, ListingImage,
  ListingSizeOption, ListingStepErrors, ListingVariantDraft, SellerListing,
} from '@/lib/types/marketListing';

/** The web stores the add-listing draft under this key in localStorage; the app keeps the same name in AsyncStorage. */
export const LISTING_DRAFT_STORAGE_KEY = 'market_product_draft_v1';
export const LISTING_STEPS = ['Basic info', 'Media', 'Pricing & details', 'Review'] as const;
export const LISTING_MAX_GALLERY_IMAGES = 10;
/** Server limits for gallery videos (MarketListingService): MP4, MOV or WebM, three per listing, 50 MB each. */
export const LISTING_MAX_GALLERY_VIDEOS = 3;
export const LISTING_MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/** True for a gallery video: a chosen local video, or a saved one stored under the listing's video/ folder. */
export const listingMediaIsVideo = (image: ListingImage): boolean => {
  if (image.kind === 'local') return image.mediaType === 'video';
  try { return decodeURIComponent(image.url).includes('/video/'); } catch { return image.url.includes('/video/'); }
};
export const LISTING_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const LISTING_MAX_PRICE = 100_000;

export const LISTING_CONDITIONS: readonly { value: ListingCondition; label: string }[] = [
  { value: 'new', label: 'New' }, { value: 'like_new', label: 'Like new' }, { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' }, { value: 'refurbished', label: 'Refurbished' },
];

/** The web's built-in categories (BasicInfo.tsx); admin categories are listed first and these fill the gaps. */
export const DEFAULT_LISTING_CATEGORIES: readonly ListingCategoryOption[] = [
  { value: 'electronics', label: 'Electronics' }, { value: 'fashion', label: 'Fashion' }, { value: 'home', label: 'Home & Living' },
  { value: 'sports', label: 'Sports & Outdoors' }, { value: 'beauty', label: 'Beauty & Personal Care' }, { value: 'books', label: 'Books & Media' },
  { value: 'toys', label: 'Toys & Games' }, { value: 'automotive', label: 'Automotive' },
];

/** The web's base colour list (PricingDetails.tsx DEFAULT_BASE_COLORS). */
export const DEFAULT_BASE_COLORS: readonly string[] = [
  'amber', 'beige', 'black', 'blue', 'bronze', 'brown', 'burgundy', 'charcoal', 'coral', 'cyan', 'emerald', 'gold', 'gray', 'green',
  'indigo', 'ivory', 'khaki', 'lavender', 'magenta', 'maroon', 'mint', 'mustard', 'navy', 'olive', 'orange', 'peach', 'pink', 'plum',
  'purple', 'red', 'ruby', 'salmon', 'sapphire', 'silver', 'teal', 'turquoise', 'white', 'yellow',
];
export const QUICK_SIZES: readonly string[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
/** Size category ids the web uses for sizes and weights when the `sizes` collection has none. */
export const SIZE_BASE_ID = 'default_size';
export const WEIGHT_BASE_ID = 'default_pounds';

export const SELLER_DISCLAIMER_TEXT = 'I confirm that I own this product or am authorized to sell it. The title, description, condition, price, images, inventory, shipping, pickup, return, warranty, and seller information are accurate. The product is lawful, authentic, and not recalled, stolen, counterfeit, unsafe, prohibited, or intentionally misrepresented. I understand that identity verification does not mean Ourlime endorses me or guarantees this product. I accept responsibility for fulfilling orders, handling returns and refunds, protecting buyer information, paying applicable taxes and fees, and complying with relevant requirements.';
export const SELLER_GUIDANCE: readonly string[] = [
  'Use photographs of the actual item.',
  'Disclose any defects, damage, missing parts, or prior use.',
  'State the complete price and additional shipping costs clearly.',
  'Never list counterfeit, recalled, illegal, or prohibited goods.',
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9]{10,15}$/;
const WEBSITE_PATTERN = /^(https?:\/\/)?(www\.)?[a-zA-Z0-9@:%._+~#=-]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&/=]*)$/;
const WEIGHT_VALUE_PATTERN = /^\d+(\.\d+)?\s*(lbs?|kg|g|oz)$/i;

type ProductDataContact = { type: 'phone' | 'email' | 'website'; value: string };
type ProductDataBody = {
  title: string; category: string; shortDescription: string; longDescription: string; currency: string; condition: ListingCondition;
  sku: string | null; brand: string | null;
  dimensions: { length?: number; width?: number; height?: number; unit: string } | null;
  weight: { value?: number; unit: string } | null;
  deliveryAvailable: boolean; pickupAvailable: boolean; shippingCost: number; estimatedShippingDays: number | null;
  returnsAllowed: boolean; returnPolicy: string | null; refundPolicy: string | null; warranty: string | null; tags: string[];
  originalPrice: number | null; salePrice: number | null; isOnSale: boolean; contactInfo: ProductDataContact[];
  colors: { id: string; colorVariantName: string; colorId: string }[];
  sizes: { id: string; sizeVariantName: string; sizeId: string }[];
  variants: { id: string; colorVariantId: string; sizeVariantId: string; price: number; quantity: number; currency: string; sku: string; status: 'active' | 'inactive' }[];
  disclaimerAccepted: { accepted: true; version: string };
};

/**
 * The listing editor's rules: defaults, the web's per-step validation (BasicInfo, MediaUpload, PricingDetails, SaveProduct)
 * plus the server's limits (MarketListingService.save), the variant matrix, the productData payload and the local draft.
 */
export class MarketListingFormService {
  private static instance: MarketListingFormService;

  private constructor() {}

  public static getInstance(): MarketListingFormService {
    if (!MarketListingFormService.instance) MarketListingFormService.instance = new MarketListingFormService();
    return MarketListingFormService.instance;
  }

  /** A Firestore-style auto id (20 letters/digits); matches the server's `[A-Za-z0-9_-]` ids. Generated offline. */
  public createId(): string {
    return doc(collection(db, 'operationIds')).id;
  }

  public createEmptyForm(contactEmail = '', contactPhone = ''): ListingFormState {
    return {
      title: '', category: '', condition: 'new', shortDescription: '', longDescription: '', brand: '', sku: '', tags: [],
      cover: null, gallery: [], deletedImageIds: [], currency: 'TTD', originalPrice: null, salePrice: null, isOnSale: false,
      colors: [], sizes: [], variants: [], deliveryAvailable: true, pickupAvailable: true, shippingCost: 0, estimatedShippingDays: 3,
      returnsAllowed: true, returnPolicy: '', refundPolicy: '', warranty: '', dimensionLength: null, dimensionWidth: null, dimensionHeight: null,
      dimensionUnit: 'cm', weightValue: null, weightUnit: 'kg', contactPhone, contactEmail, contactWebsite: '', disclaimerAccepted: false,
    };
  }

  /** Rebuilds the colour × size matrix like the web, keeping price, stock and availability of combinations that remain. */
  public rebuildVariants(form: ListingFormState): ListingVariantDraft[] {
    const previous = form.variants;
    const keep = (colorVariantId: string, sizeVariantId: string): ListingVariantDraft => {
      const existing = previous.find((variant) => variant.colorVariantId === colorVariantId && variant.sizeVariantId === sizeVariantId);
      if (existing) return existing;
      const sameColor = colorVariantId ? previous.find((variant) => variant.colorVariantId === colorVariantId) : undefined;
      const template = sameColor ?? (previous.length === 1 ? previous[0] : undefined);
      return { id: this.createId(), colorVariantId, sizeVariantId, price: template?.price ?? null, quantity: template?.quantity ?? null, status: template?.status ?? 'active', sku: '' };
    };
    const colorIds = form.colors.length ? form.colors.map((color) => color.id) : [''];
    const sizeIds = form.sizes.length ? form.sizes.map((size) => size.id) : [''];
    return colorIds.flatMap((colorId) => sizeIds.map((sizeId) => keep(colorId, sizeId)));
  }

  public variantLabel(form: Pick<ListingFormState, 'colors' | 'sizes'>, variant: ListingVariantDraft): string {
    const color = form.colors.find((option) => option.id === variant.colorVariantId)?.name;
    const size = form.sizes.find((option) => option.id === variant.sizeVariantId)?.name;
    return [color, size].filter(Boolean).join(' / ') || 'Standard';
  }

  public createColor(name: string, baseId: string): ListingColorOption {
    const trimmed = name.trim();
    return { id: this.createId(), name: trimmed.charAt(0).toUpperCase() + trimmed.slice(1), baseId };
  }

  public createSize(name: string): ListingSizeOption {
    const trimmed = name.trim();
    return { id: this.createId(), name: trimmed, baseId: WEIGHT_VALUE_PATTERN.test(trimmed) ? WEIGHT_BASE_ID : SIZE_BASE_ID };
  }

  public validateStep(form: ListingFormState, step: ListingEditorStep, isEditing: boolean): string[] {
    if (step === 0) return this.validateBasicInfo(form);
    if (step === 1) return this.validateMedia(form, isEditing);
    if (step === 2) return this.validatePricing(form);
    return isEditing || form.disclaimerAccepted ? [] : ['Read and agree to the Seller Listing Disclaimer before publishing.'];
  }

  public validateAll(form: ListingFormState, isEditing: boolean): ListingStepErrors {
    return { 0: this.validateStep(form, 0, isEditing), 1: this.validateStep(form, 1, isEditing), 2: this.validateStep(form, 2, isEditing), 3: this.validateStep(form, 3, isEditing) };
  }

  /** Website BasicInfo.tsx rules (title, category, descriptions, contact methods) plus the server's field limits. */
  public validateBasicInfo(form: ListingFormState): string[] {
    const errors: string[] = [];
    const title = form.title.trim();
    if (!title) errors.push('Title is required.');
    else if (title.length < 3) errors.push('Title must be at least 3 characters.');
    else if (title.length > 100) errors.push('Title must be less than 100 characters.');
    if (!form.category) errors.push('Please select a category.');
    const short = form.shortDescription.trim();
    if (!short) errors.push('Short description is required.');
    else if (short.length < 10) errors.push('Short description must be at least 10 characters.');
    else if (short.length > 150) errors.push('Short description must be less than 150 characters.');
    const long = form.longDescription.trim();
    if (!long) errors.push('Detailed description is required.');
    else if (long.length < 50) errors.push('Detailed description must be at least 50 characters.');
    else if (long.length > 50_000) errors.push('Detailed description is too long.');
    if (form.brand.trim().length > 200) errors.push('Brand must be 200 characters or fewer.');
    if (form.sku.trim().length > 200) errors.push('SKU must be 200 characters or fewer.');
    if (form.tags.length > 30) errors.push('Use at most 30 tags.');
    if (form.tags.some((tag) => tag.length > 100)) errors.push('Each tag must be 100 characters or fewer.');
    const phone = form.contactPhone.trim().replace(/[\s()-]/g, '');
    const email = form.contactEmail.trim();
    const website = form.contactWebsite.trim();
    if (phone && !PHONE_PATTERN.test(phone)) errors.push('Please enter a valid phone number (10–15 digits).');
    if (email && !EMAIL_PATTERN.test(email)) errors.push('Please enter a valid email address.');
    if (website && !WEBSITE_PATTERN.test(website)) errors.push('Please enter a valid website URL.');
    if (!phone && !email && !website) errors.push('At least one contact method is required.');
    return errors;
  }

  /** Website: a cover image is required and, for a new listing, at least one gallery image (up to 10). */
  public validateMedia(form: ListingFormState, isEditing: boolean): string[] {
    const errors: string[] = [];
    if (!form.cover) errors.push('Cover image is required.');
    if (!isEditing && !form.gallery.length) errors.push('Please add at least one gallery image.');
    if (form.gallery.length > LISTING_MAX_GALLERY_IMAGES) errors.push(`You can only upload up to ${LISTING_MAX_GALLERY_IMAGES} images/videos in total.`);
    if (form.gallery.filter((image) => listingMediaIsVideo(image)).length > LISTING_MAX_GALLERY_VIDEOS) errors.push(`Add at most ${LISTING_MAX_GALLERY_VIDEOS} videos to a listing.`);
    return errors;
  }

  /** Website PricingDetails.tsx feedback plus the server's variant, currency and number checks. */
  public validatePricing(form: ListingFormState): string[] {
    const errors: string[] = [];
    if (!/^[A-Z]{3}$/.test(form.currency.trim().toUpperCase())) errors.push('Specify a three-letter currency (e.g. TTD, USD).');
    if (!form.colors.length) errors.push('Select at least one colour variant.');
    if (form.colors.length > 30 || form.sizes.length > 30) errors.push('A listing supports at most 30 colours and 30 sizes.');
    if (!form.variants.length) errors.push('Select colour and size/weight variants to generate combination pricing.');
    if (form.variants.length > 100) errors.push('A listing supports at most 100 variant combinations.');
    if (form.variants.some((variant) => variant.price === null || !(variant.price > 0))) errors.push('Enter a valid price (> 0) for all variant combinations.');
    if (form.variants.some((variant) => variant.price !== null && variant.price > LISTING_MAX_PRICE)) errors.push('Prices cannot exceed 100,000.');
    if (form.variants.some((variant) => variant.quantity === null || variant.quantity < 0 || !Number.isSafeInteger(variant.quantity))) errors.push('Enter an inventory quantity (≥ 0) for all variant combinations.');
    if (form.isOnSale && form.salePrice === null) errors.push('Enter a sale price or turn off "On sale".');
    if (form.originalPrice !== null && form.salePrice !== null && form.salePrice > form.originalPrice) errors.push('The sale price must not be higher than the original price.');
    if (form.estimatedShippingDays !== null && !Number.isSafeInteger(form.estimatedShippingDays)) errors.push('Estimated shipping days must be a whole number.');
    if (form.returnPolicy.length > 5000 || form.refundPolicy.length > 5000 || form.warranty.length > 5000) errors.push('Policies and warranty must be 5,000 characters or fewer.');
    return errors;
  }

  public buildContactInfo(form: ListingFormState): ProductDataContact[] {
    const entries: ProductDataContact[] = [];
    const phone = form.contactPhone.trim().replace(/[\s()-]/g, '');
    if (phone) entries.push({ type: 'phone', value: phone });
    if (form.contactEmail.trim()) entries.push({ type: 'email', value: form.contactEmail.trim() });
    if (form.contactWebsite.trim()) entries.push({ type: 'website', value: form.contactWebsite.trim() });
    return entries;
  }

  /** JSON productData exactly as the web's SaveProduct sends it (docs/market-api.md ListingProductData). */
  public buildProductData(form: ListingFormState): string {
    const currency = form.currency.trim().toUpperCase();
    const hasDimensions = form.dimensionLength !== null || form.dimensionWidth !== null || form.dimensionHeight !== null;
    const body: ProductDataBody = {
      title: form.title.trim(), category: form.category, shortDescription: form.shortDescription.trim(), longDescription: form.longDescription.trim(),
      currency, condition: form.condition, sku: form.sku.trim() || null, brand: form.brand.trim() || null,
      dimensions: hasDimensions ? {
        ...(form.dimensionLength !== null ? { length: form.dimensionLength } : {}), ...(form.dimensionWidth !== null ? { width: form.dimensionWidth } : {}),
        ...(form.dimensionHeight !== null ? { height: form.dimensionHeight } : {}), unit: form.dimensionUnit,
      } : null,
      weight: form.weightValue !== null ? { value: form.weightValue, unit: form.weightUnit } : null,
      deliveryAvailable: form.deliveryAvailable, pickupAvailable: form.pickupAvailable, shippingCost: form.shippingCost ?? 0,
      estimatedShippingDays: form.estimatedShippingDays, returnsAllowed: form.returnsAllowed, returnPolicy: form.returnPolicy.trim() || null,
      refundPolicy: form.refundPolicy.trim() || null, warranty: form.warranty.trim() || null, tags: form.tags.map((tag) => tag.trim()).filter(Boolean),
      originalPrice: form.originalPrice, salePrice: form.salePrice, isOnSale: form.isOnSale, contactInfo: this.buildContactInfo(form),
      colors: form.colors.map((color) => ({ id: color.id, colorVariantName: color.name, colorId: color.baseId })),
      sizes: form.sizes.map((size) => ({ id: size.id, sizeVariantName: size.name, sizeId: size.baseId })),
      variants: form.variants.map((variant) => ({
        id: variant.id, colorVariantId: variant.colorVariantId, sizeVariantId: variant.sizeVariantId, price: variant.price ?? 0,
        quantity: variant.quantity ?? 0, currency, sku: variant.sku.trim(), status: variant.status,
      })),
      disclaimerAccepted: { accepted: true, version: 'v1.0' },
    };
    return JSON.stringify(body);
  }

  public async loadDraft(): Promise<ListingDraft | null> {
    try {
      const raw = await AsyncStorage.getItem(LISTING_DRAFT_STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return this.mergeDraft(parsed as Partial<ListingDraft>);
    } catch (error: unknown) {
      console.error('[MarketListingFormService.loadDraft] Error:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  public async saveDraft(form: ListingFormState): Promise<void> {
    if (!form.title.trim() && !form.shortDescription.trim()) return;
    const { cover: _cover, gallery: _gallery, deletedImageIds: _deleted, disclaimerAccepted: _accepted, ...rest } = form;
    const draft: ListingDraft = { ...rest, savedAtMs: Date.now() };
    try {
      await AsyncStorage.setItem(LISTING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (error: unknown) {
      console.error('[MarketListingFormService.saveDraft] Error:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  public async clearDraft(): Promise<void> {
    try {
      await AsyncStorage.removeItem(LISTING_DRAFT_STORAGE_KEY);
    } catch (error: unknown) {
      console.error('[MarketListingFormService.clearDraft] Error:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /** Website "Duplicate": copies the listing's details into the draft and opens the add-listing editor. */
  public async saveDuplicateDraft(listing: SellerListing): Promise<void> {
    const base = this.createEmptyForm();
    const draft: ListingDraft = {
      ...this.toDraftFields(base), title: `${listing.title} (Copy)`, category: listing.category, shortDescription: listing.shortDescription,
      longDescription: listing.longDescription, condition: listing.condition, brand: listing.brand, deliveryAvailable: listing.deliveryAvailable,
      pickupAvailable: listing.pickupAvailable, shippingCost: listing.shippingCost, currency: listing.currency || base.currency, savedAtMs: Date.now(),
    };
    await AsyncStorage.setItem(LISTING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }

  public applyDraft(form: ListingFormState, draft: ListingDraft): ListingFormState {
    const { savedAtMs: _savedAt, ...fields } = draft;
    return { ...form, ...fields };
  }

  private toDraftFields(form: ListingFormState): Omit<ListingDraft, 'savedAtMs'> {
    const { cover: _cover, gallery: _gallery, deletedImageIds: _deleted, disclaimerAccepted: _accepted, ...rest } = form;
    return rest;
  }

  /** Keeps only well-typed fields of a stored draft, so an old or damaged draft cannot break the editor. */
  private mergeDraft(raw: Partial<ListingDraft>): ListingDraft {
    const base = this.toDraftFields(this.createEmptyForm());
    const text = (value: unknown, fallback: string): string => typeof value === 'string' ? value : fallback;
    const flag = (value: unknown, fallback: boolean): boolean => typeof value === 'boolean' ? value : fallback;
    const num = (value: unknown, fallback: number | null): number | null => value === null ? null : typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    const condition = LISTING_CONDITIONS.some((entry) => entry.value === raw.condition) ? raw.condition as ListingCondition : base.condition;
    const colors = Array.isArray(raw.colors) ? raw.colors.filter((color): color is ListingColorOption => Boolean(color) && typeof color.id === 'string' && typeof color.name === 'string' && typeof color.baseId === 'string') : [];
    const sizes = Array.isArray(raw.sizes) ? raw.sizes.filter((size): size is ListingSizeOption => Boolean(size) && typeof size.id === 'string' && typeof size.name === 'string' && typeof size.baseId === 'string') : [];
    const variants = Array.isArray(raw.variants) ? raw.variants.filter((variant): variant is ListingVariantDraft => Boolean(variant) && typeof variant.id === 'string' && typeof variant.colorVariantId === 'string' && typeof variant.sizeVariantId === 'string') : [];
    return {
      title: text(raw.title, base.title), category: text(raw.category, base.category), condition, shortDescription: text(raw.shortDescription, ''),
      longDescription: text(raw.longDescription, ''), brand: text(raw.brand, ''), sku: text(raw.sku, ''),
      tags: Array.isArray(raw.tags) ? raw.tags.filter((tag): tag is string => typeof tag === 'string') : [],
      currency: text(raw.currency, base.currency) || base.currency, originalPrice: num(raw.originalPrice, null), salePrice: num(raw.salePrice, null),
      isOnSale: flag(raw.isOnSale, false), colors, sizes,
      variants: variants.map((variant) => ({ ...variant, price: num(variant.price, null), quantity: num(variant.quantity, null), status: variant.status === 'inactive' ? 'inactive' : 'active', sku: typeof variant.sku === 'string' ? variant.sku : '' })),
      deliveryAvailable: flag(raw.deliveryAvailable, true), pickupAvailable: flag(raw.pickupAvailable, true), shippingCost: num(raw.shippingCost, 0),
      estimatedShippingDays: num(raw.estimatedShippingDays, 3), returnsAllowed: flag(raw.returnsAllowed, true), returnPolicy: text(raw.returnPolicy, ''),
      refundPolicy: text(raw.refundPolicy, ''), warranty: text(raw.warranty, ''), dimensionLength: num(raw.dimensionLength, null),
      dimensionWidth: num(raw.dimensionWidth, null), dimensionHeight: num(raw.dimensionHeight, null), dimensionUnit: raw.dimensionUnit === 'in' ? 'in' : 'cm',
      weightValue: num(raw.weightValue, null), weightUnit: raw.weightUnit === 'lb' || raw.weightUnit === 'g' ? raw.weightUnit : 'kg',
      contactPhone: text(raw.contactPhone, ''), contactEmail: text(raw.contactEmail, ''), contactWebsite: text(raw.contactWebsite, ''),
      savedAtMs: typeof raw.savedAtMs === 'number' ? raw.savedAtMs : Date.now(),
    };
  }
}

export const marketListingFormService = MarketListingFormService.getInstance();
