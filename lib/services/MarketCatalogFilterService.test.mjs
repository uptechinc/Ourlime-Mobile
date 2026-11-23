import { describe, expect, test } from 'bun:test';

const { EMPTY_MARKET_FILTERS, MARKET_PRICE_CEILING, marketCatalogFilterService: service } = await import('./MarketCatalogFilterService.ts');

const variant = (overrides = {}) => ({
  id: 'v1', productId: 'p1', label: 'Standard', price: 100, currency: 'TTD', stock: 3, available: true, image: null,
  colorName: null, colorCode: null, sizeName: null, sku: null, ...overrides,
});

const product = (overrides = {}) => ({
  id: 'p1', title: 'Wooden bowl', shortDescription: 'Hand carved', description: 'Teak bowl', category: 'Home', images: [],
  sellerId: 's1', sellerName: 'Carver Co', sellerVerified: true, available: true, unavailableReason: null, variants: [variant()],
  condition: 'new', brand: null, sku: null, tags: ['kitchen'], rating: 4, ratingCount: 2, popularity: 0,
  originalPrice: 100, salePrice: null, isOnSale: false, deliveryAvailable: true, pickupAvailable: false,
  returnsAllowed: null, returnPolicy: null, warranty: null, sellerType: 'business', createdAtMs: 1000, ...overrides,
});

const filters = (overrides = {}) => ({ ...EMPTY_MARKET_FILTERS, ...overrides });
const ids = (products) => products.map((item) => item.id);

describe('MarketCatalogFilterService counts and price input', () => {
  test('counts each active filter, with the ceiling price meaning no limit', () => {
    expect(service.activeCount(EMPTY_MARKET_FILTERS)).toBe(0);
    expect(service.activeCount(filters({ categories: ['Home', 'Toys'], inStockOnly: true, maxPrice: 500, sellerType: 'personal' }))).toBe(5);
    expect(service.activeCount(filters({ maxPrice: MARKET_PRICE_CEILING }))).toBe(0);
  });

  test('the maximum price is a whole number from 0 to 10,000', () => {
    expect(service.parseMaxPrice(' 250 ')).toBe(250);
    expect(service.parseMaxPrice('0')).toBe(0);
    expect(service.parseMaxPrice('10000')).toBe(10000);
    for (const input of ['10001', '-5', '12.5', '', 'abc', '1e3', '٣٠٠']) expect(service.parseMaxPrice(input)).toBeNull();
  });
});

