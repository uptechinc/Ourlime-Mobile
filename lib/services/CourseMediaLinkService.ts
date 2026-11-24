import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '@/lib/firebaseConfig';
import { nativeSessionService } from './NativeSessionService';
import type { CourseMediaLink, CourseMediaRequest } from '@/lib/types/course';

/** A cached signed link is asked for again this long before it expires, so it never runs out as it is opened. */
export const LINK_RENEW_MARGIN_MS = 60_000;

/** A Firebase Storage download link, which the server exchanges for a signed one. Anything else opens as it is. */
export function isStorageDownloadUrl(url: string): boolean {
  return /^https:\/\/firebasestorage\.googleapis\.com\//.test(url.trim());
}

/** Whether a cached signed link (its ISO expiry) can still be handed out at `now`. */
export function isReusableLink(expiresAt: string | null, now: number): boolean {
  if (!expiresAt) return false;
  const expires = Date.parse(expiresAt);
  return Number.isFinite(expires) && expires - LINK_RENEW_MARGIN_MS > now;
}

type MediaLinkRequest = { action: 'media_link' } & CourseMediaRequest;

/**
 * Short-lived signed links for course files (manageLearning media_link): lesson video and files, resources, assignment
 * attachments and hand-ins. The server checks the reader first (enrolled learner, the course's instructor, an
 * administrator; for a hand-in, the learner who handed it in) instead of trusting whoever holds a download link.
 *
 * While the stored download links still work (until their tokens are removed, after this update has reached members),
 * a failed exchange falls back to the stored link so lessons keep opening; external links are returned as they are.
 */
export class CourseMediaLinkService {
  private static instance: CourseMediaLinkService;
  private readonly links = new Map<string, CourseMediaLink>();
  private constructor() {}

  public static getInstance(): CourseMediaLinkService {
    if (!CourseMediaLinkService.instance) CourseMediaLinkService.instance = new CourseMediaLinkService();
    return CourseMediaLinkService.instance;
  }

  public async openableUrl(request: CourseMediaRequest, storedUrl: string): Promise<string> {
    if (!storedUrl || !isStorageDownloadUrl(storedUrl)) return storedUrl;
    const userId = auth.currentUser?.uid;
    if (!userId) return storedUrl;
    // Links are cached per account: another account signed in on this phone gets its own check.
    const key = `${userId}:${JSON.stringify(request)}`;
    const cached = this.links.get(key);
    if (cached && isReusableLink(cached.expiresAt, Date.now())) return cached.url;
    try {
      await nativeSessionService.ensure(userId);
      const result = await httpsCallable<MediaLinkRequest, CourseMediaLink>(getFunctions(app), 'manageLearning')({ action: 'media_link', ...request });
      nativeSessionService.assertOwner(userId);
      const link = result.data;
      if (link.signed) this.links.set(key, link);
      return typeof link.url === 'string' && link.url ? link.url : storedUrl;
    } catch (error: unknown) {
      console.warn('[CourseMediaLinkService.openableUrl] Error:', error instanceof Error ? error.message : 'Unknown error');
      return storedUrl;
    }
  }
}

export const courseMediaLinkService = CourseMediaLinkService.getInstance();
