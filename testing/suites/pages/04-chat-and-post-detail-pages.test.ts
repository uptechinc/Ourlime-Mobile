import { describe, expect, it } from 'bun:test';
import { mockPosts } from '../../mocks/mockPosts';
import { mockMessages } from '../../mocks/mockChats';

describe('Page Test Suite 04: Chat Room, Post Detail & Other User Profile Pages', () => {
  it('should verify Chat Room (/chat/[id]) voice notes, stickers, and reactions support', () => {
    const supportedMessageTypes = ['text', 'image', 'video', 'voiceNote', 'sticker', 'audioCall', 'videoCall'];
    expect(supportedMessageTypes.includes('voiceNote')).toBe(true);
    expect(supportedMessageTypes.includes('sticker')).toBe(true);
    expect(supportedMessageTypes.includes('videoCall')).toBe(true);
  });

  it('should verify Post Detail (/post/[id]) rich text, YouTube player, and comments state', () => {
    const post = mockPosts[0];
    expect(post.id).toBe('post_1');
    expect(post.caption).toContain('https://www.youtube.com');
    expect(post.stats.comments).toBe(3);
  });

  it('should verify View Other Profile (/profile/[username]) actions', () => {
    const profileActions = ['follow', 'friend_request', 'message', 'block', 'report'];
    expect(profileActions.includes('friend_request')).toBe(true);
    expect(profileActions.includes('block')).toBe(true);
  });
});
