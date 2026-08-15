import { auth } from '@/lib/firebaseConfig';
import { signOut } from 'firebase/auth';
import { DiagnosticLogService } from './DiagnosticLogService';
import { localCacheService } from './LocalCacheService';
import { useResourceStore } from '@/lib/store/useResourceStore';

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ApiAvailabilityState = 'unknown' | 'available' | 'unavailable';
export type ApiRequestPriority = 'foreground' | 'background';

export type ApiHealthResult = {
  success: true;
  status: 'ok';
  timestamp: string;
};

export type ApiRequestOptions = {
  method?: ApiMethod;
  authenticated?: boolean;
  body?: unknown;
  signal?: AbortSignal;
  headers?: ApiRequestHeaders;
  timeoutMs?: number;
  priority?: ApiRequestPriority;
};

export type ApiRequestHeaders = {
  Accept?: string;
  Authorization?: string;
  'Content-Type'?: string;
};

type ApiAvailabilityLogMetadata = {
  requestId?: string;
  method?: ApiMethod;
  path?: string;
  baseUrl: string;
  status?: number;
  elapsedMs?: number;
  error?: string;
};

export type ApiErrorPayload = {
  success?: boolean;
  error?: string;
  message?: string;
  code?: string;
};

export class ApiServiceError extends Error {
  public readonly status: number;
  public readonly code?: string;

  public constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiServiceError';
    this.status = status;
    this.code = code;
  }
}

const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_WEB_API_URL || 'https://ourlime.com';
const API_UNAVAILABLE_BACKOFF_MS = 15_000;
const API_HEALTH_TIMEOUT_MS = 1_500;

export class ApiService {
  private static instance: ApiService;
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly baseUrl: string;
  private readonly activeRequestControllers = new Set<AbortController>();
  private availabilityState: ApiAvailabilityState = 'unknown';
  private healthProbe: Promise<boolean> | null = null;
  private unavailableUntil = 0;

