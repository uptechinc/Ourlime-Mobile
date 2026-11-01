import { appServerService, AppServerError } from './AppServerService';
import type {
  EHubCatalogProduct, EHubEnquiry, EHubEnquiryInput, EHubEnquiryMode, EHubManageableEnquiryStatus,
  EHubProductDetail, EHubProvider, EHubProviderDetail, EHubProviderFilters,
} from '@/lib/types/ehubDiscovery';

export type EHubMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type EHubRequestOptions = { query?: string; body?: object; allowEmpty?: boolean };
type GatewayResponse = { status: number; body: unknown };
type RouteBody<TData> = { status?: string; data?: TData; message?: string };
type CacheEntry<TValue> = { value: TValue; cachedAt: number };

/** A failed eHub request; status is the website route's HTTP status (404 unpublished, 429 rate limited). */
export class EHubError extends Error {
  public constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'EHubError';
  }
}

const CACHE_TTL_MS = 60_000;
export const EHUB_BUYER_TERMS_URL = 'https://ourlime.com/ehub/terms#buyer';

/**
 * The website's eHub buyer flows (catalog, product detail, provider discovery and profiles, enquiries) through the
 * app's ehubApi function, which runs the same /api/ehub route handlers as the website. The eHub collections are
 * closed to clients in the Firestore rules, so every read goes through the function.
 */
export class EHubService {
  private static instance: EHubService;
  private catalogCache: CacheEntry<EHubCatalogProduct[]> | null = null;
  private providersCache: CacheEntry<EHubProvider[]> | null = null;

  private constructor() {}

  public static getInstance(): EHubService {
    if (!EHubService.instance) EHubService.instance = new EHubService();
    return EHubService.instance;
  }

  public async getCatalog(force = false): Promise<EHubCatalogProduct[]> {
    if (!force && this.isFresh(this.catalogCache)) return this.catalogCache.value;
    const products = await this.request<EHubCatalogProduct[]>('GET', '/api/ehub/catalog');
    this.catalogCache = { value: products, cachedAt: Date.now() };
    return products;
  }

  /** null when the product is unpublished or its store or business is no longer active. */
  public async getProduct(productId: string): Promise<EHubProductDetail | null> {
    return this.orNullWhenMissing(this.request<EHubProductDetail>('GET', `/api/ehub/products/${encodeURIComponent(productId)}`));
  }

  public async getProviders(filters: EHubProviderFilters = {}, force = false): Promise<EHubProvider[]> {
    const query = new URLSearchParams();
    if (filters.search?.trim()) query.set('search', filters.search.trim());
    if (filters.category) query.set('category', filters.category);
    if (filters.location) query.set('location', filters.location);
    if (filters.kind) query.set('kind', filters.kind);
    const queryString = query.toString();
    if (!queryString && !force && this.isFresh(this.providersCache)) return this.providersCache.value;
    const providers = await this.request<EHubProvider[]>('GET', '/api/ehub/providers', { query: queryString });
    if (!queryString) this.providersCache = { value: providers, cachedAt: Date.now() };
    return providers;
  }

  /** null when the provider or its store is not active. */
  public async getProvider(providerId: string): Promise<EHubProviderDetail | null> {
    return this.orNullWhenMissing(this.request<EHubProviderDetail>('GET', `/api/ehub/providers/${encodeURIComponent(providerId)}`));
  }

  public async createEnquiry(input: EHubEnquiryInput): Promise<EHubEnquiry> {
    return this.request<EHubEnquiry>('POST', '/api/ehub/enquiries', { body: input });
  }

  public async getEnquiries(mode: EHubEnquiryMode): Promise<EHubEnquiry[]> {
    return this.request<EHubEnquiry[]>('GET', '/api/ehub/enquiries', { query: `mode=${mode}` });
  }

  public async updateEnquiry(enquiryId: string, status: EHubManageableEnquiryStatus, responseMessage?: string): Promise<EHubEnquiry> {
    return this.request<EHubEnquiry>('PATCH', '/api/ehub/enquiries', { body: { enquiryId, status, ...(responseMessage ? { responseMessage } : {}) } });
  }

  /** Seller changes show on the public lists straight away instead of after the 60 s cache. */
  public clearCaches(): void {
    this.catalogCache = null;
    this.providersCache = null;
  }

  private isFresh<TValue>(entry: CacheEntry<TValue> | null): entry is CacheEntry<TValue> {
    return entry !== null && Date.now() - entry.cachedAt < CACHE_TTL_MS;
  }

  private async orNullWhenMissing<TData>(request: Promise<TData>): Promise<TData | null> {
    try {
      return await request;
    } catch (error: unknown) {
      if (error instanceof EHubError && error.status === 404) return null;
      throw error;
    }
  }

  /** One /api/ehub route through ehubApi. allowEmpty accepts a success with no data (the delete routes). */
  public async request<TData>(method: EHubMethod, path: string, options: EHubRequestOptions = {}): Promise<TData> {
    let response: GatewayResponse;
    try {
      response = await appServerService.call<GatewayResponse>('ehubApi', {
        method,
        path,
        ...(options.query ? { query: options.query } : {}),
        ...(options.body ? { body: options.body } : {}),
      }, 45_000);
    } catch (error: unknown) {
      if (error instanceof AppServerError && (error.code === 'deadline-exceeded' || error.code === 'unavailable')) {
        throw new EHubError('E-Hub did not respond in time. Please try again.', 504);
      }
      throw error;
    }
    const body = (response.body && typeof response.body === 'object' ? response.body : {}) as RouteBody<TData>;
    if (response.status >= 400 || body.status !== 'success' || (body.data === undefined && !options.allowEmpty)) {
      throw new EHubError(this.messageFor(response.status, body.message), response.status);
    }
    return body.data as TData;
  }

  /** The enquiry route returns its error codes lower-cased with spaces (e.g. "message too short"). */
  private messageFor(status: number, message: string | undefined): string {
    if (status === 401) return 'Sign in to continue.';
    if (status === 429) return 'You have sent several enquiries recently. Please try again in an hour.';
    if (message === 'message too short') return 'Your message needs at least 10 characters.';
    if (message === 'invalid recipient') return 'You cannot send an enquiry to your own business.';
    if (message === 'account restricted') return 'Your account cannot send enquiries right now.';
    if (message === 'provider not found') return 'This provider is no longer available.';
    return message ? message.charAt(0).toUpperCase() + message.slice(1) : 'E-Hub could not complete this request.';
  }
}

export const eHubService = EHubService.getInstance();
