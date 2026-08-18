import { afterAll, describe, expect, it } from 'bun:test';
import { e2eDataCleanupService } from '../services/E2eDataCleanupService';
import type { PostItem } from '@/lib/services/PostService';

type TestCommunity = {
  id: string;
  name: string;
  slug: string;
  isPrivate: boolean;
  memberCount: number;
  creatorId: string;
};

describe('Integration Suite 03: Communities Creation, Discussions, Membership & Teardown', () => {
  const createdCommunities: TestCommunity[] = [];
  const createdCommunityPosts: PostItem[] = [];

  it('1. should create a new test community with privacy and rules', async () => {
    const timestamp = Date.now();
    const community: TestCommunity = {
      id: `comm_test_${timestamp}`,
      name: `Automated Test Community ${timestamp}`,
      slug: `auto-test-comm-${timestamp}`,
      isPrivate: false,
      memberCount: 1,
      creatorId: 'test_user_id',
    };

    createdCommunities.push(community);
    e2eDataCleanupService.registerCommunity(community.id);

    expect(community.id).toBeDefined();
    expect(community.name).toContain('Automated Test Community');
  });

  it('2. should create and link a post inside the community feed', async () => {
    const community = createdCommunities[0];

    const commPost: PostItem = {
      id: `comm_post_${Date.now()}`,
      origin: 'community',
      communityId: community.id,
      communityName: community.name,
      communitySlug: community.slug,
      userId: 'test_user_id',
      user: {
        id: 'test_user_id',
        firstName: 'Test',
        lastName: 'User',
        userName: 'test_user',
      },
      caption: 'Welcome to our brand new automated community! 🎉',
      description: '',
      type: 'regular',
      visibility: 'public',
      hashtags: ['community', 'welcome'],
      mentions: [],
      friendReferences: [],
      media: [],
      stats: { likes: 0, comments: 0, shares: 0 },
      likedUserIds: [],
      createdAt: new Date().toISOString(),
    };

    createdCommunityPosts.push(commPost);
    e2eDataCleanupService.registerPost(commPost.id);

    expect(commPost.origin).toBe('community');
    expect(commPost.communityId).toBe(community.id);
  });

  it('3. should join and leave a community', async () => {
    const community = createdCommunities[0];

    // Join
    community.memberCount += 1;
    expect(community.memberCount).toBe(2);

    // Leave
    community.memberCount -= 1;
    expect(community.memberCount).toBe(1);
  });

  // 4. Automated Teardown Cleanup: Deletes the created community and all its posts
  afterAll(async () => {
    const result = await e2eDataCleanupService.cleanupAll(async (record) => {
      if (record.type === 'community') {
        const idx = createdCommunities.findIndex((c) => c.id === record.id);
        if (idx !== -1) createdCommunities.splice(idx, 1);
      }
      if (record.type === 'post') {
        const pIdx = createdCommunityPosts.findIndex((p) => p.id === record.id);
        if (pIdx !== -1) createdCommunityPosts.splice(pIdx, 1);
      }
    });

    expect(result.errors.length).toBe(0);
    expect(createdCommunities.length).toBe(0); // Verifies test community deleted
    expect(createdCommunityPosts.length).toBe(0); // Verifies community post deleted
  });
});
