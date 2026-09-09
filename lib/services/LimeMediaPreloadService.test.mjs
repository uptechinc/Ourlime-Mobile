import { describe, expect, mock, test } from 'bun:test';

mock.module('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: { currentState: 'active', addEventListener: () => ({ remove: () => {} }) },
  Share: { share: async () => ({ action: 'sharedAction' }), sharedAction: 'sharedAction' },
}));

let prefetchedCalls = [];
let prefetchFn = async (url, policy) => {
  prefetchedCalls.push({ url, policy });
  return true;
};

mock.module('expo-image', () => ({
  Image: {
    prefetch: (url, policy) => prefetchFn(url, policy),
  },
}));

const { limeMediaPreloadService } = await import('./LimeMediaPreloadService.ts');

describe('LimeMediaPreloadService', () => {
  test('ignores invalid, short, or non-string URLs', async () => {
    limeMediaPreloadService.clear();

    const emptyResult = await limeMediaPreloadService.prefetchPoster('');
    expect(emptyResult).toBe(false);

    const shortResult = await limeMediaPreloadService.prefetchPoster('http');
    expect(shortResult).toBe(false);

    const nullResult = await limeMediaPreloadService.prefetchPoster(null);
    expect(nullResult).toBe(false);

    const undefinedResult = await limeMediaPreloadService.prefetchPoster(undefined);
    expect(undefinedResult).toBe(false);
  });

  test('prefetches valid poster URL and records in cache', async () => {
    limeMediaPreloadService.clear();
    prefetchedCalls = [];

    const url = 'https://firebasestorage.googleapis.com/v0/b/ourlime/thumb1.jpg';
    const result = await limeMediaPreloadService.prefetchPoster(url);

    expect(result).toBe(true);
    expect(prefetchedCalls.length).toBe(1);
    expect(prefetchedCalls[0].url).toBe(url);
    expect(prefetchedCalls[0].policy).toBe('memory-disk');
    expect(limeMediaPreloadService.isPreloaded(url)).toBe(true);

    // Subsequent call should immediately return true from cache without refetching
    prefetchedCalls = [];
    const cachedResult = await limeMediaPreloadService.prefetchPoster(url);
    expect(cachedResult).toBe(true);
    expect(prefetchedCalls.length).toBe(0);
  });

  test('prefetchFeedPosters extracts thumbnail aliases and bounds count', async () => {
    limeMediaPreloadService.clear();
    prefetchedCalls = [];

    const mockReels = [
      { id: '1', thumbnailUrl: 'https://example.com/thumb1.jpg', media: { typeUrl: 'https://example.com/v1.mp4' } },
      { id: '2', media: { typeUrl: 'https://example.com/v2.mp4', thumbnailUrl: 'https://example.com/thumb2.jpg' } },
      { id: '3', thumbnailUrl: 'https://example.com/thumb3.jpg', media: { typeUrl: 'https://example.com/v3.mp4' } },
      { id: '4', thumbnailUrl: 'https://example.com/thumb4.jpg', media: { typeUrl: 'https://example.com/v4.mp4' } },
      { id: '5', thumbnailUrl: 'https://example.com/thumb5.jpg', media: { typeUrl: 'https://example.com/v5.mp4' } },
    ];

    // Prefetch starting from index 1 with limit 2
    await limeMediaPreloadService.prefetchFeedPosters(mockReels, 1, 2);

    expect(prefetchedCalls.length).toBe(2);
    expect(prefetchedCalls.map((call) => call.url)).toEqual([
      'https://example.com/thumb2.jpg',
      'https://example.com/thumb3.jpg',
    ]);
    expect(limeMediaPreloadService.isPreloaded('https://example.com/thumb2.jpg')).toBe(true);
    expect(limeMediaPreloadService.isPreloaded('https://example.com/thumb3.jpg')).toBe(true);
    expect(limeMediaPreloadService.isPreloaded('https://example.com/thumb1.jpg')).toBe(false);
  });

  test('cancel invalidates in-flight prefetch from committing to cache', async () => {
    limeMediaPreloadService.clear();
    prefetchedCalls = [];

    let resolvePrefetch;
    const gate = new Promise((resolve) => {
      resolvePrefetch = resolve;
    });

    const previousFn = prefetchFn;
    prefetchFn = async (url, policy) => {
      await gate;
      return true;
    };

    try {
      const url = 'https://example.com/slow-poster.jpg';
      const promise = limeMediaPreloadService.prefetchPoster(url);

      // Cancel before prefetch completes
      limeMediaPreloadService.cancel();

      resolvePrefetch();
      await promise;

      // Because generation changed on cancel, it should not be committed to preloaded cache
      expect(limeMediaPreloadService.isPreloaded(url)).toBe(false);
    } finally {
      prefetchFn = previousFn;
    }
  });
});
