import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, storage } from '@/lib/firebaseConfig';
import { adsApiClient, AdsApiError } from './AdsApiClient';
import type {
  AdBooking,
  AdBookingInput,
  AdOffer,
  AdOfferInput,
  AdOfferStatus,
  AdReviewInput,
  AdsPickedFile,
  AdsTimestamp,
  BookingStatus,
  BusinessHostRegistration,
  Client,
  Host,
  InfluencerHostRegistration,
  ProofAnalyticsData,
  ProofFileInput,
} from '@/lib/types/adsMarketplace';

const MEGABYTE = 1024 * 1024;
const IMAGE_TYPE = /^image\/(jpeg|jpg|png|webp|heic|heif|gif|bmp)$/;
const VIDEO_TYPE = /^video\/[-a-z0-9.+]+$/;
const DOCUMENT_TYPE = /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/;

/** Ourlime's commission percentage on bookings (the server sets the same value). */
export const OURLIME_COMMISSION_PERCENT = 10;

export type VerificationDocumentKind = 'registrationCertificate' | 'taxIdDocument' | 'governmentId';

/**
 * The ads marketplace for the app: hosts, offers, clients, bookings, proof of delivery and reviews, through the same
 * /api/ads routes the website uses (see AdsApiClient), plus uploads to the ads/ Storage folders the website writes to.
 * Business rules (who may read or change what) stay in those routes; this class mirrors the website pages' checks.
 */
export class AdsMarketplaceService {
  private static instance: AdsMarketplaceService;

  private constructor() {}

  public static getInstance(): AdsMarketplaceService {
    if (!AdsMarketplaceService.instance) AdsMarketplaceService.instance = new AdsMarketplaceService();
    return AdsMarketplaceService.instance;
  }

  public currentUserId(): string | null {
    return auth.currentUser?.uid ?? null;
  }

  private requireUserId(): string {
    const userId = this.currentUserId();
    if (!userId) throw new AdsApiError('Sign in to use the ads marketplace.', 401);
    return userId;
  }

  /** The route's data, or null when it answered 404 (record not found). */
  private async readOrNull<TData>(path: string, query: string): Promise<TData | null> {
    try {
      const body = await adsApiClient.request('GET', path, { query });
      return (body.data ?? null) as TData | null;
    } catch (error: unknown) {
      if (error instanceof AdsApiError && error.status === 404) return null;
      throw error;
    }
  }

  private async readList<TData>(path: string, query: string): Promise<TData[]> {
    const body = await adsApiClient.request('GET', path, { query });
    return Array.isArray(body.data) ? body.data as TData[] : [];
  }

  private requireId(value: string | undefined, label: string): string {
    if (!value) throw new AdsApiError(`The server did not return the new ${label}.`, 500);
    return value;
  }

  // ── Hosts ──────────────────────────────────────────────────────────────────

  public getHost(hostId: string): Promise<Host | null> {
    return this.readOrNull<Host>('/api/ads/hosts', `hostId=${encodeURIComponent(hostId)}`);
  }

  /** The signed-in user's host account, or null when they have not registered as a host. */
  public getMyHost(): Promise<Host | null> {
    const userId = this.requireUserId();
    return this.readOrNull<Host>('/api/ads/hosts', `userId=${encodeURIComponent(userId)}`);
  }

  public async registerBusinessHost(registration: BusinessHostRegistration): Promise<string> {
    this.requireUserId();
    const body = await adsApiClient.request('POST', '/api/ads/hosts', { body: { hostType: 'business', ...registration } });
    return this.requireId(body.hostId, 'host');
  }

  public async registerInfluencerHost(registration: InfluencerHostRegistration): Promise<string> {
    this.requireUserId();
    const body = await adsApiClient.request('POST', '/api/ads/hosts', { body: { hostType: 'influencer', ...registration } });
    return this.requireId(body.hostId, 'host');
  }

  // ── Offers ─────────────────────────────────────────────────────────────────

  /** Active offers for the browse page, newest first (the same filters the website sends). */
  public browseOffers(filters: { displayType?: string; category?: string }): Promise<AdOffer[]> {
    const params = new URLSearchParams();
    if (filters.displayType) params.append('displayType', filters.displayType);
    if (filters.category) params.append('category', filters.category);
    params.append('availableOnly', 'true');
    return this.readList<AdOffer>('/api/ads/offers', params.toString());
  }

