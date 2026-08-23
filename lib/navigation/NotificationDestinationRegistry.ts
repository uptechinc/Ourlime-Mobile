import type { Href } from 'expo-router';
import type { NotificationType, PushOnlyNotificationType } from '@/lib/types/notification';
import { deepLinkService } from '@/lib/services/DeepLinkService';

export type NotificationDestinationInput = {
  type?: NotificationType | PushOnlyNotificationType | string;
  senderId?: string;
  sourceUserId?: string;
  userName?: string;
  sourceUserName?: string;
  communityId?: string;
  projectId?: string;
  postId?: string;
  limeId?: string;
  reelId?: string;
  reportId?: string;
  chatId?: string;
  path?: string;
  actionUrl?: string;
};

type UnknownDestinationSource = {
  type?: unknown; senderId?: unknown; sourceUserId?: unknown; userName?: unknown; sourceUserName?: unknown;
  communityId?: unknown; projectId?: unknown; postId?: unknown; limeId?: unknown; reelId?: unknown; reportId?: unknown;
  chatId?: unknown; path?: unknown; actionUrl?: unknown; notificationType?: unknown;
};

export class NotificationDestinationRegistry {
  private static instance: NotificationDestinationRegistry;
  private constructor() {}
  public static getInstance(): NotificationDestinationRegistry {
    if (!NotificationDestinationRegistry.instance) NotificationDestinationRegistry.instance = new NotificationDestinationRegistry();
    return NotificationDestinationRegistry.instance;
  }

  public normalize(value: unknown): NotificationDestinationInput {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const source = value as UnknownDestinationSource;
    return {
      type: this.readString(source.type) || this.readString(source.notificationType), senderId: this.readString(source.senderId),
      sourceUserId: this.readString(source.sourceUserId), userName: this.readString(source.userName), sourceUserName: this.readString(source.sourceUserName),
      communityId: this.readString(source.communityId), projectId: this.readString(source.projectId), postId: this.readString(source.postId), limeId: this.readString(source.limeId),
      reelId: this.readString(source.reelId), reportId: this.readString(source.reportId), chatId: this.readString(source.chatId),
      path: this.readString(source.path), actionUrl: this.readString(source.actionUrl),
    };
  }

  public resolve(data: NotificationDestinationInput): Href {
    const type = data.type ?? '';
    const chatId = data.chatId || data.senderId;
    if (chatId && (type === 'message' || type === 'voice_call' || type === 'video_call')) {
      return { pathname: '/chat/[id]', params: { id: chatId, ...(type === 'voice_call' ? { incomingCall: 'audio' } : {}), ...(type === 'video_call' ? { incomingCall: 'video' } : {}) } };
    }
    const path = data.path || data.actionUrl;
    if (path) {
      const resolution = deepLinkService.resolve(path);
      if (resolution.kind === 'internal') return resolution.route as Href;
    }
    if (type === 'project_invite' || data.projectId) return '/projectManagement';
    const communityId = data.communityId || this.pathSegment(path, '/communities/');
    if (communityId) return { pathname: '/communities/[id]', params: { id: communityId } };
    if (data.postId) return { pathname: '/post/[id]', params: { id: data.postId } };
    const userName = data.userName || data.sourceUserName || this.pathSegment(path, '/profile/viewOtherProfile/') || this.pathSegment(path, '/profile/');
    if (userName) return { pathname: '/profile/[username]', params: { username: userName } };
    const limeId = data.limeId || data.reelId;
    if (limeId) return { pathname: '/(tabs)/Limes', params: { limeId } };
    if (data.reportId && (type === 'community_report' || type === 'report_action')) return { pathname: '/admin/reports/[reportId]', params: { reportId: data.reportId } };
    if (type === 'role_change' || type === 'beta_management') return '/admin';
    return '/(tabs)';
  }

  private readString(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
  private pathSegment(value: string | undefined, prefix: string): string {
    if (!value?.startsWith(prefix)) return '';
    return decodeURIComponent(value.slice(prefix.length).split('/')[0] || '');
  }
}

export const notificationDestinationRegistry = NotificationDestinationRegistry.getInstance();
