export type LinkPreviewData = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  domain?: string;
};

const cache = new Map<string, LinkPreviewData | null>();
const pending = new Map<string, Promise<LinkPreviewData | null>>();

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

    if (cache.has(cleanUrl)) return cache.get(cleanUrl) ?? null;
    if (pending.has(cleanUrl)) return pending.get(cleanUrl)!;

    const promise = this.doFetch(cleanUrl)
      .then((data) => {
        if (data) cache.set(cleanUrl, data);
        return data;
      })
      .catch((e) => {
        console.warn('[OpenGraphService] Error fetching preview:', e);
        return null;
      })
      .finally(() => {
        pending.delete(cleanUrl);
      });

    pending.set(cleanUrl, promise);
    return promise;
  }

  private async doFetch(url: string): Promise<LinkPreviewData | null> {
    const domain = extractDomain(url);

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
}

export const openGraphService = OpenGraphService.getInstance();