describe('MarketCatalogFilterService.apply', () => {
  const bowl = product();
  const shirt = product({
    id: 'p2', title: 'Festival shirt', category: 'Clothing', sellerName: 'Mas Band', sellerType: 'personal', condition: 'like_new', tags: [], rating: 5, popularity: 9,
    deliveryAvailable: false, pickupAvailable: true, createdAtMs: 3000, originalPrice: 300, salePrice: 250,
    variants: [variant({ id: 'v2', productId: 'p2', price: 250, colorName: 'Red', sizeName: 'M', stock: 0 }), variant({ id: 'v3', productId: 'p2', price: 270, colorName: 'Blue', sizeName: 'L', stock: 0 })],
  });
  const car = product({ id: 'p3', title: 'Used car', category: 'Vehicles', tags: [], originalPrice: 150000, variants: [variant({ id: 'base', productId: 'p3', price: 150000, isBase: true })], createdAtMs: 2000, rating: null, ratingCount: 7 });
  const all = [bowl, shirt, car];

  test('no filters keeps everything in order, including listings above the price ceiling', () => {
    expect(ids(service.apply(all, EMPTY_MARKET_FILTERS, '', [], 'default'))).toEqual(['p1', 'p2', 'p3']);
  });

  test('search matches title, descriptions, category, seller and tags, ignoring case and spacing', () => {
    expect(ids(service.apply(all, EMPTY_MARKET_FILTERS, '  KITCHEN ', [], 'default'))).toEqual(['p1']);
    expect(ids(service.apply(all, EMPTY_MARKET_FILTERS, 'mas band', [], 'default'))).toEqual(['p2']);
    expect(ids(service.apply(all, EMPTY_MARKET_FILTERS, 'vehicles', [], 'default'))).toEqual(['p3']);
    expect(ids(service.apply(all, EMPTY_MARKET_FILTERS, 'nothing like this', [], 'default'))).toEqual([]);
  });

  test('search handles unicode and full-width input', () => {
    const accented = product({ id: 'p9', title: 'Café crème mug' });
    expect(ids(service.apply([accented], EMPTY_MARKET_FILTERS, 'CAFÉ', [], 'default'))).toEqual(['p9']);
    expect(ids(service.apply([bowl], EMPTY_MARKET_FILTERS, 'ｂｏｗｌ', [], 'default'))).toEqual(['p1']);
  });

  test('filters by category, colour, size, condition, seller type and fulfilment', () => {
    expect(ids(service.apply(all, filters({ categories: ['Clothing'] }), '', [], 'default'))).toEqual(['p2']);
    expect(ids(service.apply(all, filters({ colors: ['Blue'] }), '', [], 'default'))).toEqual(['p2']);
    expect(ids(service.apply(all, filters({ sizes: ['XL'] }), '', [], 'default'))).toEqual([]);
    expect(ids(service.apply(all, filters({ conditions: ['like_new'] }), '', [], 'default'))).toEqual(['p2']);
    expect(ids(service.apply([product({ condition: null })], filters({ conditions: ['new'] }), '', [], 'default'))).toEqual(['p1']);
    expect(ids(service.apply(all, filters({ sellerType: 'personal' }), '', [], 'default'))).toEqual(['p2']);
    expect(ids(service.apply(all, filters({ deliveryOnly: true }), '', [], 'default'))).toEqual(['p1', 'p3']);
    expect(ids(service.apply(all, filters({ pickupOnly: true }), '', [], 'default'))).toEqual(['p2']);
  });

  test('a maximum price below the ceiling uses variant prices, or the listing price without real variants', () => {
    expect(ids(service.apply(all, filters({ maxPrice: 260 }), '', [], 'default'))).toEqual(['p1', 'p2']);
    expect(ids(service.apply(all, filters({ maxPrice: 99 }), '', [], 'default'))).toEqual([]);
    expect(ids(service.apply(all, filters({ maxPrice: 0 }), '', [], 'default'))).toEqual([]);
  });

  test('in-stock only drops listings whose variants are all sold out', () => {
    expect(ids(service.apply(all, filters({ inStockOnly: true }), '', [], 'default'))).toEqual(['p1', 'p3']);
    expect(ids(service.apply([product({ variants: [] })], filters({ inStockOnly: true }), '', [], 'default'))).toEqual(['p1']);
  });

  test('favourites only keeps saved listings', () => {
    expect(ids(service.apply(all, filters({ favoritesOnly: true }), '', ['p3'], 'default'))).toEqual(['p3']);
    expect(ids(service.apply(all, filters({ favoritesOnly: true }), '', [], 'default'))).toEqual([]);
  });

  test('sorts by price (sale price first), newest, rating and popularity without changing the input', () => {
    const input = [...all];
    expect(ids(service.apply(input, EMPTY_MARKET_FILTERS, '', [], 'price-low-high'))).toEqual(['p1', 'p2', 'p3']);
    expect(ids(service.apply(input, EMPTY_MARKET_FILTERS, '', [], 'price-high-low'))).toEqual(['p3', 'p2', 'p1']);
    expect(ids(service.apply(input, EMPTY_MARKET_FILTERS, '', [], 'newest'))).toEqual(['p2', 'p3', 'p1']);
    expect(ids(service.apply(input, EMPTY_MARKET_FILTERS, '', [], 'rating'))).toEqual(['p2', 'p1', 'p3']);
    expect(ids(service.apply(input, EMPTY_MARKET_FILTERS, '', [], 'popularity'))).toEqual(['p2', 'p3', 'p1']);
    expect(ids(input)).toEqual(['p1', 'p2', 'p3']);
  });
});

describe('MarketCatalogFilterService.prices and facets', () => {
  test('a listing without real variants is priced from salePrice, then originalPrice', () => {
    expect(service.prices(product({ variants: [variant({ id: 'base', isBase: true, price: 1 })], salePrice: 80, originalPrice: 100 }))).toEqual([80]);
    expect(service.prices(product({ variants: [], salePrice: null, originalPrice: null }))).toEqual([0]);
    expect(service.prices(product({ variants: [variant({ price: 5 }), variant({ id: 'v2', price: 7 })] }))).toEqual([5, 7]);
  });

  test('facets list each colour, size and category once, sorted (sizes numerically)', () => {
    const facets = service.facets([
      product({ category: 'Toys', variants: [variant({ colorName: 'Red', colorCode: '#f00', sizeName: '10' }), variant({ colorName: 'Blue', sizeName: '9' })] }),
      product({ category: 'Home', variants: [variant({ colorName: 'Red', colorCode: '#e00', sizeName: '10' })] }),
      product({ category: '', variants: [] }),
    ]);
    expect(facets.colors).toEqual([{ name: 'Blue', code: null }, { name: 'Red', code: '#f00' }]);
    expect(facets.sizes).toEqual(['9', '10']);
    expect(facets.categories).toEqual(['Home', 'Toys']);
  });
});
