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

export type EHubEnquiryType = 'service' | 'availability' | 'product' | 'general';
export type EHubEnquiryStatus = 'new' | 'read' | 'replied' | 'closed';
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
};

/** An unsent enquiry form kept while the member moves around the app (e.g. to sign in or read the buyer terms). */
export type EHubEnquiryDraft = { type: EHubEnquiryType; message: string; isBuyerAcknowledgementAccepted: boolean };

export type EHubEnquiryInput = { providerId: string; type: EHubEnquiryType; message: string; buyerAcknowledgementAccepted: true };

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
