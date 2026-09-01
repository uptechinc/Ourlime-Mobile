export type SharedChatContentKind =
  | 'lime'
  | 'post'
  | 'community'
  | 'profile'
  | 'event'
  | 'blog'
  | 'job'
  | 'market-product';

export type SharedChatContentPresentation = {
  kind: SharedChatContentKind;
  entityId: string;
  sourceUrl: string;
  webPath: string;
  mobileRoute: string;
  visibleText: string;
  summary: string;
};

const URL_PATTERN = /https?:\/\/[^\s<]+/gi;
const HAS_URL_PATTERN = /https?:\/\/[^\s<]+/i;
const TRAILING_URL_PUNCTUATION = /[),.!?;:\]}]+$/;

export class SharedContentMessageService {
  private static instance: SharedContentMessageService;

  private constructor() {}

  public static getInstance(): SharedContentMessageService {
    if (!SharedContentMessageService.instance) {
      SharedContentMessageService.instance = new SharedContentMessageService();
    }
    return SharedContentMessageService.instance;
  }

  public parse(message: string): SharedChatContentPresentation | null {
    const matchedUrl = message.match(URL_PATTERN)?.[0];
    if (!matchedUrl) return null;
    const sourceUrl = matchedUrl.replace(TRAILING_URL_PUNCTUATION, '');
    const destination = this.parseUrl(sourceUrl);
    if (!destination) return null;

    const matchIndex = message.indexOf(matchedUrl);
    const remainingText = `${message.slice(0, matchIndex)}${message.slice(matchIndex + matchedUrl.length)}`
      .replace(/\s+/g, ' ')
      .trim();
    return {
      ...destination,
      sourceUrl,
      visibleText: this.isGeneratedShareCopy(destination.kind, remainingText) ? '' : remainingText,
      summary: this.getSummary(destination.kind),
    };
  }

  public getWebPath(kind: SharedChatContentKind, entityId: string): string {
    const encodedId = encodeURIComponent(entityId);
    switch (kind) {
      case 'lime': return `/limes/${encodedId}`;
      case 'post': return `/post/${encodedId}`;
      case 'community': return `/communities/${encodedId}`;
      case 'profile': return `/profile/${encodedId}`;
      case 'event': return `/events/${encodedId}`;
      case 'blog': return `/blogs/${encodedId}`;
      case 'job': return `/jobs/${encodedId}`;
      case 'market-product': return `/market/${encodedId}`;
    }
    const exhaustiveKind: never = kind;
    return exhaustiveKind;
  }

  public getMobileRoute(kind: SharedChatContentKind, entityId: string): string {
    const encodedId = encodeURIComponent(entityId);
    switch (kind) {
      case 'lime': return `/limes/viewer?limeId=${encodedId}&viewer=1`;
      case 'post': return `/post/${encodedId}`;
      case 'community': return `/communities/${encodedId}`;
      case 'profile': return `/profile/${encodedId}`;
      case 'event': return `/events?targetId=${encodedId}`;
      case 'blog': return `/blogs/${encodedId}`;
      case 'job': return `/jobs?apply=${encodedId}`;
      case 'market-product': return `/market?product=${encodedId}`;
    }
    const exhaustiveKind: never = kind;
    return exhaustiveKind;
  }

  public getConversationListPreview(message: string, sentByViewer: boolean): string | null {
    const sharedContent = this.parse(message);
    if (sharedContent) {
      const summary = sharedContent.summary.replace(/^Shared\s+/i, 'shared ');
      return sentByViewer ? `You ${summary}` : `${summary.charAt(0).toUpperCase()}${summary.slice(1)}`;
    }

    if (HAS_URL_PATTERN.test(message)) {
      return sentByViewer ? 'You shared a link' : 'Shared a link';
    }
    return null;
  }

  private parseUrl(sourceUrl: string): Omit<SharedChatContentPresentation, 'sourceUrl' | 'visibleText' | 'summary'> | null {
    try {
      const url = new URL(sourceUrl);
      const hostname = url.hostname.toLowerCase();
      const isDevelopmentBundle = typeof __DEV__ !== 'undefined' && __DEV__;
      const isPrivateDevelopmentHost = isDevelopmentBundle
        && (
          hostname === 'localhost'
          || hostname === '127.0.0.1'
          || /^10\./.test(hostname)
          || /^192\.168\./.test(hostname)
          || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
        );
      const isOurlimeHost = hostname === 'ourlime.com'
        || hostname === 'www.ourlime.com'
        || isPrivateDevelopmentHost;
      if (!isOurlimeHost) return null;
      const segments = url.pathname.split('/').filter(Boolean).map((segment) => decodeURIComponent(segment));
      const root = segments[0]?.toLowerCase();
      let kind: SharedChatContentKind | null = null;
      let entityId: string | null = null;
      if (root === 'limes' || root === 'lime') {
        kind = 'lime';
        entityId = segments[1] || url.searchParams.get('id') || url.searchParams.get('limeId');
      } else if (root === 'post' || root === 'posts') {
        kind = 'post';
        entityId = segments[1] || url.searchParams.get('id') || url.searchParams.get('postId') || url.searchParams.get('post');
      } else {
        entityId = segments[1] || null;
        if (root === 'communities') kind = 'community';
        else if (root === 'profile') kind = 'profile';
        else if (root === 'events') kind = 'event';
        else if (root === 'blogs') kind = 'blog';
        else if (root === 'jobs') kind = 'job';
        else if (root === 'market') kind = 'market-product';
      }
      if (!kind || !entityId) return null;
      return {
        kind,
        entityId,
        webPath: this.getWebPath(kind, entityId),
        mobileRoute: this.getMobileRoute(kind, entityId),
      };
    } catch {
      return null;
    }
  }

  private getSummary(kind: SharedChatContentKind): string {
    switch (kind) {
      case 'lime': return 'Shared a Lime';
      case 'post': return 'Shared a post';
      case 'community': return 'Shared a community';
      case 'profile': return 'Shared a profile';
      case 'event': return 'Shared an event';
      case 'blog': return 'Shared a blog';
      case 'job': return 'Shared a job';
      case 'market-product': return 'Shared a Marketplace listing';
    }
    const exhaustiveKind: never = kind;
    return exhaustiveKind;
  }

  private isGeneratedShareCopy(kind: SharedChatContentKind, text: string): boolean {
    if (!text) return true;
    if (kind === 'lime') {
      return /^(?:watch\s+.+?\s+lime\s+on\s+ourlime|check out this lime on ourlime|shared a lime)\s*:?$/i.test(text);
    }
    if (kind === 'post') {
      return /^(?:check out this (?:post|poll) on ourlime|shared a post)\s*:?$/i.test(text);
    }
    if (kind === 'community') {
      return /^(?:join me in the ourlime community .+|check out this community on ourlime|shared a community)\s*:?$/i.test(text);
    }
    if (kind === 'profile') return /^(?:check out .+?'s profile on ourlime|shared a profile)\s*:?$/i.test(text);
    if (kind === 'event') return /^(?:check out .+? on ourlime|shared an event)\s*!?:?$/i.test(text);
    if (kind === 'blog') return /^(?:check out this blog on ourlime|shared a blog)\s*:?$/i.test(text);
    if (kind === 'job') return /^(?:check out this job on ourlime|shared a job)\s*:?$/i.test(text);
    return /^(?:check out this (?:marketplace )?listing on ourlime|shared a marketplace listing)\s*:?$/i.test(text);
  }
}

export const sharedContentMessageService = SharedContentMessageService.getInstance();
