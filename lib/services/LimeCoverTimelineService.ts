export class LimeCoverTimelineService {
  private static instance: LimeCoverTimelineService;

  private constructor() {}

  public static getInstance(): LimeCoverTimelineService {
    if (!LimeCoverTimelineService.instance) LimeCoverTimelineService.instance = new LimeCoverTimelineService();
    return LimeCoverTimelineService.instance;
  }

  public createTimestamps(durationSeconds: number, frameCount: number): number[] {
    const safeDuration = Math.max(durationSeconds, 0.1);
    const safeFrameCount = Math.min(Math.max(Math.round(frameCount), 6), 12);
    return Array.from({ length: safeFrameCount }, (_, frameIndex) => {
      const fraction = frameIndex / Math.max(safeFrameCount - 1, 1);
      return Math.min(Math.max(safeDuration * fraction, 0.05), Math.max(safeDuration - 0.05, 0.05));
    });
  }

  public getFrameIndex(trackPosition: number, trackWidth: number, frameCount: number): number {
    if (trackWidth <= 0 || frameCount <= 0) return 0;
    const fraction = Math.max(0, Math.min(trackPosition / trackWidth, 0.999));
    return Math.min(Math.floor(fraction * frameCount), frameCount - 1);
  }
}

export const limeCoverTimelineService = LimeCoverTimelineService.getInstance();
