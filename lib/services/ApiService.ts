import { auth } from '@/lib/firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';

export type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type ApiRequestOptions = {
  method?: ApiMethod;
  authenticated?: boolean;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
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

const DEFAULT_API_BASE_URL = 'https://ourlime.vercel.app';

export class ApiService {
  private static instance: ApiService;
  private readonly logger = DiagnosticLogService.getInstance();
  private readonly baseUrl: string;

  private constructor() {
    const configuredUrl = process.env.EXPO_PUBLIC_OURLIME_API_BASE_URL?.trim();
    this.baseUrl = (configuredUrl || DEFAULT_API_BASE_URL).replace(/\/$/, '');
    this.logger.info('ApiService', 'initialize', { baseUrl: this.baseUrl });
  }

  public static getInstance(): ApiService {
    if (!ApiService.instance) ApiService.instance = new ApiService();
    return ApiService.instance;
  }

  public async request<TResponse>(path: string, options: ApiRequestOptions = {}): Promise<TResponse> {
    const method = options.method ?? 'GET';
    const requestId = this.createRequestId();
    const startedAt = Date.now();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };

    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.authenticated) {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new ApiServiceError('Authentication required', 401, 'AUTH_REQUIRED');
      headers.Authorization = `Bearer ${await currentUser.getIdToken()}`;
    }

    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    this.logger.info('ApiService', 'request:start', { requestId, method, path });

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
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
      if (options.signal?.aborted) throw error;
      const isNetworkError = error instanceof TypeError || (error instanceof Error && error.message.toLowerCase().includes('fetch'));
      if (isNetworkError) {
        this.logger.warn('ApiService', 'request:network', {
          requestId,
          method,
          path,
          error: error instanceof Error ? error.message : String(error),
          elapsedMs: Date.now() - startedAt,
        });
      } else {
        this.logger.error('ApiService', 'request', error, {
          requestId,
          method,
          path,
          elapsedMs: Date.now() - startedAt,
        });
      }
      throw error;
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private readErrorPayload(value: unknown): ApiErrorPayload {
    if (typeof value !== 'object' || value === null) return {};
    const record = value as Record<string, unknown>;
    return {
      success: typeof record.success === 'boolean' ? record.success : undefined,
      error: typeof record.error === 'string' ? record.error : undefined,
      message: typeof record.message === 'string' ? record.message : undefined,
      code: typeof record.code === 'string' ? record.code : undefined,
    };
  }

  private createRequestId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

export const apiService = ApiService.getInstance();
