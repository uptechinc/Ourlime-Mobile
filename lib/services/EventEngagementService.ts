import { collection, doc, getDoc, getDocs, increment, query, serverTimestamp, where, writeBatch, type DocumentData } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { AuthService } from './AuthService';
import { firestoreBatchReadService } from './FirestoreBatchReadService';
import type { RegistrationAnswers } from '@/types/eventTypes';

/** Saves (bookmarks) live in users/{uid}/saved (SavedService); this covers likes only. */
export type EventViewerState = { liked: { [eventId: string]: boolean } };
export type EventRegistration = { userId: string; name: string; userName: string | null; image: string | null; answers: RegistrationAnswers };

const LIKES = 'eventVariantLikes';
const LIKE_COUNTER = 'eventLikeCounter';

/** Event likes and registration answers (the website's EventInteractionsService, direct to Firestore). */
export class EventEngagementService {
  private static instance: EventEngagementService;
  private readonly authService = AuthService.getInstance();

  private constructor() {}

  public static getInstance(): EventEngagementService {
    if (!EventEngagementService.instance) EventEngagementService.instance = new EventEngagementService();
    return EventEngagementService.instance;
  }

  private requireUserId(): string {
    const userId = this.authService.getVerifiedCurrentUser()?.uid;
    if (!userId) throw new Error('Sign in to continue.');
    return userId;
  }

  /** Which of these events the member liked. */
  public async fetchViewerState(eventIds: string[]): Promise<EventViewerState> {
    const result: EventViewerState = { liked: {} };
    const userId = this.authService.getVerifiedCurrentUser()?.uid;
    if (!userId || eventIds.length === 0) return result;
    const wanted = new Set(eventIds);
    const likes = await getDocs(query(collection(db, LIKES), where('userId', '==', userId)));
    likes.docs.forEach((entry) => { const eventId = String(entry.data().eventVariantId ?? ''); if (wanted.has(eventId)) result.liked[eventId] = true; });
    return result;
  }

  public async fetchLikeCount(eventId: string): Promise<number> {
    const counter = await getDoc(doc(db, LIKE_COUNTER, eventId));
    const value: unknown = counter.data()?.like;
    if (typeof value === 'number') return Math.max(0, value);
    return (await getDocs(query(collection(db, LIKES), where('eventVariantId', '==', eventId)))).size;
  }

  /** Likes or unlikes (`${eventId}_${uid}` plus the eventLikeCounter total, in one batch as the rules require). Returns the new state. */
  public async toggleLike(eventId: string, isLiked: boolean): Promise<boolean> {
    const userId = this.requireUserId();
    const likeRef = doc(db, LIKES, `${eventId}_${userId}`);
    const counterRef = doc(db, LIKE_COUNTER, eventId);
    const counter = await getDoc(counterRef);
    const batch = writeBatch(db);
    if (isLiked) {
      batch.delete(likeRef);
      if (counter.exists() && typeof counter.data().like === 'number' && counter.data().like > 0) batch.update(counterRef, { like: increment(-1) });
    } else {
      batch.set(likeRef, { eventVariantId: eventId, userId, createdAt: serverTimestamp() });
      if (counter.exists()) batch.update(counterRef, { like: increment(1) });
      else batch.set(counterRef, { like: 1, eventVariantId: eventId });
    }
    await batch.commit();
    return !isLiked;
  }

  /** Attendees' answers to the registration questions (the website's "View registrations" for organisers). */
  public async fetchRegistrations(eventId: string): Promise<EventRegistration[]> {
    const attendees = await getDocs(query(collection(db, 'eventAttendees'), where('eventId', '==', eventId)));
    const withAnswers = attendees.docs
      .map((entry) => entry.data())
      .filter((data) => typeof data.userId === 'string' && data.answers && typeof data.answers === 'object' && Object.keys(data.answers as object).length > 0);
    const profiles = withAnswers.length
      ? await firestoreBatchReadService.getDocumentsByIds('users', [...new Set(withAnswers.map((data) => String(data.userId)))])
      : new Map<string, DocumentData>();
    return withAnswers.map((data) => {
      const profile = profiles.get(String(data.userId));
      const name = [profile?.firstName, profile?.lastName].filter((part): part is string => typeof part === 'string' && part.length > 0).join(' ');
      return {
        userId: String(data.userId),
        name: name || (typeof profile?.userName === 'string' && !profile.userName.includes('@') ? profile.userName : 'Ourlime member'),
        userName: typeof profile?.userName === 'string' ? profile.userName : null,
        image: typeof profile?.profileImage === 'string' ? profile.profileImage : null,
        answers: data.answers as RegistrationAnswers,
      };
    });
  }
}

export const eventEngagementService = EventEngagementService.getInstance();
