# Market API (`marketApi` callable) — contract for the app

The website does every Market write (and the reads the rules close: `marketOrders`, `businesses`, non-published
`products`, `ownership` details, `productReviews` writes) through Next.js API routes with the Admin SDK. The app must
never call the website, so the Cloud Function **`marketApi`** (region `us-central1`, `Ourlime-Web/functions`) runs
copies of those exact route handlers (`functions/src/web/app/api/market/**`, `functions/src/web/app/api/profile/products/**`)
the same way `ehubApi` does for E-Hub.

Server side: `functions/src/web/MarketGatewayService.ts`, export in `functions/src/index.ts`.

## 1. Calling convention

Call it exactly like `ehubApi` (see `lib/services/EHubService.ts#request`):

```ts
const response = await appServerService.call<GatewayResponse>('marketApi', {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: '/api/market/reviews',          // a path key from the table below (no query string here)
  query: 'productId=abc123',            // optional, URL query string WITHOUT the leading "?" (one is stripped if present)
  body: { ... },                        // optional, JSON body (the request body the web route reads)
}, 60_000);   // use ~120_000 for addProduct/updateProduct (the function reads up to 11 images; server timeout 120 s)

type GatewayResponse = { status: number; body: unknown };   // status = the web route's HTTP status
```

- Auth: the callable's own Firebase ID token is passed to the handler as `Authorization: Bearer …` automatically;
  the routes verify it themselves (`getRequestUserId` / `requireViewerId`). Nothing about identity is read from the body
  (reviewerId, updatedBy, ownerId are all ignored / derived).
- The callable never throws for route errors: inspect `response.status` and `response.body`. It throws
  `HttpsError('not-found')` only for an unknown path/method, `invalid-argument` for a malformed path, and
  `permission-denied` when a **staff-preview** session (custom claim `previewPage`) sends anything other than `GET`.
- Timestamps in bodies are converted like the web (`toClientJson`): Firestore Timestamps arrive as
  `{ seconds, nanoseconds }`, GeoPoints as `{ latitude, longitude }`, references as their path string.
  Exception: `addProduct`/`updateProduct`/`updateStatus`/`deleteProduct` return plain values (no timestamps).

Routes are matched in this order (static paths before `/api/market/:id`, like Next.js):

| Method | Path key | Auth | Web source |
|---|---|---|---|
| GET | `/api/market/reviews` | optional | `app/api/market/reviews/route.ts` |
| POST | `/api/market/reviews` | required | same |
| GET | `/api/market/orders` | required | `app/api/market/orders/route.ts` |
| PATCH | `/api/market/orders` | required | same |
| POST | `/api/market/checkout` | none | `app/api/market/checkout/route.ts` |
| GET | `/api/market/:id` | optional | `app/api/market/[id]/route.ts` |
| POST | `/api/profile/products/addProduct` | required | `app/api/profile/products/addProduct/route.ts` (JSON instead of multipart, see §4) |
| POST | `/api/profile/products/updateProduct` | required | `app/api/profile/products/updateProduct/route.ts` (JSON instead of multipart) |
| PATCH | `/api/profile/products/updateStatus` | required | `app/api/profile/products/updateStatus/route.ts` |
| DELETE | `/api/profile/products/deleteProduct` | required | `app/api/profile/products/deleteProduct/route.ts` |
| GET | `/api/profile/products/getProduct` | required | `app/api/profile/products/getProduct/route.ts` |
| GET | `/api/profile/products/listProducts` | required | **gateway-only**: what `app/profile/products/page.tsx` loads (ownership query + getProduct for each) |

## 2. Shared types (copied from the web)

