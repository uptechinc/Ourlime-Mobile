import { appServerService, AppServerError } from './AppServerService';

type MarketApiMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type GatewayResponse = { status: number; body: unknown };
type MarketApiOptions = { query?: string; body?: object; timeoutMs?: number };

/** A Market route answered with an error; status is the website route's HTTP status (503 when payments are off). */
export class MarketApiError extends Error {
  public constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'MarketApiError';
  }
}

/**
 * The website's Market routes (/api/market/**) through the app's `marketApi` callable, which runs the same route
 * handlers as the website (docs/market-api.md). Never calls the website itself.
 */
export class MarketApiClient {
  private static instance: MarketApiClient;

  private constructor() {}

  public static getInstance(): MarketApiClient {
    if (!MarketApiClient.instance) MarketApiClient.instance = new MarketApiClient();
    return MarketApiClient.instance;
  }

  /** The route's `data` when it answered `{ status: 'success', data }`; otherwise a MarketApiError with its message. */
  public async request<TData>(method: MarketApiMethod, path: string, options: MarketApiOptions = {}): Promise<TData> {
    let response: GatewayResponse;
    try {
      response = await appServerService.call<GatewayResponse>('marketApi', {
        method,
        path,
        ...(options.query ? { query: options.query } : {}),
        ...(options.body ? { body: options.body } : {}),
      }, options.timeoutMs ?? 60_000);
    } catch (error: unknown) {
      console.warn('[MarketApiClient.request] Error:', path, error instanceof Error ? error.message : error);
      if (error instanceof AppServerError && error.code === 'not-found') throw new MarketApiError('This Market feature is not available yet. Try again after the next update.', 404);
      if (error instanceof AppServerError && error.code === 'permission-denied') throw new MarketApiError('This action is not available in preview.', 403);
      throw new MarketApiError('The Market server could not be reached. Check your connection and retry.', 0);
    }
    const body = response.body && typeof response.body === 'object' ? response.body as { status?: unknown; data?: unknown; message?: unknown } : {};
    if (response.status >= 200 && response.status < 300 && body.status === 'success') return body.data as TData;
    const message = typeof body.message === 'string' && body.message.trim() ? body.message : 'The Market server could not complete this request.';
    throw new MarketApiError(message, response.status);
  }
}

export const marketApiClient = MarketApiClient.getInstance();
