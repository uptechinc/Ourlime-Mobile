import { beforeEach, describe, expect, mock, test } from 'bun:test';

const auth = { currentUser: { uid: 'user-1' } };
let callableResponse = {};
let callableError = null;
const requests = [];

// The same exports as the other service tests' mock, so the files can run together.
mock.module('@/lib/firebaseConfig', () => ({ app: {}, auth, db: {}, storage: {} }));
mock.module('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: () => async (request) => {
    requests.push(request);
    if (callableError) throw callableError;
    return { data: callableResponse };
  },
}));
mock.module('./NativeSessionService', () => ({ nativeSessionService: { assertOwner: () => undefined, ensure: async () => undefined } }));

const { courseMediaLinkService, isReusableLink, isStorageDownloadUrl, LINK_RENEW_MARGIN_MS } = await import('./CourseMediaLinkService.ts');

const stored = 'https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/courseFiles%2Fc1%2Ft%2Fclip.mp4?alt=media&token=permanent';
const later = () => new Date(Date.now() + 15 * 60 * 1000).toISOString();

beforeEach(() => {
  auth.currentUser = { uid: 'user-1' };
  callableResponse = {};
  callableError = null;
  requests.length = 0;
});

describe('CourseMediaLinkService', () => {
  test('only Firebase Storage links are exchanged; external links open as they are', async () => {
    expect(isStorageDownloadUrl(stored)).toBe(true);
    expect(isStorageDownloadUrl('https://www.youtube.com/watch?v=abc')).toBe(false);
    expect(await courseMediaLinkService.openableUrl({ kind: 'lesson', lessonId: 'external' }, 'https://www.youtube.com/watch?v=abc')).toBe('https://www.youtube.com/watch?v=abc');
    expect(requests.length).toBe(0);
  });

  test('asks the server for a signed link (media_link) and reuses it until shortly before it expires', async () => {
    callableResponse = { url: 'https://signed.example/clip', expiresAt: later(), signed: true, name: 'clip' };
    expect(await courseMediaLinkService.openableUrl({ kind: 'lesson', lessonId: 'l1' }, stored)).toBe('https://signed.example/clip');
    expect(requests[0]).toEqual({ action: 'media_link', kind: 'lesson', lessonId: 'l1' });
    expect(await courseMediaLinkService.openableUrl({ kind: 'lesson', lessonId: 'l1' }, stored)).toBe('https://signed.example/clip');
    expect(requests.length).toBe(1);
    // Another account on the same phone gets its own access check.
    auth.currentUser = { uid: 'user-2' };
    await courseMediaLinkService.openableUrl({ kind: 'lesson', lessonId: 'l1' }, stored);
    expect(requests.length).toBe(2);
  });

  test('while stored links still work, a refused or failed exchange falls back to the stored link', async () => {
    callableError = Object.assign(new Error('permission-denied'), { code: 'functions/permission-denied' });
    expect(await courseMediaLinkService.openableUrl({ kind: 'submission_file', submissionId: 's1', index: 0 }, stored)).toBe(stored);
    auth.currentUser = null;
    expect(await courseMediaLinkService.openableUrl({ kind: 'resource', resourceId: 'r1' }, stored)).toBe(stored);
  });

  test('cached links are renewed a minute before they expire', () => {
    const now = Date.parse('2026-11-24T12:00:00Z');
    expect(isReusableLink('2026-11-24T12:15:00.000Z', now)).toBe(true);
    expect(isReusableLink(new Date(now + LINK_RENEW_MARGIN_MS).toISOString(), now)).toBe(false);
    expect(isReusableLink(null, now)).toBe(false);
  });
});
