import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  DeepLinkDestination,
  DeepLinkResolution,
  PendingDeepLink,
} from '@/lib/types/deepLink';
import { sharedContentMessageService } from '@/lib/services/SharedContentMessageService';

const CANONICAL_WEB_BASE_URL = 'https://ourlime.com';
const PENDING_DEEP_LINK_KEY = 'ourlime.pending-deep-link';
const PENDING_DEEP_LINK_RETENTION_MS = 24 * 60 * 60 * 1000;

/** App screens a link may open directly, keyed by the link's first path segment (lowercase). */
const SCREEN_ROUTES: { [firstSegment: string]: string } = {
  help: '/help',
  policies: '/policies',
  'privacy-policy': '/privacy-policy',
  'terms-and-conditions': '/terms-and-conditions',
  'child-safety-standards': '/child-safety-standards',
  'delete-account': '/delete-account',
  notifications: '/notifications',
  saved: '/saved',
  games: '/games',
  'wordle-game': '/wordle-game',
  trinigeoguesser: '/triniGeoGuesser',
  ewallet: '/eWallet',
  ads: '/ads',
  chat: '/chat',
  messages: '/chat',
  settings: '/settings',
  calendar: '/calendar',
  'verify-email': '/verify-email',
  'reset-password': '/reset-password',
  'forgot-password': '/forgot-password',
  // Website pages with no id; these used to fall through to the 404 page.
  profile: '/profile',
  discover: '/Discover',
  limes: '/Limes',
  login: '/login',
};
/** Query parameters a SCREEN_ROUTES link keeps (verification/reset tokens, game mode). */
const SCREEN_QUERY_KEEP: { [firstSegment: string]: string[] } = {
  'verify-email': ['status', 'token', 'userId'],
  'reset-password': ['oobCode', 'mode', 'apiKey', 'lang'],
  trinigeoguesser: ['mode'],
};
/** Website /profile/... pages that are app screens rather than a username. */
const PROFILE_SCREEN_ROUTES: { [secondSegment: string]: string } = {
  settings: '/settings',
  admin: '/admin',
  // The website's business account page; the app's is in the E-Hub stack next to Seller Center.
  'business-account': '/ehub/business-account',
  friends: '/profile/friends',
};

