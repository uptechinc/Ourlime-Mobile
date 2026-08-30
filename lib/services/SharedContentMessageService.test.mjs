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
});
