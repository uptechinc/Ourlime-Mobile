import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  increment,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import type { CommunityEventEngagement } from '@/lib/types/community';

const readCount = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0);

/**
 * Likes and comment totals for the event cards on a community's Events tab, matching the website's
 * CommunityEventsModal: a like is `eventVariantLikes/${eventId}_${uid}` plus the `eventLikeCounter` total,
 * and comments are counted from `eventVariantComments`.
 */
export class CommunityEventEngagementService {
  private static instance: CommunityEventEngagementService;

  private constructor() {}

  public static getInstance(): CommunityEventEngagementService {
    if (!CommunityEventEngagementService.instance) CommunityEventEngagementService.instance = new CommunityEventEngagementService();
    return CommunityEventEngagementService.instance;
  }

  public async getEngagement(eventIds: string[]): Promise<Map<string, CommunityEventEngagement>> {
    const viewerId = auth.currentUser?.uid ?? '';
    const uniqueIds = [...new Set(eventIds.filter(Boolean))];
    const entries = await Promise.all(uniqueIds.map(async (eventId): Promise<[string, CommunityEventEngagement]> => {
      const [counter, like, comments] = await Promise.all([
        getDoc(doc(db, 'eventLikeCounter', eventId)).catch(() => null),
        viewerId ? getDoc(doc(db, 'eventVariantLikes', `${eventId}_${viewerId}`)).catch(() => null) : Promise.resolve(null),
        getCountFromServer(query(collection(db, 'eventVariantComments'), where('eventVariantId', '==', eventId))).catch(() => null),
      ]);
      return [eventId, {
        liked: Boolean(like?.exists()),
        likeCount: readCount(counter?.data()?.like),
        commentCount: comments?.data().count ?? 0,
      }];
    }));
    return new Map(entries);
  }

  /** Likes or unlikes the event and returns the new state. */
  public async toggleLike(eventId: string, liked: boolean): Promise<Pick<CommunityEventEngagement, 'liked' | 'likeCount'>> {
    const viewerId = auth.currentUser?.uid;
    if (!viewerId) throw new Error('You must be signed in.');
    const likeRef = doc(db, 'eventVariantLikes', `${eventId}_${viewerId}`);
    const counterRef = doc(db, 'eventLikeCounter', eventId);
    const [likeSnapshot, counterSnapshot] = await Promise.all([getDoc(likeRef), getDoc(counterRef)]);
    const currentCount = readCount(counterSnapshot.data()?.like);
    if (liked === likeSnapshot.exists()) return { liked, likeCount: currentCount };
    const batch = writeBatch(db);
    if (liked) {
      batch.set(likeRef, { eventVariantId: eventId, userId: viewerId, createdAt: serverTimestamp() });
      if (counterSnapshot.exists()) batch.update(counterRef, { like: increment(1) });
      else batch.set(counterRef, { like: 1, eventVariantId: eventId });
    } else {
      batch.delete(likeRef);
      if (counterSnapshot.exists() && currentCount > 0) batch.update(counterRef, { like: increment(-1) });
    }
    try {
      await batch.commit();
    } catch (error: unknown) {
      console.error('[CommunityEventEngagementService.toggleLike] Error:', error instanceof Error ? error.message : 'like failed');
      throw new Error('The event like could not be saved.');
    }
    return { liked, likeCount: Math.max(0, currentCount + (liked ? 1 : -1)) };
  }
}

export const communityEventEngagementService = CommunityEventEngagementService.getInstance();
