import { appServerService, AppServerError } from './AppServerService';

export type AdminApiMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export type AdminApiRequestOptions = {
  method?: AdminApiMethod;
  body?: object;
  headers?: { [name: string]: string };
  timeoutMs?: number;
};

/** An admin request that failed; code is REQUEST_TIMEOUT when the server could not be reached in time. */
export class AdminApiError extends Error {
  public constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = 'AdminApiError';
  }
}

type GatewayResponse = { status: number; body: unknown };

/**
 * Admin, moderation and beta-management requests through the app's own adminApi function, which runs the
 * same admin route handlers as the website. Paths and payloads match the website routes (/api/admin/...).
 */
export class AdminApiService {
  private static instance: AdminApiService;

  private constructor() {}

  public static getInstance(): AdminApiService {
    if (!AdminApiService.instance) AdminApiService.instance = new AdminApiService();
    return AdminApiService.instance;
  }

  public async request<TResponse>(pathWithQuery: string, options: AdminApiRequestOptions = {}): Promise<TResponse> {
    const [path, query = ''] = pathWithQuery.split('?');
    let response: GatewayResponse;
    try {
      response = await appServerService.call<GatewayResponse>('adminApi', {
        method: options.method ?? 'GET',
        path,
        ...(query ? { query } : {}),
        ...(options.body ? { body: options.body } : {}),
        ...(options.headers ? { headers: options.headers } : {}),
      }, options.timeoutMs ?? 60_000);
    } catch (error: unknown) {
      if (error instanceof AppServerError && (error.code === 'deadline-exceeded' || error.code === 'unavailable')) {
        throw new AdminApiError('The Ourlime server did not respond in time.', 504, 'REQUEST_TIMEOUT');
      }
      throw error;
    }
    if (response.status >= 400) {
      const body = response.body && typeof response.body === 'object' ? response.body as { error?: unknown; message?: unknown } : {};
      const message = typeof body.error === 'string' ? body.error : typeof body.message === 'string' ? body.message : 'The admin request failed.';
      throw new AdminApiError(message, response.status);
    }
    return response.body as TResponse;
  }
}

export const adminApiService = AdminApiService.getInstance();
