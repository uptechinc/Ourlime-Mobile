import { useCallback, useEffect, useState } from 'react';
import { marketListingClient } from '@/lib/services/MarketListingClient';
import type { SellerOrder, SellerOrderFulfillment, SellerOrderStatus, ShipmentDetails } from '@/lib/types/marketListing';

const errorMessage = (error: unknown, fallback: string): string => error instanceof Error && error.message ? error.message : fallback;

/** Seller fulfilment (website /profile/products/orders): the seller's orders and the status changes the web offers. */
export function useSellerOrders(userId: string | null) {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!userId) { setOrders([]); setIsLoading(false); return; }
    if (isRefresh) setIsRefreshing(true); else setIsLoading(true);
    setError(null);
    try {
      setOrders(await marketListingClient.listSellerOrders());
    } catch (failure: unknown) {
      setError(errorMessage(failure, 'Your orders could not be loaded.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const setStatus = useCallback(async (orderId: string, status: SellerOrderStatus, fulfillment?: SellerOrderFulfillment): Promise<void> => {
    setBusyOrderId(orderId);
    try {
      await marketListingClient.updateOrderStatus(orderId, status, fulfillment);
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status, fulfillmentDetails: fulfillment ? { ...order.fulfillmentDetails, ...fulfillment } : order.fulfillmentDetails } : order));
    } finally {
      setBusyOrderId(null);
    }
  }, []);

  /** Website "Confirm Shipment": carrier, tracking number (required), optional tracking URL and the shipped time. */
  const markShipped = useCallback((orderId: string, shipment: ShipmentDetails): Promise<void> => {
    const trackingUrl = shipment.trackingUrl.trim();
    return setStatus(orderId, 'shipped', {
      carrier: shipment.carrier.trim(),
      trackingNumber: shipment.trackingNumber.trim(),
      ...(trackingUrl ? { trackingUrl } : {}),
      shippedAt: new Date().toISOString(),
    });
  }, [setStatus]);

  const refresh = useCallback(() => load(true), [load]);

  return { orders, isLoading, isRefreshing, busyOrderId, error, refresh, setStatus, markShipped };
}
