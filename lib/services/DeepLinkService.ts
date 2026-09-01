import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  DeepLinkDestination,
  DeepLinkResolution,
  PendingDeepLink,
} from '@/lib/types/deepLink';
import { sharedContentMessageService } from '@/lib/services/SharedContentMessageService';
import { platformEnvironmentService } from '@/lib/services/PlatformEnvironmentService';

const CANONICAL_WEB_BASE_URL = 'https://ourlime.com';
const PENDING_DEEP_LINK_KEY = 'ourlime.pending-deep-link';
const PENDING_DEEP_LINK_RETENTION_MS = 24 * 60 * 60 * 1000;

export class DeepLinkService {
  private static instance: DeepLinkService;
  private readonly webBaseUrl = (
    process.env.EXPO_PUBLIC_SHARE_BASE_URL
    || platformEnvironmentService.getDevelopmentApiBaseUrl()
    || CANONICAL_WEB_BASE_URL
  ).replace(/\/$/, '');
  private readonly nativeScheme = 'ourlime';

  private constructor() {}

  public static getInstance(): DeepLinkService {
    if (!DeepLinkService.instance) DeepLinkService.instance = new DeepLinkService();
    return DeepLinkService.instance;
  }

  public getShareUrl(destination: DeepLinkDestination): string {
    return `${this.webBaseUrl}${this.getCanonicalPath(destination)}`;
  }

  public getAppUrl(destination: DeepLinkDestination): string {
    return `${this.nativeScheme}://${this.getCanonicalPath(destination).replace(/^\//, '')}`;
  }

  public getPostShareUrl(postId: string): string {
    return this.getShareUrl({ kind: 'post', postId });
  }

  public getProfileShareUrl(username: string): string {
    return this.getShareUrl({ kind: 'profile', username: this.normalizeUsername(username) });
  }

  public getCommunityShareUrl(identifier: string): string {
    return this.getShareUrl({ kind: 'community', identifier });
  }

  public getBlogShareUrl(blogId: string): string {
    return this.getShareUrl({ kind: 'blog', blogId });
  }

  public getLimeShareUrl(limeId: string): string {
    return this.getShareUrl({ kind: 'lime', limeId });
  }

  public getEventShareUrl(eventId: string): string {
    return this.getShareUrl({ kind: 'event', eventId });
  }

  public getJobShareUrl(jobId: string): string {
    return this.getShareUrl({ kind: 'job', jobId });
  }

  public getMarketProductShareUrl(productId: string): string {
    return this.getShareUrl({ kind: 'market-product', productId });
  }

  public getPostAppUrl(postId: string): string {
    return this.getAppUrl({ kind: 'post', postId });
  }

  public getProfileAppUrl(username: string): string {
    return this.getAppUrl({ kind: 'profile', username: this.normalizeUsername(username) });
  }

  public resolve(input: string): DeepLinkResolution {
    const normalizedInput = input.trim();
    if (!normalizedInput) return { kind: 'invalid', reason: 'empty' };

    const parsedUrl = this.parseUrl(normalizedInput);
    if (!parsedUrl) return { kind: 'invalid', reason: 'malformed' };
    if (!this.isOurlimeUrl(parsedUrl)) return { kind: 'external', url: normalizedInput };

    let destination: DeepLinkDestination | null = null;
    try {
      destination = this.parseDestination(parsedUrl);
    } catch {
      return { kind: 'invalid', reason: 'malformed' };
    }
    if (!destination) {
      return { kind: 'invalid', reason: 'unsupported' };
    }

    return {
      kind: 'internal',
      destination,
      route: this.getMobileRoute(destination),
      sourceUrl: normalizedInput,
    };
  }

  public async rememberPendingResolution(resolution: Extract<DeepLinkResolution, { kind: 'internal' }>): Promise<void> {
    const pending: PendingDeepLink = {
      route: resolution.route,
      sourceUrl: resolution.sourceUrl,
      receivedAt: Date.now(),
    };
    await AsyncStorage.setItem(PENDING_DEEP_LINK_KEY, JSON.stringify(pending));
  }

