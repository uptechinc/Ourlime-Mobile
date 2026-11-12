import { doc, getDoc, type DocumentData } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { app, auth, db } from '@/lib/firebaseConfig';
import { nativeSessionService } from './NativeSessionService';
import type {
  ClassSchedule,
  ClassScheduleForm,
  ScheduleDay,
  ScheduleTemplate,
  ScheduleTemplateEntry,
} from '@/lib/types/schedule';

type ScheduleMutation =
  | { action: 'add_schedules'; schedules: ClassSchedule[] }
  | { action: 'update_schedule'; scheduleId: string; updatedSchedule: ClassScheduleForm }
  | { action: 'delete_schedule'; scheduleId: string }
  | { action: 'save_schedule_template'; template: ScheduleTemplate };

export const SCHEDULE_DAYS: ScheduleDay[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export const SCHEDULE_START_SLOTS = ['8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'];
/** A class can end at midnight, so end times run one hour past the last start time. */
export const SCHEDULE_END_SLOTS = [...SCHEDULE_START_SLOTS.slice(1), '24:00'];
export const SCHEDULE_FIRST_HOUR = 8;

/** Soft, distinct class colours (web components/eLearning/schedules CLASS_COLORS). */
export const CLASS_COLORS = [
  { name: 'Emerald', value: '#10b981' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Orange', value: '#f97316' },
] as const;

/** Thrown when the server has no schedule actions yet, so the screen can say so instead of a generic failure. */
export class ScheduleEditingUnavailableError extends Error {
  constructor() {
    super('Editing your class schedule is not available in the app yet. You can add and change classes on ourlime.com.');
    this.name = 'ScheduleEditingUnavailableError';
  }
}

/**
 * The learner's weekly class timetable (website components/eLearning/schedules). Reads schedules/{uid} and
 * scheduleTemplates/{uid} directly (the rules let the owner read them); the rules allow no client writes, so changes go
 * through the manageLearning callable's schedule actions with the same shapes the website's /api/schedules stores.
 */
export class ScheduleService {
  private static instance: ScheduleService;
  private constructor() {}

  public static getInstance(): ScheduleService {
    if (!ScheduleService.instance) ScheduleService.instance = new ScheduleService();
    return ScheduleService.instance;
  }

  public parseHour(time: string): number {
    return Number.parseInt(time, 10);
  }

  /** "13:00" → "1 PM". */
  public formatHour(time: string): string {
    const hour = this.parseHour(time) % 24;
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  }

  /** A light background from any saved colour, including the old neon ones. */
  public tint(hex: string, alpha: number): string {
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match) return `rgba(16, 185, 129, ${alpha})`;
    const value = Number.parseInt(match[1], 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
  }

  public todayName(now = new Date()): ScheduleDay | undefined {
    return SCHEDULE_DAYS[now.getDay() - 1];
  }

  public emptyForm(): ClassScheduleForm {
    return {
      subject: '', startTime: '8:00', endTime: '9:00', day: 'Monday', color: CLASS_COLORS[0].value,
      isRecurring: false, recurringType: 'weekly', reminders: { email: true, whatsapp: false },
    };
  }

  /** Weekly/monthly repeats are stored as separate copies; the timetable shows one block per day, start time and subject. */
  public visibleSchedules(schedules: ClassSchedule[]): ClassSchedule[] {
    return schedules.filter((schedule, index) =>
      schedules.findIndex((other) => other.day === schedule.day && other.startTime === schedule.startTime && other.subject === schedule.subject) === index);
  }

  /** True when the class overlaps another class on the same day (the website's validateTimeConflicts). */
  public hasConflict(schedules: ClassSchedule[], candidate: Pick<ClassSchedule, 'day' | 'startTime' | 'endTime'>, ignoreId?: string): boolean {
    const start = this.parseHour(candidate.startTime);
    const end = this.parseHour(candidate.endTime);
    return schedules.some((existing) => {
      if (existing.day !== candidate.day || existing.id === ignoreId) return false;
      const existingStart = this.parseHour(existing.startTime);
      const existingEnd = this.parseHour(existing.endTime);
      return (start >= existingStart && start < existingEnd) || (end > existingStart && end <= existingEnd);
    });
  }

  /** One class, or 4 weekly / 3 monthly copies when it repeats (the website's handleSubmit). */
  public buildSchedules(form: ClassScheduleForm, now = Date.now()): ClassSchedule[] {
    if (!form.isRecurring) return [{ id: `schedule_${now}`, ...form, status: 'upcoming' }];
    if (form.recurringType === 'weekly') {
      return [0, 1, 2, 3].map((week) => ({ id: `schedule_${now}_${week}`, ...form, weekNumber: week + 1, status: 'upcoming' }));
    }
    return [0, 1, 2].map((month) => ({ id: `schedule_${now}_${month}`, ...form, monthNumber: month + 1, status: 'upcoming' }));
  }

  public async getSchedules(userId: string): Promise<ClassSchedule[]> {
    this.assertSignedIn(userId);
    const snapshot = await getDoc(doc(db, 'schedules', userId));
    const list: unknown = snapshot.data()?.schedules;
    return Array.isArray(list) ? list.map((item) => this.schedule(item)).filter((item): item is ClassSchedule => item !== null) : [];
  }

  public async getTemplates(userId: string): Promise<ScheduleTemplate[]> {
    this.assertSignedIn(userId);
    const snapshot = await getDoc(doc(db, 'scheduleTemplates', userId));
    const list: unknown = snapshot.data()?.templates;
    if (!Array.isArray(list)) return [];
    return list.map((item) => this.template(item)).filter((item): item is ScheduleTemplate => item !== null);
  }

  public async addSchedules(schedules: ClassSchedule[]): Promise<void> {
    await this.mutate({ action: 'add_schedules', schedules });
  }

  public async updateSchedule(scheduleId: string, updatedSchedule: ClassScheduleForm): Promise<void> {
    await this.mutate({ action: 'update_schedule', scheduleId, updatedSchedule });
  }

  public async deleteSchedule(scheduleId: string): Promise<void> {
    await this.mutate({ action: 'delete_schedule', scheduleId });
  }

  public async saveTemplate(template: ScheduleTemplate): Promise<void> {
    await this.mutate({ action: 'save_schedule_template', template });
  }

  /** Writes the timetable as an .ics file and opens the share sheet (the website downloads schedule.ics). */
  public async exportCalendar(schedules: ClassSchedule[]): Promise<void> {
    const fileUri = `${FileSystem.cacheDirectory ?? ''}schedule.ics`;
    await FileSystem.writeAsStringAsync(fileUri, this.icsContent(schedules), { encoding: FileSystem.EncodingType.UTF8 });
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
    await Sharing.shareAsync(fileUri, { mimeType: 'text/calendar', dialogTitle: 'Export schedule.ics', UTI: 'com.apple.ical.ics' });
  }

  private icsContent(schedules: ClassSchedule[]): string {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ourlime//Schedule//EN'];
    schedules.forEach((schedule) => {
      lines.push('BEGIN:VEVENT', `SUMMARY:${schedule.subject}`, `DTSTART:${this.icsDate(schedule.day, schedule.startTime)}`, `DTEND:${this.icsDate(schedule.day, schedule.endTime)}`, 'END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  private icsDate(day: ScheduleDay, time: string): string {
    const today = new Date();
    const date = new Date(today);
    date.setDate(today.getDate() + ((SCHEDULE_DAYS.indexOf(day) - (today.getDay() - 1) + 7) % 7));
    date.setHours(this.parseHour(time), 0, 0, 0);
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  private async mutate(request: ScheduleMutation): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Sign in to edit your schedule.');
    await nativeSessionService.ensure(userId);
    try {
      await httpsCallable<ScheduleMutation, unknown>(getFunctions(app), 'manageLearning')(request);
    } catch (error: unknown) {
      const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : '';
      const message = error instanceof Error ? error.message : '';
      if (code.endsWith('not-found') || (code.endsWith('invalid-argument') && /unsupported/i.test(message))) throw new ScheduleEditingUnavailableError();
      throw error;
    }
    nativeSessionService.assertOwner(userId);
  }

  private assertSignedIn(userId: string): void {
    if (!userId || auth.currentUser?.uid !== userId) throw new Error('Sign in to see your schedule.');
  }

  private schedule(value: unknown): ClassSchedule | null {
    if (!value || typeof value !== 'object') return null;
    const data = value as DocumentData;
    const entry = this.entry(data);
    const id = typeof data.id === 'string' ? data.id : '';
    if (!entry || !id) return null;
    return { ...entry, id, status: data.status === 'passed' ? 'passed' : 'upcoming' };
  }

  private template(value: unknown): ScheduleTemplate | null {
    if (!value || typeof value !== 'object') return null;
    const data = value as DocumentData;
    if (typeof data.name !== 'string' || !Array.isArray(data.schedules)) return null;
    return {
      name: data.name,
      schedules: data.schedules.map((item: unknown) => (item && typeof item === 'object' ? this.entry(item as DocumentData) : null))
        .filter((item: ScheduleTemplateEntry | null): item is ScheduleTemplateEntry => item !== null),
    };
  }

  private entry(data: DocumentData): ScheduleTemplateEntry | null {
    const day = SCHEDULE_DAYS.find((item) => item === data.day);
    if (typeof data.subject !== 'string' || typeof data.startTime !== 'string' || typeof data.endTime !== 'string' || !day) return null;
    const reminders = data.reminders && typeof data.reminders === 'object' ? data.reminders as DocumentData : {};
    return {
      subject: data.subject,
      startTime: data.startTime,
      endTime: data.endTime,
      day,
      color: typeof data.color === 'string' ? data.color : CLASS_COLORS[0].value,
      isRecurring: data.isRecurring === true,
      recurringType: data.recurringType === 'monthly' ? 'monthly' : 'weekly',
      ...(typeof data.weekNumber === 'number' ? { weekNumber: data.weekNumber } : {}),
      ...(typeof data.monthNumber === 'number' ? { monthNumber: data.monthNumber } : {}),
      reminders: { email: reminders.email !== false, whatsapp: reminders.whatsapp === true },
    };
  }
}

export const scheduleService = ScheduleService.getInstance();
