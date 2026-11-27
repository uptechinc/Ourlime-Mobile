const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

test('E-Hub keeps its own catalog; Market products open the detail route with discussion', () => {
  const hub = read('components/ehub/EHubScreen.tsx');
  const market = read('components/market/MarketplaceScreen.tsx');
  const details = read('components/market/details/ProductDetailsScreen.tsx');
  // The E-Hub concept keeps business catalogs separate from Market listings (web docs/ehub-concept-audit.md).
  assert.doesNotMatch(hub, /useMarketplaceCatalog/);
  assert.match(hub, /useEHubCatalog/);
  assert.match(market, /router\.push\(`\/market\/\$\{encodeURIComponent\(product\.id\)\}`/);
  assert.match(details, /ListingDiscussion/);
});

test('seller application contains the document fields without payout collection', () => {
  // The document rows and terms checkbox live in SellerApplicationParts.tsx.
  const application = read('components/market/SellerApplicationModal.tsx') + read('components/market/SellerApplicationParts.tsx');
  for (const required of ['name', 'email', 'phone', 'storeName', 'description', 'governmentId', 'proofOfAddress', 'businessRegistration', 'logo', 'Categories', 'Accept seller terms', 'Submit for review']) {
    assert.match(application, new RegExp(required));
  }
  assert.doesNotMatch(application, /card number|bank account|routing number/i);
});

test('Market exposes durable cart, checkout, discussion and support controls', () => {
  const market = read('components/market/MarketplaceScreen.tsx');
  const cart = read('components/market/cart/MarketCartModal.tsx');
  const checkout = read('components/market/checkout/MarketCheckoutScreen.tsx');
  assert.match(cart, /Save Cart \/ Retry sync/);
  assert.match(cart, /Proceed to checkout/);
  // The support shortcut is one of the quick-action tiles at the top of the Market.
  assert.match(market, /key: 'support', title: 'Support'/);
  for (const required of ['Full name', 'Phone number', 'Buyer Acknowledgment', 'Place Order & Pay']) {
    assert.match(checkout, new RegExp(required));
  }
  assert.doesNotMatch(checkout, /credit card|card number|payment successful/i);
});

test('E-Projects and Blogs do not advertise stale unavailable badges when enabled', () => {
  const registry = read('lib/pageAccess/PageRegistry.ts');
  const access = read('lib/services/PageAccessService.ts');
  assert.match(registry, /id: 'blogs',[\s\S]*?defaultStatus: 'enabled'/);
  assert.match(registry, /id: 'projects',[\s\S]*?defaultStatus: 'enabled'/);
  assert.match(access, /rawBadge === 'Unavailable' \|\| rawBadge === 'Coming Soon' \? undefined/);
});

// Tasks moved to CreateTaskSheet and blogs to an autosaving editor (web parity, Oct 2026); ContentDraftModal is unused.
test('task creation uses the task sheet and blog creation autosaves its draft', () => {
  const task = read('app/projectManagement/[id]/index.tsx');
  const blog = read('components/blogs/CreateBlogModal.tsx');
  assert.match(task, /<CreateTaskSheet/);
  assert.match(blog, /blogService\.saveDraft\(/);
  assert.match(blog, /blogService\.loadDraft\(/);
});

test('blog dates, likes and comment navigation use the repaired implementations', () => {
  const comments = read('components/blog/BlogCommentsSection.tsx');
  const details = read('app/blogs/[id]/index.tsx');
  const engagement = read('components/blog/BlogEngagementBar.tsx');
  assert.match(comments, /contentDateService\.formatCommentDate/);
  assert.match(details, /blogService\.updateInteraction\(blog\.id, 'like', nextState\)/);
  assert.match(details, /composer\.focus\(\)/);
  assert.match(details, /scrollResponderScrollNativeHandleToKeyboard/);
  assert.match(engagement, /accessibilityLabel="Go to responses"/);
});