  public async consumePendingDestination(): Promise<PendingDeepLink | null> {
    const serialized = await AsyncStorage.getItem(PENDING_DEEP_LINK_KEY);
    if (!serialized) return null;
    await AsyncStorage.removeItem(PENDING_DEEP_LINK_KEY);
    try {
      const parsed: unknown = JSON.parse(serialized);
      if (!this.isPendingDeepLink(parsed)) return null;
      if (Date.now() - parsed.receivedAt > PENDING_DEEP_LINK_RETENTION_MS) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private parseUrl(input: string): URL | null {
    try {
      if (input.startsWith('/')) return new URL(input, this.webBaseUrl);
      return new URL(input);
    } catch {
      return null;
    }
  }

  private isOurlimeUrl(url: URL): boolean {
    if (url.protocol === `${this.nativeScheme}:`) return true;
    if (url.origin === this.webBaseUrl) return true;
    if (url.protocol !== 'https:') return false;
    const hostname = url.hostname.toLowerCase();
    return hostname === 'ourlime.com' || hostname === 'www.ourlime.com';
  }

  private parseDestination(url: URL): DeepLinkDestination | null {
    const segments = this.getSegments(url);
    const first = segments[0]?.toLowerCase();
    if (!first) return null;

    if (first === 'post' && segments[1]) return { kind: 'post', postId: segments[1] };
    if (first === 'profile' && segments[1]?.toLowerCase() === 'viewotherprofile' && segments[2]) {
      return { kind: 'profile', username: this.normalizeUsername(segments[2]) };
    }
    if (first === 'profile' && segments[1]) return { kind: 'profile', username: this.normalizeUsername(segments[1]) };
    if (first === 'communities' && segments[1]) return { kind: 'community', identifier: segments[1] };
    if (first === 'blogs' && segments[1]) return { kind: 'blog', blogId: segments[1] };
    if ((first === 'limes' || first === 'lime') && segments[1]) return { kind: 'lime', limeId: segments[1] };
    if (first === 'events') return { kind: 'event', eventId: segments[1] ?? url.searchParams.get('targetId') };
    if (first === 'jobs') return { kind: 'job', jobId: segments[1] ?? url.searchParams.get('apply') };
    if (first === 'market') return { kind: 'market-product', productId: segments[1] ?? url.searchParams.get('product') };
    if (first === 'admin' && segments[1]?.toLowerCase() === 'reports' && segments[2]) {
      return { kind: 'admin-report', reportId: segments[2] };
    }
    return null;
  }

  private getSegments(url: URL): string[] {
    const nativeHost = url.protocol === `${this.nativeScheme}:` && url.hostname ? [url.hostname] : [];
    return [...nativeHost, ...url.pathname.split('/').filter(Boolean)].map((segment) => decodeURIComponent(segment));
  }

  private getCanonicalPath(destination: DeepLinkDestination): string {
    switch (destination.kind) {
      case 'post': return sharedContentMessageService.getWebPath('post', destination.postId);
      case 'profile': return `/profile/${encodeURIComponent(this.normalizeUsername(destination.username))}`;
      case 'community': return sharedContentMessageService.getWebPath('community', destination.identifier);
      case 'blog': return `/blogs/${encodeURIComponent(destination.blogId)}`;
      case 'lime': return `/limes/${encodeURIComponent(destination.limeId)}`;
      case 'event': return destination.eventId ? `/events/${encodeURIComponent(destination.eventId)}` : '/events';
      case 'job': return destination.jobId ? `/jobs/${encodeURIComponent(destination.jobId)}` : '/jobs';
      case 'market-product': return destination.productId ? `/market/${encodeURIComponent(destination.productId)}` : '/market';
      case 'admin-report': return `/admin/reports/${encodeURIComponent(destination.reportId)}`;
    }
    const exhaustiveDestination: never = destination;
    return exhaustiveDestination;
  }

  private getMobileRoute(destination: DeepLinkDestination): string {
    switch (destination.kind) {
      case 'post': return sharedContentMessageService.getMobileRoute('post', destination.postId);
      case 'profile': return `/profile/${encodeURIComponent(this.normalizeUsername(destination.username))}`;
      case 'community': return sharedContentMessageService.getMobileRoute('community', destination.identifier);
      case 'blog': return `/blogs/${encodeURIComponent(destination.blogId)}`;
      case 'lime': return sharedContentMessageService.getMobileRoute('lime', destination.limeId);
      case 'event': return destination.eventId ? `/events?targetId=${encodeURIComponent(destination.eventId)}` : '/events';
      case 'job': return destination.jobId ? `/jobs?apply=${encodeURIComponent(destination.jobId)}` : '/jobs';
      case 'market-product': return destination.productId ? `/market?product=${encodeURIComponent(destination.productId)}` : '/market';
      case 'admin-report': return `/admin/reports/${encodeURIComponent(destination.reportId)}`;
    }
    const exhaustiveDestination: never = destination;
    return exhaustiveDestination;
  }

  private normalizeUsername(username: string): string {
    return username.replace(/^@/, '');
  }

  private isPendingDeepLink(value: unknown): value is PendingDeepLink {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Partial<PendingDeepLink>;
    return typeof candidate.route === 'string'
      && typeof candidate.sourceUrl === 'string'
      && typeof candidate.receivedAt === 'number';
  }
}

export const deepLinkService = DeepLinkService.getInstance();
