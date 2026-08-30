import { describe, expect, test } from 'bun:test';
import { sharedContentMessageService } from './SharedContentMessageService.ts';

describe('SharedContentMessageService', () => {
  test('opens Lime shares in the stack viewer so Back returns to chat', () => {
    const result = sharedContentMessageService.parse(
      "Watch @Chris's Lime on Ourlime: https://ourlime.com/limes/lime-123"
    );

    expect(result?.kind).toBe('lime');
    expect(result?.visibleText).toBe('');
    expect(result?.mobileRoute).toBe('/limes/viewer?limeId=lime-123&viewer=1');
  });

  test('keeps post and community links inside the native application', () => {
    const post = sharedContentMessageService.parse('https://ourlime.com/post/post-1');
    const community = sharedContentMessageService.parse('https://ourlime.com/communities/community-1');

    expect(post?.mobileRoute).toBe('/post/post-1');
    expect(community?.mobileRoute).toBe('/communities/community-1');
    expect(post?.visibleText).toBe('');
    expect(community?.visibleText).toBe('');
  });

  test('keeps every supported Ourlime entity share inside the native application', () => {
    const expectations = [
      ['https://ourlime.com/profile/Chris', 'profile', '/profile/Chris'],
      ['https://ourlime.com/events/event-1', 'event', '/events?targetId=event-1'],
      ['https://ourlime.com/blogs/blog-1', 'blog', '/blogs/blog-1'],
      ['https://ourlime.com/jobs/job-1', 'job', '/jobs?apply=job-1'],
      ['https://ourlime.com/market/listing-1', 'market-product', '/market?product=listing-1'],
    ];

    for (const [url, kind, route] of expectations) {
      const result = sharedContentMessageService.parse(url);
      expect(result?.kind).toBe(kind);
      expect(result?.mobileRoute).toBe(route);
      expect(result?.visibleText).toBe('');
    }
  });

  test('hides generated profile share copy while retaining the content card', () => {
    const result = sharedContentMessageService.parse(
      "Check out @Chris's profile on Ourlime: https://ourlime.com/profile/Chris"
    );

    expect(result?.kind).toBe('profile');
    expect(result?.visibleText).toBe('');
    expect(result?.summary).toBe('Shared a profile');
  });

  test('preserves sender commentary but removes the raw Ourlime URL', () => {
    const result = sharedContentMessageService.parse(
      'You need to see this https://ourlime.com/limes/lime-456'
    );

    expect(result?.visibleText).toBe('You need to see this');
    expect(result?.sourceUrl).toBe('https://ourlime.com/limes/lime-456');
  });

  test('leaves external and unsupported links to normal link handling', () => {
    expect(sharedContentMessageService.parse('https://example.com/post/1')).toBeNull();
    expect(sharedContentMessageService.parse('https://ourlime.com/help')).toBeNull();
  });

  test('formats Ourlime post shares for each side of the conversation list', () => {
    const message = 'Check out this post on Ourlime: https://ourlime.com/post/post-1';

    expect(sharedContentMessageService.getConversationListPreview(message, true)).toBe('You shared a post');
    expect(sharedContentMessageService.getConversationListPreview(message, false)).toBe('Shared a post');
  });

  test('formats external links without exposing their content in the conversation list', () => {
    const message = 'Interesting article https://example.com/article/1';

    expect(sharedContentMessageService.getConversationListPreview(message, true)).toBe('You shared a link');
    expect(sharedContentMessageService.getConversationListPreview(message, false)).toBe('Shared a link');
  });

  test('does not replace ordinary message previews', () => {
    expect(sharedContentMessageService.getConversationListPreview('Hello there', true)).toBeNull();
  });
});
