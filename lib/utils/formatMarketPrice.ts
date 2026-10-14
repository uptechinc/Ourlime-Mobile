/**
 * Listing prices as the website shows them. Older listings store a price without a currency code; those read as
 * "$700.00" (as on the website) instead of being treated as unpriced.
 */
export function formatMarketPrice(currency: string, amount: number): string {
  return currency ? `${currency} ${amount.toFixed(2)}` : `$${amount.toFixed(2)}`;
}
