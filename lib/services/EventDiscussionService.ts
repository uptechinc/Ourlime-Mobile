import { addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, increment, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { AuthService } from './AuthService';
import { accountLifecycleVisibilityService } from './AccountLifecycleVisibilityService';
import { firestoreBatchReadService } from './FirestoreBatchReadService';
import { RelationshipService } from './RelationshipService';

export type EventDiscussionSort = 'newest' | 'oldest' | 'most_liked';
export type EventDiscussionComment = {
  id: string;
  userId: string;
  comment: string;
  createdAt: string | null;
  editedAt: string | null;
  likeCount: number;
  parentId: string | null;
  isOrganizerReply: boolean;
  authorName: string;
  authorUserName: string | null;
  authorImage: string | null;
};
export type TreeNode<T> = T & { replies: TreeNode<T>[] };
export type EventDiscussionNode = TreeNode<EventDiscussionComment>;
export type EventViewerCommunityState = { mutedUserIds: string[]; blockedUserIds: string[]; guidelinesAccepted: boolean; likedCommentIds: string[] };
export type EventReview = {
  id: string;
  userId: string;
  rating: number;
  content: string;
  createdAt: string | null;
  parentId: string | null;
  isOrganizerReply: boolean;
  authorName: string;
  authorUserName: string | null;
  authorImage: string | null;
};
export type EventReviewNode = TreeNode<EventReview>;

const COMMENTS = 'eventVariantComments';
const COMMENT_LIKES = 'eventVariantCommentLikes';
const REVIEWS = 'eventReviews';

/** The event page's Discussions and Reviews (the website's eventCommentService, direct to Firestore). */
export class EventDiscussionService {
  private static instance: EventDiscussionService;
  private readonly authService = AuthService.getInstance();

  private constructor() {}

  public static getInstance(): EventDiscussionService {
    if (!EventDiscussionService.instance) EventDiscussionService.instance = new EventDiscussionService();
    return EventDiscussionService.instance;
  }

  private requireUserId(): string {
    const userId = this.authService.getVerifiedCurrentUser()?.uid;
    if (!userId) throw new Error('Sign in to continue.');
    return userId;
  }

  /** Every comment on the event (stored under eventId and/or the older eventVariantId), sorted like the website. */
  public async fetchComments(eventId: string, sort: EventDiscussionSort): Promise<EventDiscussionComment[]> {
    const [byEvent, byVariant] = await Promise.all([
      getDocs(query(collection(db, COMMENTS), where('eventId', '==', eventId))),
      getDocs(query(collection(db, COMMENTS), where('eventVariantId', '==', eventId))),
    ]);
    const unique = new Map<string, QueryDocumentSnapshot<DocumentData>>();
    [...byEvent.docs, ...byVariant.docs].forEach((entry) => unique.set(entry.id, entry));
    const visible = [...unique.values()].filter((entry) => {
      const data = entry.data();
      return data.removed !== true && typeof data.comment === 'string' && data.comment.trim().length > 0 && !accountLifecycleVisibilityService.isHidden(data);
    });
    const profiles = await this.profiles(visible.map((entry) => String(entry.data().userId ?? '')));
    const comments = visible.map((entry): EventDiscussionComment => {
      const data = entry.data();
      const userId = String(data.userId ?? '');
      return {
        id: entry.id, userId, comment: String(data.comment), createdAt: this.isoDate(data.timestamp), editedAt: this.isoDate(data.editedAt),
        likeCount: typeof data.likeCount === 'number' ? Math.max(0, data.likeCount) : 0, parentId: typeof data.parentId === 'string' && data.parentId ? data.parentId : null,
        isOrganizerReply: data.isOrganizerReply === true, ...this.author(profiles.get(userId)),
      };
    });
    return comments.sort((left, right) => {
      if (sort === 'most_liked') return (right.likeCount - left.likeCount) || (right.createdAt ?? '').localeCompare(left.createdAt ?? '');
      const order = (left.createdAt ?? '').localeCompare(right.createdAt ?? '');
      return sort === 'oldest' ? order : -order;
    });
  }

  /** Replies nest under their parent; a reply whose parent is gone shows at the top level, as on the website. */
  public buildTree<T extends { id: string; parentId: string | null }>(items: T[]): TreeNode<T>[] {
    const nodes = new Map<string, TreeNode<T>>(items.map((item) => [item.id, { ...item, replies: [] }]));
    const roots: TreeNode<T>[] = [];
    items.forEach((item) => {
      const node = nodes.get(item.id);
      if (!node) return;
      const parent = item.parentId ? nodes.get(item.parentId) : undefined;
      if (parent) parent.replies.push(node);
      else roots.push(node);
    });
    return roots;
  }

  public async addComment(eventId: string, comment: string, options: { parentId?: string | null; isOrganizerReply: boolean }): Promise<void> {
    const userId = this.requireUserId();
    const text = comment.trim();
    if (!text) throw new Error('Write something first.');
    await addDoc(collection(db, COMMENTS), {
      eventId, eventVariantId: eventId, comment: text.slice(0, 5000), userId, timestamp: serverTimestamp(), likeCount: 0,
      parentId: options.parentId ?? null, isOrganizerReply: options.isOrganizerReply,
    });
  }

  public async editComment(commentId: string, comment: string): Promise<void> {
    const text = comment.trim();
    if (!text) throw new Error('A comment cannot be empty.');
    await updateDoc(doc(db, COMMENTS, commentId), { comment: text.slice(0, 5000), editedAt: serverTimestamp() });
  }

  /** Deletes a comment and (where the rules allow) its likes. */
  public async deleteComment(commentId: string): Promise<void> {
    const likes = await getDocs(query(collection(db, COMMENT_LIKES), where('commentId', '==', commentId)));
    await Promise.all(likes.docs.map(async (entry) => {
      try { await deleteDoc(entry.ref); } catch { return; }
    }));
    await deleteDoc(doc(db, COMMENTS, commentId));
  }

  /** Likes or unlikes a comment: the like record first, then the count (the rules check the record's presence). */
  public async toggleCommentLike(eventId: string, commentId: string, like: boolean): Promise<void> {
    const userId = this.requireUserId();
    const likeRef = doc(db, COMMENT_LIKES, `${commentId}_${userId}`);
    if (like) {
      await setDoc(likeRef, { commentId, eventId, userId, timestamp: serverTimestamp() });
      await updateDoc(doc(db, COMMENTS, commentId), { likeCount: increment(1) });
    } else {
      await deleteDoc(likeRef);
      await updateDoc(doc(db, COMMENTS, commentId), { likeCount: increment(-1) });
    }
  }

  /** Muted and blocked members, whether the Community Guidelines were accepted, and the comments the member liked. */
  public async fetchViewerState(eventId: string): Promise<EventViewerCommunityState> {
    const userId = this.authService.getVerifiedCurrentUser()?.uid;
    if (!userId) return { mutedUserIds: [], blockedUserIds: [], guidelinesAccepted: false, likedCommentIds: [] };
    const [profile, likes] = await Promise.all([
      getDoc(doc(db, 'users', userId)),
      getDocs(query(collection(db, COMMENT_LIKES), where('userId', '==', userId))),
    ]);
    const data = profile.data() ?? {};
    const list = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
    return {
      mutedUserIds: list(data.mutedUsers),
      blockedUserIds: list(data.blockList),
      guidelinesAccepted: data.guidelinesAcceptedAt != null,
      likedCommentIds: likes.docs.filter((entry) => !entry.data().eventId || entry.data().eventId === eventId).map((entry) => String(entry.data().commentId ?? '')).filter(Boolean),
    };
  }

  public async acceptGuidelines(): Promise<void> {
    await updateDoc(doc(db, 'users', this.requireUserId()), { guidelinesAcceptedAt: serverTimestamp() });
  }

  /** Hides the member's comments from the viewer (users.mutedUsers, as on the website). */
  public async muteUser(targetUserId: string): Promise<void> {
    await updateDoc(doc(db, 'users', this.requireUserId()), { mutedUsers: arrayUnion(targetUserId) });
  }

  public async blockUser(targetUserId: string): Promise<void> {
    await RelationshipService.getInstance().blockUser(targetUserId);
  }

  /** Reviews and organiser replies, newest first. */
  public async fetchReviews(eventId: string): Promise<EventReview[]> {
    const snapshot = await getDocs(query(collection(db, REVIEWS), where('eventId', '==', eventId)));
    const visible = snapshot.docs.filter((entry) => !accountLifecycleVisibilityService.isHidden(entry.data()));
    const profiles = await this.profiles(visible.map((entry) => String(entry.data().userId ?? '')));
    return visible.map((entry): EventReview => {
      const data = entry.data();
      const userId = String(data.userId ?? '');
      return {
        id: entry.id, userId, rating: typeof data.rating === 'number' ? data.rating : 0, content: typeof data.content === 'string' ? data.content : '',
        createdAt: this.isoDate(data.timestamp), parentId: typeof data.parentId === 'string' && data.parentId ? data.parentId : null,
        isOrganizerReply: data.isOrganizerReply === true, ...this.author(profiles.get(userId)),
      };
    }).sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? ''));
  }

  /** One review per attendee (rating 1 to 5 and some words), as the website enforces. */
  public async createReview(eventId: string, rating: number, content: string): Promise<void> {
    const userId = this.requireUserId();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Choose a rating from 1 to 5 stars.');
    if (!content.trim()) throw new Error('Write a few words about the event.');
    const existing = await getDocs(query(collection(db, REVIEWS), where('eventId', '==', eventId), where('userId', '==', userId)));
    if (existing.docs.some((entry) => !entry.data().parentId)) throw new Error('You have already reviewed this event.');
    await addDoc(collection(db, REVIEWS), { eventId, userId, rating, content: content.trim().slice(0, 5000), timestamp: serverTimestamp(), parentId: null, isOrganizerReply: false });
  }

  /** The organiser's reply under a review (no rating, as the rules require). */
  public async replyToReview(eventId: string, reviewId: string, content: string): Promise<void> {
    const userId = this.requireUserId();
    if (!content.trim()) throw new Error('Write a reply first.');
    await addDoc(collection(db, REVIEWS), { eventId, userId, rating: null, content: content.trim().slice(0, 5000), timestamp: serverTimestamp(), parentId: reviewId, isOrganizerReply: true });
  }

  private async profiles(userIds: string[]): Promise<Map<string, DocumentData>> {
    const ids = [...new Set(userIds.filter(Boolean))];
    return ids.length ? firestoreBatchReadService.getDocumentsByIds('users', ids) : new Map<string, DocumentData>();
  }

  private author(profile: DocumentData | undefined): { authorName: string; authorUserName: string | null; authorImage: string | null } {
    const fullName = [profile?.firstName, profile?.lastName].filter((part): part is string => typeof part === 'string' && part.trim().length > 0).join(' ');
    const userName = typeof profile?.userName === 'string' ? profile.userName : null;
    return {
      authorName: fullName || (userName && !userName.includes('@') ? userName : 'Ourlime member'),
      authorUserName: userName,
      authorImage: typeof profile?.profileImage === 'string' ? profile.profileImage : null,
    };
  }

  private isoDate(value: unknown): string | null {
    if (value instanceof Timestamp) return value.toDate().toISOString();
    if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
    return null;
  }
}

export const eventDiscussionService = EventDiscussionService.getInstance();
