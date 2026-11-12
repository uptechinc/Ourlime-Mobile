import AsyncStorage from '@react-native-async-storage/async-storage';
import { appServerService, AppServerError } from './AppServerService';
import type {
  EHubCatalogProduct, EHubEnquiry, EHubEnquiryDraft, EHubEnquiryInput, EHubEnquiryMode, EHubManageableEnquiryStatus,
  EHubProductDetail, EHubProvider, EHubProviderDetail, EHubProviderFilters,
} from '@/lib/types/ehubDiscovery';

export type EHubMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type EHubRequestOptions = { query?: string; body?: object; allowEmpty?: boolean };
type GatewayResponse = { status: number; body: unknown };
type RouteBody<TData> = { status?: string; data?: TData; message?: string };
type CacheEntry<TValue> = { value: TValue; cachedAt: number };
type StoredEnquiryDraft = EHubEnquiryDraft & { savedAt: number };
type StoredEnquiryDrafts = { [key: string]: StoredEnquiryDraft };

/** A failed eHub request; status is the website route's HTTP status (404 unpublished, 429 rate limited). */
export class EHubError extends Error {
  public constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'EHubError';
  }
}

const CACHE_TTL_MS = 60_000;
const ENQUIRY_DRAFTS_STORAGE_KEY = 'ehub-enquiry-drafts';
/** Unsent enquiry forms older than this are dropped when the drafts are read back. */
const ENQUIRY_DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const ENQUIRY_DRAFT_WRITE_DELAY_MS = 400;
const ENQUIRY_TYPES: EHubEnquiryDraft['type'][] = ['service', 'availability', 'product', 'general'];

function isStoredEnquiryDraft(value: unknown): value is StoredEnquiryDraft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<StoredEnquiryDraft>;
  return typeof draft.message === 'string' && typeof draft.savedAt === 'number' && ENQUIRY_TYPES.includes(draft.type as EHubEnquiryDraft['type']);
}
export const EHUB_BUYER_TERMS_URL = 'https://ourlime.com/ehub/terms#buyer';
export const EHUB_PROVIDER_SHARE_BASE_URL = 'https://ourlime.com/ehub/providers/';

/** The website's /ehub/terms anchors; the app's terms screen takes them as ?section=. */
export type EHubTermsSection = 'seller' | 'provider' | 'catalog' | 'buyer' | 'moderation';
const TERMS_SECTIONS: EHubTermsSection[] = ['seller', 'provider', 'catalog', 'buyer', 'moderation'];

export function isEHubTermsSection(value: unknown): value is EHubTermsSection {
  return typeof value === 'string' && TERMS_SECTIONS.includes(value as EHubTermsSection);
}

/** The in-app terms screen route, opened at a section like the website's /ehub/terms#buyer. */
export function getEHubTermsRoute(section?: EHubTermsSection): string {
  return section ? `/ehub/terms?section=${section}` : '/ehub/terms';
}

/**
 * The website's eHub buyer flows (catalog, product detail, provider discovery and profiles, enquiries) through the
 * app's ehubApi function, which runs the same /api/ehub route handlers as the website. The eHub collections are
 * closed to clients in the Firestore rules, so every read goes through the function.
 */
export class EHubService {
  private static instance: EHubService;
  private catalogCache: CacheEntry<EHubCatalogProduct[]> | null = null;
  private providersCache: CacheEntry<EHubProvider[]> | null = null;
  /**
   * Unsent enquiry forms, like the website's browser-stored drafts. Kept in memory and written to AsyncStorage
   * (debounced), so a half-written enquiry survives closing the app.
   */
  private readonly enquiryDrafts = new Map<string, StoredEnquiryDraft>();
  private enquiryDraftsLoad: Promise<void> | null = null;
  /** Keys saved or cleared in this run before the stored drafts were read; the stored copies of these are stale. */
  private readonly touchedEnquiryDraftKeys = new Set<string>();
  private enquiryDraftsWriteTimer: ReturnType<typeof setTimeout> | null = null;

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

