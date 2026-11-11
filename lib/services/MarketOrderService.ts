import { auth } from '@/lib/firebaseConfig';
import { marketApiClient } from './MarketApiClient';
import { marketReviewService } from './MarketReviewService';
import type { CartLine, MarketOrder, MarketOrderItem, MarketOrderStatus, MarketShippingAddress } from '@/lib/types/reliability';

export const BUYER_ACKNOWLEDGMENT_VERSION = 'v1.0';
export type MarketDeliveryMethod = 'shipping' | 'pickup';
export type MarketCheckoutRequest = {
  lines: CartLine[]; deliveryMethod: MarketDeliveryMethod;
  shippingAddress: MarketShippingAddress; acknowledged: boolean;
};
export type MarketPlacedOrder = { orderId: string; orderNumber: string };

const ORDER_STATUSES: readonly MarketOrderStatus[] = ['pending_payment', 'paid', 'processing', 'shipped', 'ready_for_pickup', 'delivered', 'cancelled', 'refund_pending', 'refunded', 'disputed'];

/** Buyer orders and checkout through the marketApi callable (web /api/market/orders and /api/market/checkout). */
export class MarketOrderService {
  private static instance: MarketOrderService;

  private constructor() {}

  public static getInstance(): MarketOrderService {
    if (!MarketOrderService.instance) MarketOrderService.instance = new MarketOrderService();
    return MarketOrderService.instance;
  }

  public async buyerOrders(buyerId: string): Promise<MarketOrder[]> {
    const orders = await marketApiClient.request<unknown>('GET', '/api/market/orders', { query: `buyerId=${encodeURIComponent(buyerId)}` });
    return Array.isArray(orders) ? orders.flatMap((order) => this.decodeOrder(order)) : [];
  }

  /** Buyer may cancel from paid/processing (web shows the button for those; the server also allows pending_payment). */
  public canCancel(order: MarketOrder): boolean {
    return order.status === 'paid' || order.status === 'processing';
  }

  public canConfirmReceived(order: MarketOrder): boolean {
    return order.status === 'shipped' || order.status === 'ready_for_pickup';
  }

  public async cancel(orderId: string): Promise<void> {
    await marketApiClient.request<unknown>('PATCH', '/api/market/orders', { body: { orderId, status: 'cancelled', note: 'Cancelled by buyer.' } });
  }

  public async confirmReceived(orderId: string): Promise<void> {
    await marketApiClient.request<unknown>('PATCH', '/api/market/orders', { body: { orderId, status: 'delivered', note: 'Buyer confirmed item receipt.' } });
  }

  /** Web checkout validation, then POST /api/market/checkout. The server currently always answers 503 (payments off). */
  public async placeOrder(request: MarketCheckoutRequest): Promise<MarketPlacedOrder> {
    const lines = request.lines.filter((line) => !line.removed);
    if (!lines.length) throw new Error('Your cart is empty');
    if (request.deliveryMethod === 'shipping') {
      const address = request.shippingAddress;
      if (!address.fullName.trim() || !address.phone.trim() || !address.addressLine1.trim() || !address.city.trim()) throw new Error('Please complete all required shipping address fields');
    }
    if (!request.acknowledged) throw new Error('You must read and agree to the Buyer Acknowledgment before purchasing.');
    const user = auth.currentUser;
    if (!user) throw new Error('Please log in to complete your checkout');
    const timestamp = new Date().toISOString();
    const result = await marketApiClient.request<{ orderId?: unknown; orderNumber?: unknown }>('POST', '/api/market/checkout', {
      body: {
        buyerId: user.uid,
        buyerName: user.displayName || request.shippingAddress.fullName || 'Verified Buyer',
        buyerEmail: user.email ?? '',
        items: lines.map((line) => ({
          id: `${line.productId}-${line.variantId}`, productId: line.productId, title: line.title, thumbnailImage: line.image ?? '',
          price: line.price, quantity: line.quantity, maxAvailableQuantity: line.quantity, variantId: line.variantId === 'base' ? undefined : line.variantId,
          sellerId: line.sellerId ?? 'seller', sellerName: line.sellerName ?? 'Seller', sellerType: 'personal',
          deliveryAvailable: line.deliveryAvailable ?? true, pickupAvailable: line.pickupAvailable ?? true, shippingCost: line.shippingCost ?? 0,
        })),
        deliveryMethod: request.deliveryMethod,
        shippingAddress: request.deliveryMethod === 'shipping' ? request.shippingAddress : undefined,
        buyerAcknowledgment: { accepted: true, timestamp, version: BUYER_ACKNOWLEDGMENT_VERSION },
      },
    });
    return { orderId: typeof result?.orderId === 'string' ? result.orderId : '', orderNumber: typeof result?.orderNumber === 'string' ? result.orderNumber : '' };
  }

