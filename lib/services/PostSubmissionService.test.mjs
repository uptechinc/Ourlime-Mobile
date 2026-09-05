import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';

let userId = 'viewer';
let authListener;
let tick;
const store = { submission: null };
const createPost = mock();
const publishCreated = mock(async () => {});
const prepend = mock(async () => {});
const adjustOwnStats = mock(async () => {});
const mentions = mock(async () => {});
const createEvent = mock(async () => 'event-id');
mock.module('./AuthService', () => ({ AuthService: { getInstance: () => ({ getCurrentUser: () => userId ? { uid: userId } : null, subscribeToAuthState: (listener) => { authListener = listener; return () => {}; } }) } }));
mock.module('./PostAuthorizationService', () => ({ postAuthorizationService: { canCreatePost: (user) => user?.verificationStatus === 'verified' } }));
mock.module('./PostService', () => ({ PostService: { getInstance: () => ({ createPost }) } }));
mock.module('./EventService', () => ({ EventService: { getInstance: () => ({ createEvent }) } }));
mock.module('./FeedResourceService', () => ({ FeedResourceService: { getInstance: () => ({ publishCreated }) } }));
mock.module('./CommunityFeedResourceService', () => ({ CommunityFeedResourceService: { getInstance: () => ({ prepend }) } }));
mock.module('./ProfileResourceService', () => ({ ProfileResourceService: { getInstance: () => ({ adjustOwnStats }) } }));
mock.module('./dispatchMentionNotifications', () => ({ dispatchMentionNotifications: mentions }));
mock.module('./PostMediaService', () => ({ isCancellationError: (error, signal) => Boolean(signal?.aborted || error?.name === 'AbortError' || error?.code === 'storage/canceled') }));
mock.module('../store/usePostSubmissionStore', () => ({ usePostSubmissionStore: { getState: () => store, setState: (update) => Object.assign(store, update) } }));
const { postSubmissionService: service } = await import('./PostSubmissionService.ts');
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const draft = () => ({ post: { userId: 'viewer', user: { id: 'viewer', firstName: 'Test', userName: 'test', verificationStatus: 'verified' }, type: 'regular', caption: 'Caption', description: '', visibility: 'public', media: [{ uri: 'file:///video.mp4', thumbnailUri: 'file:///cover.jpg', fileSize: 100, type: 'video', fileName: 'video.mp4' }], hashtags: ['test'], mentions: [], friendReferences: [] } });

