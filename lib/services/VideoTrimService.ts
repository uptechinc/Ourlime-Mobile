import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { DiagnosticLogService } from './DiagnosticLogService';

type NativeTrimResult = { uri: string; durationMs: number; sizeBytes: number };

type VideoTrimModule = {
  trimVideo?: (inputUri: string, startMs: number, endMs: number) => Promise<NativeTrimResult>;
  cancelTrim?: () => Promise<void>;
  addListener: (eventName: string) => void;
  removeListeners: (count: number) => void;
};

type VideoTrimProgressEvent = { progress?: number };

export type TrimmedVideoFile = {
  uri: string;
  durationSeconds: number;
  fileSize: number;
};

const PROGRESS_EVENT = 'OurlimeVideoTrimProgress';

function getVideoTrimModule(): VideoTrimModule | null {
  if (Platform.OS !== 'android') return null;
  const modules = NativeModules as { OurlimeVideoTrim?: VideoTrimModule };
  return modules.OurlimeVideoTrim?.trimVideo ? modules.OurlimeVideoTrim : null;
}

/**
 * Really cuts a video on the device (Android, Media3 via plugins/native-media), so only the chosen part of a long
 * Lime / feed video is uploaded. Where native trimming isn't available (iOS, Expo Go), callers fall back.
 */
export class VideoTrimService {
  private static instance: VideoTrimService;
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): VideoTrimService {
    if (!VideoTrimService.instance) VideoTrimService.instance = new VideoTrimService();
    return VideoTrimService.instance;
  }

  public isAvailable(): boolean {
    return getVideoTrimModule() !== null;
  }

  /** Cuts [startSeconds, endSeconds] into a new MP4 in the cache; onProgress receives 0..1. */
  public async trim(uri: string, startSeconds: number, endSeconds: number, onProgress?: (progress: number) => void): Promise<TrimmedVideoFile> {
    const nativeModule = getVideoTrimModule();
    if (!nativeModule?.trimVideo) throw new Error('Video trimming is not available on this device.');
    const emitter = new NativeEventEmitter(nativeModule);
    const subscription = onProgress
      ? emitter.addListener(PROGRESS_EVENT, (event: VideoTrimProgressEvent) => onProgress(Math.min(1, Math.max(0, event.progress ?? 0))))
      : null;
    const startedAt = Date.now();
    try {
      const result = await nativeModule.trimVideo(uri, Math.round(startSeconds * 1000), Math.round(endSeconds * 1000));
      this.logger.info('VideoTrimService', 'trim', {
        requestedSeconds: Math.round((endSeconds - startSeconds) * 10) / 10,
        outputSeconds: Math.round(result.durationMs / 100) / 10,
        sizeBytes: result.sizeBytes,
        elapsedMs: Date.now() - startedAt,
      });
      return { uri: result.uri, durationSeconds: result.durationMs / 1000, fileSize: result.sizeBytes };
    } catch (error: unknown) {
      this.logger.warn('VideoTrimService', 'trim:failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      subscription?.remove();
    }
  }

  public async cancel(): Promise<void> {
    await getVideoTrimModule()?.cancelTrim?.().catch(() => undefined);
  }
}

export const videoTrimService = VideoTrimService.getInstance();
