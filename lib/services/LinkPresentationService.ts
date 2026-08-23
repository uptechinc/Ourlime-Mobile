const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION_PATTERN = /[),.!?;:\]}]+$/;
const DEFAULT_MAXIMUM_LABEL_LENGTH = 42;

export type LocationPresentation = {
  title: string;
  detail: string;
  url: string | null;
  isOnline: boolean;
};

export class LinkPresentationService {
  private static instance: LinkPresentationService;

  private constructor() {}

  public static getInstance(): LinkPresentationService {
    if (!LinkPresentationService.instance) {
      LinkPresentationService.instance = new LinkPresentationService();
    }
    return LinkPresentationService.instance;
  }

  public getOpenableUrl(value?: string | null): string | null {
    const normalizedValue = value?.trim();
    if (!normalizedValue) return null;

    const candidateUrl = /^www\./i.test(normalizedValue)
      ? `https://${normalizedValue}`
      : normalizedValue;
    try {
      const parsedUrl = new URL(candidateUrl);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
        ? parsedUrl.toString()
        : null;
    } catch {
      return null;
    }
  }

  public formatUrl(value: string, maximumLength = DEFAULT_MAXIMUM_LABEL_LENGTH): string {
    const openableUrl = this.getOpenableUrl(value);
    if (!openableUrl) return value;

    const parsedUrl = new URL(openableUrl);
    const host = parsedUrl.hostname.replace(/^www\./i, '');
    const decodedPath = this.decodePath(parsedUrl.pathname).replace(/\/$/, '');
    const candidateLabel = decodedPath && decodedPath !== '/'
      ? `${host}${decodedPath}`
      : host;
    if (candidateLabel.length <= maximumLength) return candidateLabel;
    if (host.length + 2 <= maximumLength) return `${host}/…`;
    return `${host.slice(0, Math.max(1, maximumLength - 1))}…`;
  }

  public compactUrlsInText(content: string, maximumLength = DEFAULT_MAXIMUM_LABEL_LENGTH): string {
    return content.replace(URL_PATTERN, (rawUrl) => {
      const trailingPunctuation = rawUrl.match(TRAILING_PUNCTUATION_PATTERN)?.[0] ?? '';
      const url = trailingPunctuation
        ? rawUrl.slice(0, -trailingPunctuation.length)
        : rawUrl;
      return `${this.formatUrl(url, maximumLength)}${trailingPunctuation}`;
    });
  }

  public presentLocation(name?: string | null, address?: string | null): LocationPresentation {
    const normalizedName = name?.trim() ?? '';
    const normalizedAddress = address?.trim() ?? '';
    const locationUrl = this.getOpenableUrl(normalizedAddress) ?? this.getOpenableUrl(normalizedName);

    if (locationUrl) {
      return {
        title: 'Online location',
        detail: this.formatUrl(locationUrl),
        url: locationUrl,
        isOnline: true,
      };
    }

    return {
      title: normalizedName || normalizedAddress || 'Location',
      detail: normalizedAddress && normalizedAddress !== normalizedName ? normalizedAddress : '',
      url: null,
      isOnline: false,
    };
  }

  private decodePath(path: string): string {
    try {
      return decodeURIComponent(path);
    } catch {
      return path;
    }
  }
}

export const linkPresentationService = LinkPresentationService.getInstance();
