/** A learner's weekly class timetable (schedules/{uid}.schedules), the same shape the website stores. */
export type ScheduleDay = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
export type ScheduleRecurringType = 'weekly' | 'monthly';
export type ScheduleStatus = 'upcoming' | 'passed';

export type ScheduleReminders = {
  email: boolean;
  whatsapp: boolean;
};

export type ClassSchedule = {
  id: string;
  subject: string;
  /** "8:00" … "23:00" (24-hour, no leading zero), like the website's time slots. */
  startTime: string;
  /** "9:00" … "24:00". */
  endTime: string;
  day: ScheduleDay;
  status: ScheduleStatus;
  color: string;
  isRecurring: boolean;
  recurringType: ScheduleRecurringType;
  weekNumber?: number;
  monthNumber?: number;
  reminders: ScheduleReminders;
};

/** The add / edit class form (web schedules FormData). */
export type ClassScheduleForm = Omit<ClassSchedule, 'id' | 'status' | 'weekNumber' | 'monthNumber'>;

export type ScheduleTemplateEntry = Omit<ClassSchedule, 'id' | 'status'>;

/** scheduleTemplates/{uid}.templates */
export type ScheduleTemplate = {
  name: string;
  schedules: ScheduleTemplateEntry[];
};
