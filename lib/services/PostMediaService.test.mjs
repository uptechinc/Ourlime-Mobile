import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';

const platform = { OS: 'android' };
const files = new Map();
const reads = [];
const uploads = [];
const deleted = [];
let failedUpload = false;
mock.module('react-native', () => ({ Platform: platform }));
mock.module('expo-file-system', () => ({ File: class {
  constructor(uri) { this.uri = uri; }
  get exists() {
    if (!reads.includes(this.uri)) reads.push(this.uri);
    return files.has(this.uri);
  }
  get size() {
    if (!reads.includes(this.uri)) reads.push(this.uri);
    const val = files.get(this.uri);
    if (typeof val === 'function') return 3;
    return val?.byteLength ?? 0;
  }
  async bytes() {
    if (!reads.includes(this.uri)) reads.push(this.uri);
    const value = files.get(this.uri);
    return typeof value === 'function' ? value() : value;
  }
} }));
mock.module('expo-file-system/legacy', () => ({
  FileSystemUploadType: { BINARY_CONTENT: 1 },
  createUploadTask: (url, fileUri, options, onProgress) => {
    let cancelReject;
    return {
      uploadAsync: async () => {
        if (failedUpload) {
          const err = new Error('Upload denied');
          err.code = 'storage/unauthorized';
          throw err;
        }
        const fileVal = files.get(fileUri);
        let resolved = fileVal;
        if (typeof fileVal === 'function') {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Reading the selected media timed out. Please select it again.')), 30_000);
          });
          const abortPromise = new Promise((_, reject) => { cancelReject = reject; });
          resolved = await Promise.race([fileVal(), timeoutPromise, abortPromise]);
        }
        const fileSize = resolved?.byteLength ?? (typeof fileVal === 'function' ? 3 : 0);
        onProgress?.({ totalBytesSent: fileSize, totalBytesExpectedToSend: fileSize });
        const match = url.match(/o\?name=([^&]+)/);
        const storagePath = match ? decodeURIComponent(match[1]) : url;
        uploads.push({ path: storagePath, uri: fileUri, data: resolved || new Uint8Array([1, 2, 3]), options });
        return { status: 200, body: '{}' };
      },
      cancelAsync: async () => {
        cancelReject?.(new Error('Media upload cancelled.'));
      },
    };
  },
}));
mock.module('expo-image-manipulator', () => ({ manipulateAsync: mock(), SaveFormat: { JPEG: 'jpeg' } }));
mock.module('../firebaseConfig', () => ({
  storage: { app: { options: { storageBucket: 'ourlime-919f2.appspot.com', appId: 'test-app' } } },
  auth: { currentUser: null },
}));
mock.module('./LimeThumbnailService', () => ({ limeThumbnailService: { createThumbnail: async () => 'file:///cover.jpg', createThumbnailAtTime: async () => 'file:///cover.jpg' } }));
mock.module('firebase/storage', () => ({
  ref: (_storage, path) => ({ fullPath: path }),
  getDownloadURL: async (reference) => `https://storage.test/${reference.fullPath}`,
  deleteObject: async (reference) => { deleted.push(reference.fullPath); },
  uploadBytesResumable: (reference, data) => {
    uploads.push({ path: reference.fullPath, data });
    return {
      cancel() {},
      on(_event, progress, reject, resolve) {
        progress?.({ bytesTransferred: data.byteLength ?? data.size });
        queueMicrotask(() => failedUpload ? reject(Object.assign(new Error('Upload denied'), { code: 'storage/unauthorized' })) : resolve());
      },
    };
  },
}));
const { PostMediaService } = await import('./PostMediaService.ts');
const { diagnosticLogService } = await import('./DiagnosticLogService.ts');
const service = PostMediaService.getInstance();
const originalXHR = globalThis.XMLHttpRequest;
const originalFetch = globalThis.fetch;
let consoleError;
let consoleLog;
let consoleWarn;
beforeEach(() => {
  platform.OS = 'android'; files.clear(); reads.length = 0; uploads.length = 0; deleted.length = 0; failedUpload = false;
  consoleError = spyOn(console, 'error').mockImplementation(() => {});
  consoleLog = spyOn(console, 'log').mockImplementation(() => {});
  consoleWarn = spyOn(console, 'warn').mockImplementation(() => {});
  globalThis.XMLHttpRequest = class { constructor() { throw Error('Native files must not use XHR'); } };
  globalThis.fetch = async (url) => {
    return new Response('{}', {
      status: 200,
      headers: { 'x-goog-upload-url': String(url) },
    });
  };
});
afterEach(() => {
  consoleError.mockRestore();
  consoleLog.mockRestore();
  consoleWarn.mockRestore();
  globalThis.XMLHttpRequest = originalXHR;
  globalThis.fetch = originalFetch;
});
const draft = (uri, type = 'video') => ({ uri, type, fileName: type === 'video' ? 'video.mp4' : 'image.jpg', fileSize: 3, mimeType: type === 'video' ? 'video/mp4' : 'image/jpeg', durationSeconds: 24 });
const batch = (media, signal) => service.uploadMediaBatch({ postId: 'draft-test', userId: 'user-test', media, signal });

