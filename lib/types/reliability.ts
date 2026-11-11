export type SyncStatus = 'saving' | 'saved_on_device' | 'syncing' | 'synced' | 'offline' | 'failed' | 'conflict';
export type MutationResult<TValue> =
  | { status: 'confirmed'; value: TValue }
  | { status: 'queued_locally'; mutationId: string }
  | { status: 'conflict'; local: TValue; remote: TValue }
  | { status: 'validation_failure' | 'permission_failure' | 'retryable_failure'; message: string };

export type MarketVariant = {
  id: string; productId: string; label: string; price: number; currency: string;
  stock: number; available: boolean; image: string | null;
  colorName: string | null; colorCode: string | null; sizeName: string | null; sku: string | null;
  /** colorVariants / sizeVariants ids, so the detail screen resolves a colour + size pick to one variant. */
  colorVariantId?: string | null; sizeVariantId?: string | null;
  /** The synthetic 'base' variant of a listing that has no variants (priced from salePrice ?? originalPrice, like the web). */
  isBase?: boolean;
};
export type MarketProductCondition = 'new' | 'like_new' | 'good' | 'fair' | 'refurbished' | null;
export type MarketProduct = {
  id: string; title: string; shortDescription: string; description: string; category: string; images: string[];
  sellerId: string; sellerName: string; sellerVerified: boolean;
  available: boolean; unavailableReason: string | null; variants: MarketVariant[];
  condition: MarketProductCondition; brand: string | null; sku: string | null; tags: string[];
  rating: number | null; ratingCount: number; popularity: number;
  originalPrice: number | null; salePrice: number | null; isOnSale: boolean;
  deliveryAvailable: boolean | null; pickupAvailable: boolean | null;
  returnsAllowed: boolean | null; returnPolicy: string | null; warranty: string | null;
  // Optional: fresh network reads fill these; the on-device catalog cache does not keep them.
  contactInfo?: MarketContactItem[]; shippingCost?: number | null; estimatedShippingDays?: number | null;
  refundPolicy?: string | null; dimensions?: MarketDimensions | null; weight?: MarketWeight | null;
  sellerType?: MarketSellerType | null; sellerProfileImage?: string | null; createdAtMs?: number | null;
};
export type MarketSellerType = 'business' | 'personal';
export type MarketContactType = 'phone' | 'email' | 'website';
export type MarketContactItem = { type: MarketContactType; value: string };
export type MarketDimensions = { length: number | null; width: number | null; height: number | null; unit: string | null };
export type MarketWeight = { value: number | null; unit: string | null };
export type CatalogCursor = { search: string; category: string; title: string; id: string };
export type CatalogPage = { products: MarketProduct[]; cursor: CatalogCursor | null };
export type CartLine = {
  id: string; productId: string; variantId: string; quantity: number;
  title: string; variantLabel: string; image: string | null;
  price: number; currency: string; revision: number; removed: boolean;
  // Checkout enrichment (read from the live listing; the synced cart line itself only stores the fields above).
  sellerId?: string; sellerName?: string; shippingCost?: number; deliveryAvailable?: boolean; pickupAvailable?: boolean;
};
export type CartMutation = {
  id: string; lineId: string; baseRevision: number; line: CartLine;
};
export type CartConflict = { mutation: CartMutation; remote: CartLine };
export type CartSnapshot = { revision: number; lines: CartLine[]; pending: CartMutation[]; conflicts: CartConflict[] };