test('unverified users cannot start a post submission', () => {
  const input = draft();
  input.post.user.verificationStatus = 'pending';
  expect(() => service.start(input)).toThrow('You must verify your account before you can create a post.');
  expect(createPost).not.toHaveBeenCalled();
});
const result = () => ({ ...draft().post, id: 'published-id' });
let intervalSpy;
let logSpy;
let errorSpy;
beforeEach(() => {
  userId = 'viewer';
  createPost.mockReset(); createEvent.mockClear(); publishCreated.mockReset(); publishCreated.mockImplementation(async () => {});
  prepend.mockClear(); adjustOwnStats.mockClear(); mentions.mockClear();
  intervalSpy = spyOn(globalThis, 'setInterval').mockImplementation((callback) => { tick = callback; return 123; });
  logSpy = spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => {
  authListener?.(null);
  await flush();
  service.dismiss();
  intervalSpy.mockRestore(); logSpy.mockRestore(); errorSpy.mockRestore();
});

test('submission returns immediately, snapshots the draft, and completes without a mounted composer', async () => {
  let resolve;
  createPost.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const input = draft();
  expect(service.start(input)).toBeUndefined();
  input.post.caption = 'Edited'; input.post.media[0].uri = 'file:///replacement.mp4';
  expect(store.submission.status).toBe('running');
  expect(createPost.mock.calls[0][0].caption).toBe('Caption');
  expect(createPost.mock.calls[0][0].media[0].uri).toBe('file:///video.mp4');
  resolve(result()); await flush();
  expect(store.submission.status).toBe('completed');
  expect(publishCreated).toHaveBeenCalledTimes(1); expect(adjustOwnStats).toHaveBeenCalledTimes(1); expect(mentions).toHaveBeenCalledTimes(1);
});
test('real progress and processing phases remain distinct', async () => {
  createPost.mockImplementation(async (input) => {
    input.onStage('uploading', 0);
    input.onUploadProgress({ completedBytes: 60, totalBytes: 100, percentage: 60 });
    expect(store.submission.percentage).toBe(60); expect(service.describe(store.submission)).toContain('60% uploaded');
    input.onStage('cover', 0); expect(store.submission.message).toBe('Preparing video cover…');
    input.onStage('publishing'); expect(store.submission.canCancel).toBe(false);
    return result();
  });
  service.start(draft()); await flush(); expect(store.submission.status).toBe('completed');
});
test('duplicate taps cannot launch two uploads', async () => {
  createPost.mockImplementation((input) => new Promise((_resolve, reject) => input.signal.addEventListener('abort', () => reject(Error('Cancelled')))));
  service.start(draft());
  expect(() => service.start(draft())).toThrow('already uploading');
  expect(createPost).toHaveBeenCalledTimes(1);
});
test('cancel remains available during media transfer, not after publishing begins', async () => {
  createPost.mockImplementation((input) => new Promise((_resolve, reject) => input.signal.addEventListener('abort', () => reject(Error('Cancelled')))));
  service.start(draft()); service.cancel(); await flush();
  expect(store.submission.status).toBe('cancelled'); expect(publishCreated).not.toHaveBeenCalled();
});
test('failed uploads retain their draft and retry safely', async () => {
  createPost.mockRejectedValueOnce(Error('Upload failed')).mockResolvedValueOnce(result());
  service.start(draft()); await flush();
  expect(store.submission.canRetry).toBe(true);
  service.retry(); await flush();
  expect(createPost).toHaveBeenCalledTimes(2); expect(store.submission.status).toBe('completed');
});
test('publication timeout allows user retry while keeping cancel disabled', async () => {
  createPost.mockImplementation(async (input) => { input.onStage('publishing'); service.cancel(); expect(input.signal.aborted).toBe(false); throw Error('Network timed out'); });
  service.start(draft()); await flush();
  expect(store.submission.canCancel).toBe(false); expect(store.submission.canRetry).toBe(true); expect(store.submission.message).toContain('check your feed');
  createPost.mockResolvedValueOnce(result());
  service.retry(); await flush(); expect(createPost).toHaveBeenCalledTimes(2); expect(store.submission.status).toBe('completed');
});
test('cache failure after success does not report publication failure', async () => {
  createPost.mockResolvedValue(result()); publishCreated.mockRejectedValue(Error('Cache unavailable'));
  service.start(draft()); await flush();
  expect(store.submission.status).toBe('completed'); expect(store.submission.canRetry).toBe(false);
});
test('late progress callbacks cannot reopen controls after completion', async () => {
  createPost.mockResolvedValue(result()); service.start(draft()); await flush();
  createPost.mock.calls[0][0].onStage('uploading', 0);
  createPost.mock.calls[0][0].onUploadProgress({ completedBytes: 1, totalBytes: 100, percentage: 1 });
  tick();
  expect(store.submission.status).toBe('completed'); expect(store.submission.canCancel).toBe(false); expect(store.submission.percentage).toBe(100);
});
test('logout clears private task state and ignores a late upload result', async () => {
  let resolve;
  createPost.mockImplementation(() => new Promise((done) => { resolve = done; }));
  service.start(draft()); userId = 'different-viewer'; authListener({ uid: userId });
  expect(store.submission).toBeNull(); expect(createPost.mock.calls[0][0].signal.aborted).toBe(true);
  resolve(result()); await flush(); expect(publishCreated).not.toHaveBeenCalled();
});
test('slow progress warning resets only when bytes actually advance', async () => {
  const clock = spyOn(Date, 'now').mockReturnValue(1000);
  createPost.mockImplementation((input) => new Promise((_resolve, reject) => input.signal.addEventListener('abort', () => reject(Error('Cancelled')))));
  try {
    service.start(draft()); clock.mockReturnValue(32_000); tick();
    expect(store.submission.isSlow).toBe(true); expect(store.submission.elapsedSeconds).toBe(31);
    createPost.mock.calls[0][0].onUploadProgress({ completedBytes: 0, totalBytes: 100, percentage: 0 });
    expect(store.submission.isSlow).toBe(true);
    createPost.mock.calls[0][0].onUploadProgress({ completedBytes: 20, totalBytes: 100, percentage: 20 });
    expect(store.submission.isSlow).toBe(false);
  } finally { clock.mockRestore(); }
});
test('community completion updates the community resource even when its screen is gone', async () => {
  const input = draft(); input.post.communityId = 'community-id';
  createPost.mockResolvedValue({ ...result(), communityId: 'community-id' });
  service.start(input); await flush();
  expect(prepend).toHaveBeenCalledTimes(1); expect(adjustOwnStats).not.toHaveBeenCalled();
});
test('confirmed event creation is not duplicated when the subsequent media upload retries', async () => {
  const input = draft(); input.event = { title: 'Event', user: input.post.user };
  createPost.mockRejectedValueOnce(Error('Media failed')).mockResolvedValueOnce(result());
  service.start(input); await flush(); expect(store.submission.canRetry).toBe(true);
  service.retry(); await flush(); expect(createEvent).toHaveBeenCalledTimes(1); expect(createPost).toHaveBeenCalledTimes(2);
});
