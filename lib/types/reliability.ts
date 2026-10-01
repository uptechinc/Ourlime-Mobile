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
};
export type CatalogCursor = { search: string; category: string; title: string; id: string };
export type CatalogPage = { products: MarketProduct[]; cursor: CatalogCursor | null };
export type CartLine = {
  id: string; productId: string; variantId: string; quantity: number;
  title: string; variantLabel: string; image: string | null;
  price: number; currency: string; revision: number; removed: boolean;
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