```ts
// types/marketCartOrderTypes.ts
export type OrderStatus =
  | 'pending_payment' | 'paid' | 'processing' | 'shipped' | 'ready_for_pickup'
  | 'delivered' | 'cancelled' | 'refund_pending' | 'refunded' | 'disputed';

export type MarketCartItem = {
  id: string; productId: string; title: string; thumbnailImage: string; price: number; originalPrice?: number;
  quantity: number; maxAvailableQuantity: number; colorVariantId?: string; colorName?: string; sizeVariantId?: string;
  sizeName?: string; variantId?: string; sellerId: string; sellerName: string; sellerType: 'business' | 'personal';
  deliveryAvailable?: boolean; pickupAvailable?: boolean; shippingCost?: number; isSavedForLater?: boolean;
};
export type ShippingAddress = { fullName: string; phone: string; addressLine1: string; addressLine2?: string; city: string; state?: string; postalCode?: string; country: string };
export type FulfillmentDetails = {
  carrier?: string; trackingNumber?: string; trackingUrl?: string; proofOfShipmentUrl?: string; shippedAt?: string;
  dispatchedAt?: string; deliveredAt?: string; pickupLocation?: string; pickupNotes?: string; deadlineDate?: string;
};
export type BuyerAcknowledgment = { accepted: boolean; timestamp: string; version: string };
export type OrderStatusEntry = { status: OrderStatus; timestamp: string; note?: string; updatedBy?: string };
export type MarketOrder = {
  id: string; orderNumber: string; buyerId: string; buyerName: string; buyerEmail: string; sellerIds: string[];
  items: MarketCartItem[]; subtotal: number; shippingCost: number; tax: number; total: number; status: OrderStatus;
  deliveryMethod: 'shipping' | 'pickup'; shippingAddress?: ShippingAddress; fulfillmentDetails?: FulfillmentDetails;
  buyerAcknowledgment: BuyerAcknowledgment; statusHistory: OrderStatusEntry[]; createdAt: string; updatedAt: string;
};
export type ProductReview = {
  id: string; productId: string; orderId?: string; reviewerId: string; reviewerName: string; reviewerAvatar?: string;
  rating: number; title: string; comment: string; photos?: string[]; verifiedPurchase: boolean;
  sellerResponse?: { response: string; respondedAt: string; sellerName: string };
  isReported?: boolean; createdAt: string; updatedAt?: string;
};

// lib/services/MarketListingService.ts
export type ListingMutationResult = {
  productId: string; revision: number;
  status: 'pending' | 'approved' | 'rejected' | 'inactive' | 'archived';
  publicationState: 'pending' | 'published' | 'hidden' | 'deleted';
};
```

`Product`, `ColorVariants`, `SizeVariants`, `ProductVariant` are the web's `types/productTypes.ts` (timestamps arrive
as `{ seconds, nanoseconds }`).

## 3. Routes

Every Market route body uses the web's envelope: `{ status: 'success', data }` or `{ status: 'error', message }`.
The profile/products routes use `{ success: boolean, status?: 'success' | 'error', ... }` as noted per route.

### GET `/api/market/reviews` — list a product's reviews
- Query: `productId=<id>` (required).
- Auth optional. Public listings: anyone. Pending/rejected/hidden listings: owner or administrator only.
- 200 `{ status: 'success', data: ProductReview[] }` — newest first (`createdAt desc`), at most 50.
- 400 `productId is required`; 404 `Product not found` (missing or not visible); 500 `Failed to fetch reviews`.
- Distribution: the web computes the star distribution / average on the client from this list
  (`components/market/...` reviews section). Product-level `rating` / `ratingCount` live on the product
  (`GET /api/market/:id` → `data.product.rating`, `ratingCount`).

### POST `/api/market/reviews` — leave a review
- Body: `{ productId: string; rating: number /*1–5*/; title: string /*≤200*/; comment: string /*≤5000*/; photos?: string[] /*https URLs, first 10 kept*/ }`.
  The reviewer is always the caller; name/avatar come from their Firebase Auth profile.
- 200 `{ status: 'success', data: { success: true, reviewId: string } }`. The product's `rating`/`ratingCount` are recalculated.
- Errors (`{ status: 'error', message }`):
  - 401 `You must be logged in to leave a review.`
  - 400 `productId is required` · `Rating must be between 1 and 5 stars.` · `A review headline and comment are required.` · `Your review is too long.`
  - 404 `Product not found`
  - 403 `Sellers cannot review their own products.`
  - 409 `You have already submitted a review for this product.`
  - 500 other.
- `verifiedPurchase` is set server-side (buyer has a `paid|processing|shipped|ready_for_pickup|delivered` order with the product).

### GET `/api/market/orders` — buyer or seller order list
- Query: `buyerId=<uid>` **or** `sellerId=<uid>` (must be the caller unless the caller is an administrator).
- 200 `{ status: 'success', data: MarketOrder[] }` — newest first, at most 100 (an index failure returns `[]`).
- 401 `Unauthorized`; 403 `Forbidden`; 400 `buyerId or sellerId parameter is required.`; 500.

