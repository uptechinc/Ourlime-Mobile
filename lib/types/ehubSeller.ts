// Mirrors the website's Seller Center types (lib/types/ehubSeller.ts), as returned by the ehubApi function's
// /api/ehub/seller routes. Keep the agreement versions in step with the website: the server rejects a store save
// that does not accept the current version.
import type { EHubCatalogProduct } from '@/lib/types/ehubDiscovery';

export const EHUB_SELLER_AGREEMENT_VERSION = '2026-10-03';
export const EHUB_PROVIDER_DECLARATION_VERSION = '2026-10-03';

export type EHubStoreStatus = 'active' | 'suspended';
export type EHubPublicationState = 'published' | 'hidden';
export type EHubDraftType = 'storefront' | 'product';
export type EHubDraftStatus = 'active' | 'deleted';
export type EHubDraftAction = 'delete' | 'restore';
export type EHubImageScope = 'storefront' | 'product';

export type EHubStoreDraftPayload = {
  storeName: string;
  description: string;
  logoUrl: string;
  coverUrl: string;
  businessHours: string;
  sellerPolicies: string;
  returnPolicy: string;
  categories: string[];
  services: string[];
  serviceAreas: string[];
};

export type EHubProductDraftPayload = {
  productId: string | null;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  imageUrls: string[];
  price: number;
  salePrice: number | null;
  inventory: number;
  brand: string;
  sku: string;
  variants: string[];
  sizes: string[];
  colours: string[];
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  warrantyInformation: string;
};

export type EHubDraft = {
  id: string;
  ownerId: string;
  type: EHubDraftType;
  title: string;
  payload: EHubStoreDraftPayload | EHubProductDraftPayload;
  completion: number;
  status: EHubDraftStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  recoverUntil: string | null;
};

export type EHubStore = {
  id: string;
  ownerId: string;
  businessId: string;
  storeName: string;
  description: string;
  logoUrl: string | null;
  coverUrl: string | null;
  location: string;
  businessHours: string;
  categories: string[];
  services: string[];
  serviceAreas: string[];
  sellerPolicies: string;
  returnPolicy: string;
  status: EHubStoreStatus;
  isVerified: boolean;
  sellerAgreementVersion: string;
  providerDeclarationVersion: string | null;
};

/** A product in the owner's own catalog, published or hidden: the public product plus its owner. */
export type EHubSellerProduct = EHubCatalogProduct & { ownerId: string };

export type EHubSellerWorkspace = {
  eligibility: {
    isAuthenticated: true;
    isIdentityVerified: boolean;
    isRestricted: boolean;
    hasBusiness: boolean;
    reason: string | null;
  };
  store: EHubStore | null;
  products: EHubSellerProduct[];
  drafts: EHubDraft[];
};

export type EHubDraftInput = {
  draftId?: string;
  type: EHubDraftType;
  title: string;
  payload: EHubStoreDraftPayload | EHubProductDraftPayload;
  completion: number;
  clientUpdatedAt: number;
};

export type EHubStoreInput = EHubStoreDraftPayload & { sellerAgreementAccepted: boolean; providerDeclarationAccepted: boolean };
export type EHubProductInput = EHubProductDraftPayload & { publicationState: EHubPublicationState };
