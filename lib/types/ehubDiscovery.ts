// Mirrors the website's eHub types (lib/types/ehubDiscovery.ts and the public parts of lib/types/ehubSeller.ts),
// as returned by the ehubApi function.
export type EHubProviderKind = 'business' | 'professional';

export type EHubProvider = {
  id: string;
  ownerId: string;
  kind: EHubProviderKind;
  name: string;
  description: string;
  categories: string[];
  services: string[];
  location: string;
  serviceAreas: string[];
  nationwide: boolean;
  logoUrl: string | null;
  coverUrl: string | null;
  isVerified: boolean;
  rating: number | null;
  reviewCount: number;
  businessHours: string | null;
  status: 'active';
  offersProducts: boolean;
  offersServices: boolean;
};

export type EHubProviderProduct = { id: string; title: string; imageUrl: string | null; price: number };

export type EHubProviderDetail = EHubProvider & {
  websiteUrl: string | null;
  sellerPolicies: string | null;
  returnPolicy: string | null;
  products: EHubProviderProduct[];
};

export type EHubProviderFilters = { search?: string; category?: string; location?: string; kind?: EHubProviderKind };

/** 'order' is an order request from the E-Hub cart (see EHubOrderRequest), sent through /api/ehub/order-requests. */
export type EHubEnquiryType = 'service' | 'availability' | 'product' | 'general' | 'order';
export type EHubPlainEnquiryType = Exclude<EHubEnquiryType, 'order'>;
export type EHubEnquiryStatus = 'new' | 'read' | 'replied' | 'closed';

export type EHubOrderFulfilment = 'pickup' | 'delivery';

/** One line of an order request, priced from the product record on the server when the request was sent. */
export type EHubOrderRequestItem = {
  productId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  selectedVariant: string | null;
  selectedSize: string | null;
  selectedColour: string | null;
};

/** The courier the buyer chose (one of the seller's preferred couriers), as it was when the request was sent. */
export type EHubOrderRequestCourier = { courierId: string; name: string; startingPrice: number | null };

/** An order request: no payment is taken and no stock is held; the seller replies to confirm price, fee and arrangements. */
export type EHubOrderRequest = {
  storeId: string;
  items: EHubOrderRequestItem[];
  subtotal: number;
  currency: 'TTD';
  fulfilment: EHubOrderFulfilment;
  /** null when the buyer leaves delivery to the seller, and always for pickup. */
  courier: EHubOrderRequestCourier | null;
  buyerMessage: string;
};

/** A cart line as the buyer sends it; the server re-reads title, price and stock. */
export type EHubOrderRequestItemInput = {
  productId: string;
  quantity: number;
  selectedVariant: string | null;
  selectedSize: string | null;
  selectedColour: string | null;
};

export type EHubOrderRequestInput = {
  storeId: string;
  items: EHubOrderRequestItemInput[];
  fulfilment: EHubOrderFulfilment;
  courierId: string | null;
  message: string;
  buyerAcknowledgementAccepted: true;
};

/** A courier the buyer can pick for an order request (no contact details; the seller arranges the booking). */
export type EHubOrderCourierOption = {
  id: string;
  name: string;
  description: string;
  serviceAreas: string[];
  islandWide: boolean;
  vehicles: string[];
  speeds: string[];
  startingPrice: number | null;
};

/** What the order request form needs about one storefront. */
export type EHubOrderRequestOptions = { storeId: string; providerId: string; storeName: string; couriers: EHubOrderCourierOption[] };
export type EHubManageableEnquiryStatus = Exclude<EHubEnquiryStatus, 'new'>;
export type EHubEnquiryMode = 'received' | 'sent';

export type EHubEnquiry = {
  id: string;
  senderId: string;
  senderName: string;
  recipientUserId: string;
  providerId: string;
  providerName: string;
  type: EHubEnquiryType;
  message: string;
  status: EHubEnquiryStatus;
  responseMessage: string | null;
  createdAt: string;
  updatedAt: string;
  readAt: string | null;
  repliedAt: string | null;
  closedAt: string | null;
  quoteRequestId: null;
  /** Set only for order requests (type 'order'); missing from servers that predate them. */
  order?: EHubOrderRequest | null;
};

/** An unsent enquiry form kept while the member moves around the app (e.g. to sign in or read the buyer terms). */
export type EHubEnquiryDraft = { type: EHubPlainEnquiryType; message: string; isBuyerAcknowledgementAccepted: boolean };

export type EHubEnquiryInput = { providerId: string; type: EHubPlainEnquiryType; message: string; buyerAcknowledgementAccepted: true };

export type EHubCatalogProduct = {
  id: string;
  storeId: string;
  storeName: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string | null;
  imageUrls: string[];
  price: number;
  salePrice: number | null;
  inventory: number;
  brand: string | null;
  sku: string | null;
  variants: string[];
  sizes: string[];
  colours: string[];
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  warrantyInformation: string | null;
  currency: 'TTD';
  publicationState: 'published' | 'hidden';
  createdAt: string;
  updatedAt: string;
};

export type EHubPublicStoreSummary = {
  id: string;
  businessId: string;
  /** The id of the seller's public storefront page. Older servers leave it out; fall back to businessId. */
  providerId?: string;
  storeName: string;
  description: string;
  logoUrl: string | null;
  location: string;
  isVerified: boolean;
  rating: number | null;
  reviewCount: number;
  sellerPolicies: string;
  returnPolicy: string;
};

export type EHubProductDetail = {
  product: EHubCatalogProduct;
  store: EHubPublicStoreSummary;
  moreFromSeller: EHubCatalogProduct[];
  relatedProducts: EHubCatalogProduct[];
};