describe('Post media file reads and upload diagnostics', () => {
  test('reads encoded Expo Go paths unchanged and uploads bytes plus persisted cover', async () => {
    const uri = 'file:///cache/ExperienceData/%2540a-hazzard%252Fourlime/ImagePicker/video.mp4';
    files.set(uri, new Uint8Array([1, 2, 3])); files.set('file:///cover.jpg', new Uint8Array([4, 5]));
    const result = await batch([draft(uri)]);
    expect(reads).toEqual([uri, 'file:///cover.jpg']);
    expect(uploads[0].data).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.media[0].thumbnailUrl).toContain('/thumbnails/');
    expect(result.storagePaths).toHaveLength(2);
    expect(result.media[0].displayOrder).toBe(0);
  });
  test('reads Android content URIs without decoding or networking', async () => {
    files.set('content://picker/image', new Uint8Array([1]));
    await batch([draft('content://picker/image', 'image')]);
    expect(reads).toEqual(['content://picker/image']);
  });
  test('reports real byte totals when the picker omits file size, with separate cover processing', async () => {
    files.set('file:///video.mp4', new Uint8Array([1, 2, 3])); files.set('file:///cover.jpg', new Uint8Array([4]));
    const phases = []; const progress = [];
    await service.uploadMediaBatch({ postId: 'draft-stage', userId: 'viewer', media: [{ ...draft('file:///video.mp4'), fileSize: undefined }], onStage: (stage) => phases.push(stage), onProgress: (value) => progress.push(value) });
    expect(phases).toEqual(['preparing', 'uploading', 'cover']);
    expect(progress.at(-1)).toEqual({ completedBytes: 3, totalBytes: 3, percentage: 100 });
  });
  test('missing files fail before upload with actionable details in one log argument', async () => {
    await expect(batch([draft('file:///missing.mp4')])).rejects.toThrow('Please select it again');
    expect(uploads).toHaveLength(0);
    const args = consoleError.mock.calls[0];
    expect(args).toHaveLength(1);
    expect(args[0]).toContain('"draftId":"draft-test"');
    expect(args[0]).toContain('[read:error]');
    expect(args[0]).toContain('no longer available');
    expect(args[0]).not.toContain('file:///');
  });
  test('rejects empty files', async () => {
    files.set('file:///empty.mp4', new Uint8Array());
    await expect(batch([draft('file:///empty.mp4')])).rejects.toThrow('empty');
    expect(uploads).toHaveLength(0);
  });
  test('cancels pending native reads and ignores their late completion', async () => {
    let finish;
    files.set('file:///slow.mp4', () => new Promise((resolve) => { finish = resolve; }));
    const controller = new AbortController();
    const result = batch([draft('file:///slow.mp4')], controller.signal);
    queueMicrotask(() => controller.abort());
    await expect(result).rejects.toThrow('cancelled');
    finish?.(new Uint8Array([1]));
    await Promise.resolve();
    expect(uploads).toHaveLength(0);
    expect(consoleError).not.toHaveBeenCalled();
  });
  test('times out stuck native reads', async () => {
    const timer = spyOn(globalThis, 'setTimeout').mockImplementation((callback) => { queueMicrotask(callback); return 0; });
    try {
      files.set('file:///stuck.mp4', () => new Promise(() => {}));
      await expect(batch([draft('file:///stuck.mp4')])).rejects.toThrow('timed out');
      expect(uploads).toHaveLength(0);
    } finally { timer.mockRestore(); }
  });
  test('serial batch failure cleans already uploaded media and covers', async () => {
    files.set('file:///one.mp4', new Uint8Array([1])); files.set('file:///cover.jpg', new Uint8Array([2]));
    await expect(batch([draft('file:///one.mp4'), draft('file:///missing.mp4')])).rejects.toThrow('no longer available');
    expect(uploads).toHaveLength(2);
    expect(deleted).toEqual(uploads.map((upload) => upload.path));
  });
  test('logs storage rejection code and cleans the attempted object', async () => {
    failedUpload = true; files.set('file:///image.jpg', new Uint8Array([1]));
    await expect(batch([draft('file:///image.jpg', 'image')])).rejects.toThrow('Upload denied');
    expect(consoleError.mock.calls[0][0]).toContain('storage/unauthorized');
    expect(deleted).toHaveLength(1);
  });
  test('browser uploads retain Blob support', async () => {
    platform.OS = 'web';
    globalThis.XMLHttpRequest = class {
      status = 200; response = new Blob(['image']);
      open() {} send() { queueMicrotask(() => this.onload()); } abort() { this.onabort?.(); }
    };
    await batch([draft('blob:browser-image', 'image')]);
    expect(uploads[0].data).toBeInstanceOf(Blob);
  });
  test('diagnostics retain Error and plain-object fields, redact secrets, handle cycles', () => {
    const details = { draftId: 'draft-test', token: 'private-token' }; details.self = details;
    diagnosticLogService.error('PostService', 'create', { code: 'storage/test', message: 'Cannot read file:///private/path.mp4', stack: 'readUploadData' }, details);
    const message = consoleError.mock.calls[0][0];
    expect(message).toContain('storage/test'); expect(message).toContain('readUploadData');
    expect(message).toContain('[circular]'); expect(message).not.toContain('private-token'); expect(message).not.toContain('/private/path');
  });
  test('routes videos > 120s to videosToTrim without rejection errors', async () => {
    const longVideoAsset = { uri: 'file:///long.mp4', type: 'video', fileName: 'long.mp4', fileSize: 50 * 1024 * 1024, duration: 180 * 1000 };
    const shortVideoAsset = { uri: 'file:///short.mp4', type: 'video', fileName: 'short.mp4', fileSize: 10 * 1024 * 1024, duration: 45 * 1000 };
    const result = await service.validateSelection([longVideoAsset, shortVideoAsset], 0);
    expect(result.errors).toHaveLength(0);
    expect(result.videosToTrim).toHaveLength(1);
    expect(result.videosToTrim[0].fileName).toBe('long.mp4');
    expect(result.videosToTrim[0].durationSeconds).toBe(180);
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0].fileName).toBe('short.mp4');
    expect(result.videos[0].durationSeconds).toBe(45);
  });
});
