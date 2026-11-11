/**
 * Seller-side Market types: a seller's own listings (website /profile/products), the listing editor
 * (website /profile/products/add and /edit/[id]) and seller order fulfilment (website /profile/products/orders).
 * Server shapes follow docs/market-api.md (the `marketApi` callable).
 */

/** `products.status` as the server writes it (`active` is a legacy synonym of `approved`). */
export type ListingStatus = 'pending' | 'approved' | 'active' | 'rejected' | 'inactive' | 'archived';
export type ListingPublicationState = 'pending' | 'published' | 'hidden' | 'deleted';
export type ListingCondition = 'new' | 'like_new' | 'good' | 'fair' | 'refurbished';
export type ListingStatusAction = 'unpublish' | 'republish';
export type ListingContactType = 'phone' | 'email' | 'website';
export type ListingDimensionUnit = 'cm' | 'in';
export type ListingWeightUnit = 'kg' | 'lb' | 'g';

/** The web's My listings filters plus the local draft (website `market_product_draft_v1`). */
export type ListingFilter = 'all' | 'published' | 'pending' | 'rejected' | 'hidden' | 'draft';

export type ListingMutationResult = {
  productId: string;
  revision: number;
  status: 'pending' | 'approved' | 'rejected' | 'inactive' | 'archived';
  publicationState: ListingPublicationState;
};

export type SellerListingVariantSummary = { price: number; quantity: number; currency: string; status: 'active' | 'inactive' };

/** One row of My listings. */
export type SellerListing = {
  id: string;
  title: string;
  category: string;
  shortDescription: string;
  longDescription: string;
  thumbnailImage: string;
  status: ListingStatus | 'unknown';
  publicationState: ListingPublicationState | 'unknown';
  revision: number | null;
  rejectionReason: string;
  condition: ListingCondition;
  brand: string;
  currency: string;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  shippingCost: number;
  variants: SellerListingVariantSummary[];
  updatedAtMs: number;
};

export type ListingCategoryOption = { value: string; label: string };
export type ListingBaseOption = { id: string; name: string };
export type ListingColorOption = { id: string; name: string; baseId: string };
export type ListingSizeOption = { id: string; name: string; baseId: string };
export type ListingVariantDraft = {
  id: string;
  colorVariantId: string;
  sizeVariantId: string;
  price: number | null;
  quantity: number | null;
  status: 'active' | 'inactive';
  sku: string;
};

/** A listing image: already stored on the listing (remote) or picked on this device (local, uploaded on save). */
export type ListingImage =
  | { key: string; kind: 'remote'; url: string; subImageId: string | null }
  | { key: string; kind: 'local'; uri: string; uploadPath: string | null; mediaType: ListingMediaType; mimeType: string | null };

/** Gallery entries may be photos or (at most LISTING_MAX_GALLERY_VIDEOS) videos; the cover is always a photo. */
export type ListingMediaType = 'image' | 'video';

/** A photo or video chosen from the device for the gallery. */
export type ListingPickedMedia = { uri: string; mediaType: ListingMediaType; mimeType: string | null; fileSize: number | null };

export type ListingFormState = {
  title: string;
  category: string;
  condition: ListingCondition;
  shortDescription: string;
  longDescription: string;
  brand: string;
  sku: string;
  tags: string[];
  cover: ListingImage | null;
  gallery: ListingImage[];
  /** subImages ids removed while editing (sent as deletedImages). */
  deletedImageIds: string[];
  currency: string;
  originalPrice: number | null;
  salePrice: number | null;
  isOnSale: boolean;
  colors: ListingColorOption[];
  sizes: ListingSizeOption[];
  variants: ListingVariantDraft[];
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  shippingCost: number | null;
  estimatedShippingDays: number | null;
  returnsAllowed: boolean;
  returnPolicy: string;
  refundPolicy: string;
  warranty: string;
  dimensionLength: number | null;
  dimensionWidth: number | null;
  dimensionHeight: number | null;
  dimensionUnit: ListingDimensionUnit;
  weightValue: number | null;
  weightUnit: ListingWeightUnit;
  contactPhone: string;
  contactEmail: string;
  contactWebsite: string;
  disclaimerAccepted: boolean;
};

/** The persisted local draft: everything but images and the disclaimer (like the web's localStorage draft). */
export type ListingDraft = Omit<ListingFormState, 'cover' | 'gallery' | 'deletedImageIds' | 'disclaimerAccepted'> & { savedAtMs: number };

/** A loaded listing for the editor (GET /api/profile/products/getProduct). */
export type SellerListingDetail = {
  listing: SellerListing;
  form: ListingFormState;
};

export type ListingEditorStep = 0 | 1 | 2 | 3;
export type ListingStepErrors = { [step in ListingEditorStep]: string[] };

/** What the gateway sends to addProduct / updateProduct (docs/market-api.md §3). */
export type ListingSaveBody = {
  operationId: string;
  productData: string;
  thumbnailUpload?: string;
  mediaUploads?: string[];
  deletedImages?: string;
  productId?: string;
};

export type SellerEligibilityStatus = 'signed_out' | 'approved' | 'pending' | 'rejected' | 'none' | 'suspended';
export type SellerEligibility = { status: SellerEligibilityStatus; storeName: string };

// Orders (copied from the web's types/marketCartOrderTypes.ts, prefixed so they never clash with buyer types).
export type SellerOrderStatus =
  | 'pending_payment' | 'paid' | 'processing' | 'shipped' | 'ready_for_pickup'
  | 'delivered' | 'cancelled' | 'refund_pending' | 'refunded' | 'disputed';

export type SellerOrderItem = {
  id: string;
  productId: string;
  title: string;
  thumbnailImage: string;
  price: number;
  quantity: number;
  colorName: string;
  sizeName: string;
  sellerId: string;
};

export type SellerOrderAddress = {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type SellerOrderFulfillment = {
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  proofOfShipmentUrl?: string;
  shippedAt?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  pickupLocation?: string;
  pickupNotes?: string;
  deadlineDate?: string;
};

export type SellerOrder = {
  id: string;
  orderNumber: string;
  buyerName: string;
  items: SellerOrderItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  status: SellerOrderStatus;
  deliveryMethod: 'shipping' | 'pickup';
  shippingAddress: SellerOrderAddress | null;
  fulfillmentDetails: SellerOrderFulfillment;
  createdAtMs: number;
};

export type ShipmentDetails = { carrier: string; trackingNumber: string; trackingUrl: string };