  /** Deletes an enquiry the caller sent while the provider has not read it yet (the website's DELETE /api/ehub/enquiries). */
  public async deleteEnquiry(enquiryId: string): Promise<void> {
    await this.request<undefined>('DELETE', '/api/ehub/enquiries', { query: `enquiryId=${encodeURIComponent(enquiryId)}`, allowEmpty: true });
  }

  /** One draft per provider and context (a product, a service, or "general"), like the website's ehub-enquiry-{provider}-{context} keys. */
  public getEnquiryDraftKey(providerId: string, contextName: string): string {
    return `ehub-enquiry-${providerId}-${encodeURIComponent(contextName || 'general')}`;
  }

  /** The saved unsent form for this key, read back from the device the first time. */
  public async getEnquiryDraft(key: string): Promise<EHubEnquiryDraft | null> {
    await this.loadEnquiryDrafts();
    const draft = this.enquiryDrafts.get(key);
    return draft ? { type: draft.type, message: draft.message, isBuyerAcknowledgementAccepted: draft.isBuyerAcknowledgementAccepted === true } : null;
  }

  public saveEnquiryDraft(key: string, draft: EHubEnquiryDraft): void {
    this.touchedEnquiryDraftKeys.add(key);
    if (!draft.message.trim() && !draft.isBuyerAcknowledgementAccepted) this.enquiryDrafts.delete(key);
    else this.enquiryDrafts.set(key, { ...draft, savedAt: Date.now() });
    this.scheduleEnquiryDraftsWrite();
  }

  public clearEnquiryDraft(key: string): void {
    this.touchedEnquiryDraftKeys.add(key);
    this.enquiryDrafts.delete(key);
    this.scheduleEnquiryDraftsWrite();
  }

  private loadEnquiryDrafts(): Promise<void> {
    if (!this.enquiryDraftsLoad) {
      this.enquiryDraftsLoad = AsyncStorage.getItem(ENQUIRY_DRAFTS_STORAGE_KEY).then((stored) => {
        if (!stored) return;
        const parsed: unknown = JSON.parse(stored);
        if (!parsed || typeof parsed !== 'object') return;
        const oldestAllowed = Date.now() - ENQUIRY_DRAFT_MAX_AGE_MS;
        Object.entries(parsed as StoredEnquiryDrafts).forEach(([key, draft]) => {
          // A draft edited or sent in this run before the read finished is newer than the stored one.
          if (isStoredEnquiryDraft(draft) && draft.savedAt >= oldestAllowed && !this.touchedEnquiryDraftKeys.has(key)) this.enquiryDrafts.set(key, draft);
        });
      }).catch((error: unknown) => {
        console.error('[EHubService.loadEnquiryDrafts] Error:', error instanceof Error ? error.message : 'Unknown error');
      });
    }
    return this.enquiryDraftsLoad;
  }

  private scheduleEnquiryDraftsWrite(): void {
    if (this.enquiryDraftsWriteTimer) clearTimeout(this.enquiryDraftsWriteTimer);
    this.enquiryDraftsWriteTimer = setTimeout(() => {
      this.enquiryDraftsWriteTimer = null;
      // Wait for the first read so drafts stored by an earlier run are not overwritten.
      void this.loadEnquiryDrafts().then(() => {
        const drafts: StoredEnquiryDrafts = {};
        this.enquiryDrafts.forEach((draft, key) => { drafts[key] = draft; });
        return Object.keys(drafts).length ? AsyncStorage.setItem(ENQUIRY_DRAFTS_STORAGE_KEY, JSON.stringify(drafts)) : AsyncStorage.removeItem(ENQUIRY_DRAFTS_STORAGE_KEY);
      }).catch((error: unknown) => {
        console.error('[EHubService.saveEnquiryDrafts] Error:', error instanceof Error ? error.message : 'Unknown error');
      });
    }, ENQUIRY_DRAFT_WRITE_DELAY_MS);
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
