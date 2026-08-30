import { createVideoPlayer } from 'expo-video';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '@/lib/firebaseConfig';

type EnsureLimeThumbnailInput = {
  reelId: string;
  ownerUserId: string;
  viewerUserId: string;
  videoUri: string;
  durationSeconds: number;
  existingThumbnailUrl?: string;
};

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
    const videoPlayer = createVideoPlayer(videoUri);
    try {
      const targetTime = Math.min(Math.max(durationSeconds * 0.2, 0.1), 1);
      const thumbnails = await videoPlayer.generateThumbnailsAsync(targetTime, {
        maxWidth: 1080,
        maxHeight: 1920,
      });
      const thumbnail = thumbnails[0];
      if (!thumbnail) throw new Error('The Lime video did not produce a thumbnail.');

      const imageContext = ImageManipulator.manipulate(thumbnail);
      const image = await imageContext.renderAsync();
      const savedImage = await image.saveAsync({
        compress: 0.86,
        format: SaveFormat.JPEG,
      });
      return savedImage.uri;
    } finally {
      videoPlayer.release();
    }
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
}

export const limeThumbnailService = LimeThumbnailService.getInstance();
