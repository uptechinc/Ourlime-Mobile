import { beforeEach, describe, expect, mock, test } from 'bun:test';

const storage = new Map();
mock.module('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key) => storage.get(key) ?? null,
    multiSet: async (pairs) => { pairs.forEach(([key, value]) => storage.set(key, value)); },
  },
}));

const { EHubCommerceService, eHubCommerceService, getEHubCurrentPrice, normalizeEHubSalePrice } = await import('./EHubCommerceService.ts');

const item = (overrides = {}) => ({
  productId: 'p1', title: 'Doubles', imageUrl: '', price: 10, originalPrice: null, quantity: 1, availableQuantity: 5,
  sellerId: 'store-a', sellerName: 'Store A', deliveryAvailable: true, pickupAvailable: true,
  selectedVariant: null, selectedSize: null, selectedColour: null, ...overrides,
});

const service = eHubCommerceService;
const cart = () => service.getState().cart;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  await service.load();
  service.removeManyFromCart(cart().map((line) => line.id));
  [...service.getState().favorites].forEach((productId) => service.toggleFavorite(productId));
  storage.clear();
});

describe('E-Hub pricing (matches the website)', () => {
  test('a sale price counts only below the regular price', () => {
    expect(normalizeEHubSalePrice('8', 10)).toBe(8);
    expect(normalizeEHubSalePrice(10, 10)).toBeNull();
    expect(normalizeEHubSalePrice(-1, 10)).toBeNull();
    expect(normalizeEHubSalePrice(null, 10)).toBeNull();
    expect(getEHubCurrentPrice(10, 'abc')).toBe(10);
    expect(getEHubCurrentPrice(10, 0)).toBe(0);
  });
});

describe('EHubCommerceService cart', () => {
  test('line ids join the product and chosen options', () => {
    expect(EHubCommerceService.getCartItemId(item())).toBe('p1');
    expect(EHubCommerceService.getCartItemId(item({ selectedVariant: 'Pro', selectedSize: 'M', selectedColour: 'Red' }))).toBe('p1|Pro|M|Red');
  });

  test('size "M" and colour "M" stay separate lines, and each keeps its own quantity', () => {
    service.addToCart(item({ selectedSize: 'M' }));
    service.addToCart(item({ selectedColour: 'M' }));
    expect(cart()).toHaveLength(2);
    expect(new Set(cart().map((line) => line.id)).size).toBe(2);
    service.addToCart(item({ selectedColour: 'M', quantity: 2 }));
    expect(cart().find((line) => line.selectedColour === 'M').quantity).toBe(3);
    expect(cart().find((line) => line.selectedSize === 'M').quantity).toBe(1);
  });

  test('adding the same product and options raises the quantity, never past the stock', () => {
    expect(service.addToCart(item({ quantity: 2 }))).toBe(true);
    service.addToCart(item({ quantity: 2 }));
    expect(cart()).toHaveLength(1);
    expect(cart()[0].quantity).toBe(4);
    service.addToCart(item({ quantity: 9 }));
    expect(cart()[0].quantity).toBe(5);
  });

  test('a new line starts at one or more units and within the stock', () => {
    service.addToCart(item({ quantity: 0 }));
    expect(cart()[0].quantity).toBe(1);
    service.addToCart(item({ productId: 'p2', quantity: 50, availableQuantity: 3 }));
    expect(cart()[1].quantity).toBe(3);
  });

  test('different options are separate lines', () => {
    service.addToCart(item({ selectedSize: 'S' }));
    service.addToCart(item({ selectedSize: 'M' }));
    expect(cart().map((line) => line.id)).toEqual(['p1|S', 'p1|M']);
  });

  test('out-of-stock or id-less products are not added', () => {
    expect(service.addToCart(item({ availableQuantity: 0 }))).toBe(false);
    expect(service.addToCart(item({ productId: '' }))).toBe(false);
    expect(cart()).toEqual([]);
  });

  test('a fresh stock figure from the product page replaces the stored one', () => {
    service.addToCart(item({ quantity: 4 }));
    service.addToCart(item({ quantity: 1, availableQuantity: 2, price: 8 }));
    expect(cart()[0]).toMatchObject({ quantity: 2, availableQuantity: 2, price: 8 });
  });

  test('quantity updates are whole units, capped at stock; less than one unit removes the line', () => {
    service.addToCart(item({ quantity: 2 }));
    service.updateQuantity('p1', 3.7);
    expect(cart()[0].quantity).toBe(3);
    service.updateQuantity('p1', 99);
    expect(cart()[0].quantity).toBe(5);
    service.updateQuantity('p1', Number.NaN);
    expect(cart()[0].quantity).toBe(5);
    service.updateQuantity('p1', 0.5);
    expect(cart()).toEqual([]);
    service.addToCart(item());
    service.updateQuantity('p1', -1);
    expect(cart()).toEqual([]);
  });

  test('removing one line or the lines of a sent order request', () => {
    service.addToCart(item());
    service.addToCart(item({ productId: 'p2' }));
    service.addToCart(item({ productId: 'p3' }));
    service.removeFromCart('p2');
    expect(cart().map((line) => line.id)).toEqual(['p1', 'p3']);
    service.removeManyFromCart(['p1', 'p3', 'unknown']);
    expect(cart()).toEqual([]);
    service.removeFromCart('');
    service.removeManyFromCart([]);
  });

  test('changes are saved to the device under the website keys', async () => {
    service.addToCart(item());
    await flush();
    expect(JSON.parse(storage.get('ourlime_ehub_cart_v2'))).toHaveLength(1);
  });
});

