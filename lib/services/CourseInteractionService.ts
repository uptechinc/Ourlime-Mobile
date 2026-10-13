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

  public async getReplies(discussionId: string): Promise<CourseDiscussionReply[]> {
    const userId = this.requireUserId();
    await nativeSessionService.ensure(userId);
    const snapshot: QuerySnapshot = await getDocs(query(collection(this.database, 'courseDiscussionReplies'), where('discussionId', '==', discussionId), where('deleted', '==', false), orderBy('createdAt', 'asc'), limit(100)));
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
    return { id, courseId: this.text(data.courseId), authorId, authorName: this.optionalText(data.authorName) ?? (this.text(data.userName).includes('@') ? undefined : this.optionalText(data.userName)), title: this.optionalText(data.title), body: this.text(data.body), replyCount: this.integer(data.replyCount), createdAt: this.timestamp(data.createdAt) };
  }

  private reply(id: string, data: Data): CourseDiscussionReply | null {
    if (!this.text(data.discussionId) || !this.text(data.courseId) || !this.text(data.authorId) || !this.text(data.body) || data.deleted === true) return null;
    return { id, discussionId: this.text(data.discussionId), courseId: this.text(data.courseId), authorId: this.text(data.authorId), authorName: this.optionalText(data.authorName), body: this.text(data.body), createdAt: this.timestamp(data.createdAt) };
  }

  private async withAuthorNames<T extends { authorId: string; authorName?: string }>(items: T[]): Promise<T[]> {
    const missingIds = [...new Set(items.filter((item) => !item.authorName).map((item) => item.authorId))];
    if (missingIds.length === 0) return items;
    try {
      const profiles = await firestoreBatchReadService.getDocumentsByIds('users', missingIds);
      return items.map((item) => item.authorName ? item : { ...item, authorName: this.profileName(profiles.get(item.authorId)) });
    } catch (error) {
      console.error('[CourseInteractionService.withAuthorNames] Error:', error);
      return items;
    }
  }

  private profileName(profile: Data | undefined): string | undefined {
    if (!profile) return undefined;
    const fullName = [this.text(profile.firstName), this.text(profile.lastName)].filter(Boolean).join(' ');
    return this.optionalText(profile.displayName) ?? (fullName || this.optionalText(profile.userName));
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
