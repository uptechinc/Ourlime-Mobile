import type { PostItem, PostMedia } from './PostService';

export class ProfileGalleryService {
  private static instance: ProfileGalleryService;

  private constructor() {}

  public static getInstance(): ProfileGalleryService {
    if (!ProfileGalleryService.instance) {
      ProfileGalleryService.instance = new ProfileGalleryService();
    }
    return ProfileGalleryService.instance;
  }

  public selectGalleryMedia(posts: PostItem[]): PostMedia[] {
    const mediaByIdentity = new Map<string, PostMedia>();

    for (const post of posts) {
      for (const mediaItem of post.media) {
        if ((mediaItem.type !== 'image' && mediaItem.type !== 'video') || !mediaItem.typeUrl) continue;
        const identity = mediaItem.id || `${mediaItem.type}:${mediaItem.typeUrl}`;
        if (!mediaByIdentity.has(identity)) mediaByIdentity.set(identity, mediaItem);
      }
    }

    return Array.from(mediaByIdentity.values());
  }
}

export const profileGalleryService = ProfileGalleryService.getInstance();
