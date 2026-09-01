import { describe, expect, test } from 'bun:test';
import { limeCoverTimelineService } from './LimeCoverTimelineService.ts';

describe('LimeCoverTimelineService', () => {
  test('creates a bounded frame strip across the video duration', () => {
    const timestamps = limeCoverTimelineService.createTimestamps(24, 10);
    expect(timestamps).toHaveLength(10);
    expect(timestamps[0]).toBe(0.05);
    expect(timestamps.at(-1)).toBeCloseTo(23.95);
    expect(timestamps.every((timestamp, index) => index === 0 || timestamp >= timestamps[index - 1])).toBe(true);
  });

  test('constrains drag selection to the local frame-strip radius', () => {
    expect(limeCoverTimelineService.getFrameIndex(-30, 300, 10)).toBe(0);
    expect(limeCoverTimelineService.getFrameIndex(155, 300, 10)).toBe(5);
    expect(limeCoverTimelineService.getFrameIndex(500, 300, 10)).toBe(9);
  });
});