  public getOffer(offerId: string): Promise<AdOffer | null> {
    return this.readOrNull<AdOffer>('/api/ads/offers', `offerId=${encodeURIComponent(offerId)}`);
  }

  /** Every offer of a host for its owner; the active ones for anyone else. */
  public getHostOffers(hostId: string, status?: AdOfferStatus): Promise<AdOffer[]> {
    const params = new URLSearchParams();
    params.append('hostId', hostId);
    if (status) params.append('status', status);
    return this.readList<AdOffer>('/api/ads/offers', params.toString());
  }

  public async createOffer(hostId: string, offer: AdOfferInput): Promise<string> {
    const userId = this.requireUserId();
    const body = await adsApiClient.request('POST', '/api/ads/offers', { body: { hostId, userId, ...offer } });
    return this.requireId(body.offerId, 'offer');
  }

  public async updateOffer(offerId: string, updates: Partial<AdOfferInput>): Promise<void> {
    this.requireUserId();
    await adsApiClient.request('PUT', '/api/ads/offers', { body: { offerId, ...updates } });
  }

  public async deleteOffer(offerId: string): Promise<void> {
    this.requireUserId();
    await adsApiClient.request('DELETE', '/api/ads/offers', { query: `offerId=${encodeURIComponent(offerId)}` });
  }

  // ── Clients ────────────────────────────────────────────────────────────────

  public getMyClient(): Promise<Client | null> {
    const userId = this.requireUserId();
    return this.readOrNull<Client>('/api/ads/clients', `userId=${encodeURIComponent(userId)}`);
  }

  public getClient(clientId: string): Promise<Client | null> {
    return this.readOrNull<Client>('/api/ads/clients', `clientId=${encodeURIComponent(clientId)}`);
  }

  /** The signed-in user's advertiser (client) ID, registering one from their account details the first time, as the website does. */
  public async ensureMyClientId(): Promise<string> {
    const existing = await this.getMyClient();
    if (existing) return existing.clientId;
    const user = auth.currentUser;
    if (!user) throw new AdsApiError('Sign in to book an offer.', 401);
    const body = await adsApiClient.request('POST', '/api/ads/clients', {
      body: {
        clientName: user.displayName || user.email || 'Client',
        clientType: 'individual',
        email: user.email || '',
        phone: user.phoneNumber || '',
      },
    });
    return this.requireId(body.clientId, 'client');
  }

  // ── Bookings ───────────────────────────────────────────────────────────────

  public async createBooking(booking: AdBookingInput): Promise<string> {
    this.requireUserId();
    const body = await adsApiClient.request('POST', '/api/ads/bookings', { body: { ...booking, ourlimeCommission: OURLIME_COMMISSION_PERCENT } });
    return this.requireId(body.bookingId, 'booking');
  }

  public getBooking(bookingId: string): Promise<AdBooking | null> {
    return this.readOrNull<AdBooking>('/api/ads/bookings', `bookingId=${encodeURIComponent(bookingId)}`);
  }

  public getClientBookings(clientId: string, status?: BookingStatus): Promise<AdBooking[]> {
    const params = new URLSearchParams();
    params.append('clientId', clientId);
    if (status) params.append('status', status);
    return this.readList<AdBooking>('/api/ads/bookings', params.toString());
  }

  public getHostBookings(hostId: string, status?: BookingStatus): Promise<AdBooking[]> {
    const params = new URLSearchParams();
    params.append('hostId', hostId);
    if (status) params.append('status', status);
    return this.readList<AdBooking>('/api/ads/bookings', params.toString());
  }

  // ── Proof of delivery and reviews ──────────────────────────────────────────

  public async submitProof(bookingId: string, proofFiles: ProofFileInput[], analyticsData?: ProofAnalyticsData): Promise<string> {
    this.requireUserId();
    const body = await adsApiClient.request('POST', '/api/ads/proof', { body: { bookingId, proofFiles, ...(analyticsData ? { analyticsData } : {}) } });
    return this.requireId(body.proofId, 'proof');
  }

  public async createReview(review: AdReviewInput): Promise<string> {
    this.requireUserId();
    const body = await adsApiClient.request('POST', '/api/ads/reviews', { body: review });
    return this.requireId(body.reviewId, 'review');
  }

  // ── Uploads (Storage paths and limits from storage.rules) ──────────────────

