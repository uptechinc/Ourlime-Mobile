import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';

globalThis.__DEV__ = true;
mock.module('react-native', () => ({
  Platform: { OS: 'android', select: (obj) => obj.default ?? obj.android },
  NativeModules: {},
  NativeEventEmitter: class {
    addListener() { return { remove() {} }; }
    removeAllListeners() {}
  },
  TurboModuleRegistry: { get: () => null },
  PixelRatio: { get: () => 2, getFontScale: () => 1, roundToNearestPixel: (n) => n },
  Dimensions: { get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }), addEventListener: () => ({ remove() {} }) },
  StyleSheet: { create: (s) => s, flatten: (s) => s },
  Linking: { canOpenURL: async () => true, openURL: async () => {} },
  LogBox: { ignoreLogs: () => {}, ignoreAllLogs: () => {} },
  AppState: { addEventListener: () => ({ remove() {} }), currentState: 'active' },
  AppRegistry: { registerComponent: () => {}, registerRunnable: () => {} },
  Text: 'Text',
  View: 'View',
  ActivityIndicator: 'ActivityIndicator',
  Appearance: { getColorScheme: () => 'light', addChangeListener: () => ({ remove() {} }) },
  Share: { share: async () => {} },
  Vibration: { vibrate: () => {}, cancel: () => {} },
}));