### PATCH `/api/market/orders` — change an order's status
- Body: `{ orderId: string; status: OrderStatus; fulfillment?: Partial<FulfillmentDetails>; note?: string /*≤500 kept*/ }`.
  (`updatedBy` in the body is ignored; the caller is recorded.)
- Who may do what:
  - Seller listed in `sellerIds`: `processing`, `shipped`, `ready_for_pickup`, `delivered`, `cancelled`, `refund_pending`, `refunded`; may record `fulfillment` (string fields ≤2000 chars: carrier, trackingNumber, trackingUrl, proofOfShipmentUrl, shippedAt, dispatchedAt, deliveredAt, pickupLocation, pickupNotes, deadlineDate — merged into `fulfillmentDetails`).
  - Buyer: `cancelled` from `pending_payment|paid|processing`; `delivered` from `shipped|ready_for_pickup`. Buyer `fulfillment` is ignored.
  - Administrator: any status.
- Appends `{ status, timestamp: ISO, note: note || 'Status updated to <status>', updatedBy }` to `statusHistory`.
  `cancelled`/`refunded` return each item's quantity to its variant.
- 200 `{ status: 'success', data: { success: true } }`.
- Errors: 401 `Unauthorized`; 400 `orderId and status are required.` · `Invalid order status.`; 404 `Order not found`;
  403 `This status change is not allowed for this order.` · `You do not have access to this order.`;
  409 `This order is already cancelled|refunded.`; 500.

### POST `/api/market/checkout`
- Body: ignored. No auth.
- Always **503** `{ status: 'unavailable', code: 'PAYMENTS_NOT_ENABLED', message: 'Payments are unavailable. No order was placed and inventory was not reserved.' }`.

### GET `/api/market/:id` — one listing (detail page / pickup contact)
- Path: `/api/market/<productId>` (URL-encode the id). Auth optional.
- Visible when public (published, not deleted/prohibited/hidden-seller); otherwise only to the owner or an administrator.
- 200 `{ status: 'success', data: MarketProductDetail }`; 404 `Product not found`; 500 `Failed to fetch product details`.

```ts
type MarketOwnership = {
  id: string; userId: string; productId: string; sellerType: 'business' | 'personal' | string;
  userName: string | null; profileImage: string | null;
  businessDetails: null | {                       // set only for sellerType 'business'
    name: string; description: string; established: string; location: string;
    contact: { email: string; phone: string; website: string };   // used by MarketPickupContact
    categories: string[];
  };
  businessProfile: null | {
    rating: { overall: number; service: number; delivery: number; product: number };
    feedback: { responseTime: number; satisfaction: number; resolution: number };
    reviews: { total: number; positive: number; negative: number };
  };
  metrics: null | { totalProducts: number; totalSales: number; avgRating: number; responseRate: string };
  productReviews: unknown[];                      // raw productReviews docs for business sellers, [] otherwise
};
type MarketProductDetail = {
  product: Product;                               // web Product (defaults filled: condition 'new', rating 4.5, …)
  colorVariants: ColorVariants[];
  sizeVariants: SizeVariants[];
  variants: ProductVariant[];                     // public viewers: published variants only; owner/admin: all
  subImages: Array<{ id: string; productId: string; imageName: string }>;
  ownership: MarketOwnership[];
  reviews: ProductReview[];                       // up to 50
};
```

Pickup contact (web `MarketPickupContact.tsx`): `ownership[0].businessDetails?.contact` (email/phone/website),
falling back to `product.contactInfo` (`{ type: 'phone'|'email'|'website'; value }[]`).

### POST `/api/profile/products/addProduct` — create a listing (seller)
### POST `/api/profile/products/updateProduct` — edit a listing (owner)

The web posts multipart `FormData`; the callable cannot carry files, so the gateway accepts the same fields as JSON,
with images given as **Storage paths the caller uploaded** (§4). The server turns them into the same `File`s and runs
the web's `MarketListingService.save` unchanged.

