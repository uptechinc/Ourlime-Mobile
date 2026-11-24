import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth, db } from '@/lib/firebaseConfig';
import type { CourseDiscussion, CourseDiscussionReply, DiscussionCursor, DiscussionPage } from '@/lib/types/course';
import { firestoreBatchReadService } from './FirestoreBatchReadService';
import { learnerPublicName } from './LearnerNameRules';
import { nativeSessionService } from './NativeSessionService';

type Data = DocumentData;
type QuerySnapshot = { docs: QueryDocumentSnapshot<Data>[]; size: number };
type MutationResponse = { id: string };

export class CourseInteractionService {
  private static instance: CourseInteractionService;
  private constructor() {}
  private get database() { return db; }
  public static getInstance(): CourseInteractionService { return this.instance ??= new CourseInteractionService(); }

  public async getDiscussions(courseId: string, cursor: DiscussionCursor | null = null): Promise<DiscussionPage> {
    const userId = this.requireUserId();
    await nativeSessionService.ensure(userId);
    // Deleted posts are filtered after the read: posts written by the website before discussions moved to
    // callables have no `deleted` field, so a `deleted == false` filter would hide them.
    const snapshot: QuerySnapshot = cursor
      ? await getDocs(query(collection(this.database, 'courseDiscussions'), where('courseId', '==', courseId), orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc'), startAfter(new Date(cursor.createdAt), cursor.id), limit(30)))
      : await getDocs(query(collection(this.database, 'courseDiscussions'), where('courseId', '==', courseId), orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc'), limit(30)));
    nativeSessionService.assertOwner(userId);
    const items = await this.withAuthorNames(snapshot.docs.map((item) => this.discussion(item.id, item.data())).filter((item): item is CourseDiscussion => item !== null));
    const lastItem = items.at(-1);
    return { items, cursor: snapshot.size === 30 && lastItem?.createdAt ? { createdAt: lastItem.createdAt, id: lastItem.id } : null };
  }

  public async getReplies(courseId: string, discussionId: string): Promise<CourseDiscussionReply[]> {
    const userId = this.requireUserId();
    await nativeSessionService.ensure(userId);
    // The rules check enrollment in the reply's course, so the list query must name the course to be allowed.
    const snapshot: QuerySnapshot = await getDocs(query(collection(this.database, 'courseDiscussionReplies'), where('courseId', '==', courseId), where('discussionId', '==', discussionId), where('deleted', '==', false), orderBy('createdAt', 'asc'), limit(100)));
    nativeSessionService.assertOwner(userId);
    return this.withAuthorNames(snapshot.docs.map((item) => this.reply(item.id, item.data())).filter((item): item is CourseDiscussionReply => item !== null));
  }

  public async createDiscussion(courseId: string, body: string, operationId: string): Promise<string> {
    const userId = this.requireUserId();
    await nativeSessionService.ensure(userId);
    const result = await httpsCallable<{ courseId: string; body: string; operationId: string }, MutationResponse>(getFunctions(app), 'createCourseDiscussion')({ courseId, body, operationId });
    nativeSessionService.assertOwner(userId);
    return result.data.id;
  }

  public async createReply(discussionId: string, body: string, operationId: string): Promise<string> {
    const userId = this.requireUserId();
    await nativeSessionService.ensure(userId);
    const result = await httpsCallable<{ discussionId: string; body: string; operationId: string }, MutationResponse>(getFunctions(app), 'createCourseReply')({ discussionId, body, operationId });
    nativeSessionService.assertOwner(userId);
    return result.data.id;
  }

  // Posts written by the website before discussions moved to callables use userId/userName and a title.
  private discussion(id: string, data: Data): CourseDiscussion | null {
    const authorId = this.text(data.authorId) || this.text(data.userId);
    if (!this.text(data.courseId) || !authorId || !this.text(data.body) || data.deleted === true) return null;
    return { id, courseId: this.text(data.courseId), authorId, authorName: this.optionalText(data.authorName) ?? (this.text(data.userName).includes('@') ? undefined : this.optionalText(data.userName)), authorDisplayName: this.displayName(data), title: this.optionalText(data.title), body: this.text(data.body), replyCount: this.integer(data.replyCount), createdAt: this.timestamp(data.createdAt) };
  }

  /** The server's display-safe name (never an email), when the post has one. */
  private displayName(data: Data): string | undefined {
    const name = this.text(data.authorDisplayName);
    return name && !name.includes('@') ? name : undefined;
  }

  private reply(id: string, data: Data): CourseDiscussionReply | null {
    if (!this.text(data.discussionId) || !this.text(data.courseId) || !this.text(data.authorId) || !this.text(data.body) || data.deleted === true) return null;
    return { id, discussionId: this.text(data.discussionId), courseId: this.text(data.courseId), authorId: this.text(data.authorId), authorName: this.optionalText(data.authorName), authorDisplayName: this.displayName(data), body: this.text(data.body), createdAt: this.timestamp(data.createdAt) };
  }

  /**
   * The name other learners see on each post. Newer posts carry authorDisplayName, which the server worked out from the
   * account (a full name for adults, "First L." for student accounts and anyone under 18), so it is shown as stored.
   * For older posts every author's profile is read (one batch for the page) because the stored authorName cannot tell
   * a minor apart (LearnerNameRules); when profiles can't be read the stored names are shortened the same way.
   */
  private async withAuthorNames<T extends { authorId: string; authorName?: string; authorDisplayName?: string }>(items: T[]): Promise<T[]> {
    const legacy = items.filter((item) => !item.authorDisplayName);
    if (legacy.length === 0) return items.map((item) => ({ ...item, authorName: item.authorDisplayName }));
    const authorIds = [...new Set(legacy.map((item) => item.authorId))];
    let profiles: Map<string, Data> | null = null;
    try {
      profiles = await firestoreBatchReadService.getDocumentsByIds('users', authorIds);
    } catch (error: unknown) {
      console.error('[CourseInteractionService.withAuthorNames] Error:', error instanceof Error ? error.message : 'Unknown error');
    }
    return items.map((item) => ({ ...item, authorName: item.authorDisplayName ?? learnerPublicName(profiles?.get(item.authorId) ?? null, item.authorName ?? '') }));
  }

  private requireUserId(): string { const userId = auth.currentUser?.uid; if (!userId) throw new Error('You must be signed in to join course discussions.'); return userId; }
  private text(value: unknown): string { return typeof value === 'string' ? value.trim() : ''; }
  private optionalText(value: unknown): string | undefined { const valueText = this.text(value); return valueText || undefined; }
  private integer(value: unknown): number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0; }
  private timestamp(value: unknown): string | undefined {
    if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
    if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      const converted: unknown = value.toDate();
      if (converted instanceof Date && Number.isFinite(converted.getTime())) return converted.toISOString();
    }
    return undefined;
  }
}

export const courseInteractionService = CourseInteractionService.getInstance();
