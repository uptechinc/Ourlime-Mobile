import { createElement } from 'react';
import { AccessibilityInfo } from 'react-native';
import { toast } from 'sonner-native';
import CartToast, { type CartToastAction, type CartToastTone } from '@/components/ui/CartToast';
import { InteractionFeedbackService } from './InteractionFeedbackService';

/** One toast id for every cart add, so quick repeated taps replace the toast instead of stacking them. */
const CART_TOAST_ID = 'cart-add';
/** Top of the screen: Add to cart buttons sit low (sticky bars, card footers), and a bottom toast would cover the button's own "Added" state. */
const CART_TOAST_POSITION = 'top-center' as const;
const CART_TOAST_MS = 5000;

/** Where the toast's buttons go. Market passes both; E-Hub has no checkout, so only View cart. */
export type CartToastLinks = { onViewCart?: () => void; onCheckout?: () => void };

export type CartAddedFeedback = CartToastLinks & {
  /** Product title, shown under the heading. */
  title: string;
  /** Units of this product in the cart after the add. */
  quantityInCart: number;
  /** The product was already in the cart, so its quantity went up rather than a new line being added. */
  wasInCart: boolean;
};

/**
 * The confirmation every "Add to cart" in a list gives (Market and E-Hub): a haptic, a slim toast at the top that says
 * what changed with "View cart" / "Checkout", and the same words for screen readers. Wording is shared with the website.
 */
export class CartFeedbackService {
  private static instance: CartFeedbackService | undefined;

  public static getInstance(): CartFeedbackService {
    if (!CartFeedbackService.instance) CartFeedbackService.instance = new CartFeedbackService();
    return CartFeedbackService.instance;
  }

  private constructor() {}

  private show(tone: CartToastTone, heading: string, detail: string, links: CartToastLinks = {}): void {
    const close = (next: () => void) => () => { toast.dismiss(CART_TOAST_ID); next(); };
    const actions: CartToastAction[] = [
      ...(links.onViewCart ? [{ label: 'View cart', onPress: close(links.onViewCart) }] : []),
      ...(links.onCheckout ? [{ label: 'Checkout', onPress: close(links.onCheckout), isPrimary: true }] : []),
    ];
    toast.custom(createElement(CartToast, { tone, heading, detail, actions }), { id: CART_TOAST_ID, position: CART_TOAST_POSITION, duration: CART_TOAST_MS, unstyled: true });
    AccessibilityInfo.announceForAccessibility(`${heading}. ${detail}`);
  }

  public added({ title, quantityInCart, wasInCart, onViewCart, onCheckout }: CartAddedFeedback): void {
    void InteractionFeedbackService.getInstance().play('success');
    this.show('success', wasInCart ? `Quantity updated · ${quantityInCart} in your cart` : 'Added to cart', title, { onViewCart, onCheckout });
  }

  /** Nothing was added because the cart already holds all the stock: informative, not an error. */
  public atLimit(quantityInCart: number, links: CartToastLinks = {}): void {
    void InteractionFeedbackService.getInstance().play('warning');
    this.show('info', 'Already in your cart', `All ${quantityInCart} available are in your cart`, links);
  }

  public failed(message: string): void {
    void InteractionFeedbackService.getInstance().play('warning');
    this.show('error', "Couldn't add to cart", message);
  }
}

export const cartFeedbackService = CartFeedbackService.getInstance();
