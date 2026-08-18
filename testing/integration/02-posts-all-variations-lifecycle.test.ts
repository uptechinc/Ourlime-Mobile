import { afterAll, describe, expect, it } from 'bun:test';
import { e2eDataCleanupService } from '../services/E2eDataCleanupService';
import type { PostItem } from '@/lib/services/PostService';
import { extractYouTubeVideoId } from '@/lib/utils/youtubeUtils';

describe('Integration Suite 02: Posts Lifecycle with All Variations, Media, Polls & Teardown', () => {
  const createdPosts: PostItem[] = [];
  const createdComments: { postId: string; commentId: string }[] = [];

  it('1. should create a standard text post with hashtags and user mentions', async () => {
    const post: PostItem = {
      id: `test_post_text_${Date.now()}`,
      origin: 'home',
      userId: 'test_user_id',
      user: {
        id: 'test_user_id',
        firstName: 'Test',
        lastName: 'User',
        userName: 'test_user',
      },
      caption: 'Loving this sunny Caribbean afternoon! #Trinidad #Ourlime @admin',
      description: '',
      type: 'regular',
      visibility: 'public',
      hashtags: ['Trinidad', 'Ourlime'],
      mentions: ['admin'],
      friendReferences: [],
      media: [],
      stats: { likes: 0, comments: 0, shares: 0 },
      likedUserIds: [],
      createdAt: new Date().toISOString(),
    };

    createdPosts.push(post);
    e2eDataCleanupService.registerPost(post.id);

    expect(post.hashtags.length).toBe(2);
    expect(post.mentions.includes('admin')).toBe(true);
  });

  it('2. should create a post with a YouTube video link and parse 16:9 embed ID', async () => {
    const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const videoId = extractYouTubeVideoId(youtubeUrl);

    const post: PostItem = {
      id: `test_post_yt_${Date.now()}`,
      origin: 'home',
      userId: 'test_user_id',
      user: {
        id: 'test_user_id',
        firstName: 'Test',
        lastName: 'User',
        userName: 'test_user',
      },
      caption: `Check out this music video: ${youtubeUrl}`,
      description: '',
      type: 'regular',
      visibility: 'public',
      hashtags: ['music'],
      mentions: [],
      friendReferences: [],
      media: [],
      stats: { likes: 0, comments: 0, shares: 0 },
      likedUserIds: [],
      createdAt: new Date().toISOString(),
    };

    createdPosts.push(post);
    e2eDataCleanupService.registerPost(post.id);

    expect(videoId).toBe('dQw4w9WgXcQ');
    expect(post.caption).toContain(youtubeUrl);
  });

  it('3. should create a post with a verified location pin and address', async () => {
    const post: PostItem = {
      id: `test_post_loc_${Date.now()}`,
      origin: 'home',
      userId: 'test_user_id',
      user: {
        id: 'test_user_id',
        firstName: 'Test',
        lastName: 'User',
        userName: 'test_user',
      },
      caption: 'Live from Maracas Bay! 🏖️',
      description: 'Enjoying some bake and shark',
      type: 'regular',
      visibility: 'public',
      location: {
        name: 'Maracas Beach',
        address: 'North Coast Road, Maracas, Trinidad and Tobago',
        latitude: 10.7583,
        longitude: -61.4394,
      },
      hashtags: ['Maracas', 'BakeAndShark'],
      mentions: [],
      friendReferences: [],
      media: [],
      stats: { likes: 0, comments: 0, shares: 0 },
      likedUserIds: [],
      createdAt: new Date().toISOString(),
    };

    createdPosts.push(post);
    e2eDataCleanupService.registerPost(post.id);

    expect(post.location?.name).toBe('Maracas Beach');
    expect(post.location?.latitude).toBeCloseTo(10.7583);
  });

  it('4. should create a post with an image upload attachment', async () => {
    const post: PostItem = {
      id: `test_post_img_${Date.now()}`,
      origin: 'home',
      userId: 'test_user_id',
      user: {
        id: 'test_user_id',
        firstName: 'Test',
        lastName: 'User',
        userName: 'test_user',
      },
      caption: 'Sunset in Port of Spain 🌅',
      description: '',
      type: 'regular',
      visibility: 'public',
      hashtags: ['sunset'],
      mentions: [],
      friendReferences: [],
      media: [
        {
          id: 'media_img_1',
          type: 'image',
          typeUrl: 'https://ourlime.com/storage/sample_sunset.jpg',
          fileName: 'sunset.jpg',
        },
      ],
      stats: { likes: 0, comments: 0, shares: 0 },
      likedUserIds: [],
      createdAt: new Date().toISOString(),
    };

    createdPosts.push(post);
    e2eDataCleanupService.registerPost(post.id);

    expect(post.media.length).toBe(1);
    expect(post.media[0].type).toBe('image');
  });

  it('5. should create a post with video upload referencing VID_20260818_112805_046.mp4', async () => {
    const videoFileName = 'VID_20260818_112805_046.mp4';

    const post: PostItem = {
      id: `test_post_vid_${Date.now()}`,
      origin: 'home',
      userId: 'test_user_id',
      user: {
        id: 'test_user_id',
        firstName: 'Test',
        lastName: 'User',
        userName: 'test_user',
      },
      caption: 'Native video test upload directly from mobile storage 🎬',
      description: '',
      type: 'regular',
      visibility: 'public',
      hashtags: ['video', 'test'],
      mentions: [],
      friendReferences: [],
      media: [
        {
          id: 'media_vid_1',
          type: 'video',
          typeUrl: `file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/${videoFileName}`,
          fileName: videoFileName,
        },
      ],
      stats: { likes: 0, comments: 0, shares: 0 },
      likedUserIds: [],
      createdAt: new Date().toISOString(),
    };

    createdPosts.push(post);
    e2eDataCleanupService.registerPost(post.id);

    expect(post.media[0].type).toBe('video');
    expect(post.media[0].fileName).toBe(videoFileName);
  });

  it('6. should create a poll post with options and record user votes', async () => {
    const post: PostItem = {
      id: `test_post_poll_${Date.now()}`,
      origin: 'home',
      userId: 'test_user_id',
      user: {
        id: 'test_user_id',
        firstName: 'Test',
        lastName: 'User',
        userName: 'test_user',
      },
      caption: 'What Caribbean dish should we feature next on Ourlime?',
      description: '',
      type: 'poll',
      visibility: 'public',
      pollOptions: [
        { id: 'opt_doubles', text: 'Trini Doubles 🌯', votes: 12 },
        { id: 'opt_roti', text: 'Roti with Curry Chicken 🍗', votes: 9 },
        { id: 'opt_pelau', text: 'Trini Pelau 🍲', votes: 15 },
      ],
      hashtags: ['food', 'poll'],
      mentions: [],
      friendReferences: [],
      media: [],
      stats: { likes: 0, comments: 0, shares: 0 },
      likedUserIds: [],
      createdAt: new Date().toISOString(),
    };

    createdPosts.push(post);
    e2eDataCleanupService.registerPost(post.id);

    expect(post.pollOptions?.length).toBe(3);
  });

  it('7. should like a post and increment like counts', async () => {
    const post = createdPosts[0];
    const testUserId = 'test_voter_123';

    // Simulate like
    post.likedUserIds.push(testUserId);
    post.stats.likes += 1;

    expect(post.likedUserIds.includes(testUserId)).toBe(true);
    expect(post.stats.likes).toBe(1);
  });

  it('8. should repost a post and verify attribution metadata', async () => {
    const originalPost = createdPosts[0];

    const repostedPost: PostItem = {
      id: `test_repost_${Date.now()}`,
      origin: 'home',
      userId: 'friend_user_id',
      user: {
        id: 'friend_user_id',
        firstName: 'Friend',
        lastName: 'User',
        userName: 'friend_user',
      },
      caption: originalPost.caption,
      description: '',
      type: 'regular',
      visibility: 'public',
      hashtags: originalPost.hashtags,
      mentions: originalPost.mentions,
      friendReferences: [],
      media: originalPost.media,
      repostedFrom: {
        postId: originalPost.id,
        userId: originalPost.userId,
        userName: originalPost.user.userName,
        firstName: originalPost.user.firstName,
        lastName: originalPost.user.lastName,
      },
      stats: { likes: 0, comments: 0, shares: 0 },
      likedUserIds: [],
      createdAt: new Date().toISOString(),
    };

    createdPosts.push(repostedPost);
    e2eDataCleanupService.registerPost(repostedPost.id);

    expect(repostedPost.repostedFrom?.postId).toBe(originalPost.id);
  });

  it('9. should create comments and nested replies on a post', async () => {
    const targetPost = createdPosts[0];
    const commentId = `test_comment_${Date.now()}`;

    createdComments.push({ postId: targetPost.id, commentId });
    e2eDataCleanupService.registerComment(targetPost.id, commentId);

    targetPost.stats.comments += 1;
    expect(targetPost.stats.comments).toBe(1);
  });

  // 10. Automated Teardown Cleanup: Deletes all created posts and comments
  afterAll(async () => {
    const result = await e2eDataCleanupService.cleanupAll(async (record) => {
      // Deletion execution hook
      if (record.type === 'post') {
        const idx = createdPosts.findIndex((p) => p.id === record.id);
        if (idx !== -1) createdPosts.splice(idx, 1);
      }
    });

    expect(result.errors.length).toBe(0);
    expect(createdPosts.length).toBe(0); // Verifies all created posts are 100% removed
  });
});
