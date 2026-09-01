import { describe, expect, test } from 'bun:test';
import { sharedPostCardStateService } from './SharedPostCardStateService.ts';

describe('SharedPostCardStateService', () => {
  test('keeps only one inline player active and ignores unrelated cleanup', () => {
    const states = [];
    const unsubscribe = sharedPostCardStateService.subscribe((activeKey) => states.push(activeKey));

    sharedPostCardStateService.activatePlayer('post-one');
    sharedPostCardStateService.activatePlayer('post-two');
    sharedPostCardStateService.deactivatePlayer('post-one');
    sharedPostCardStateService.deactivatePlayer('post-two');
    unsubscribe();

    expect(states).toEqual([null, 'post-one', 'post-two', null]);
  });

  test('stores legacy video thumbnails for row-local reuse', () => {
    sharedPostCardStateService.cacheThumbnail('https://cdn.example/video.mp4', 'file:///thumbnail.jpg');

    expect(sharedPostCardStateService.getCachedThumbnail('https://cdn.example/video.mp4')).toBe('file:///thumbnail.jpg');
    expect(sharedPostCardStateService.getCachedThumbnail('https://cdn.example/other.mp4')).toBeUndefined();
  });

  test('unloads the active player before internal navigation', () => {
    const states = [];
    const unsubscribe = sharedPostCardStateService.subscribe((activeKey) => states.push(activeKey));
    sharedPostCardStateService.activatePlayer('post-three');

    sharedPostCardStateService.deactivateAllPlayers();
    unsubscribe();

    expect(states).toEqual([null, 'post-three', null]);
  });

  test('isolates players when two messages share the exact same post path', () => {
    const instanceKey1 = 'msg-1:/post/post-1';
    const instanceKey2 = 'msg-2:/post/post-1';

    sharedPostCardStateService.activatePlayer(instanceKey1);
    expect(sharedPostCardStateService.getActivePlayerKey()).toBe(instanceKey1);

    sharedPostCardStateService.activatePlayer(instanceKey2);
    expect(sharedPostCardStateService.getActivePlayerKey()).toBe(instanceKey2);

    sharedPostCardStateService.deactivatePlayer(instanceKey1);
    // Deactivating stale instance should not affect the active instance
    expect(sharedPostCardStateService.getActivePlayerKey()).toBe(instanceKey2);

    sharedPostCardStateService.deactivatePlayer(instanceKey2);
    expect(sharedPostCardStateService.getActivePlayerKey()).toBeNull();
  });
});
