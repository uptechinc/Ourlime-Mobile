import { addDoc, collection, deleteDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ApiService } from './ApiService';
import type { Event } from '@/types/eventTypes';

export type EventAttendanceStatus = { isAttending: boolean; attendeeCount: number };
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
    const response = await this.apiService.request<{ status: 'success'; data: Event[] }>('/api/events/fetch');
    return Array.isArray(response.data) ? response.data : [];
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