export type BlogDraftPayload = {
  title: string; type: 'blog' | 'article'; excerpt: string; content: string;
  coverImage: string; categoryId: string; readTime: number; tags: string[];
  sources: { title: string; url: string; author: string; publishDate: string; type: string; citation: string; isVerified: boolean }[];
};
export type TaskDraftPayload = {
  title: string; description: string; status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent'; assignee: string; assignees: string[];
  dueDate: string | null; estimatedTime: number; tags: string[];
};
export type PublicationReceipt = { operationId: string; destinationId: string; publishedAt: string };
export type ContentDraft = {
  id: string; ownerId: string; name: string; revision: number; localRevision: number; syncedLocalRevision: number; editId: string;
  operationId: string; lastSavedAt: string; deleted: boolean;
  receipt: PublicationReceipt | null; conflictOf: string | null;
} & ({ kind: 'blog'; projectId: null; payload: BlogDraftPayload } | { kind: 'task'; projectId: string; payload: TaskDraftPayload });
export type SellerFileKind = 'governmentId' | 'proofOfAddress' | 'businessRegistration' | 'logo';
export type SellerFile = { id: string; kind: SellerFileKind; name: string; path: string; contentType: string; size: number };
export type SellerApplicationStatus = 'draft' | 'submitted' | 'changes_requested' | 'approved' | 'rejected' | 'suspended';
export type SellerApplication = {
  ownerId: string; revision: number; status: SellerApplicationStatus;
  name: string; email: string; phone: string; storeName: string; description: string;
  categories: string[]; isBusiness: boolean; acceptedTerms: boolean; files: SellerFile[];
};
export type SellerReviewDecision = {
  id: string; ownerId: string; applicationRevision: number; reviewerId: string;
  status: 'changes_requested' | 'approved' | 'rejected' | 'suspended'; reason: string; decidedAt: string;
};

/** Web types/marketCartOrderTypes.ts, as returned by the marketApi callable (docs/market-api.md). */
export type MarketOrderStatus =
  | 'pending_payment' | 'paid' | 'processing' | 'shipped' | 'ready_for_pickup'
  | 'delivered' | 'cancelled' | 'refund_pending' | 'refunded' | 'disputed';
export type MarketOrderItem = {
  id: string; productId: string; title: string; thumbnailImage: string; price: number; quantity: number;
  colorName: string | null; sizeName: string | null; sellerId: string; sellerName: string;
};
export type MarketShippingAddress = { fullName: string; phone: string; addressLine1: string; addressLine2: string; city: string; state: string; postalCode: string; country: string };
export type MarketFulfillmentDetails = { carrier: string | null; trackingNumber: string | null; trackingUrl: string | null; pickupLocation: string | null; pickupNotes: string | null };
export type MarketOrderStatusEntry = { status: MarketOrderStatus | string; timestamp: string; note: string | null };
export type MarketOrder = {
  id: string; orderNumber: string; items: MarketOrderItem[]; subtotal: number; shippingCost: number; tax: number; total: number;
  status: MarketOrderStatus | string; deliveryMethod: 'shipping' | 'pickup'; shippingAddress: MarketShippingAddress | null;
  fulfillmentDetails: MarketFulfillmentDetails | null; statusHistory: MarketOrderStatusEntry[]; createdAt: string;
};
export type MarketReview = {
  id: string; productId: string; reviewerId: string; reviewerName: string; rating: number; title: string; comment: string;
  verifiedPurchase: boolean; sellerResponse: { response: string; respondedAt: string; sellerName: string } | null; createdAt: string;
};
export type MarketSellerDetail = {
  sellerType: MarketSellerType | null; name: string | null; profileImage: string | null; location: string | null;
  description: string | null; contact: Partial<Record<MarketContactType, string>>;
};
export type MarketProductDetail = { seller: MarketSellerDetail | null; reviews: MarketReview[]; contactInfo: MarketContactItem[]; pickupAvailable: boolean | null };
export type MarketPickupContacts =
  | { status: 'loading' | 'unavailable' | 'no-pickup' }
  | { status: 'ready'; contacts: MarketContactItem[] };
export type MarketSavedSearch = { id: string; label: string; query: string; categories: string[]; createdAt: number };
export type MarketSavedItem = { productId: string; variantId: string; title: string; variantLabel: string; image: string | null; price: number; currency: string; quantity: number; savedAt: number };
