import { db, app } from '@/lib/firebaseConfig';
import { collection, getDocs, query, orderBy, documentId, startAfter, limit, doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { AuthService } from './AuthService';
import { nativeSessionService } from './NativeSessionService';
import { contentDraftService } from './ContentDraftService';
import { durableWorkService } from './DurableWorkService';
import { reliabilityDecoder as decode } from './ReliabilityDecoderService';
import { contentDateService } from './ContentDateService';
import { pageAccessService } from './PageAccessService';
import type { BlogCommentReply } from '@/lib/types/blog';

export type DiscussionComment = {
  id: string;
  userId: string;
  authorName: string;
  authorAvatar: string;
  isVerified?: boolean;
  text: string;
  date: string;
  createdAt: string;
  removed: boolean;
  replyCount: number;
  legacyReplies: BlogCommentReply[];
};
export type DiscussionPage = { comments: DiscussionComment[]; cursor: string | null };
type EngagementInput = { kind: 'blog' | 'product'; targetId: string; action: 'like' | 'bookmark' | 'view' | 'comment' | 'delete_comment' | 'report'; active?: boolean; parentId?: string; text?: string; commentId?: string };

export class NativeEngagementService {
  private static instance: NativeEngagementService;
  private queues = new Map<string, Promise<void>>();
  public static getInstance(): NativeEngagementService { return this.instance ??= new NativeEngagementService(); }
  public async mutate(ownerId: string, input: EngagementInput): Promise<{ active?: boolean; id?: string }> {
    pageAccessService.assertMutation(input.kind === 'blog' ? '/blogs' : '/market');
    const key = JSON.stringify(input);
    const queueKey = `${ownerId}:${input.kind}:${input.targetId}:${input.action}`;
    const operation = (this.queues.get(queueKey) ?? Promise.resolve()).then(async () => {
      await nativeSessionService.ensure(ownerId);
      const stored = await durableWorkService.read(ownerId, 'mutation', key, (value) => decode.string(decode.object(value).id));
      const id = stored?.value ?? await contentDraftService.newId();
      const revision = stored?.revision ?? await durableWorkService.write(ownerId, 'mutation', key, { id }, 0);
      const functionsInstance = getFunctions(app);
      const result = await httpsCallable(functionsInstance, 'mutateEngagement')({ ...input, mutationId: id });
      await durableWorkService.remove(ownerId, 'mutation', key, revision);
      nativeSessionService.assertOwner(ownerId);
      const value = decode.object(result.data);
      return { active: typeof value.active === 'boolean' ? value.active : undefined, id: typeof value.id === 'string' ? value.id : undefined };
    });
    this.queues.set(queueKey, operation.then(() => {}, () => {}));
    return operation;
  }
  public async page(ownerId: string, kind: 'blog' | 'product', targetId: string, parentId?: string, cursor?: string | null): Promise<DiscussionPage> {
    nativeSessionService.assertOwner(ownerId);
    const database = db;
    const parentPath = `${kind === 'blog' ? 'blogsAndArticles' : 'products'}/${targetId}/comments`;
    const reference = collection(database, parentId ? `${parentPath}/${parentId}/replies` : parentPath);
    type CommentSnapshot = { id: string; data: () => unknown; metadata: { hasPendingWrites: boolean } };
    let documents: CommentSnapshot[];
    let nextCursor: string | null;
    const parent = parentId && kind === 'blog' ? (await getDoc(doc(database, parentPath, parentId))).data() : null;
    const embedded: unknown[] = Array.isArray(parent?.replies) ? parent.replies : [];
    const legacyOffset = cursor?.startsWith('@legacy:') ? Number(cursor.slice(8)) : 0;
    if (embedded.length && (!cursor || cursor.startsWith('@legacy:'))) {
      if (!Number.isSafeInteger(legacyOffset) || legacyOffset < 0 || legacyOffset > embedded.length) throw new Error('Invalid reply cursor. Reload the discussion.');
      const entries = embedded.slice(legacyOffset, legacyOffset + 20);
      documents = [];
      for (let offset = 0; offset < entries.length; offset += 4) {
        documents.push(...await Promise.all(entries.slice(offset, offset + 4).map(async (entry, index): Promise<CommentSnapshot> => {
          const id = `legacy_${legacyOffset + offset + index}`;
          const migrated = await getDoc(doc(reference, id));
          return migrated.exists() ? migrated : { id, data: () => entry, metadata: { hasPendingWrites: false } };
        })));
      }
      nextCursor = legacyOffset + entries.length < embedded.length ? `@legacy:${legacyOffset + entries.length}` : '@native:';
    } else {
      const after = cursor?.startsWith('@native:') ? cursor.slice(8) : cursor;
      const snapshot = await getDocs(after ? query(reference, orderBy(documentId()), startAfter(after), limit(20)) : query(reference, orderBy(documentId()), limit(20)));
      // Migrated legacy records are overlaid above so pagination cannot display both copies.
      documents = snapshot.docs.filter((document: CommentSnapshot) => !embedded.length || !/^legacy_\d+$/.test(document.id));
      nextCursor = snapshot.docs.length === 20 ? `@native:${snapshot.docs[snapshot.docs.length - 1].id}` : null;
    }
    const comments: DiscussionComment[] = [];
    for (let offset = 0; offset < documents.length; offset += 4) {
      comments.push(...await Promise.all(documents.slice(offset, offset + 4).map(async (document: { id: string; data: () => unknown; metadata: { hasPendingWrites: boolean } }) => {
        const data = decode.object(document.data());
        const userId = typeof data.userId === 'string' ? data.userId : '';
        const [authorSnap, userProfile] = await Promise.all([
          userId ? getDoc(doc(database, 'users', userId)).catch(() => null) : Promise.resolve(null),
          userId ? AuthService.getInstance().getUserProfileIfAvailable(userId).catch(() => null) : Promise.resolve(null),
        ]);
        const profile = authorSnap?.data();
        const resolvedName = userProfile
          ? [userProfile.firstName, userProfile.lastName].filter(Boolean).join(' ') || userProfile.userName || 'Member'
          : profile ? [profile.firstName, profile.lastName].filter((part) => typeof part === 'string').join(' ') || 'Member' : 'Member unavailable';
        const resolvedAvatar = userProfile?.profilePicture || (typeof profile?.profilePicture === 'string' ? profile.profilePicture : '') || (typeof profile?.avatar === 'string' ? profile.avatar : '') || '';
        const isVerified = userProfile?.identityVerificationStatus === 'verified' || userProfile?.verificationStatus === 'verified' || profile?.identityVerificationStatus === 'verified' || profile?.verificationStatus === 'verified';
        const timestamp = contentDateService.toMilliseconds(data.createdAt);
        const legacyReplies: BlogCommentReply[] = [];
        return {
          id: document.id,
          userId,
          authorName: resolvedName,
          authorAvatar: resolvedAvatar,
          isVerified,
          text: data.isDeleted ? 'Comment removed' : typeof data.content === 'string' ? data.content : typeof data.text === 'string' ? data.text : '',
          date: contentDateService.formatCommentDate(data.createdAt, document.metadata.hasPendingWrites),
          createdAt: timestamp === null ? '' : new Date(timestamp).toISOString(),
          legacyReplies,
          removed: data.isDeleted === true,
          replyCount: typeof data.replyCount === 'number' ? data.replyCount : 0,
        };
      })));
    }
    nativeSessionService.assertOwner(ownerId);
    return { comments, cursor: nextCursor };
  }
}
export const nativeEngagementService = NativeEngagementService.getInstance();
