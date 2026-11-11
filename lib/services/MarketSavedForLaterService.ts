import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartLine, MarketSavedItem } from '@/lib/types/reliability';

const STORAGE_PREFIX = 'ourlime:market-saved-for-later:v1:';
const MAXIMUM_SAVED_ITEMS = 50;

/**
 * "Save for later" cart items (web MarketCartContext savedForLater). The synced account cart only accepts active
 * lines, so saved items live on this device per account, like the website keeps them in the browser.
 */
export class MarketSavedForLaterService {
  private static instance: MarketSavedForLaterService;

  private constructor() {}

  public static getInstance(): MarketSavedForLaterService {
    if (!MarketSavedForLaterService.instance) MarketSavedForLaterService.instance = new MarketSavedForLaterService();
    return MarketSavedForLaterService.instance;
  }

  public async read(ownerId: string): Promise<MarketSavedItem[]> {
    try {
      const decoded: unknown = JSON.parse((await AsyncStorage.getItem(this.key(ownerId))) ?? '[]');
      if (!Array.isArray(decoded)) return [];
      return decoded.flatMap((entry): MarketSavedItem[] => {
        if (!entry || typeof entry !== 'object') return [];
        const value = entry as Partial<Record<keyof MarketSavedItem, unknown>>;
        if (typeof value.productId !== 'string' || typeof value.variantId !== 'string' || typeof value.title !== 'string') return [];
        return [{
          productId: value.productId,
          variantId: value.variantId,
          title: value.title,
          variantLabel: typeof value.variantLabel === 'string' ? value.variantLabel : '',
          image: typeof value.image === 'string' ? value.image : null,
          price: typeof value.price === 'number' && Number.isFinite(value.price) ? value.price : 0,
          currency: typeof value.currency === 'string' ? value.currency : '',
          quantity: typeof value.quantity === 'number' && Number.isInteger(value.quantity) && value.quantity > 0 ? Math.min(value.quantity, 99) : 1,
          savedAt: typeof value.savedAt === 'number' ? value.savedAt : 0,
        }];
      });
    } catch (error: unknown) {
      console.warn('[MarketSavedForLaterService.read] Error:', error instanceof Error ? error.message : error);
      return [];
    }
  }

  public async save(ownerId: string, line: CartLine): Promise<MarketSavedItem[]> {
    const current = (await this.read(ownerId)).filter((item) => !(item.productId === line.productId && item.variantId === line.variantId));
    const item: MarketSavedItem = { productId: line.productId, variantId: line.variantId, title: line.title, variantLabel: line.variantLabel, image: line.image, price: line.price, currency: line.currency, quantity: line.quantity, savedAt: Date.now() };
    return this.write(ownerId, [item, ...current].slice(0, MAXIMUM_SAVED_ITEMS));
  }

  public async remove(ownerId: string, productId: string, variantId: string): Promise<MarketSavedItem[]> {
    return this.write(ownerId, (await this.read(ownerId)).filter((item) => !(item.productId === productId && item.variantId === variantId)));
  }

  private async write(ownerId: string, items: MarketSavedItem[]): Promise<MarketSavedItem[]> {
    await AsyncStorage.setItem(this.key(ownerId), JSON.stringify(items));
    return items;
  }

  private key(ownerId: string): string {
    return `${STORAGE_PREFIX}${ownerId}`;
  }
}

export const marketSavedForLaterService = MarketSavedForLaterService.getInstance();
