import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import { File } from 'expo-file-system';
import { createUploadTask, FileSystemUploadType } from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { auth, storage } from '../firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';
import { limeThumbnailService } from './LimeThumbnailService';
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
export type PendingVideoTrim = {
  asset: ImagePickerAsset;
  fileName: string;
  mimeType: string;
  fileSize: number;
  durationSeconds: number;
};
export type MediaSelectionResult = {
  imagesToCrop: PendingImageCrop[];
  videosToTrim: PendingVideoTrim[];
  videos: PostMediaDraft[];
  errors: string[];
};
export type MediaUploadProgress = { completedBytes: number; totalBytes: number; percentage: number };
export type PostUploadStage = 'preparing' | 'uploading' | 'cover' | 'publishing';
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

export function isCancellationError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (!error) return false;
  if (typeof error === 'object') {
    const err = error as { code?: string; name?: string; message?: string };
    if (err.code === 'storage/canceled') return true;
    if (err.name === 'AbortError') return true;
    if (typeof err.message === 'string' && /cancel|abort/i.test(err.message)) return true;
  }
  return false;
}

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
    const videosToTrim: PendingVideoTrim[] = [];
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
          errors.push(`"${fileName}" is not a supported video. Use MP4, MOV, or WebM.`);
          continue;
        }
        if (fileSize > MAX_POST_VIDEO_SIZE_BYTES) {
          errors.push(`"${fileName}" exceeds the 250 MB video size limit.`);
          continue;
        }
        const durationSeconds = (asset.duration ?? 0) / 1000;
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
          errors.push(`Could not determine the duration of "${fileName}".`);
          continue;
        }
        if (durationSeconds > MAX_POST_VIDEO_DURATION_SECONDS) {
          videosToTrim.push({
            asset,
            fileName,
            mimeType,
            fileSize,
            durationSeconds,
          });
          continue;
        }
        videos.push({ uri: asset.uri, type: 'video', fileName, mimeType, width: asset.width, height: asset.height, fileSize, durationSeconds });
        continue;
      }

      if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
        errors.push(`"${fileName}" is not a supported image. Use JPEG, PNG, WebP, or HEIC.`);
        continue;
      }
      if (fileSize > MAX_POST_IMAGE_SIZE_BYTES) {
        errors.push(`"${fileName}" exceeds the 10 MB image size limit.`);
        continue;
      }
      imagesToCrop.push({ asset, fileName, mimeType });
    }

    return { imagesToCrop, videosToTrim, videos, errors };
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
    onStage?: (stage: PostUploadStage, index?: number) => void;
  }): Promise<MediaUploadBatch> {
    const totals = options.media.map((item) => item.fileSize ?? 0);
    const transferred = options.media.map(() => 0);
    const storagePaths: string[] = [];
    try {
      const media: PostMedia[] = [];
      for (const [index, item] of options.media.entries()) {
        const uploaded = await this.uploadMedia({ ...options, item, index, onItemProgress: (bytes, total) => {
          if (typeof total === 'number' && total > 0) totals[index] = total;
          transferred[index] = bytes;
          const completedBytes = transferred.reduce((sum, value) => sum + value, 0);
          const totalBytes = totals.reduce((sum, value) => sum + value, 0);
          options.onProgress?.({ completedBytes, totalBytes, percentage: totalBytes > 0 ? Math.round((completedBytes / totalBytes) * 100) : 0 });
        }, onStoragePath: (path) => storagePaths.push(path) });
        media.push(uploaded.media);
      }
      return { media, storagePaths };
    } catch (error: unknown) {
      await this.cleanup(storagePaths);
      throw error;
    }
  }

  public async uploadProfileImage(options: { userId: string; uri: string }): Promise<string> {
    const fileSize = await this.getFileSize(options.uri);
    const storagePath = `profiles/${options.userId}/avatar-${Date.now()}.jpg`;
    return this.uploadMediaItem({
      uri: options.uri,
      storagePath,
      mimeType: 'image/jpeg',
      fileSize: fileSize || 1024,
    });
  }

  public async uploadProfileCover(options: { userId: string; uri: string }): Promise<string> {
    const fileSize = await this.getFileSize(options.uri);
    const storagePath = `profiles/${options.userId}/cover-${Date.now()}.jpg`;
    return this.uploadMediaItem({
      uri: options.uri,
      storagePath,
      mimeType: 'image/jpeg',
      fileSize: fileSize || 1024,
    });
  }

  public async cleanup(storagePaths: string[]): Promise<void> {
    await Promise.all(storagePaths.map(async (path) => {
      try {
        await deleteObject(ref(storage, path));
      } catch (error: unknown) {
        const err = error as { code?: string; message?: string } | null;
        const isNotFound = err?.code === 'storage/object-not-found' ||
          String(err?.message || '').includes('storage/object-not-found') ||
          String(err?.message || '').includes('does not exist');
        if (isNotFound) return;
        this.logger.warn('PostMediaService', 'cleanup-failed', { path, error: error instanceof Error ? error.message : String(error) });
      }
    }));
  }

  public async uploadMediaItem(options: {
    uri: string;
    storagePath: string;
    mimeType: string;
    fileSize: number;
    signal?: AbortSignal;
    onItemProgress?: (bytes: number, total?: number) => void;
  }): Promise<string> {
    if (options.signal?.aborted) throw new Error('Media upload cancelled.');
    const mediaReference = ref(storage, options.storagePath);
    const uploadStartedAt = Date.now();

    // Attempt native streaming upload on mobile devices with local file URIs
    if (Platform.OS !== 'web' && /^(file|content):\/\//i.test(options.uri) && this.isNativeUploadAvailable()) {
      this.logger.info('PostMediaService', 'upload:native-path', {
        storagePath: options.storagePath,
        fileSize: options.fileSize,
        mimeType: options.mimeType,
      });

      const uploadUrl = await this.createResumableSession({
        storagePath: options.storagePath,
        mimeType: options.mimeType,
        fileSize: options.fileSize,
        signal: options.signal,
      });
      this.logger.info('PostMediaService', 'upload:session-acquired', {
        storagePath: options.storagePath,
        uploadUrlLength: uploadUrl.length,
        elapsedMs: Date.now() - uploadStartedAt,
      });
      if (options.signal?.aborted) throw new Error('Media upload cancelled.');

      let progressCallCount = 0;
      const uploadTask = createUploadTask(
        uploadUrl,
        options.uri,
        {
          httpMethod: 'POST',
          uploadType: FileSystemUploadType.BINARY_CONTENT,
          headers: {
            'X-Goog-Upload-Command': 'upload, finalize',
            'X-Goog-Upload-Offset': '0',
            'Content-Type': options.mimeType,
          },
        },
        (data) => {
          progressCallCount++;
          this.logger.info('PostMediaService', 'upload:native-progress', {
            storagePath: options.storagePath,
            sent: data.totalBytesSent,
            expected: data.totalBytesExpectedToSend,
            callCount: progressCallCount,
          });
          options.onItemProgress?.(data.totalBytesSent, data.totalBytesExpectedToSend || options.fileSize);
        }
      );

      const abortHandler = () => {
        void uploadTask.cancelAsync().catch(() => {});
      };
      options.signal?.addEventListener('abort', abortHandler, { once: true });
      try {
        if (options.signal?.aborted) {
          await uploadTask.cancelAsync().catch(() => {});
          throw new Error('Media upload cancelled.');
        }
        this.logger.info('PostMediaService', 'upload:native-start', {
          storagePath: options.storagePath,
          elapsedMs: Date.now() - uploadStartedAt,
        });
        const result = await uploadTask.uploadAsync();
        this.logger.info('PostMediaService', 'upload:native-complete', {
          storagePath: options.storagePath,
          status: result?.status,
          bodyLength: result?.body?.length,
          progressCallCount,
          elapsedMs: Date.now() - uploadStartedAt,
        });
        if (!result || result.status < 200 || result.status >= 300) {
          throw new Error(`Upload failed (${result?.status ?? 'unknown'}): ${result?.body ?? ''}`);
        }
        options.onItemProgress?.(options.fileSize, options.fileSize);
        return await getDownloadURL(mediaReference);
      } finally {
        options.signal?.removeEventListener('abort', abortHandler);
      }
    }

    this.logger.info('PostMediaService', 'upload:blob-path', {
      storagePath: options.storagePath,
      fileSize: options.fileSize,
      platform: Platform.OS,
      uriScheme: options.uri.split(':')[0],
      nativeAvailable: this.isNativeUploadAvailable(),
    });
    return this.uploadWebOrBlob(options);
  }

  /** Returns true only when the native ExponentFileSystem module supports upload tasks at runtime. */
  private isNativeUploadAvailable(): boolean {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { NativeModules } = require('react-native');
      return Boolean(NativeModules?.ExponentFileSystem?.uploadTaskStartAsync || typeof createUploadTask === 'function');
    } catch {
      return false;
    }
  }

  private async createResumableSession(options: {
    storagePath: string;
    mimeType: string;
    fileSize: number;
    signal?: AbortSignal;
  }): Promise<string> {
    if (options.signal?.aborted) throw new Error('Media upload cancelled.');
    const bucket = storage.app.options.storageBucket || 'ourlime-919f2.appspot.com';
    const appId = storage.app.options.appId || '';
    const token = auth.currentUser ? await auth.currentUser.getIdToken().catch(() => null) : null;
    const url = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o?name=${encodeURIComponent(options.storagePath)}`;
    const headers: Record<string, string> = {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(options.fileSize),
      'X-Goog-Upload-Header-Content-Type': options.mimeType,
      'Content-Type': 'application/json; charset=utf-8',
    };
    if (token) headers['Authorization'] = `Firebase ${token}`;
    if (appId) headers['X-Firebase-GMPID'] = appId;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
      signal: options.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Failed to initiate storage upload session (${response.status}): ${text}`);
    }
    const uploadUrl = response.headers.get('x-goog-upload-url') || response.headers.get('X-Goog-Upload-URL');
    if (!uploadUrl) throw new Error('Storage did not return a resumable upload URL.');
    return uploadUrl;
  }

  private async uploadWebOrBlob(options: {
    uri: string;
    storagePath: string;
    mimeType: string;
    fileSize: number;
    signal?: AbortSignal;
    onItemProgress?: (bytes: number, total?: number) => void;
  }): Promise<string> {
    if (options.signal?.aborted) throw new Error('Media upload cancelled.');
    const blobStartedAt = Date.now();
    this.logger.info('PostMediaService', 'blob:read-start', {
      storagePath: options.storagePath,
      fileSize: options.fileSize,
      uriScheme: options.uri.split(':')[0],
    });
    const blob = await this.readUploadData(options.uri, options.signal);
    const blobSize = blob instanceof Blob ? blob.size : blob.byteLength;
    this.logger.info('PostMediaService', 'blob:read-complete', {
      storagePath: options.storagePath,
      blobSize,
      blobType: blob instanceof Blob ? 'Blob' : 'Uint8Array',
      elapsedMs: Date.now() - blobStartedAt,
    });
    if (options.signal?.aborted) throw new Error('Media upload cancelled.');
    const mediaReference = ref(storage, options.storagePath);
    this.logger.info('PostMediaService', 'blob:upload-start', {
      storagePath: options.storagePath,
      blobSize,
      mimeType: options.mimeType,
    });
    const task = uploadBytesResumable(mediaReference, blob, { contentType: options.mimeType });
    const abortHandler = () => task.cancel();
    options.signal?.addEventListener('abort', abortHandler, { once: true });
    let progressCallCount = 0;
    try {
      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          (snapshot) => {
            progressCallCount++;
            if (progressCallCount <= 5 || progressCallCount % 20 === 0) {
              this.logger.info('PostMediaService', 'blob:upload-progress', {
                storagePath: options.storagePath,
                transferred: snapshot.bytesTransferred,
                total: snapshot.totalBytes,
                state: snapshot.state,
                callCount: progressCallCount,
              });
            }
            options.onItemProgress?.(snapshot.bytesTransferred, snapshot.totalBytes);
          },
          (error: unknown) => {
            this.logger.info('PostMediaService', 'blob:upload-error', {
              storagePath: options.storagePath,
              error: error instanceof Error ? error.message : String(error),
              progressCallCount,
              elapsedMs: Date.now() - blobStartedAt,
            });
            reject(error);
          },
          () => {
            this.logger.info('PostMediaService', 'blob:upload-complete', {
              storagePath: options.storagePath,
              progressCallCount,
              elapsedMs: Date.now() - blobStartedAt,
            });
            resolve();
          }
        );
      });
      return await getDownloadURL(mediaReference);
    } finally {
      options.signal?.removeEventListener('abort', abortHandler);
    }
  }

  private async readUploadData(uri: string, signal?: AbortSignal): Promise<Blob | Uint8Array> {
    if (signal?.aborted) throw new Error('Media upload cancelled.');
    if (Platform.OS !== 'web' && /^(file|content):\/\//i.test(uri)) {
      return new Promise((resolve, reject) => {
        const handleAbort = () => finish(new Error('Media upload cancelled.'));
        const timer = setTimeout(() => finish(new Error('Reading the selected media timed out. Please select it again.')), 30_000);
        let settled = false;
        const finish = (error?: Error, bytes?: Uint8Array) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener('abort', handleAbort);
          if (error) reject(error);
          else if (bytes) resolve(bytes);
        };
        signal?.addEventListener('abort', handleAbort, { once: true });
        void (async () => {
          try {
            const file = new File(uri);
            if (!file.exists) throw new Error('The selected media is no longer available on this device. Please select it again.');
            const bytes = await file.bytes();
            if (!bytes.byteLength) throw new Error('The selected media file is empty. Please select another file.');
            finish(undefined, bytes);
          } catch (error: unknown) {
            finish(error instanceof Error ? error : new Error('Unable to read the selected media. Please select it again.'));
          }
        })();
      });
    }
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const handleAbort = () => xhr.abort();
      const finish = (error?: Error) => {
        signal?.removeEventListener('abort', handleAbort);
        if (error) reject(error);
        else resolve(xhr.response as Blob);
      };
      xhr.onload = function () {
        if ((xhr.status !== 0 && (xhr.status < 200 || xhr.status >= 300)) || !xhr.response?.size) {
          finish(new Error('The selected media could not be read. Please select it again.'));
        } else finish();
      };
      xhr.onerror = function () {
        finish(new TypeError('Failed to read the selected media. Please select it again.'));
      };
      xhr.onabort = () => finish(new Error('Media upload cancelled.'));
      xhr.ontimeout = () => finish(new Error('Reading the selected media timed out. Please try again.'));
      xhr.timeout = 30_000;
      xhr.responseType = 'blob';
      xhr.open('GET', uri, true);
      signal?.addEventListener('abort', handleAbort, { once: true });
      xhr.send(null);
    });
  }

  private async uploadMedia(options: {
    postId: string;
    userId: string;
    item: PostMediaDraft;
    index: number;
    signal?: AbortSignal;
    onItemProgress: (bytes: number, total?: number) => void;
    onStoragePath: (path: string) => void;
    onStage?: (stage: PostUploadStage, index?: number) => void;
  }): Promise<{ media: PostMedia; storagePath: string }> {
    if (options.signal?.aborted) throw new Error('Media upload cancelled.');
    const startedAt = Date.now();
    const context = { draftId: options.postId, index: options.index, mediaType: options.item.type, fileSize: options.item.fileSize, uriScheme: options.item.uri.split(':')[0] };
    this.logger.info('PostMediaService', 'read:start', context);
    options.onStage?.('preparing', options.index);

    let effectiveSize = options.item.fileSize;
    try {
      if (Platform.OS !== 'web' && /^(file|content):\/\//i.test(options.item.uri)) {
        const file = new File(options.item.uri);
        if (!file.exists) throw new Error('The selected media is no longer available on this device. Please select it again.');
        effectiveSize = typeof file.size === 'number' ? file.size : effectiveSize;
        if (!effectiveSize) throw new Error('The selected media file is empty. Please select another file.');
      } else {
        const measuredSize = await this.getFileSize(options.item.uri);
        effectiveSize = typeof measuredSize === 'number' && measuredSize >= 0 ? measuredSize : effectiveSize;
        if (!effectiveSize) throw new Error('The selected media file is empty. Please select another file.');
      }
      this.logger.success('PostMediaService', 'read', { ...context, elapsedMs: Date.now() - startedAt, bytes: effectiveSize });
    } catch (error: unknown) {
      this.logger.error('PostMediaService', 'read', error, { ...context, elapsedMs: Date.now() - startedAt });
      throw error;
    }
    if (options.signal?.aborted) throw new Error('Media upload cancelled.');
    options.onItemProgress(0, effectiveSize);

    const safeFileName = options.item.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `posts/${options.userId}/regular/${options.postId}-${options.index}-${safeFileName}`;
    options.onStoragePath(storagePath);
    this.logger.info('PostMediaService', 'upload:start', context);
    options.onStage?.('uploading', options.index);

    try {
      const typeUrl = await this.uploadMediaItem({
        uri: options.item.uri,
        storagePath,
        mimeType: options.item.mimeType || (options.item.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        fileSize: effectiveSize,
        signal: options.signal,
        onItemProgress: (bytes, total) => options.onItemProgress(bytes, total || effectiveSize),
      });

      let thumbnailUrl: string | undefined = undefined;
      if (options.item.type === 'video') {
        options.onStage?.('cover', options.index);
        try {
          let thumbUri = options.item.thumbnailUri;
          if (!thumbUri) {
            const thumbTime = typeof options.item.trimStartSeconds === 'number'
              ? options.item.trimStartSeconds
              : Math.min(Math.max((options.item.durationSeconds || 5) * 0.2, 0.1), Math.max((options.item.durationSeconds || 5) - 0.05, 0.1));
            thumbUri = await limeThumbnailService.createThumbnailAtTime(
              options.item.uri,
              thumbTime
            );
          }
          if (thumbUri) {
            const thumbStoragePath = `posts/${options.userId}/thumbnails/${options.postId}-${options.index}-thumb.jpg`;
            options.onStoragePath(thumbStoragePath);
            const thumbSize = await this.getFileSize(thumbUri);
            thumbnailUrl = await this.uploadMediaItem({
              uri: thumbUri,
              storagePath: thumbStoragePath,
              mimeType: 'image/jpeg',
              fileSize: thumbSize || 1024,
              signal: options.signal,
            });
          }
        } catch (thumbError) {
          if (isCancellationError(thumbError, options.signal)) throw thumbError;
          this.logger.warn('PostMediaService', 'thumbnail-upload-failed', {
            postId: options.postId,
            error: thumbError instanceof Error ? thumbError.message : String(thumbError),
          });
        }
      }

      if (options.signal?.aborted) throw new Error('Media upload cancelled.');
      this.logger.success('PostMediaService', 'media-upload', { postId: options.postId, index: options.index, storagePath });
      return {
        media: {
          id: `${options.postId}-${options.index}`,
          type: options.item.type,
          typeUrl,
          fileName: options.item.fileName,
          thumbnailUrl,
          displayOrder: options.index,
          trimStartSeconds: options.item.trimStartSeconds,
          trimEndSeconds: options.item.trimEndSeconds,
          durationSeconds: options.item.durationSeconds,
        },
        storagePath,
      };
    } catch (error: unknown) {
      if (isCancellationError(error, options.signal)) {
        this.logger.info('PostMediaService', 'upload:cancelled', { ...context, elapsedMs: Date.now() - startedAt });
      } else {
        this.logger.error('PostMediaService', 'upload', error, { ...context, elapsedMs: Date.now() - startedAt });
      }
      throw error;
    }
  }

  private resolveMimeType(asset: ImagePickerAsset, fileName: string): string {
    if (asset.mimeType) return asset.mimeType.toLowerCase();
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
    return extensionMimeTypes[extension] ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
  }

  private async getFileSize(uri: string): Promise<number> {
    try {
      if (Platform.OS !== 'web' && /^(file|content):\/\//i.test(uri)) return new File(uri).size;
      const response = await fetch(uri);
      const blob = await response.blob();
      return blob.size || 0;
    } catch {
      return 0;
    }
  }
}
