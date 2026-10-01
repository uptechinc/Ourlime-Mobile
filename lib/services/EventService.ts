import { addDoc, collection, deleteDoc, getDocs, query, serverTimestamp, Timestamp, where, type DocumentData } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { AuthService } from './AuthService';
import type { Event, MediaItem } from '@/types/eventTypes';
import { accountLifecycleVisibilityService } from './AccountLifecycleVisibilityService';
import { communityDataService } from './CommunityDataService';

export type EventAttendanceStatus = { isAttending: boolean; attendeeCount: number };
type EventMediaRecord = { type?: unknown; url?: unknown; typeUrl?: unknown };
export type CreateEventInput = {
  title: string;
  description: string;
  summary: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  recurrence: string;
  creatorId: string;
  userId: string;
  user: { id: string; firstName: string; lastName: string; userName: string; profileImage: string | null };
  communityVariantId?: string;
  image?: string;
  media?: MediaItem[];
};

/** Web helpers/Events isEventVisible: hides archived, hidden, draft, cancelled, removed and not-yet-published events. */
const isEventVisible = (data: DocumentData): boolean => {
  if (data.isArchived === true || data.deletedAt != null) return false;
  if (data.hidden === true || data.isHidden === true || data.moderationVisibility === 'hidden') return false;
  if (data.draft === true || data.isDraft === true) return false;
  if (data.cancelled === true || data.isCancelled === true) return false;
  if (data.removed === true || data.isRemoved === true || data.isDeleted === true) return false;
  const status = typeof data.status === 'string' ? data.status.toLowerCase() : '';
  if (['draft', 'cancelled', 'removed', 'deleted', 'archived', 'inactive'].includes(status)) return false;
  if (status === 'scheduled' && data.publishAt) {
    const publishTime = new Date(data.publishAt instanceof Timestamp ? data.publishAt.toMillis() : String(data.publishAt)).getTime();
    if (!Number.isNaN(publishTime) && publishTime > Date.now()) return false;
  }
  if (data.isExpired === true) return false;
  const toMillis = (value: unknown): number | null => {
    if (value instanceof Timestamp) return value.toMillis();
    if (value instanceof Date) return value.getTime();
    if (typeof value !== 'string' || !value) return null;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  };
  const endsAt = toMillis(data.endDate) ?? toMillis(data.startDate);
  return endsAt === null || endsAt >= Date.now();
};

export class EventService {
  private static instance: EventService;
  private readonly authService = AuthService.getInstance();

  private constructor() {}

  public static getInstance(): EventService {
    if (!EventService.instance) EventService.instance = new EventService();
    return EventService.instance;
  }

  /** All visible events, newest start date first (same filters as the website's events fetch). */
  public async fetchEvents(): Promise<Event[]> {
    const snapshot = await getDocs(collection(db, 'events'));
    return snapshot.docs
      .filter((document) => !accountLifecycleVisibilityService.isHidden(document.data()) && isEventVisible(document.data()))
      .map((document): Event => {
        const event = document.data();
        const startDate = event.startDate instanceof Timestamp
          ? event.startDate.toDate().toISOString()
          : typeof event.startDate === 'string' ? event.startDate : new Date(0).toISOString();
        const endDate = event.endDate instanceof Timestamp
          ? event.endDate.toDate().toISOString()
          : typeof event.endDate === 'string' ? event.endDate : startDate;
        const location = typeof event.location === 'string'
          ? event.location
          : event.location && typeof event.location === 'object' && typeof event.location.name === 'string'
            ? event.location.name
            : 'Online';
        const media: MediaItem[] | undefined = Array.isArray(event.media)
          ? event.media.flatMap((item): MediaItem[] => {
              if (!item || typeof item !== 'object') return [];
              const value = item as EventMediaRecord;
              const url = typeof value.url === 'string' ? value.url : typeof value.typeUrl === 'string' ? value.typeUrl : '';
              if (!url) return [];
              return [{ type: value.type === 'video' ? 'video' : 'image', url }];
            })
          : undefined;
        return {
          id: document.id,
          title: typeof event.title === 'string' ? event.title : 'Untitled event',
          summary: typeof event.summary === 'string' ? event.summary : typeof event.description === 'string' ? event.description : '',
          description: typeof event.description === 'string' ? event.description : undefined,
          startDate,
          endDate,
          location,
          userId: typeof event.userId === 'string' ? event.userId : '',
          likeCount: typeof event.likeCount === 'number' ? event.likeCount : 0,
          recurrence: typeof event.recurrence === 'string' ? event.recurrence : 'none',
          image: typeof event.image === 'string' ? event.image : undefined,
          media,
          category: typeof event.category === 'string' ? event.category : undefined,
          communityVariantId: typeof event.communityVariantId === 'string' ? event.communityVariantId : undefined,
        };
      })
      .sort((left, right) => new Date(right.startDate).getTime() - new Date(left.startDate).getTime());
  }

  public async createEvent(input: CreateEventInput): Promise<string> {
    const event = await addDoc(collection(db, 'events'), { ...input, createdAt: serverTimestamp() });
    return event.id;
  }

  /** Community events read and written directly in Firestore (same logic as the website's community events route). */
  public async fetchCommunityEvents(communityId: string): Promise<Event[]> {
    const events = await communityDataService.fetchEvents(communityId);
    return events.filter((event) => !accountLifecycleVisibilityService.isHidden(event));
  }

  public async createCommunityEvent(input: CreateEventInput): Promise<string> {
    if (!input.communityVariantId) throw new Error('Community is required.');
    return communityDataService.createEvent(input.communityVariantId, input);
  }

  public async updateCommunityEvent(communityId: string, eventId: string, updates: Partial<CreateEventInput>): Promise<void> {
    await communityDataService.updateEvent(communityId, eventId, updates);
  }

  public async deleteCommunityEvent(communityId: string, eventId: string): Promise<void> {
    await communityDataService.deleteEvent(communityId, eventId);
  }

  public async toggleCommunityAttendance(communityId: string, eventId: string, desiredAttending?: boolean): Promise<EventAttendanceStatus> {
    const result = await communityDataService.toggleAttendance(communityId, eventId, desiredAttending);
    if (result.onWaitlist) throw new Error(`This event is full. You are number ${result.position ?? 1} on the waitlist.`);
    return { isAttending: result.isAttending, attendeeCount: result.attendeeCount };
  }

  public async getAttendance(eventId: string): Promise<EventAttendanceStatus> {
    const userId = this.authService.getVerifiedCurrentUser()?.uid;
    const attendees = await getDocs(query(collection(db, 'eventAttendees'), where('eventId', '==', eventId)));
    return {
      attendeeCount: attendees.size,
      isAttending: Boolean(userId && attendees.docs.some((document) => document.data().userId === userId)),
    };
  }

  public async toggleAttendance(eventId: string): Promise<EventAttendanceStatus> {
    const userId = this.authService.getVerifiedCurrentUser()?.uid;
    if (!userId) throw new Error('Your verified session is still loading. Please try again.');
    const existing = await getDocs(query(collection(db, 'eventAttendees'), where('eventId', '==', eventId), where('userId', '==', userId)));
    if (existing.empty) {
      await addDoc(collection(db, 'eventAttendees'), { eventId, userId, createdAt: new Date().toISOString() });
    } else {
      await Promise.all(existing.docs.map((document) => deleteDoc(document.ref)));
    }
    return this.getAttendance(eventId);
  }
}

export const eventService = EventService.getInstance();
