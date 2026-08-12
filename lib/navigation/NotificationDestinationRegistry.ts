import type { Href } from 'expo-router';

export class NotificationDestinationRegistry {
  private static instance: NotificationDestinationRegistry;

  private constructor() {}

  public static getInstance(): NotificationDestinationRegistry {
    if (!NotificationDestinationRegistry.instance) NotificationDestinationRegistry.instance = new NotificationDestinationRegistry();
    return NotificationDestinationRegistry.instance;
  }

  public resolve(data: Record<string, unknown>): Href {
    const senderId = this.readString(data.senderId);
    const type = this.readString(data.type);
    if (senderId && (type === 'message' || type === 'voice_call' || type === 'video_call')) {
      return { pathname: '/chat/[id]', params: { id: senderId } };
    }
    const sourceUserName = this.readString(data.userName) || this.pathSegment(data.path, '/profile/');
    if (sourceUserName) return { pathname: '/profile/[username]', params: { username: sourceUserName } };
    const communityId = this.readString(data.communityId) || this.pathSegment(data.path, '/communities/');
    if (communityId) return { pathname: '/communities/[id]', params: { id: communityId } };
    const postId = this.readString(data.postId);
    if (postId) return { pathname: '/post/[id]', params: { id: postId } } as unknown as Href;
    const limeId = this.readString(data.limeId) || this.readString(data.reelId);
    if (limeId) return { pathname: '/(tabs)/Limes', params: { limeId } };
    return '/(tabs)';
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private pathSegment(value: unknown, prefix: string): string {
    const path = this.readString(value);
    if (!path.startsWith(prefix)) return '';
    return decodeURIComponent(path.slice(prefix.length).split('/')[0] || '');
  }
}

export const notificationDestinationRegistry = NotificationDestinationRegistry.getInstance();