  /** A verification document under ads/hosts/{uid}/verification/ (PDF, Word or image, up to 10 MB). */
  public uploadVerificationDocument(file: AdsPickedFile, kind: VerificationDocumentKind): Promise<string> {
    const userId = this.requireUserId();
    const prefix = kind === 'governmentId' ? 'governmentId' : kind;
    return this.upload(file, `ads/hosts/${userId}/verification`, prefix, (contentType) => IMAGE_TYPE.test(contentType) || DOCUMENT_TYPE.test(contentType), 10 * MEGABYTE, 'Choose a PDF, Word document, JPG or PNG up to 10 MB.');
  }

  /** An ad material image (up to 15 MB) or video (up to 260 MB) under ads/bookings/{uid}/. */
  public uploadBookingMaterial(file: AdsPickedFile, kind: 'image' | 'video'): Promise<string> {
    const userId = this.requireUserId();
    return kind === 'image'
      ? this.upload(file, `ads/bookings/${userId}`, 'ad_material', (contentType) => IMAGE_TYPE.test(contentType), 15 * MEGABYTE, 'Choose a JPG, PNG or WebP image up to 15 MB.')
      : this.upload(file, `ads/bookings/${userId}`, 'ad_material', (contentType) => VIDEO_TYPE.test(contentType), 260 * MEGABYTE, 'Choose a video up to 260 MB.');
  }

  /** A proof file (image, video, PDF or Word, up to 50 MB) under ads/proof/{uid}/{bookingId}/. */
  public uploadProofFile(bookingId: string, file: AdsPickedFile): Promise<string> {
    const userId = this.requireUserId();
    return this.upload(file, `ads/proof/${userId}/${bookingId}`, 'proof', (contentType) => IMAGE_TYPE.test(contentType) || VIDEO_TYPE.test(contentType) || DOCUMENT_TYPE.test(contentType), 50 * MEGABYTE, 'Choose an image, video, PDF or Word document up to 50 MB.');
  }

  private async upload(file: AdsPickedFile, folder: string, prefix: string, accepts: (contentType: string) => boolean, maxBytes: number, rejection: string): Promise<string> {
    const blob = await (await fetch(file.uri)).blob();
    const contentType = (file.mimeType || blob.type || '').toLowerCase();
    const size = file.size ?? blob.size;
    if (!accepts(contentType) || size <= 0 || size > maxBytes) throw new AdsApiError(rejection, 400);
    const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-100) || 'file';
    const fileReference = ref(storage, `${folder}/${prefix}_${Date.now()}_${safeName}`);
    await uploadBytes(fileReference, blob, { contentType });
    return getDownloadURL(fileReference);
  }

  // ── Pricing and display helpers shared by the ads screens ──────────────────

  /** The booking price for a duration in days, as the website's book page calculates it. */
  public static calculatePrice(offer: AdOffer, durationDays: number): number {
    const { pricing } = offer;
    switch (pricing.pricingModel) {
      case 'fixed': return pricing.basePrice;
      case 'per_day': return pricing.basePrice * durationDays;
      case 'per_week': return pricing.basePrice * Math.ceil(durationDays / 7);
      case 'per_month': return pricing.basePrice * Math.ceil(durationDays / 30);
      default: return pricing.basePrice * durationDays;
    }
  }

  /** Whole days between two dates, at least 1 (the website's duration rule). */
  public static durationDays(start: Date, end: Date): number {
    return Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1;
  }

  public static formatPrice(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
    } catch {
      return `${currency || 'USD'} ${amount.toFixed(2)}`;
    }
  }

  public static toDate(timestamp: AdsTimestamp | undefined): Date | null {
    if (!timestamp || typeof timestamp.seconds !== 'number') return null;
    return new Date(timestamp.seconds * 1000 + Math.floor((timestamp.nanoseconds ?? 0) / 1e6));
  }

  public static formatDate(timestamp: AdsTimestamp | undefined, withTime = false): string {
    const date = AdsMarketplaceService.toDate(timestamp);
    if (!date) return 'N/A';
    return withTime
      ? date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  public static hostName(host: Host): string {
    return host.hostType === 'business' ? host.businessName : 'Influencer';
  }

  public static pricingModelLabel(model: string): string {
    return model.replace('_', ' ');
  }

  public static statusLabel(status: string): string {
    return status.replace('_', ' ');
  }

  public static countLabel(count: number, noun: string): string {
    return `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`;
  }

  public static errorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof AdsApiError)) console.warn('[AdsMarketplaceService] Error:', error instanceof Error ? error.message : error);
    return error instanceof AdsApiError && error.message ? error.message : fallback;
  }
}

export const adsMarketplaceService = AdsMarketplaceService.getInstance();