mock.module('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));

mock.module('./DeepLinkService', () => ({
  DeepLinkService: { getInstance: () => ({}) },
}));

mock.module('./AvatarService', () => ({
  AvatarService: { getInstance: () => ({ resolve: (img) => ({ kind: 'uri', uri: img }), getAvatarUrl: () => 'https://mock/avatar.jpg' }) },
}));

mock.module('./ApiService', () => ({
  ApiService: { getInstance: () => ({ request: async () => ({ success: false, error: 'Post not found' }) }) },
  ApiServiceError: class extends Error {},
}));

mock.module('./AccountLifecycleVisibilityService', () => ({
  accountLifecycleVisibilityService: { filterActiveContent: (items) => items },
}));

const mockFirestoreDocs = [];
const mockBatchSets = [];
const mockBatchCommits = [];
const mockCleanedUpPaths = [];
let mockUploadResult;
let mockUploadError = null;
let mockGetDocHandler = async (docRef) => ({ id: docRef?.id || 'mock-id', exists: () => false, data: () => null });

const uploadMediaBatch = mock(async () => {
  if (mockUploadError) throw mockUploadError;
  return mockUploadResult;
});

const cleanup = mock(async (paths) => {
  mockCleanedUpPaths.push(...paths);
});

mock.module('./PostMediaService', () => ({
  PostMediaService: {
    getInstance: () => ({
      uploadMediaBatch,
      cleanup,
    }),
  },
  isCancellationError: (error, signal) => Boolean(signal?.aborted || error?.name === 'AbortError' || error?.code === 'storage/canceled'),
}));

mock.module('./DiagnosticLogService', () => ({
  DiagnosticLogService: {
    getInstance: () => ({
      info: () => {},
      warn: () => {},
      error: () => {},
      success: () => {},
    }),
  },
}));

const requireVerifiedUser = mock(async () => {});
mock.module('./PostAuthorizationService', () => ({
  postAuthorizationService: { requireVerifiedUser },
}));

mock.module('../firebaseConfig', () => ({
  db: { type: 'mock-db' },
  auth: { currentUser: { uid: 'test-user' } },
  app: {},
  storage: {},
}));

mock.module('firebase/firestore', () => ({
  collection: (_db, name) => ({ path: name }),
  doc: (_db, pathOrCol, id) => {
    const docId = id || ('generated-id-' + Math.random().toString(36).slice(2, 8));
    const basePath = typeof pathOrCol === 'string' ? pathOrCol : pathOrCol?.path || '';
    return {
      id: docId,
      path: basePath ? (basePath + '/' + docId) : docId,
    };
  },
  addDoc: async (col, data) => {
    const docId = 'adddoc-' + Math.random().toString(36).slice(2, 8);
    mockFirestoreDocs.push({ collection: col.path, id: docId, data });
    return { id: docId, ...data };
  },
  writeBatch: () => ({
    set: (docRef, data) => {
      mockBatchSets.push({ docId: docRef.id, data });
    },
    commit: async () => {
      mockBatchCommits.push(true);
    },
  }),
  updateDoc: async () => {},
  serverTimestamp: () => 'SERVER_TIMESTAMP',
  increment: (val) => val,
  getDoc: async (...args) => mockGetDocHandler(...args),
  getDocs: async () => ({ docs: [] }),
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  documentId: () => ({}),
  getCountFromServer: async () => ({ data: () => ({ count: 0 }) }),
  deleteDoc: async () => {},
  arrayUnion: (...items) => items,
  arrayRemove: (...items) => items,
  Timestamp: { now: () => new Date() },
}));

const { PostService } = await import('./PostService.ts');
const service = PostService.getInstance();

beforeEach(() => {
  mockFirestoreDocs.length = 0;
  mockBatchSets.length = 0;
  mockBatchCommits.length = 0;
  mockCleanedUpPaths.length = 0;
  mockUploadError = null;
  mockGetDocHandler = async (docRef) => ({ id: docRef?.id || 'mock-id', exists: () => false, data: () => null });
  uploadMediaBatch.mockClear();
  cleanup.mockClear();
  requireVerifiedUser.mockClear();

  mockUploadResult = {
    media: [
      {
        id: 'media-1',
        type: 'video',
        typeUrl: 'https://storage.googleapis.com/test-bucket/video.mp4',
        fileName: 'video.mp4',
        thumbnailUrl: 'https://storage.googleapis.com/test-bucket/thumb.jpg',
        displayOrder: 0,
        trimStartSeconds: 10,
        trimEndSeconds: 70,
        durationSeconds: 60,
      },
    ],
    storagePaths: ['posts/test-user/regular/video.mp4', 'posts/test-user/thumbnails/thumb.jpg'],
  };
});

test('createPost successfully creates regular post with trimmed video in Firestore', async () => {
  const result = await service.createPost({
    userId: 'user-123',
    user: { id: 'user-123', firstName: 'Alice', lastName: 'Smith', userName: 'alice' },
    type: 'regular',
    caption: 'My trimmed clip',
    description: 'Check this out',
    visibility: 'public',
    hashtags: ['fun', 'video'],
    mentions: ['bob'],
    friendReferences: ['@bob'],
    media: [
      {
        uri: 'file:///local/video.mp4',
        type: 'video',
        fileName: 'video.mp4',
        durationSeconds: 180,
        trimStartSeconds: 10,
        trimEndSeconds: 70,
      },
    ],
  });

  expect(uploadMediaBatch).toHaveBeenCalledTimes(1);
  expect(mockBatchCommits.length).toBe(1);

  // Check feedPosts batch entry
  const postBatch = mockBatchSets.find((entry) => entry.data.type === 'regular');
  expect(postBatch).toBeDefined();
  expect(postBatch.data.caption).toBe('My trimmed clip');
  expect(postBatch.data.userId).toBe('user-123');

  // Check likesCount batch entry
  const likesBatch = mockBatchSets.find((entry) => entry.data.likeCount === 0);
  expect(likesBatch).toBeDefined();

  // Check feedsPostSummary document
  const summaryDoc = mockFirestoreDocs.find((doc) => doc.collection === 'feedsPostSummary');
  expect(summaryDoc).toBeDefined();
  expect(summaryDoc.data.type).toBe('video');
  expect(summaryDoc.data.trimStartSeconds).toBe(10);
  expect(summaryDoc.data.trimEndSeconds).toBe(70);
  expect(summaryDoc.data.durationSeconds).toBe(60);
  expect(summaryDoc.data.typeUrl).toBe('https://storage.googleapis.com/test-bucket/video.mp4');

  // Check returned PostItem
  expect(result.id).toBeTruthy();
  expect(result.caption).toBe('My trimmed clip');
  expect(result.media.length).toBe(1);
  expect(result.media[0].trimStartSeconds).toBe(10);
  expect(result.media[0].trimEndSeconds).toBe(70);
  expect(result.media[0].durationSeconds).toBe(60);
});

test('createPost verifies permission before uploading media', async () => {
  requireVerifiedUser.mockRejectedValueOnce(new Error('You must verify your account before you can create a post.'));
  await expect(service.createPost({
    userId: 'unverified-user',
    user: { id: 'unverified-user', firstName: 'Unverified', lastName: 'User', userName: 'unverified' },
    type: 'regular', caption: 'Blocked', description: '', visibility: 'public', hashtags: [], mentions: [], friendReferences: [], media: [],
  })).rejects.toThrow('You must verify your account before you can create a post.');
  expect(uploadMediaBatch).not.toHaveBeenCalled();
});

test('createPost creates community post with trimmed video', async () => {
  const result = await service.createPost({
    userId: 'user-123',
    user: { id: 'user-123', firstName: 'Alice', lastName: 'Smith', userName: 'alice' },
    communityId: 'community-abc',
    communityName: 'Mobile Devs',
    type: 'regular',
    caption: 'Community clip',
    description: 'Community clip desc',
    visibility: 'public',
    hashtags: ['community'],
    mentions: [],
    friendReferences: [],
    media: [
      {
        uri: 'file:///local/video.mp4',
        type: 'video',
        fileName: 'video.mp4',
        durationSeconds: 180,
        trimStartSeconds: 5,
        trimEndSeconds: 65,
      },
    ],
  });

  expect(result.origin).toBe('community');
  expect(result.communityId).toBe('community-abc');

  const communityPostDoc = mockFirestoreDocs.find((d) => d.collection === 'communityVariantDetails');
  expect(communityPostDoc).toBeDefined();
  expect(communityPostDoc.data.communityVariantId).toBe('community-abc');

  const communitySummaryDoc = mockFirestoreDocs.find((d) => d.collection === 'communityVariantDetailsSummary');
  expect(communitySummaryDoc).toBeDefined();
  expect(communitySummaryDoc.data.trimStartSeconds).toBe(10);
  expect(communitySummaryDoc.data.trimEndSeconds).toBe(70);
  expect(communitySummaryDoc.data.durationSeconds).toBe(60);
});

test('createPost does not autofill description with caption for community post when description is empty', async () => {
  mockUploadResult = { media: [], storagePaths: [] };

  const result = await service.createPost({
    userId: 'user-123',
    user: { id: 'user-123', firstName: 'Alice', lastName: 'Smith', userName: 'alice' },
    communityId: 'community-abc',
    type: 'regular',
    caption: 'My Caption Only',
    description: '',
    visibility: 'public',
    hashtags: [],
    mentions: [],
    friendReferences: [],
    media: [],
  });

  expect(result.description).toBe('');
  const communityPostDoc = mockFirestoreDocs.find((d) => d.data.title === 'My Caption Only');
  expect(communityPostDoc).toBeDefined();
  expect(communityPostDoc.data.description).toBe('');
});

test('createPost creates poll post with options and duration', async () => {
  mockUploadResult = { media: [], storagePaths: [] };

  const result = await service.createPost({
    userId: 'user-123',
    user: { id: 'user-123', firstName: 'Alice', lastName: 'Smith', userName: 'alice' },
    type: 'poll',
    caption: 'What is your favorite color?',
    description: '',
    visibility: 'public',
    hashtags: [],
    mentions: [],
    friendReferences: [],
    media: [],
    pollDuration: 48,
    pollOptions: [
      { id: '1', text: 'Green', votes: 0 },
      { id: '2', text: 'Blue', votes: 0 },
    ],
  });

  const pollBatch = mockBatchSets.find((entry) => entry.data.type === 'poll');
  expect(pollBatch).toBeDefined();
  expect(pollBatch.data.pollDuration).toBe(48);
  expect(pollBatch.data.pollOptions).toEqual([
    { id: '1', text: 'Green' },
    { id: '2', text: 'Blue' },
  ]);
  expect(pollBatch.data.pollEndTime).toBeTruthy();
  expect(result.type).toBe('poll');
});

test('createPost cleans up uploaded files if aborted before publication', async () => {
  const abortController = new AbortController();
  abortController.abort();

  expect(
    service.createPost({
      userId: 'user-123',
      user: { id: 'user-123', firstName: 'Alice', lastName: 'Smith', userName: 'alice' },
      type: 'regular',
      caption: 'Cancelled upload',
      description: '',
      visibility: 'public',
      hashtags: [],
      mentions: [],
      friendReferences: [],
      media: [],
      signal: abortController.signal,
    })
  ).rejects.toThrow('Post submission cancelled.');

  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(mockCleanedUpPaths).toContain('posts/test-user/regular/video.mp4');
});

test('fetchPost throws "This post was removed by an admin." when post has admin moderation flag', async () => {
  mockGetDocHandler = async () => ({
    exists: () => true,
    data: () => ({
      userId: 'user-1',
      deletionSource: 'admin_moderation',
      status: 'admin_deleted',
      caption: 'Moderated post',
    }),
  });

  expect(service.fetchPost('post-mod-1')).rejects.toThrow('This post was removed by an admin.');
});

test('fetchPost throws "This post was deleted." when post is marked deleted', async () => {
  mockGetDocHandler = async () => ({
    exists: () => true,
    data: () => ({
      userId: 'user-1',
      isDeleted: true,
      caption: 'Deleted post',
    }),
  });

  expect(service.fetchPost('post-del-1')).rejects.toThrow('This post was deleted.');
});

test('fetchPost loads community post from communityVariantDetails', async () => {
  mockGetDocHandler = async (docRef) => {
    if (docRef.path?.includes('feedPosts')) {
      return { exists: () => false, data: () => null };
    }
    if (docRef.path?.includes('communityVariantDetails')) {
      return {
        exists: () => true,
        id: 'comm-post-1',
        data: () => ({
          userId: 'user-comm',
          communityVariantId: 'comm-123',
          communityName: 'Dev Club',
          caption: 'Community Discussion',
          description: '',
          visibility: 'public',
          createdAt: '2026-09-05T00:00:00Z',
        }),
      };
    }
    return { id: docRef?.id || 'mock-id', exists: () => false, data: () => null };
  };

  const post = await service.fetchPost('comm-post-1');
  expect(post).toBeDefined();
  expect(post.id).toBe('comm-post-1');
  expect(post.origin).toBe('community');
  expect(post.communityId).toBe('comm-123');
  expect(post.caption).toBe('Community Discussion');
});