describe('EHubCommerceService.groupCartBySeller', () => {
  test('groups by storefront in first-added order with cent-exact subtotals', () => {
    const lines = [
      { ...item({ price: 0.1, quantity: 3 }), id: '1' }, { ...item({ sellerId: 'store-b', sellerName: 'B' }), id: '2' }, { ...item({ price: 0.2 }), id: '3' },
    ];
    const groups = EHubCommerceService.groupCartBySeller(lines);
    expect(groups.map((group) => group.sellerId)).toEqual(['store-a', 'store-b']);
    expect(groups[0].subtotal).toBe(0.5);
    expect(groups[0].items.map((line) => line.id)).toEqual(['1', '3']);
  });

  test('uses the server fulfilment rule', () => {
    const [deliveryOnlyMix] = EHubCommerceService.groupCartBySeller([{ ...item({ pickupAvailable: false }), id: '1' }, { ...item(), id: '2' }]);
    expect(deliveryOnlyMix).toMatchObject({ deliveryAvailable: true, pickupAvailable: false });
    const [neither] = EHubCommerceService.groupCartBySeller([{ ...item({ deliveryAvailable: false, pickupAvailable: false }), id: '1' }]);
    expect(neither).toMatchObject({ deliveryAvailable: false, pickupAvailable: true });
    expect(EHubCommerceService.groupCartBySeller([])).toEqual([]);
  });
});

describe('EHubCommerceService saved and recently viewed', () => {
  test('toggling a favourite saves and unsaves it', () => {
    expect(service.toggleFavorite('p1')).toBe(true);
    expect(service.isFavorite('p1')).toBe(true);
    expect(service.toggleFavorite('p1')).toBe(false);
    expect(service.isFavorite('p1')).toBe(false);
    expect(service.toggleFavorite('')).toBe(false);
  });

  test('recently viewed keeps the newest ten, one entry per product', () => {
    for (let index = 0; index < 12; index += 1) service.addRecentlyViewed({ id: `p${index}`, title: `P${index}`, imageUrl: '', price: index });
    service.addRecentlyViewed({ id: 'p5', title: 'P5', imageUrl: '', price: 5 });
    const ids = service.getState().recentlyViewed.map((entry) => entry.id);
    expect(ids).toHaveLength(10);
    expect(ids[0]).toBe('p5');
    expect(new Set(ids).size).toBe(10);
    expect(ids).not.toContain('p0');
  });
});
