import { ApiService } from '@/lib/services/ApiService';
import { db } from '@/lib/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { sharedContentMessageService } from '@/lib/services/SharedContentMessageService';

export type OurlimeLinkPreviewKind =
  | 'profile'
  | 'post'
  | 'community'
  | 'lime'
  | 'event'
  | 'job'
  | 'market-product'
  | 'blog';

export type SharedPostPrimaryMedia = {
  kind: 'image' | 'video';
  url: string;
  thumbnailUrl?: string;
  displayOrder: number;
};

export type SharedPostYouTube = { videoId: string; url: string; thumbnailUrl: string };
export type SharedPostLocation = { name: string; address?: string; latitude?: number; longitude?: number; url?: string };
export type SharedPostPollSummary = { options: string[]; totalVotes: number; ended: boolean };
export type SharedPostEventSummary = { startDate?: string; endDate?: string; category?: string };
export type SharedPostPresentation = {
  subtype: 'regular' | 'poll' | 'event';
  excerpt: string;
  primaryMedia?: SharedPostPrimaryMedia;
  imageCount: number;
  videoCount: number;
  youtube?: SharedPostYouTube;
  location?: SharedPostLocation;
  poll?: SharedPostPollSummary;
  event?: SharedPostEventSummary;
};

export type OurlimeLinkPreviewEntity = {
  kind: OurlimeLinkPreviewKind;
  id: string;
  path: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  creatorDisplayName?: string;
  creatorUsername?: string;
  creatorImageUrl?: string;
  post?: SharedPostPresentation;
  unavailable?: boolean;
  unavailableReason?: 'deleted' | 'admin_taken_down' | 'unavailable';
};

export type LinkPreviewData = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  domain?: string;
  entity?: OurlimeLinkPreviewEntity;
};

type LinkPreviewApiData = {
  url: string;
  title: string;
  description: string;
  imageUrl?: string;
  siteName: string;
  entity?: OurlimeLinkPreviewEntity;
};

type LinkPreviewApiResponse = {
  success: boolean;
  data?: LinkPreviewApiData;
};

const MAX_CACHE_ENTRIES = 100;

const URL_PATTERN = /https?:\/\/[^\s<]+/gi;
const TRAILING_PUNCTUATION = /[),.!?;:\]}]+$/;

