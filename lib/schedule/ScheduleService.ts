// lib/services/ScheduleService.ts
import { db } from '@/lib/firebaseConfig';
import { collection, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

interface Schedule {
    id: string;
    subject: string;
    startTime: string;
    endTime: string;
    day: string;
    status: 'upcoming' | 'passed';
    color: string;
    isRecurring: boolean;
    recurringType: 'weekly' | 'monthly';
    weekNumber?: number;
    monthNumber?: number;
    reminders: {
        email: boolean;
        whatsapp: boolean;
    };
}

interface Template {
    name: string;
    schedules: Omit<Schedule, 'id' | 'status'>[];
}

export class ScheduleService {
    private static instance: ScheduleService;
    private readonly db;

    private constructor() {
        this.db = db;
    }

    public static getInstance(): ScheduleService {
        if (!ScheduleService.instance) {
            ScheduleService.instance = new ScheduleService();
        }
        return ScheduleService.instance;
    }

    async getSchedules(userId: string): Promise<Schedule[]> {
        const scheduleDoc = await getDoc(doc(this.db, 'schedules', userId));
        return scheduleDoc.exists() ? scheduleDoc.data().schedules : [];
    }

    async addSchedules(userId: string, newSchedules: Schedule[]): Promise<void> {
        const docRef = doc(this.db, 'schedules', userId);
        const existingDoc = await getDoc(docRef);
        const existingSchedules = existingDoc.exists() ? existingDoc.data().schedules : [];

        await setDoc(docRef, {
            schedules: [...existingSchedules, ...newSchedules],
            updatedAt: serverTimestamp()
        }, { merge: true });
    }

    async updateSchedule(userId: string, scheduleId: string, updatedSchedule: Partial<Schedule>): Promise<void> {
        const docRef = doc(this.db, 'schedules', userId);
        const scheduleDoc = await getDoc(docRef);

        if (!scheduleDoc.exists()) throw new Error('Schedule not found');

        const schedules = scheduleDoc.data().schedules;
        const updatedSchedules = schedules.map((schedule: Schedule) => 
            schedule.id === scheduleId ? { ...schedule, ...updatedSchedule } : schedule
        );

        await updateDoc(docRef, {
            schedules: updatedSchedules,
            updatedAt: serverTimestamp()
        });
    }

    async deleteSchedule(userId: string, scheduleId: string): Promise<void> {
        const docRef = doc(this.db, 'schedules', userId);
        const scheduleDoc = await getDoc(docRef);

        if (!scheduleDoc.exists()) throw new Error('Schedule not found');

        const schedules = scheduleDoc.data().schedules;
        const updatedSchedules = schedules.filter((schedule: Schedule) => schedule.id !== scheduleId);

        await updateDoc(docRef, {
            schedules: updatedSchedules,
            updatedAt: serverTimestamp()
        });
    }

    async getTemplates(userId: string): Promise<Template[]> {
        const templateDoc = await getDoc(doc(this.db, 'scheduleTemplates', userId));
        return templateDoc.exists() ? templateDoc.data().templates : [];
    }

    async saveTemplate(userId: string, template: Template): Promise<void> {
        const docRef = doc(this.db, 'scheduleTemplates', userId);
        const existingDoc = await getDoc(docRef);
        const existingTemplates = existingDoc.exists() ? existingDoc.data().templates : [];

        await setDoc(docRef, {
            templates: [...existingTemplates, template],
            updatedAt: serverTimestamp()
        }, { merge: true });
    }
}
