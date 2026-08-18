import { describe, expect, it } from 'bun:test';
import { apiTestHarness } from '../services/ApiTestHarness';

describe('Suite 13: Core OOP API & Service Endpoints', () => {
  it('should fetch feed posts via /api/home/MiddleSection/Post', async () => {
    const response = await apiTestHarness.mockGet('/api/home/MiddleSection/Post');
    expect(response.status).toBe(200);
    const data = response.data as { posts: unknown[]; hasMore: boolean };
    expect(data.posts.length).toBeGreaterThan(0);
  });

  it('should fetch friend conversations via /api/chat/friends', async () => {
    const response = await apiTestHarness.mockGet('/api/chat/friends');
    expect(response.status).toBe(200);
    const data = response.data as { conversations: unknown[] };
    expect(data.conversations.length).toBeGreaterThan(0);
  });

  it('should send messages via /api/messaging', async () => {
    const response = await apiTestHarness.mockPost('/api/messaging', {
      receiverId: 'peer_123',
      text: 'Hello from test',
    });
    expect(response.status).toBe(200);
    const data = response.data as { success: boolean; messageId: string };
    expect(data.success).toBe(true);
    expect(data.messageId).toBeDefined();
  });
});
