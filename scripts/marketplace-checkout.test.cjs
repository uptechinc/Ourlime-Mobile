const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadService() {
  const filename = path.resolve(__dirname, '..', 'lib/services/MarketplaceService.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require, module, exports) { ${source}\n})`, { filename })(
    (specifier) => {
      if (specifier === '@/lib/constants/countries') return { ALL_COUNTRIES: [{ code: 'CA' }, { code: 'TT' }, { code: 'AE' }] };
      if (specifier === './NativeSessionService') return { nativeSessionService: {} };
      if (specifier === './ReliabilityDecoderService') return { reliabilityDecoder: {} };
      if (specifier === '@/lib/firebaseConfig') return { db: {} };
      if (specifier === 'firebase/firestore') return {};
      throw new Error(`Unexpected dependency: ${specifier}`);
    }, module, module.exports,
  );
  return new module.exports.MarketplaceService();
}

const line = (overrides = {}) => ({ id: 'product::variant', productId: 'product', variantId: 'variant', variantLabel: 'Standard', title: 'Product', image: null, quantity: 2, price: 10, currency: 'CAD', removed: false, revision: 1, ...overrides });
const product = (overrides = {}) => ({ id: 'product', title: 'Product', shortDescription: '', description: '', category: 'Home', images: [], sellerId: 'seller', sellerName: 'Store', sellerVerified: true, available: true, unavailableReason: null, variants: [{ id: 'variant', productId: 'product', label: 'Standard', price: 12, currency: 'CAD', stock: 5, available: true, image: null, colorName: null, colorCode: null, sizeName: null, sku: null }], condition: null, brand: null, sku: null, tags: [], rating: null, ratingCount: 0, popularity: 0, originalPrice: null, salePrice: null, isOnSale: false, deliveryAvailable: null, pickupAvailable: null, returnsAllowed: null, returnPolicy: null, warranty: null, ...overrides });

test('checkout review explains changed prices and stock reductions without mutating cart lines', async () => {
  const service = loadService();
  service.product = async () => product();
  const changed = await service.review('owner', [line()]);
  assert.equal(changed[0].priceChanged, true);
  assert.equal(changed[0].currentPrice, 12);
  assert.equal(changed[0].reason, null);
  assert.equal(changed[0].line.price, 10);
  const stock = await service.review('owner', [line({ quantity: 6 })]);
  assert.equal(stock[0].reason, 'Only 5 units are currently available.');
});

test('checkout review blocks currency changes, suspended listings and deleted links', async () => {
  const service = loadService();
  service.product = async () => product({ variants: [{ ...product().variants[0], currency: 'USD' }] });
  assert.equal((await service.review('owner', [line()]))[0].reason, 'Currency changed. Review this item before continuing.');
  service.product = async () => product({ available: false, unavailableReason: 'Seller is suspended.' });
  assert.equal((await service.review('owner', [line()]))[0].reason, 'Seller is suspended.');
  service.product = async () => { throw new Error('deleted'); };
  assert.equal((await service.review('owner', [line()]))[0].reason, 'Listing could not be revalidated. Retry or remove the item.');
});

test('checkout contact rules are country-aware and require international phone format', () => {
  const service = loadService();
  const base = { name: 'Chris Walker', email: 'chris@example.com', phone: '+18685551234', country: 'TT', address: '1 Main Road', city: 'Port of Spain', postalCode: '' };
  assert.doesNotThrow(() => service.validateContact(base));
  assert.throws(() => service.validateContact({ ...base, country: 'CA' }), /postal code/i);
  assert.throws(() => service.validateContact({ ...base, phone: '868-555-1234' }), /international phone/i);
});

test('support destination prefers a valid email, accepts HTTPS help, and falls back safely', () => {
  const service = loadService();
  assert.deepEqual(service.supportDestination({ email: 'help@ourlime.com', helpUrl: 'https://ourlime.com/help' }), { kind: 'email', url: 'mailto:help@ourlime.com', display: 'help@ourlime.com' });
  assert.deepEqual(service.supportDestination({ email: 'invalid', helpUrl: 'https://ourlime.com/help' }), { kind: 'help', url: 'https://ourlime.com/help', display: 'https://ourlime.com/help' });
  assert.deepEqual(service.supportDestination({ email: '', helpUrl: 'javascript:alert(1)' }), { kind: 'fallback', url: null, display: 'Help from the main menu' });
});
