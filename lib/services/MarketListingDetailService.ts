import { marketApiClient } from './MarketApiClient';
import { marketplaceService } from './MarketplaceService';
import { marketReviewService } from './MarketReviewService';
import type { MarketContactItem, MarketContactType, MarketPickupContacts, MarketProductDetail, MarketSellerDetail } from '@/lib/types/reliability';

type RawOwnership = {
  productId?: unknown; sellerType?: unknown; userName?: unknown; profileImage?: unknown;
  businessDetails?: { name?: unknown; description?: unknown; location?: unknown; contact?: Partial<Record<MarketContactType, unknown>> } | null;
};
type RawProductDetail = { product?: { contactInfo?: unknown; pickupAvailable?: unknown }; ownership?: unknown; reviews?: unknown };

const CONTACT_TYPES: readonly MarketContactType[] = ['phone', 'email', 'website'];

/**
 * The parts of a listing the rules keep server-side (seller business details and contacts, reviews), read through
 * the marketApi callable's GET /api/market/:id exactly like the website's detail page and pickup contacts.
 */
export class MarketListingDetailService {
  private static instance: MarketListingDetailService;
  private readonly cache = new Map<string, { value: MarketProductDetail; cachedAt: number }>();

  private constructor() {}

  public static getInstance(): MarketListingDetailService {
    if (!MarketListingDetailService.instance) MarketListingDetailService.instance = new MarketListingDetailService();
    return MarketListingDetailService.instance;
  }

  public async detail(productId: string, force = false): Promise<MarketProductDetail> {
    const cached = this.cache.get(productId);
    if (!force && cached && Date.now() - cached.cachedAt < 60_000) return cached.value;
    const raw = await marketApiClient.request<RawProductDetail>('GET', `/api/market/${encodeURIComponent(productId)}`);
    const ownershipList = Array.isArray(raw?.ownership) ? raw.ownership as RawOwnership[] : [];
    const owner = ownershipList.find((entry) => entry?.productId === productId) ?? ownershipList[0];
    const value: MarketProductDetail = {
      seller: owner ? this.seller(owner) : null,
      reviews: marketReviewService.decodeList(raw?.reviews),
      contactInfo: marketplaceService.contactItems(raw?.product?.contactInfo),
      pickupAvailable: typeof raw?.product?.pickupAvailable === 'boolean' ? raw.product.pickupAvailable : null,
    };
    this.cache.set(productId, { value, cachedAt: Date.now() });
    return value;
  }

  /** Web MarketPickupContact: listing contactInfo first, then the business contact, ordered phone → email → website. */
  public async pickupContacts(ownerId: string | null, productId: string): Promise<MarketPickupContacts> {
    try {
      const detail = await this.detail(productId);
      if (detail.pickupAvailable === false) return { status: 'no-pickup' };
      return { status: 'ready', contacts: this.mergeContacts(detail.contactInfo, detail.seller?.contact ?? {}) };
    } catch (error: unknown) {
      console.warn('[MarketListingDetailService.pickupContacts] Error:', error instanceof Error ? error.message : error);
      // The published listing is readable directly, so its own contacts still show if the server is unreachable.
      try {
        const product = await marketplaceService.product(ownerId, productId);
        if (product.pickupAvailable === false) return { status: 'no-pickup' };
        return { status: 'ready', contacts: product.contactInfo ?? [] };
      } catch {
        return { status: 'unavailable' };
      }
    }
  }

  public mergeContacts(listing: MarketContactItem[], business: Partial<Record<MarketContactType, string>>): MarketContactItem[] {
    return CONTACT_TYPES.flatMap((type) => {
      const value = listing.find((contact) => contact.type === type)?.value ?? business[type];
      return typeof value === 'string' && value.trim() ? [{ type, value: value.trim() }] : [];
    });
  }

  private seller(owner: RawOwnership): MarketSellerDetail {
    const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
    const business = owner.businessDetails && typeof owner.businessDetails === 'object' ? owner.businessDetails : null;
    const contact: Partial<Record<MarketContactType, string>> = {};
    CONTACT_TYPES.forEach((type) => {
      const value = text(business?.contact?.[type]);
      if (value) contact[type] = value;
    });
    const profileImage = text(owner.profileImage);
    return {
      sellerType: owner.sellerType === 'business' || owner.sellerType === 'personal' ? owner.sellerType : null,
      name: text(business?.name) ?? text(owner.userName),
      profileImage: profileImage && /^https:\/\//.test(profileImage) ? profileImage : null,
      location: text(business?.location),
      description: text(business?.description),
      contact,
    };
  }
}

export const marketListingDetailService = MarketListingDetailService.getInstance();
