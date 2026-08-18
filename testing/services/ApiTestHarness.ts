import { mockPosts } from '../mocks/mockPosts';
import { mockConversations, mockMessages } from '../mocks/mockChats';

export type MockApiResponse<T = unknown> = {
  status: number;
  data: T;
  headers?: Record<string, string>;
};

export class ApiTestHarness {
  private static instance: ApiTestHarness;

  private constructor() {}

  public static getInstance(): ApiTestHarness {
    if (!ApiTestHarness.instance) {
      ApiTestHarness.instance = new ApiTestHarness();
    }
    return ApiTestHarness.instance;
  }

  public async mockGet(path: string): Promise<MockApiResponse> {
    if (path.includes('/api/home/MiddleSection/Post')) {
      return {
        status: 200,
        data: { posts: mockPosts, hasMore: false, nextCursor: null },
      };
    }
    if (path.includes('/api/chat/friends')) {
      return {
        status: 200,
        data: { conversations: mockConversations },
      };
    }
    if (path.includes('/api/messaging/messages')) {
      return {
        status: 200,
        data: { messages: mockMessages },
      };
    }
    if (path.includes('/api/notifications')) {
      return {
        status: 200,
        data: { notifications: [], unreadCount: 0 },
      };
    }
    return { status: 404, data: { error: 'Not found' } };
  }

  public async mockPost(path: string, body: Record<string, unknown>): Promise<MockApiResponse> {
    if (path === '/api/push-tokens') {
      const { token, platform, transport } = body;
      if (!token || !platform || (platform !== 'android' && platform !== 'ios')) {
        return { status: 400, data: { success: false, error: 'Invalid push token' } };
      }
      return { status: 200, data: { success: true } };
    }
    if (path === '/api/messaging') {
      return { status: 200, data: { success: true, messageId: 'msg_created_123' } };
    }
    return { status: 200, data: { success: true } };
  }
}

export const apiTestHarness = ApiTestHarness.getInstance();
