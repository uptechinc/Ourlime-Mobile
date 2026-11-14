import { AppServerError, appServerService } from '@/lib/services/AppServerService';
import type { Courier, CourierProfileInput, CourierStatus, SellerCourierPreferences } from '@/lib/types/couriers';

const CALL_TIMEOUT_MS = 30_000;

export type SellerCouriers = { preferences: SellerCourierPreferences; couriers: Courier[] };

/**
 * Couriers on the same server code as the website's /api/couriers routes (the courierApi callable runs the website's
 * CourierService): registration and administrator review, the directory, and sellers' preferred couriers. These
 * records are server-only, so the app never writes them to Firestore itself.
 */
export class CourierService {
  private static instance: CourierService;

  private constructor() {}

  public static getInstance(): CourierService {
    if (!CourierService.instance) CourierService.instance = new CourierService();
    return CourierService.instance;
  }

  /** Approved couriers by name, optionally only those covering one town or region. */
  public async fetchCouriers(area?: string): Promise<Courier[]> {
    return (await this.call<{ couriers: Courier[] }>({ action: 'list', area }, 'Could not load couriers.')).couriers;
  }

  /** The signed-in member's own courier service, or null when they have not registered one. */
  public async fetchOwnCourier(): Promise<Courier | null> {
    return (await this.call<{ courier: Courier | null }>({ action: 'mine' }, 'Could not load your courier service.')).courier;
  }

  /** Registers or edits the member's courier service; it goes to an administrator for review. */
  public async saveOwnCourier(courier: CourierProfileInput): Promise<Courier> {
    const result = await this.call<{ courier: Courier | null }>({ action: 'saveMine', courier }, 'Could not save your courier service.');
    if (!result.courier) throw new Error('Could not save your courier service.');
    return result.courier;
  }

  /** A seller's preferred couriers that are still approved. */
  public async fetchSellerCouriers(sellerId: string): Promise<Courier[]> {
    return (await this.call<SellerCouriers>({ action: 'sellerCouriers', sellerId }, 'Could not load this seller\'s couriers.')).couriers;
  }

  public async fetchOwnPreferences(): Promise<SellerCouriers> {
    return this.call<SellerCouriers>({ action: 'myPreferences' }, 'Could not load your couriers.');
  }

  public async saveOwnPreferences(courierIds: string[]): Promise<SellerCouriers> {
    return this.call<SellerCouriers>({ action: 'savePreferences', courierIds }, 'Could not save your couriers.');
  }

  /** Every courier service for administrators (optionally one status), waiting ones first. */
  public async fetchModerationCouriers(status?: CourierStatus): Promise<Courier[]> {
    return (await this.call<{ couriers: Courier[] }>({ action: 'adminList', status }, 'Could not load courier services.')).couriers;
  }

  public async updateCourierStatus(courierId: string, status: Exclude<CourierStatus, 'pending'>, reason?: string): Promise<Courier> {
    const result = await this.call<{ courier: Courier | null }>({ action: 'moderate', courierId, status, reason }, 'Could not save the decision.');
    if (!result.courier) throw new Error('Could not save the decision.');
    return result.courier;
  }

  private async call<TResult>(data: object, fallbackMessage: string): Promise<TResult> {
    try {
      return await appServerService.call<TResult>('courierApi', data, CALL_TIMEOUT_MS);
    } catch (error: unknown) {
      console.error('[CourierService.call] Error:', error instanceof Error ? error.message : 'Unknown error');
      // Server checks send a sentence; a bare code ("not-found", "internal") means the call itself failed.
      const message = error instanceof Error ? error.message.trim() : '';
      const isSentence = message.includes(' ') && !(error instanceof AppServerError && message === error.code);
      throw new Error(isSentence ? message : fallbackMessage);
    }
  }
}

export const courierService = CourierService.getInstance();
