import {
  collection,
  doc,
  getDoc,
  getCountFromServer,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export type PostCounterField = 'commentCount' | 'shareCount';
export type LegacyCommunityCounts = { commentCount: number; shareCount: number };

const readCount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/**
 * Owns where a post's comment/share counters live.
 * Community posts keep every counter in communityVariantDetailsCounter/{postId} (same as the web);
 * home feed posts use the likesCount collection.
 */
export class PostCounterService {
  private static instance: PostCounterService;
  private readonly communityPostCache = new Map<string, boolean>();

  private constructor() {}

  public static getInstance(): PostCounterService {
    if (!PostCounterService.instance) PostCounterService.instance = new PostCounterService();
    return PostCounterService.instance;
  }

  public async isCommunityPost(postId: string): Promise<boolean> {
    const cached = this.communityPostCache.get(postId);
    if (cached !== undefined) return cached;
    const snapshot = await getDoc(doc(db, 'communityVariantDetails', postId)).catch(() => null);
    const isCommunity = snapshot?.exists() === true;
    this.communityPostCache.set(postId, isCommunity);
    return isCommunity;
  }

  /** Adds `delta` to a post's comment or share counter and returns the new value when it can be read. */
  public async adjust(postId: string, field: PostCounterField, delta: number): Promise<number | null> {
    if (!postId || delta === 0) return null;
    try {
      if (await this.isCommunityPost(postId)) {
        const counterRef = doc(db, 'communityVariantDetailsCounter', postId);
        await setDoc(counterRef, { [field]: increment(delta), updatedAt: serverTimestamp() }, { merge: true });
        return this.readField(counterRef, field);
      }
      const existing = await getDocs(query(collection(db, 'likesCount'), where('feedsPostId', '==', postId), limit(1)));
      if (!existing.empty) {
        const counterRef = existing.docs[0].ref;
        await updateDoc(counterRef, { [field]: increment(delta), updatedAt: serverTimestamp() });
        return this.readField(counterRef, field);
      }
      if (delta < 0) return null;
      // Fixed ID so a post never gets a second counter doc.
      await setDoc(doc(db, 'likesCount', postId), {
        feedsPostId: postId,
        likeCount: 0,
        commentCount: field === 'commentCount' ? delta : 0,
        shareCount: field === 'shareCount' ? delta : 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return delta;
    } catch (error: unknown) {
      console.error('[PostCounterService.adjust] Error:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Comment/share counts that older app versions wrote to likesCount for community posts.
   * Added to the community counter on read so those counts are not lost.
   */
  public async loadLegacyCommunityCounts(postIds: string[]): Promise<Map<string, LegacyCommunityCounts>> {
    const result = new Map<string, LegacyCommunityCounts>();
    const uniqueIds = [...new Set(postIds.filter(Boolean))];
    const chunks = Array.from({ length: Math.ceil(uniqueIds.length / 30) }, (_, index) => uniqueIds.slice(index * 30, index * 30 + 30));
    const snapshots = await Promise.all(chunks.map((chunk) =>
      getDocs(query(collection(db, 'likesCount'), where('feedsPostId', 'in', chunk))).catch(() => null)));
    snapshots.forEach((snapshot) => snapshot?.docs.forEach((counterDoc) => {
      const data = counterDoc.data();
      const postId = typeof data.feedsPostId === 'string' ? data.feedsPostId : '';
      if (!postId) return;
      const previous = result.get(postId) ?? { commentCount: 0, shareCount: 0 };
      result.set(postId, {
        commentCount: Math.max(previous.commentCount, readCount(data.commentCount)),
        shareCount: Math.max(previous.shareCount, readCount(data.shareCount)),
      });
    }));
    return result;
  }

  /**
   * Live comment totals for community posts. Their stored commentCount was never kept
   * reliably, so the comment documents themselves are the source of truth.
   */
  public async countComments(postIds: string[]): Promise<Map<string, number>> {
    const uniqueIds = [...new Set(postIds.filter(Boolean))];
    const counts = await Promise.all(uniqueIds.map(async (postId) => {
      const snapshot = await getCountFromServer(query(collection(db, 'feedsPostComments'), where('feedsPostId', '==', postId))).catch(() => null);
      return [postId, snapshot ? snapshot.data().count : null] as const;
    }));
    const result = new Map<string, number>();
    counts.forEach(([postId, count]) => { if (count !== null) result.set(postId, count); });
    return result;
  }

  public mergeCommunityCounts(counter: Record<string, unknown> | undefined, legacy: LegacyCommunityCounts | undefined, liveCommentCount?: number): { commentCount: number; shareCount: number } {
    return {
      commentCount: liveCommentCount ?? readCount(counter?.commentCount) + (legacy?.commentCount ?? 0),
      shareCount: readCount(counter?.shareCount) + (legacy?.shareCount ?? 0),
    };
  }

  private async readField(counterRef: DocumentReference, field: PostCounterField): Promise<number | null> {
    const snapshot = await getDoc(counterRef).catch(() => null);
    return snapshot?.exists() ? readCount(snapshot.data()?.[field]) : null;
  }
}

export const postCounterService = PostCounterService.getInstance();
