import type { LinkPreviewData, SharedPostLocation, SharedPostPrimaryMedia } from './OpenGraphService';
import { sharedPostCardStateService, type ActiveSharedPostPlayerListener } from './SharedPostCardStateService';

const getNativeBridge = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native');
    return {
      Platform: rn.Platform || { OS: 'android', select: <T,>(obj: { default?: T; ios?: T; android?: T }): T => (obj.default ?? obj.android ?? obj.ios) as T },
      Linking: rn.Linking || { canOpenURL: async () => false, openURL: async () => {} },
    };
  } catch {
    return {
      Platform: { OS: 'android', select: <T,>(obj: { default?: T; ios?: T; android?: T }): T => (obj.default ?? obj.android ?? obj.ios) as T },
      Linking: { canOpenURL: async () => false, openURL: async () => {} },
    };
  }
};

export class SharedPostPresentationService {
  private static readonly YOUTUBE_WEB_ORIGIN = 'https://ourlime.com';
  private static readonly YOUTUBE_MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
  private static instance: SharedPostPresentationService;
  private constructor() {}

  public static getInstance(): SharedPostPresentationService {
    if (!SharedPostPresentationService.instance) {
      SharedPostPresentationService.instance = new SharedPostPresentationService();
    }
    return SharedPostPresentationService.instance;
  }

  public subscribe(listener: ActiveSharedPostPlayerListener): () => void {
    return sharedPostCardStateService.subscribe(listener);
  }

  public activatePlayer(key: string): void {
    sharedPostCardStateService.activatePlayer(key);
  }

  public deactivatePlayer(key: string): void {
    sharedPostCardStateService.deactivatePlayer(key);
  }

  public deactivateAllPlayers(): void {
    sharedPostCardStateService.deactivateAllPlayers();
  }

  public getHero(preview: LinkPreviewData): SharedPostPrimaryMedia | undefined {
    return preview.entity?.post?.primaryMedia;
  }

  public getCachedThumbnail(videoUrl: string): string | undefined {
    return sharedPostCardStateService.getCachedThumbnail(videoUrl);
  }

  public cacheThumbnail(videoUrl: string, thumbnailUrl: string): void {
    sharedPostCardStateService.cacheThumbnail(videoUrl, thumbnailUrl);
  }

  public getYouTubeEmbedUrl(videoId: string): string {
    const encodedVideoId = encodeURIComponent(videoId);
    return `https://www.youtube-nocookie.com/embed/${encodedVideoId}?autoplay=1&playsinline=1&enablejsapi=1&rel=0&modestbranding=1&origin=${SharedPostPresentationService.YOUTUBE_WEB_ORIGIN}`;
  }

  public getYouTubeRequestHeaders(): { Referer: string } {
    return { Referer: `${SharedPostPresentationService.YOUTUBE_WEB_ORIGIN}/` };
  }

  public getYouTubeUserAgent(): string {
    return SharedPostPresentationService.YOUTUBE_MOBILE_USER_AGENT;
  }

  public async openYouTube(videoId: string): Promise<void> {
    const { Linking } = getNativeBridge();
    const appUrl = `vnd.youtube://${encodeURIComponent(videoId)}`;
    const webUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    try {
      if (await Linking.canOpenURL(appUrl)) {
        await Linking.openURL(appUrl);
        return;
      }
      await Linking.openURL(webUrl);
    } catch {
      await Linking.openURL(webUrl).catch(() => undefined);
    }
  }

  public async openLocation(location: SharedPostLocation): Promise<void> {
    const { Linking, Platform } = getNativeBridge();
    if (location.url) {
      await Linking.openURL(location.url);
      return;
    }
    const label = encodeURIComponent(location.name);
    const hasCoordinates = location.latitude !== undefined && location.longitude !== undefined;
    const url = hasCoordinates
      ? Platform.select({
        ios: `maps:0,0?q=${label}@${location.latitude},${location.longitude}`,
        default: `geo:${location.latitude},${location.longitude}?q=${location.latitude},${location.longitude}(${label})`,
      })
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address || location.name)}`;
    if (url) await Linking.openURL(url);
  }
}

export const sharedPostPresentationService = SharedPostPresentationService.getInstance();
