import { addDoc, collection, deleteDoc, getDocs, query, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ApiService } from './ApiService';
import type { Event } from '@/types/eventTypes';

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
};

export class EventService {
  private static instance: EventService;
  private readonly apiService = ApiService.getInstance();

  private constructor() {}

  public static getInstance(): EventService {
    if (!EventService.instance) EventService.instance = new EventService();
    return EventService.instance;
  }

  public async fetchEvents(): Promise<Event[]> {
    try {
      const response = await this.apiService.request<{ status: 'success'; data: Event[] }>('/api/events/fetch', {
        timeoutMs: 2_500,
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch {
      return this.fetchEventsFromFirestore();
    }
  }

  private async fetchEventsFromFirestore(): Promise<Event[]> {
    const snapshot = await getDocs(collection(db, 'events'));
    return snapshot.docs
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
        const media = Array.isArray(event.media)
          ? event.media.flatMap((item): NonNullable<Event['media']> => {
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
      .sort((left, right) => new Date(left.startDate).getTime() - new Date(right.startDate).getTime());
  }

  public async createEvent(input: CreateEventInput): Promise<string> {
    const event = await addDoc(collection(db, 'events'), { ...input, createdAt: serverTimestamp() });
    return event.id;
  }

  public async getAttendance(eventId: string, userId?: string): Promise<EventAttendanceStatus> {
    const attendees = await getDocs(query(collection(db, 'eventAttendees'), where('eventId', '==', eventId)));
    return {
      attendeeCount: attendees.size,
      isAttending: Boolean(userId && attendees.docs.some((document) => document.data().userId === userId)),
    };
  }

  public async toggleAttendance(eventId: string, userId: string): Promise<EventAttendanceStatus> {
    const existing = await getDocs(query(collection(db, 'eventAttendees'), where('eventId', '==', eventId), where('userId', '==', userId)));
    if (existing.empty) {
      await addDoc(collection(db, 'eventAttendees'), { eventId, userId, createdAt: new Date().toISOString() });
    } else {
      await Promise.all(existing.docs.map((document) => deleteDoc(document.ref)));
    }
    return this.getAttendance(eventId, userId);
  }
}

export const eventService = EventService.getInstance();
