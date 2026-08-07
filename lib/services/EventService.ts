import { addDoc, collection, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export type EventAttendanceStatus = { isAttending: boolean; attendeeCount: number };

export class EventService {
  private static instance: EventService;

  private constructor() {}

  public static getInstance(): EventService {
    if (!EventService.instance) EventService.instance = new EventService();
    return EventService.instance;
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