export function findFirstUrl(text: string): string | null {
  const match = text.match(URL_PATTERN)?.[0];
  if (!match) return null;
  return match.replace(TRAILING_PUNCTUATION, '');
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * OpenGraphService — Client-side link preview parser for React Native.
 * Parses YouTube oEmbed, X/Twitter oEmbed, and HTML OpenGraph meta tags.
 */
export class OpenGraphService {
  private static instance: OpenGraphService;
  private readonly cache = new Map<string, LinkPreviewData | null>();
  private readonly pending = new Map<string, Promise<LinkPreviewData | null>>();
  private readonly apiService = ApiService.getInstance();

  private constructor() {}

  public static getInstance(): OpenGraphService {
    if (!OpenGraphService.instance) {
      OpenGraphService.instance = new OpenGraphService();
    }
    return OpenGraphService.instance;
  }

  public async fetchPreview(url: string): Promise<LinkPreviewData | null> {
    const cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return null;
    }

    if (this.cache.has(cleanUrl)) {
      const cached = this.cache.get(cleanUrl) ?? null;
      if (!this.isIncompleteMediaPreview(cached, cleanUrl)) {
        this.cache.delete(cleanUrl);
        this.cache.set(cleanUrl, cached);
        return cached;
      }
      this.cache.delete(cleanUrl);
    }
    const pendingPreview = this.pending.get(cleanUrl);
    if (pendingPreview) return pendingPreview;

    const fetchOperation = async (): Promise<LinkPreviewData | null> => {
      try {
        const data = await this.doFetch(cleanUrl);
        if (!this.isIncompleteMediaPreview(data, cleanUrl)) {
          this.cache.set(cleanUrl, data);
          this.trimCache();
        }
        return data;
      } catch (e) {
        console.warn('[OpenGraphService] Error fetching preview:', e);
        return null;
      } finally {
        this.pending.delete(cleanUrl);
      }
    };

    const promise = fetchOperation();
    this.pending.set(cleanUrl, promise);
    return promise;
  }

  public clearMemoryCache(): void {
    this.cache.clear();
    this.pending.clear();
  }

  private trimCache(): void {
    while (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (typeof oldestKey !== 'string') return;
      this.cache.delete(oldestKey);
    }
  }

  private isIncompleteMediaPreview(preview: LinkPreviewData | null, sourceUrl: string): boolean {
    if (!preview) return true;
    const kind = preview.entity?.kind;
    if (kind === 'post') return !preview.entity?.post;
    try {
      const parsed = new URL(sourceUrl);
      const root = parsed.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
      if (this.isOurlimeUrl(sourceUrl) && (root === 'post' || root === 'posts')) return !preview.entity?.post;
    } catch {
      return false;
    }
    return kind === 'lime' && !preview.entity?.thumbnailUrl && !preview.image;
  }

  private async doFetch(url: string): Promise<LinkPreviewData | null> {
    const domain = extractDomain(url);

    if (this.isOurlimeUrl(url)) {
      try {
        const response = await this.apiService.request<LinkPreviewApiResponse>(
          `/api/link-preview?url=${encodeURIComponent(url)}`,
          { authenticated: true }
        );
        if (response.success && response.data?.entity) {
          console.log('[OpenGraphService] Fetched Ourlime preview for', url, {
            kind: response.data.entity?.kind,
            hasPost: Boolean(response.data.entity?.post),
            postSubtype: response.data.entity?.post?.subtype,
          });
          return {
            url: response.data.url,
            title: response.data.title,
            description: response.data.description,
            image: response.data.imageUrl,
            siteName: response.data.siteName,
            domain,
            entity: response.data.entity,
          };
        }
      } catch (e) {
        console.log('[OpenGraphService] Error fetching Ourlime preview for', url, e);
      }
      return this.resolveOurlimeFallback(url, domain);
    }

    // 1. YouTube oEmbed
    if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
      try {
        const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        if (res.ok) {
          const data = await res.json();
          return {
            url,
            title: data.title,
            description: data.author_name ? `By ${data.author_name}` : undefined,
            image: data.thumbnail_url,
            siteName: 'YouTube',
            domain: 'youtube.com',
          };
        }
      } catch {}
    }

    // 2. Twitter / X oEmbed
    if (domain.includes('twitter.com') || domain.includes('x.com')) {
      try {
        const res = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`);
        if (res.ok) {
          const data = await res.json();
          return {
            url,
            title: data.author_name ? `${data.author_name} on X` : 'X Post',
            description: data.html ? data.html.replace(/<[^>]+>/g, '').slice(0, 160) : undefined,
            siteName: 'X (formerly Twitter)',
            domain: 'x.com',
          };
        }
      } catch {}
    }

    // 3. General OpenGraph HTML meta tag parser
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uinform.client.php)',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) return { url, domain };

      const html = await response.text();

      const getMeta = (property: string): string | undefined => {
        const regex1 = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
        const regex2 = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i');
        const regex3 = new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i');
        const match = html.match(regex1) || html.match(regex2) || html.match(regex3);
        return match ? match[1] : undefined;
      };

      const getTitle = (): string | undefined => {
        const ogTitle = getMeta('og:title') || getMeta('twitter:title');
        if (ogTitle) return ogTitle;
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        return titleMatch ? titleMatch[1].trim() : undefined;
      };

      const title = getTitle();
      const image = getMeta('og:image') || getMeta('twitter:image') || getMeta('og:image:secure_url');
      const description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description');
      const siteName = getMeta('og:site_name') || domain;

      return {
        url,
        title,
        description,
        image,
        siteName,
        domain,
      };
    } catch {
      return { url, domain };
    }
  }

  private isOurlimeUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      const hostname = parsed.hostname.toLowerCase();
      const apiOrigin = new URL(this.apiService.getBaseUrl()).origin;
      const isPrivateDevelopmentHost = (typeof __DEV__ !== 'undefined' && __DEV__)
        && (
          hostname === 'localhost'
          || hostname === '127.0.0.1'
          || /^10\./.test(hostname)
          || /^192\.168\./.test(hostname)
          || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
        );
      return hostname === 'ourlime.com'
        || hostname === 'www.ourlime.com'
        || parsed.origin === apiOrigin
        || isPrivateDevelopmentHost;
    } catch {
      return false;
    }
  }

  private async resolveOurlimeFallback(url: string, domain: string): Promise<LinkPreviewData> {
    const shared = sharedContentMessageService.parse(url);
    if (shared?.kind === 'post') {
      try {
        let snap = await getDoc(doc(db, 'feedPosts', shared.entityId));
        if (!snap.exists()) {
          snap = await getDoc(doc(db, 'communityVariantDetails', shared.entityId));
        }
        if (!snap.exists()) {
          snap = await getDoc(doc(db, 'posts', shared.entityId));
        }
        if (!snap.exists()) {
          return {
            url,
            title: 'Post Deleted',
            description: 'This post was deleted.',
            domain,
            siteName: 'Ourlime Posts',
            entity: {
              kind: 'post',
              id: shared.entityId,
              path: shared.mobileRoute,
              unavailable: true,
              unavailableReason: 'deleted',
            },
          };
        }
        const data = snap.data() || {};
        const isAdminDeleted =
          data.deletionSource === 'admin_moderation' ||
          data.status === 'admin_deleted' ||
          data.deletedByAdmin === true ||
          data.moderated === true ||
          data.banned === true;
        if (isAdminDeleted) {
          return {
            url,
            title: 'Post Removed',
            description: 'This post was removed by an admin.',
            domain,
            siteName: 'Ourlime Posts',
            entity: {
              kind: 'post',
              id: shared.entityId,
              path: shared.mobileRoute,
              unavailable: true,
              unavailableReason: 'admin_taken_down',
            },
          };
        }
        const isUserDeleted = data.isDeleted === true || data.status === 'deleted';
        if (isUserDeleted) {
          return {
            url,
            title: 'Post Deleted',
            description: 'This post was deleted.',
            domain,
            siteName: 'Ourlime Posts',
            entity: {
              kind: 'post',
              id: shared.entityId,
              path: shared.mobileRoute,
              unavailable: true,
              unavailableReason: 'deleted',
            },
          };
        }
      } catch (err) {
        console.warn('[OpenGraphService] Firestore fallback error for post:', err);
      }
    } else if (shared?.kind === 'lime') {
      try {
        let snap = await getDoc(doc(db, 'reels', shared.entityId));
        if (!snap.exists()) {
          snap = await getDoc(doc(db, 'feedPosts', shared.entityId));
        }
        if (!snap.exists()) {
          snap = await getDoc(doc(db, 'limes', shared.entityId));
        }
        if (!snap.exists()) {
          return {
            url,
            title: 'Lime Deleted',
            description: 'This Lime was deleted.',
            domain,
            siteName: 'Ourlime Limes',
            entity: {
              kind: 'lime',
              id: shared.entityId,
              path: shared.mobileRoute,
              unavailable: true,
              unavailableReason: 'deleted',
            },
          };
        }
        const data = snap.data() || {};
        const isAdminDeleted =
          data.deletionSource === 'admin_moderation' ||
          data.status === 'admin_deleted' ||
          data.deletedByAdmin === true ||
          data.moderated === true ||
          data.banned === true;
        if (isAdminDeleted) {
          return {
            url,
            title: 'Lime Removed',
            description: 'This Lime was removed by an admin.',
            domain,
            siteName: 'Ourlime Limes',
            entity: {
              kind: 'lime',
              id: shared.entityId,
              path: shared.mobileRoute,
              unavailable: true,
              unavailableReason: 'admin_taken_down',
            },
          };
        }
        const isUserDeleted = data.isDeleted === true || data.status === 'deleted';
        if (isUserDeleted) {
          return {
            url,
            title: 'Lime Deleted',
            description: 'This Lime was deleted.',
            domain,
            siteName: 'Ourlime Limes',
            entity: {
              kind: 'lime',
              id: shared.entityId,
              path: shared.mobileRoute,
              unavailable: true,
              unavailableReason: 'deleted',
            },
          };
        }
      } catch (err) {
        console.warn('[OpenGraphService] Firestore fallback error for lime:', err);
      }
    }
    return { url, domain, siteName: 'Ourlime' };
  }
}

export const openGraphService = OpenGraphService.getInstance();