export class DeepLinkService {
  private static instance: DeepLinkService;
  private readonly webBaseUrl = (
    process.env.EXPO_PUBLIC_SHARE_BASE_URL
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

  /** The named query parameters, re-encoded, as "?a=1&b=2" (or "" when none are present). */
  private pickQuery(url: URL, names: string[]): string {
    const pairs = names
      .map((name) => [name, url.searchParams.get(name)?.trim().slice(0, 200) ?? ''] as const)
      .filter(([, value]) => value.length > 0)
      .map(([name, value]) => `${name}=${encodeURIComponent(value)}`);
    return pairs.length ? `?${pairs.join('&')}` : '';
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
    const profileScreen = first === 'profile' ? PROFILE_SCREEN_ROUTES[segments[1]?.toLowerCase() ?? ''] : undefined;
    if (profileScreen) {
      // /profile/admin/<page> on the website is /admin/<page> in the app.
      const rest = profileScreen === '/admin' ? segments.slice(2) : [];
      // /profile/friends?tab=requests keeps its tab.
      const query = profileScreen === '/profile/friends' ? this.pickQuery(url, ['tab']) : '';
      return this.screen(`/${segments.join('/')}${query}`, [profileScreen, ...rest].join('/') + query);
    }
    // The website's Seller Center and enquiry inbox live under /profile; the app's are /ehub/seller and /ehub/enquiries.
    if (first === 'profile' && segments[1]?.toLowerCase() === 'ehub' && segments[2]?.toLowerCase() === 'seller') {
      return this.screen('/profile/ehub/seller', '/ehub/seller');
    }
    if (first === 'profile' && segments[1]?.toLowerCase() === 'ehub' && segments[2]?.toLowerCase() === 'enquiries') {
      const mode = url.searchParams.get('mode') === 'sent' ? '?mode=sent' : '';
      return { kind: 'screen', webPath: `/profile/ehub/enquiries${mode}`, appRoute: `/ehub/enquiries${mode}` };
    }
    if (first === 'profile' && segments[1]?.toLowerCase() === 'viewotherprofile' && segments[2]) {
      return { kind: 'profile', username: this.normalizeUsername(segments[2]) };
    }
    if (first === 'profile' && segments[1]) return { kind: 'profile', username: this.normalizeUsername(segments[1]) };
    // /communities alone is the directory (it used to fall through to the 404 page).
    if (first === 'communities') return segments[1] ? { kind: 'community', identifier: segments[1] } : { kind: 'communities' };
    if (first === 'blogs') return segments[1] ? { kind: 'blog', blogId: segments[1] } : { kind: 'blogs' };
    if ((first === 'limes' || first === 'lime') && segments[1]) return { kind: 'lime', limeId: segments[1] };
    if (first === 'events') return { kind: 'event', eventId: segments[1] ?? url.searchParams.get('targetId') };
    if (first === 'jobs') {
      // /jobs?apply=<id> (the website's share link) opens the job with its application form.
      const applyId = url.searchParams.get('apply');
      if (!segments[1] && applyId) return this.screen(`/jobs?apply=${encodeURIComponent(applyId)}`, `/jobs/${encodeURIComponent(applyId)}?apply=1`);
      return { kind: 'job', jobId: segments[1] ?? null };
    }
    if (first === 'market') {
      // /market/orders, /market/checkout and /market/pets are pages, not product ids.
      const marketPage = segments[1]?.toLowerCase();
      if (marketPage === 'orders' || marketPage === 'checkout' || marketPage === 'pets') return this.screen(`/market/${marketPage}`, `/market/${marketPage}`);
      return { kind: 'market-product', productId: segments[1] ?? url.searchParams.get('product') };
    }
    if (first === 'admin' && segments[1]?.toLowerCase() === 'reports' && segments[2]) {
      return { kind: 'admin-report', reportId: segments[2] };
    }
    if (first === 'ehub') {
      const section = segments[1]?.toLowerCase();
      // Keep the filters and enquiry context the website link carries (discover ?kind/&search, provider ?product/&service).
      if (section === 'providers' && segments[2]) {
        const query = this.pickQuery(url, ['product', 'service']);
        return this.screen(`/ehub/providers/${segments[2]}${query}`, `/ehub/providers/${segments[2]}${query}`);
      }
      if (section === 'products' && segments[2]) return this.screen(`/ehub/products/${segments[2]}`, `/ehub/products/${segments[2]}`);
      if (section === 'discover') {
        const query = this.pickQuery(url, ['kind', 'search']);
        return this.screen(`/ehub/discover${query}`, `/ehub/discover${query}`);
      }
      // App-only E-Hub screens; on the website these live under /profile (business account under /profile too).
      if (section === 'seller') return this.screen('/profile/ehub/seller', '/ehub/seller');
      if (section === 'enquiries') return this.screen('/profile/ehub/enquiries', '/ehub/enquiries');
      if (section === 'business-account') return this.screen('/profile/business-account', '/ehub/business-account');
      if (section === 'terms') {
        // /ehub/terms#buyer on the website opens at that section; the app scrolls to ?section=.
        const anchor = url.hash.replace(/^#/, '').replace(/[^a-z-]/gi, '');
        return this.screen(`/ehub/terms${url.hash}`, anchor ? `/ehub/terms?section=${anchor}` : '/ehub/terms');
      }
      return { kind: 'ehub' };
    }
    if (first === 'elearning') {
      // The website's CXC forums, MCQ and past-papers pages are sample content; the app's CXC hub has the real resources.
      if (segments[1]?.toLowerCase() === 'cxc') return { kind: 'elearning', path: 'cxc' };
      return { kind: 'elearning', path: segments.slice(1).join('/') || undefined };
    }
    if (first === 'projectmanagement' || first === 'projects') return { kind: 'projects', projectId: segments[1] };
    if (first === 'register') {
      const referralToken = url.searchParams.get('referralToken') || undefined;
      return { kind: 'register', referralToken };
    }
    const screenRoute = SCREEN_ROUTES[first];
    if (screenRoute) {
      const query = this.pickQuery(url, SCREEN_QUERY_KEEP[first] ?? []);
      return this.screen(`/${segments.join('/')}${query}`, [screenRoute, ...segments.slice(1)].join('/') + query);
    }
    if (first === 'admin') return this.screen(`/${segments.join('/')}`, `/${segments.join('/')}`);
    return null;
  }

  private screen(webPath: string, appRoute: string): DeepLinkDestination {
    // Encode path segments only; a query or #anchor built by pickQuery (already encoded) is kept as it is.
    const encode = (route: string) => {
      const suffixStart = route.search(/[?#]/);
      const path = suffixStart >= 0 ? route.slice(0, suffixStart) : route;
      const suffix = suffixStart >= 0 ? route.slice(suffixStart) : '';
      return path.split('/').map((segment) => encodeURIComponent(segment)).join('/') + suffix;
    };
    return { kind: 'screen', webPath: encode(webPath), appRoute: encode(appRoute) };
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
      case 'communities': return '/communities';
      case 'blogs': return '/blogs';
      case 'blog': return `/blogs/${encodeURIComponent(destination.blogId)}`;
      case 'lime': return `/limes/${encodeURIComponent(destination.limeId)}`;
      case 'event': return destination.eventId ? `/events/${encodeURIComponent(destination.eventId)}` : '/events';
      case 'job': return destination.jobId ? `/jobs/${encodeURIComponent(destination.jobId)}` : '/jobs';
      case 'market-product': return destination.productId ? `/market/${encodeURIComponent(destination.productId)}` : '/market';
      case 'admin-report': return `/admin/reports/${encodeURIComponent(destination.reportId)}`;
      case 'ehub': return '/ehub';
      case 'elearning': return destination.path ? `/eLearning/${destination.path}` : '/eLearning';
      case 'projects': return destination.projectId ? `/projectManagement/${encodeURIComponent(destination.projectId)}` : '/projectManagement';
      case 'register': return destination.referralToken ? `/register?referralToken=${encodeURIComponent(destination.referralToken)}` : '/register';
      case 'screen': return destination.webPath;
    }
    const exhaustiveDestination: never = destination;
    return exhaustiveDestination;
  }

  private getMobileRoute(destination: DeepLinkDestination): string {
    switch (destination.kind) {
      case 'post': return sharedContentMessageService.getMobileRoute('post', destination.postId);
      case 'profile': return `/profile/${encodeURIComponent(this.normalizeUsername(destination.username))}`;
      case 'community': return sharedContentMessageService.getMobileRoute('community', destination.identifier);
      case 'communities': return '/communities';
      case 'blogs': return '/blogs';
      case 'blog': return `/blogs/${encodeURIComponent(destination.blogId)}`;
      case 'lime': return sharedContentMessageService.getMobileRoute('lime', destination.limeId);
      case 'event': return destination.eventId ? `/events/${encodeURIComponent(destination.eventId)}` : '/events';
      case 'job': return destination.jobId ? `/jobs/${encodeURIComponent(destination.jobId)}` : '/jobs';
      case 'market-product': return destination.productId ? `/market?product=${encodeURIComponent(destination.productId)}` : '/market';
      case 'admin-report': return `/admin/reports/${encodeURIComponent(destination.reportId)}`;
      case 'ehub': return '/ehub';
      case 'elearning': return destination.path ? `/eLearning/${destination.path}` : '/eLearning';
      case 'projects': return destination.projectId ? `/projectManagement/${encodeURIComponent(destination.projectId)}` : '/projectManagement';
      case 'register': return destination.referralToken ? `/(auth)/register?referralToken=${encodeURIComponent(destination.referralToken)}` : '/(auth)/register';
      case 'screen': return destination.appRoute;
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
