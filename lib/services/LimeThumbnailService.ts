import * as VideoThumbnails from 'expo-video-thumbnails';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '@/lib/firebaseConfig';
import { limeCoverTimelineService } from '@/lib/services/LimeCoverTimelineService';

type EnsureLimeThumbnailInput = {
  reelId: string;
  ownerUserId: string;
  viewerUserId: string;
  videoUri: string;
  durationSeconds: number;
  existingThumbnailUrl?: string;
};

export type LimeCoverSource = 'video-frame' | 'custom-image';

export type LimeCoverFrame = {
  id: string;
  timestampSeconds: number;
  previewUri: string;
};

export type LimeCoverSelection = {
  source: LimeCoverSource;
  timestampSeconds: number | null;
  previewUri: string;
  finalUri: string;
};

const THUMBNAIL_TIMEOUT_MS = 12_000;

export class LimeThumbnailService {
  private static instance: LimeThumbnailService;

  private constructor() {}

  public static getInstance(): LimeThumbnailService {
    if (!LimeThumbnailService.instance) {
      LimeThumbnailService.instance = new LimeThumbnailService();
    }
    return LimeThumbnailService.instance;
  }

  public async createThumbnail(videoUri: string, durationSeconds: number): Promise<string> {
    const targetTime = Math.min(Math.max(durationSeconds * 0.2, 0.1), Math.max(durationSeconds - 0.05, 0.1));
    return this.createThumbnailAtTime(videoUri, targetTime);
  }

  public async createThumbnailAtTime(videoUri: string, timestampSeconds: number): Promise<string> {
    const thumbnail = await this.withTimeout(
      VideoThumbnails.getThumbnailAsync(videoUri, {
        time: Math.round(Math.max(timestampSeconds, 0.05) * 1000),
        quality: 0.9,
      }),
      'Preparing the video cover took too long.'
    );
    const imageContext = ImageManipulator.manipulate(thumbnail.uri);
    const image = await imageContext.renderAsync();
    const savedImage = await image.saveAsync({
      compress: 0.86,
      format: SaveFormat.JPEG,
    });
    return savedImage.uri;
  }

  public async createTimelineFrames(
    videoUri: string,
    durationSeconds: number,
    frameCount = 10
  ): Promise<LimeCoverFrame[]> {
    const timestamps = limeCoverTimelineService.createTimestamps(durationSeconds, frameCount);
    const frames: LimeCoverFrame[] = [];
    for (const [frameIndex, timestampSeconds] of timestamps.entries()) {
      const thumbnail = await this.withTimeout(
        VideoThumbnails.getThumbnailAsync(videoUri, {
          time: Math.round(timestampSeconds * 1000),
          quality: 0.55,
        }),
        'Preparing the cover timeline took too long.'
      );
      const imageContext = ImageManipulator.manipulate(thumbnail.uri);
      const image = await imageContext.renderAsync();
      const savedImage = await image.saveAsync({ compress: 0.68, format: SaveFormat.JPEG });
      frames.push({
        id: `cover-frame-${frameIndex}`,
        timestampSeconds,
        previewUri: savedImage.uri,
      });
    }
    if (frames.length === 0) throw new Error('The video did not produce cover frames.');
    return frames;
  }

  public async ensureOwnedLimeThumbnail(input: EnsureLimeThumbnailInput): Promise<string | null> {
    if (input.existingThumbnailUrl) return input.existingThumbnailUrl;
    if (!input.viewerUserId || input.viewerUserId !== input.ownerUserId) return null;

    const thumbnailUri = await this.createThumbnail(input.videoUri, input.durationSeconds);
    const thumbnailBlob = await this.uriToBlob(thumbnailUri);
    const thumbnailPath = `limes/${input.ownerUserId}/thumbnails/${input.reelId}_thumbnail.jpg`;
    const thumbnailTask = uploadBytesResumable(
      ref(storage, thumbnailPath),
      thumbnailBlob,
      { contentType: 'image/jpeg' }
    );
    await new Promise<void>((resolve, reject) => {
      thumbnailTask.on('state_changed', undefined, reject, resolve);
    });
    const thumbnailUrl = await getDownloadURL(thumbnailTask.snapshot.ref);
    await updateDoc(doc(db, 'reels', input.reelId), {
      thumbnailUrl,
      'media.thumbnailUrl': thumbnailUrl,
    });
    return thumbnailUrl;
  }

  private uriToBlob(uri: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.onload = () => resolve(request.response as Blob);
      request.onerror = () => reject(new TypeError('Could not read the generated Lime thumbnail.'));
      request.responseType = 'blob';
      request.open('GET', uri, true);
      request.send(null);
    });
  }

  private async withTimeout<T>(operation: Promise<T>, message: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), THUMBNAIL_TIMEOUT_MS);
    });
    try {
      return await Promise.race([operation, timeout]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
}

export const limeThumbnailService = LimeThumbnailService.getInstance();
