import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';
import type { PostMedia, PostMediaDraft } from './PostService';

export const MAX_POST_MEDIA = 5;
export const MAX_POST_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_POST_VIDEO_SIZE_BYTES = 250 * 1024 * 1024;
export const MAX_POST_VIDEO_DURATION_SECONDS = 120;

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export type CropPreset = 'fit' | 'portrait' | 'square' | 'landscape';
export type PendingImageCrop = {
  asset: ImagePickerAsset;
  fileName: string;
  mimeType: string;
};
export type MediaSelectionResult = {
  imagesToCrop: PendingImageCrop[];
  videos: PostMediaDraft[];
  errors: string[];
};
export type MediaUploadProgress = { completedBytes: number; totalBytes: number; percentage: number };
export type MediaUploadBatch = { media: PostMedia[]; storagePaths: string[] };

const extensionMimeTypes: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

export class PostMediaService {
  private static instance: PostMediaService;
  private readonly logger = DiagnosticLogService.getInstance();

  private constructor() {}

  public static getInstance(): PostMediaService {
    if (!PostMediaService.instance) PostMediaService.instance = new PostMediaService();
    return PostMediaService.instance;
  }

  public async validateSelection(assets: ImagePickerAsset[], currentCount: number): Promise<MediaSelectionResult> {
    const availableSlots = Math.max(0, MAX_POST_MEDIA - currentCount);
    const selected = assets.slice(0, availableSlots);
    const errors: string[] = [];
    const imagesToCrop: PendingImageCrop[] = [];
    const videos: PostMediaDraft[] = [];

    if (assets.length > availableSlots) {
      errors.push(`You can only add ${availableSlots} more ${availableSlots === 1 ? 'file' : 'files'}. Maximum ${MAX_POST_MEDIA} media files per post.`);
    }

    for (const [index, asset] of selected.entries()) {
      const fileName = asset.fileName ?? `post-media-${Date.now()}-${index}.${asset.type === 'video' ? 'mp4' : 'jpg'}`;
      const mimeType = this.resolveMimeType(asset, fileName);
      const fileSize = asset.fileSize ?? await this.getFileSize(asset.uri);

      if (asset.type === 'video') {
        if (!ALLOWED_VIDEO_TYPES.has(mimeType)) {
          errors.push(`\"${fileName}\" is not a supported video. Use MP4, MOV, or WebM.`);
          continue;
        }
        if (fileSize > MAX_POST_VIDEO_SIZE_BYTES) {
          errors.push(`\"${fileName}\" exceeds the 250 MB video size limit.`);
          continue;
        }
        const durationSeconds = (asset.duration ?? 0) / 1000;
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
          errors.push(`Could not determine the duration of \"${fileName}\".`);
          continue;
        }
        if (durationSeconds > MAX_POST_VIDEO_DURATION_SECONDS) {
          errors.push(`\"${fileName}\" is ${Math.round(durationSeconds)}s long. Maximum duration is 120 seconds.`);
          continue;
        }
        videos.push({ uri: asset.uri, type: 'video', fileName, mimeType, width: asset.width, height: asset.height, fileSize, durationSeconds });
        continue;
      }

      if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
        errors.push(`\"${fileName}\" is not a supported image. Use JPEG, PNG, WebP, or HEIC.`);
        continue;
      }
      if (fileSize > MAX_POST_IMAGE_SIZE_BYTES) {
        errors.push(`\"${fileName}\" exceeds the 10 MB image size limit.`);
        continue;
      }
      imagesToCrop.push({ asset, fileName, mimeType });
    }

    return { imagesToCrop, videos, errors };
  }

  public async cropImage(pending: PendingImageCrop, preset: CropPreset, zoom: number): Promise<PostMediaDraft> {
    const { width, height } = pending.asset;
    const boundedZoom = Math.min(3, Math.max(1, zoom));
    const aspect = preset === 'portrait' ? 4 / 5 : preset === 'square' ? 1 : preset === 'landscape' ? 1.91 : width / height;
    const sourceAspect = width / height;
    let cropWidth = width;
    let cropHeight = height;

    if (sourceAspect > aspect) cropWidth = height * aspect;
    else cropHeight = width / aspect;

    cropWidth /= boundedZoom;
    cropHeight /= boundedZoom;
    const originX = Math.max(0, (width - cropWidth) / 2);
    const originY = Math.max(0, (height - cropHeight) / 2);
    const result = await manipulateAsync(
      pending.asset.uri,
      [{ crop: { originX, originY, width: cropWidth, height: cropHeight } }],
      { compress: 0.85, format: SaveFormat.JPEG }
    );
    const fileSize = await this.getFileSize(result.uri);
    return {
      uri: result.uri,
      type: 'image',
      fileName: pending.fileName.replace(/\.[^.]+$/, '') + '-cropped.jpg',
      mimeType: 'image/jpeg',
      width: result.width,
      height: result.height,
      fileSize,
    };
  }

  public async uploadMediaBatch(options: {
    postId: string;
    userId: string;
    media: PostMediaDraft[];
    signal?: AbortSignal;
    onProgress?: (progress: MediaUploadProgress) => void;
  }): Promise<MediaUploadBatch> {
    const totals = options.media.map((item) => item.fileSize ?? 0);
    const transferred = options.media.map(() => 0);
    const storagePaths: string[] = [];
    try {
      const media = await Promise.all(options.media.map(async (item, index) => {
        const uploaded = await this.uploadMedia({ ...options, item, index, onItemProgress: (bytes) => {
          transferred[index] = bytes;
          const completedBytes = transferred.reduce((sum, value) => sum + value, 0);
          const totalBytes = totals.reduce((sum, value) => sum + value, 0);
          options.onProgress?.({ completedBytes, totalBytes, percentage: totalBytes > 0 ? Math.round((completedBytes / totalBytes) * 100) : 0 });
        } });
        storagePaths.push(uploaded.storagePath);
        return uploaded.media;
      }));
      return { media, storagePaths };
    } catch (error: unknown) {
      await this.cleanup(storagePaths);
      throw error;
    }
  }

  public async cleanup(storagePaths: string[]): Promise<void> {
    await Promise.all(storagePaths.map(async (path) => {
      try {
        await deleteObject(ref(storage, path));
      } catch (error: unknown) {
        this.logger.warn('PostMediaService', 'cleanup-failed', { path, error: error instanceof Error ? error.message : String(error) });
      }
    }));
  }

  private uriToBlob(uri: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response as Blob);
      };
      xhr.onerror = function () {
        reject(new TypeError(`Failed to read local media file: ${uri}`));
      };
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      xhr.send(null);
    });
  }

  private async uploadMedia(options: {
    postId: string;
    userId: string;
    item: PostMediaDraft;
    index: number;
    signal?: AbortSignal;
    onItemProgress: (bytes: number) => void;
  }): Promise<{ media: PostMedia; storagePath: string }> {
    if (options.signal?.aborted) throw new Error('Media upload cancelled.');
    const blob = await this.uriToBlob(options.item.uri);
    const safeFileName = options.item.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const mediaReference = ref(storage, `posts/${options.userId}/regular/${options.postId}-${options.index}-${safeFileName}`);
    const task = uploadBytesResumable(mediaReference, blob, options.item.mimeType ? { contentType: options.item.mimeType } : undefined);
    const abortHandler = () => task.cancel();
    options.signal?.addEventListener('abort', abortHandler, { once: true });
    try {
      await new Promise<void>((resolve, reject) => {
        task.on('state_changed', (snapshot) => options.onItemProgress(snapshot.bytesTransferred), reject, resolve);
      });
      const typeUrl = await getDownloadURL(mediaReference);
      this.logger.success('PostMediaService', 'media-upload', { postId: options.postId, index: options.index, storagePath: mediaReference.fullPath });
      return {
        media: { id: `${options.postId}-${options.index}`, type: options.item.type, typeUrl, fileName: options.item.fileName },
        storagePath: mediaReference.fullPath,
      };
    } finally {
      options.signal?.removeEventListener('abort', abortHandler);
    }
  }

  private resolveMimeType(asset: ImagePickerAsset, fileName: string): string {
    if (asset.mimeType) return asset.mimeType.toLowerCase();
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
    return extensionMimeTypes[extension] ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
  }

  private async getFileSize(uri: string): Promise<number> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return blob.size || 0;
    } catch {
      return 0;
    }
  }
}