  private constructor() {
    const configuredUrl = process.env.EXPO_PUBLIC_OURLIME_API_BASE_URL?.trim() || process.env.EXPO_PUBLIC_WEB_API_URL?.trim();
    this.baseUrl = (configuredUrl || DEFAULT_API_BASE_URL).replace(/\/$/, '');
    this.logger.info('ApiService', 'initialize', { baseUrl: this.baseUrl });
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) ApiService.instance = new ApiService();
    return ApiService.instance;
  }

  public async request<TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> {
    return this.performRequest<TResponse>(path, options, false);
  }

  private async performRequest<TResponse>(path: string, options: ApiRequestOptions, didRetryAuthentication: boolean): Promise<TResponse> {
    const method = options.method ?? 'GET';
    await this.ensureAvailability(path, options.priority ?? 'foreground');
    const requestId = this.createRequestId();
    const startedAt = Date.now();
    const headers = new Headers();
    headers.set('Accept', options.headers?.Accept ?? 'application/json');
    if (options.headers?.Authorization) headers.set('Authorization', options.headers.Authorization);
    if (options.headers?.['Content-Type']) headers.set('Content-Type', options.headers['Content-Type']);

    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    if (options.authenticated) {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new ApiServiceError('Authentication required', 401, 'AUTH_REQUIRED');
      headers.set('Authorization', `Bearer ${await currentUser.getIdToken(didRetryAuthentication)}`);
    }

    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    this.logger.info('ApiService', 'request:start', { requestId, method, path });
    const requestController = new AbortController();
    this.activeRequestControllers.add(requestController);
    let didTimeout = false;
    const handleExternalAbort = () => requestController.abort();
    options.signal?.addEventListener('abort', handleExternalAbort, { once: true });
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      requestController.abort();
    }, options.timeoutMs ?? 8_000);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: requestController.signal,
      });
      this.markAvailable();
      const payload: unknown = await response.json().catch(() => null);
      if (response.status === 401 && options.authenticated && !didRetryAuthentication && auth.currentUser) {
        this.logger.warn('ApiService', 'request:auth-retry', { requestId, method, path });
        return this.performRequest<TResponse>(path, options, true);
      }
      if (response.status === 401 && options.authenticated && didRetryAuthentication) {
        const userId = auth.currentUser?.uid;
        if (userId) await localCacheService.clearUser(userId).catch(() => undefined);
        useResourceStore.getState().clearUserResources();
        await signOut(auth).catch(() => undefined);
      }
      if (!response.ok) {
        const errorPayload = this.readErrorPayload(payload);
        throw new ApiServiceError(
          errorPayload.error || errorPayload.message || `Request failed with status ${response.status}`,
          response.status,
          errorPayload.code
        );
      }
      this.logger.success('ApiService', 'request', {
        requestId,
        method,
        path,
        status: response.status,
        elapsedMs: Date.now() - startedAt,
      });
      return payload as TResponse;
    } catch (error: unknown) {
      if (didTimeout) {
        const timeoutError = new ApiServiceError(
          'The Ourlime API did not respond at ' + this.baseUrl + '.',
          408,
          'REQUEST_TIMEOUT',
        );
        this.markUnavailable(requestController, 'request:timeout', {
          requestId,
          method,
          path,
          baseUrl: this.baseUrl,
          elapsedMs: Date.now() - startedAt,
        });
        throw timeoutError;
      }
      if (options.signal?.aborted) throw error;
      if (error instanceof ApiServiceError) throw error;
      if (this.availabilityState === 'unavailable' && this.isAbortError(error)) {
        throw this.createUnavailableError();
      }
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
      const isNetworkError = error instanceof TypeError
        || errorMessage.includes('fetch')
        || errorMessage.includes('network security policy')
        || errorMessage.includes('cleartext communication')
        || errorMessage.includes('network request failed');
      if (isNetworkError) {
        this.markUnavailable(requestController, 'request:network', {
          requestId,
          baseUrl: this.baseUrl,
          method,
          path,
          error: error instanceof Error ? error.message : String(error),
          elapsedMs: Date.now() - startedAt,
        });
        throw new ApiServiceError(
          'Ourlime could not connect to its API. Check the server address and device network access.',
          0,
          'NETWORK_ERROR',
        );
      } else {
        this.logger.error('ApiService', 'request', error, {
          requestId,
          method,
          path,
          elapsedMs: Date.now() - startedAt,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      this.activeRequestControllers.delete(requestController);
      options.signal?.removeEventListener('abort', handleExternalAbort);
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public isTemporarilyUnavailable(): boolean {
    return Date.now() < this.unavailableUntil;
  }

  public getAvailabilityState(): ApiAvailabilityState {
    return this.availabilityState;
  }

  public async checkHealth(force = false): Promise<ApiHealthResult | null> {
    const available = await this.probeAvailability(force);
    if (!available) return null;
    return {
      success: true,
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  private async ensureAvailability(path: string, priority: ApiRequestPriority): Promise<void> {
    if (path === '/api/health' || path.startsWith('/api/health?')) return;
    if (this.availabilityState === 'available') return;

    const now = Date.now();
    if (
      this.availabilityState === 'unavailable'
      && now < this.unavailableUntil
      && priority === 'background'
    ) {
      throw this.createUnavailableError();
    }

    const available = await this.probeAvailability(priority === 'foreground');
    if (!available) throw this.createUnavailableError();
  }

  private async probeAvailability(force: boolean): Promise<boolean> {
    if (this.healthProbe) return this.healthProbe;
    const now = Date.now();
    if (!force && this.availabilityState === 'unavailable' && now < this.unavailableUntil) return false;

    this.healthProbe = (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_HEALTH_TIMEOUT_MS);
      try {
        await fetch(`${this.baseUrl}/api/health`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        // Any HTTP response proves the host is reachable. Older deployments may
        // not expose /api/health yet; the requested endpoint will surface its own status.
        this.markAvailable();
        return true;
      } catch {
        this.markUnavailable(null, 'health:unavailable', { baseUrl: this.baseUrl });
        return false;
      } finally {
        clearTimeout(timeoutId);
      }
    })().finally(() => {
      this.healthProbe = null;
    });
    return this.healthProbe;
  }

  private markAvailable(): void {
    this.availabilityState = 'available';
    this.unavailableUntil = 0;
  }

  private markUnavailable(
    currentController: AbortController | null,
    operation: string,
    metadata: ApiAvailabilityLogMetadata,
  ): void {
    const shouldLog = this.availabilityState !== 'unavailable' || Date.now() >= this.unavailableUntil;
    this.availabilityState = 'unavailable';
    this.unavailableUntil = Date.now() + API_UNAVAILABLE_BACKOFF_MS;
    this.activeRequestControllers.forEach((controller) => {
      if (controller !== currentController) controller.abort();
    });
    if (shouldLog) this.logger.warn('ApiService', operation, metadata);
  }

  private createUnavailableError(): ApiServiceError {
    return new ApiServiceError(
      `The Ourlime API is temporarily unavailable at ${this.baseUrl}.`,
      503,
      'API_UNAVAILABLE',
    );
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
  }

  private readErrorPayload(value: unknown): ApiErrorPayload {
    if (typeof value !== 'object' || value === null) return {};
    const payload = value as Partial<ApiErrorPayload>;
    return {
      success: typeof payload.success === 'boolean' ? payload.success : undefined,
      error: typeof payload.error === 'string' ? payload.error : undefined,
      message: typeof payload.message === 'string' ? payload.message : undefined,
      code: typeof payload.code === 'string' ? payload.code : undefined,
    };
  }

  private createRequestId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

export const apiService = ApiService.getInstance();
