import { appServerService, AppServerError } from './AppServerService';

type AdsApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type GatewayResponse = { status: number; body: unknown };
type AdsApiOptions = { query?: string; body?: object; timeoutMs?: number };

/** The JSON every /api/ads route answers with: data for reads, the new record's ID for creates. */
export type AdsApiBody = {
  status?: string;
  message?: string;
  data?: unknown;
  hostId?: string;
  offerId?: string;
  clientId?: string;
  bookingId?: string;
  proofId?: string;
  reviewId?: string;
};

/** An /api/ads route answered with an error; status is the route's HTTP status (0 when the server was unreachable). */
export class AdsApiError extends Error {
  public constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'AdsApiError';
  }
}

/** Shown while the server has no `adsApi` callable yet (the app ships before the backend). */
export const ADS_UNAVAILABLE_MESSAGE = 'The ads marketplace is not available in the app yet. Use ourlime.com for now, or try again after the next update.';

/**
 * The website's ads marketplace routes (/api/ads/**) through the app's `adsApi` callable, which runs the same route
 * handlers as the website with the caller's ID token (the same gateway contract as marketApi). The ads collections are
 * closed to clients, so the app never reads them directly and never calls the website itself.
 */
export class AdsApiClient {
  private static instance: AdsApiClient;

  private constructor() {}

  public static getInstance(): AdsApiClient {
    if (!AdsApiClient.instance) AdsApiClient.instance = new AdsApiClient();
    return AdsApiClient.instance;
  }

  /** The route's body when it answered `{ status: 'success' }`; otherwise an AdsApiError with its message. */
  public async request(method: AdsApiMethod, path: string, options: AdsApiOptions = {}): Promise<AdsApiBody> {
    let response: GatewayResponse;
    try {
      response = await appServerService.call<GatewayResponse>('adsApi', {
        method,
        path,
        ...(options.query ? { query: options.query } : {}),
        ...(options.body ? { body: options.body } : {}),
      }, options.timeoutMs ?? 45_000);
    } catch (error: unknown) {
      console.warn('[AdsApiClient.request] Error:', path, error instanceof Error ? error.message : error);
      if (error instanceof AppServerError && error.code === 'not-found') throw new AdsApiError(ADS_UNAVAILABLE_MESSAGE, 501);
      if (error instanceof AppServerError && error.code === 'permission-denied') throw new AdsApiError('This action is not available in preview.', 403);
      if (error instanceof AppServerError && error.code === 'unauthenticated') throw new AdsApiError('Sign in to use the ads marketplace.', 401);
      throw new AdsApiError('The ads marketplace could not be reached. Check your connection and retry.', 0);
    }
    const body: AdsApiBody = response.body && typeof response.body === 'object' ? response.body as AdsApiBody : {};
    if (response.status >= 200 && response.status < 300 && body.status === 'success') return body;
    const message = typeof body.message === 'string' && body.message.trim() ? body.message : 'The ads marketplace could not complete this request.';
    throw new AdsApiError(message, response.status);
  }
}

export const adsApiClient = AdsApiClient.getInstance();