```ts
type ListingSaveBody = {
  operationId: string;            // [A-Za-z0-9_-]{1,150}; generate once per user action and REUSE on retry (idempotent)
  productData: string;            // JSON.stringify(ListingProductData) — ≤400 000 chars, exactly what the web sends
  thumbnailUpload?: string;       // Storage path of the cover image — REQUIRED for addProduct, optional for update
  mediaUploads?: string[];        // Storage paths of gallery images, at most 10 (order = image-0..image-9)
  deletedImages?: string;         // JSON.stringify(string[]) of subImages ids to remove (update only)
  productId?: string;             // updateProduct only: [A-Za-z0-9_-]+
};

// productData (validated by MarketListingService.save; same as the web listing form)
type ListingProductData = {
  title: string;                  // required, ≤200
  category: string;               // required, ≤100
  shortDescription?: string;      // ≤2000
  longDescription?: string;       // ≤50000
  currency?: string;              // 3 letters; default for variants
  condition?: string; sku?: string; brand?: string;
  dimensions?: { length?: number; width?: number; height?: number; unit?: string } | null;
  weight?: { value?: number; unit?: string } | null;
  deliveryAvailable?: boolean; pickupAvailable?: boolean; shippingCost?: number | null; estimatedShippingDays?: number | null;
  returnsAllowed?: boolean; returnPolicy?: string; refundPolicy?: string; warranty?: string;
  tags?: string[];                // ≤30, each ≤100
  originalPrice?: number | null; salePrice?: number | null; isOnSale?: boolean;
  contactInfo?: Array<{ type: 'phone' | 'email' | 'website'; value: string }>;  // ≤5
  colors?: Array<{ id: string; colorVariantName: string; colorId?: string }>;  // ≤30, distinct id
  sizes?: Array<{ id: string; sizeVariantName: string; sizeId?: string }>;     // ≤30, distinct id
  variants: Array<{               // 1..100, distinct id
    id: string; colorVariantId?: string; sizeVariantId?: string;  // must reference ids in colors/sizes ('' = none)
    price: number; quantity: number /*integer*/; currency?: string; sku?: string; status: 'active' | 'inactive';
  }>;
  disclaimerAccepted?: { accepted: true };   // REQUIRED for addProduct
};
```

- Success 200: `{ success: true, status: 'success', data: ListingMutationResult & { message: 'Listing saved for review.' } }`.
  A new listing's `productId` is derived from `sha256(ownerId:operationId)`; every save returns `status: 'pending'`,
  `publicationState: 'pending'` and the new `revision`.
- Errors: 401 `{ success: false, status: 'error', message: 'AUTH_REQUIRED' }`; everything else **400** with the
  service message, e.g. `Administrator seller verification is required for new or republished listings.`,
  `Product ownership could not be verified.`, `Invalid operation ID.`, `Invalid listing payload.`,
  `Provide distinct product variants.`, `Every variant must reference a selected color and size.`,
  `Accept the seller listing disclaimer.`, `A cover image is required.`, `Choose at most 10 listing images.`,
  `Listing images must be JPEG, PNG or WebP up to 10 MB.`, `Image contents do not match the file type.`,
  `This operation ID was already used for a different listing change.`, `Seller approval changed.`,
  `Listing ownership changed.`, `Invalid listing ID.`, plus the upload errors in §4.
- Seller eligibility = `publicStores/{uid}.verificationStatus == 'approved'` and an active, non-suspended account.

### PATCH `/api/profile/products/updateStatus` — unpublish / republish
- Body: `{ productId: string; expectedRevision: number; operationId: string; action: 'unpublish' | 'republish' }`.
- 200 `{ success: true, status: 'success', result: ListingMutationResult }` (unpublish → `inactive`/`hidden`; republish → `pending`/`pending`).
- 401 `AUTH_REQUIRED`; 400 `Invalid listing status action.` · `Listing ownership could not be verified.` ·
  `The listing changed on another device. Refresh before continuing.` · `Deleted listings cannot be republished.` · seller-eligibility message (republish).

### DELETE `/api/profile/products/deleteProduct` — archive a listing
- Body: `{ productId: string; expectedRevision: number; operationId: string }`.
- 200 `{ success: true, status: 'success', message: 'Product archived.', result: ListingMutationResult }` (`archived`/`deleted`).
- 401 `AUTH_REQUIRED`; 400 `Listing not found.` · `Administrator access required.` · `The listing changed on another device. Refresh before deleting.`

