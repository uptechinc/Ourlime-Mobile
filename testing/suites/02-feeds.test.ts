import { describe, expect, it } from 'bun:test';
import { FeedsScreenObject } from '../screens/FeedsScreenObject';

describe('Suite 02: Feeds, Filters, and YouTube Embed Parsing', () => {
  it('should switch between standard feed filters (All, Photos, Videos, Polls, Events)', () => {
    const screen = new FeedsScreenObject();

    expect(screen.getActiveFilter()).toBe('All');

    const photoResult = screen.setFilter('Photos');
    expect(photoResult.allowed).toBe(true);
    expect(screen.getActiveFilter()).toBe('Photos');

    const videoResult = screen.setFilter('Videos');
    expect(videoResult.allowed).toBe(true);
    expect(screen.getActiveFilter()).toBe('Videos');
  });

  it('should block Sound filter and return isComingSoon flag', () => {
    const screen = new FeedsScreenObject();
    const soundResult = screen.setFilter('Sound');

    expect(soundResult.allowed).toBe(false);
    expect(soundResult.isComingSoon).toBe(true);
    expect(screen.getActiveFilter()).toBe('All'); // Active filter does not change
  });

  it('should toggle feed sources between Home, Friends, and Communities', () => {
    const screen = new FeedsScreenObject();

    expect(screen.getActiveSource()).toBe('home');
    screen.setFeedSource('friends');
    expect(screen.getActiveSource()).toBe('friends');
    screen.setFeedSource('communities');
    expect(screen.getActiveSource()).toBe('communities');
  });

  it('should correctly parse standard YouTube watch URLs', () => {
    const screen = new FeedsScreenObject();
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const videoId = screen.parseYouTubeUrl(url);

    expect(videoId).toBe('dQw4w9WgXcQ');
  });

  it('should correctly parse short youtu.be URLs', () => {
    const screen = new FeedsScreenObject();
    const url = 'https://youtu.be/dQw4w9WgXcQ?si=abcdef12345';
    const videoId = screen.parseYouTubeUrl(url);

    expect(videoId).toBe('dQw4w9WgXcQ');
  });

  it('should correctly parse YouTube Shorts URLs', () => {
    const screen = new FeedsScreenObject();
    const url = 'https://youtube.com/shorts/dQw4w9WgXcQ';
    const videoId = screen.parseYouTubeUrl(url);

    expect(videoId).toBe('dQw4w9WgXcQ');
  });

  it('should return null for non-YouTube URLs', () => {
    const screen = new FeedsScreenObject();
    const url = 'https://ourlime.com/posts/123';
    const videoId = screen.parseYouTubeUrl(url);

    expect(videoId).toBeNull();
  });

  it('should optimistically toggle like count on posts', () => {
    const screen = new FeedsScreenObject();
    const post = screen.getPosts()[0];
    const initialLikes = post.stats.likes;
    const testUserId = 'test_user_abc';

    screen.toggleLike(post.id, testUserId);
    expect(post.likedUserIds.includes(testUserId)).toBe(true);
    expect(post.stats.likes).toBe(initialLikes + 1);

    screen.toggleLike(post.id, testUserId);
    expect(post.likedUserIds.includes(testUserId)).toBe(false);
    expect(post.stats.likes).toBe(initialLikes);
  });
});