  private decodeOrder(value: unknown): MarketOrder[] {
    if (!value || typeof value !== 'object') return [];
    const order = value as Record<string, unknown>;
    if (typeof order.id !== 'string') return [];
    const number = (entry: unknown) => typeof entry === 'number' && Number.isFinite(entry) ? entry : 0;
    const text = (entry: unknown) => typeof entry === 'string' ? entry : '';
    const optional = (entry: unknown) => typeof entry === 'string' && entry.trim() ? entry.trim() : null;
    const items: MarketOrderItem[] = (Array.isArray(order.items) ? order.items : []).flatMap((entry): MarketOrderItem[] => {
      if (!entry || typeof entry !== 'object') return [];
      const item = entry as Record<string, unknown>;
      return [{
        id: text(item.id) || `${text(item.productId)}-${text(item.variantId) || 'default'}`, productId: text(item.productId), title: text(item.title) || 'Listing',
        thumbnailImage: text(item.thumbnailImage), price: number(item.price), quantity: Math.max(1, Math.trunc(number(item.quantity))),
        colorName: optional(item.colorName), sizeName: optional(item.sizeName), sellerId: text(item.sellerId), sellerName: text(item.sellerName) || 'Seller',
      }];
    });
    const address = order.shippingAddress && typeof order.shippingAddress === 'object' ? order.shippingAddress as Record<string, unknown> : null;
    const fulfillment = order.fulfillmentDetails && typeof order.fulfillmentDetails === 'object' ? order.fulfillmentDetails as Record<string, unknown> : null;
    const status = text(order.status);
    return [{
      id: order.id,
      orderNumber: text(order.orderNumber) || order.id.slice(0, 8).toUpperCase(),
      items,
      subtotal: number(order.subtotal), shippingCost: number(order.shippingCost), tax: number(order.tax), total: number(order.total),
      status: ORDER_STATUSES.find((entry) => entry === status) ?? status,
      deliveryMethod: order.deliveryMethod === 'pickup' ? 'pickup' : 'shipping',
      shippingAddress: address ? {
        fullName: text(address.fullName), phone: text(address.phone), addressLine1: text(address.addressLine1), addressLine2: text(address.addressLine2),
        city: text(address.city), state: text(address.state), postalCode: text(address.postalCode), country: text(address.country),
      } : null,
      fulfillmentDetails: fulfillment ? {
        carrier: optional(fulfillment.carrier), trackingNumber: optional(fulfillment.trackingNumber),
        trackingUrl: typeof fulfillment.trackingUrl === 'string' && /^https?:\/\//i.test(fulfillment.trackingUrl) ? fulfillment.trackingUrl : null,
        pickupLocation: optional(fulfillment.pickupLocation), pickupNotes: optional(fulfillment.pickupNotes),
      } : null,
      statusHistory: (Array.isArray(order.statusHistory) ? order.statusHistory : []).flatMap((entry) => {
        if (!entry || typeof entry !== 'object') return [];
        const historyEntry = entry as Record<string, unknown>;
        return [{ status: text(historyEntry.status), timestamp: marketReviewService.isoDate(historyEntry.timestamp), note: optional(historyEntry.note) }];
      }),
      createdAt: marketReviewService.isoDate(order.createdAt),
    }];
  }
}

export const marketOrderService = MarketOrderService.getInstance();