### GET `/api/profile/products/getProduct` — a product with variants and images (edit form)
- Query: `productId=<id>`. Owner or administrator: any state; others: published only.
- 200 `{ success: true, product: SellerProductDetails }`; 400 `Product ID is required`; 401 `Unauthorized`;
  404 `Failed to fetch product data`; 403 `You do not have permission to view this product`; 500 `Failed to fetch product`.

```ts
type SellerProductDetails = { id: string } & ProductDocument /* every field of products/{id}, incl. revision,
  status, publicationState, rejection_reason, thumbnailImage, images, currency … */ & {
  colorVariants: Array<{ id: string } & DocumentData>;   // raw colorVariants docs (incl. inactive)
  sizeVariants: Array<{ id: string } & DocumentData>;
  variants: Array<{ id: string } & DocumentData>;         // raw variants docs (price, quantity, currency, status, label, publicationState, colorVariantId, sizeVariantId, sku)
  subImages: Array<{ id: string; productId: string; imageName: string; storagePath?: string; operationId?: string }>;
  ownership: { id: string; productId: string; userId: string; sellerType: string; status?: string } | undefined;
};
```

### GET `/api/profile/products/listProducts` — "my products" (gateway-only)
- No query. Auth required. Does what `app/profile/products/page.tsx` does: `ownership where userId == caller`, then
  `getProductDetails` for each (missing products skipped; at most 200 ownership records).
- 200 `{ success: true, products: SellerProductDetails[] }` (unsorted, same as web); 401 `{ success: false, message: 'Unauthorized' }`; 500 `{ success: false, message: 'Failed to fetch products' }`.
- The web page's filters: `active` = status `approved`/`active`, `pending`, `rejected` (`rejection_reason`), `inactive`.

## 4. Listing image upload flow (phone)

Storage `products/` is closed to clients except one new owner-only staging folder:

```
products/{uid}/uploads/{uploadId}
  create only (no read/update/delete), signed-in owner, email verified, active account, not staff preview,
  contentType image/jpeg | image/png | image/webp, 0 < size <= 10 MB,
  uploadId matches [A-Za-z0-9_-]{8,128} optionally followed by .jpg/.jpeg/.png/.webp
```

Steps:
1. Pick/capture the image. Convert to **JPEG** (e.g. `expo-image-manipulator`, `SaveFormat.JPEG`, compress ~0.85,
   longest side ≤ 2048) — HEIC is rejected. Make sure it is ≤ 10 MB.
2. `uploadId = <uuid without braces>.jpg` (e.g. `crypto.randomUUID()`); path = `products/${uid}/uploads/${uploadId}`.
3. `storage().ref(path).putFile(localUri, { contentType: 'image/jpeg' })`. Each path can be written only once
   (no overwrite), so a retry after a failed upload uses a new uploadId.
4. Call `addProduct` / `updateProduct` with `thumbnailUpload: path` and/or `mediaUploads: [path, …]` and an
   `operationId` created once for this save. Do **not** request a download URL (reads are denied; not needed).
5. The server checks each path is `products/{caller}/uploads/…`, exists, is JPEG/PNG/WebP ≤ 10 MB, reads it, verifies
   the magic bytes, and stores it exactly like the web at
   `products/{uid}/pending/{operationId}/{cover|image-N}-{sha256}` with a public download token; `products.thumbnailImage`,
   `products.images` and `subImages.imageName` hold those download URLs.
6. After a successful save the server deletes the staged uploads. If the same `operationId` is retried after a success
   (e.g. response lost) and the uploads are already gone, the server returns the stored result of that operation
   (idempotent replay). If the save failed, the uploads remain, so retry with the same paths.

Staged uploads that are never submitted are not cleaned up automatically yet (the scheduled
`ListingMediaCleanupService` only sweeps `products/*/pending/`), so upload right before saving, not on pick.

Upload errors (400, `{ success: false, status: 'error', message }`):
`Invalid listing image upload.` (path not under `products/{caller}/uploads/` or bad name) ·
`Listing image upload not found. Upload it again.` · `Listing images must be JPEG, PNG or WebP up to 10 MB.` ·
`Choose at most 10 listing images.`

## 5. Deploy

```
cd Ourlime-Web
firebase deploy --only functions:marketApi
firebase deploy --only storage
```
