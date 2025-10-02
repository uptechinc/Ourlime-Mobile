// lib/schedule/reminders/ReminderManager.ts
import { NotificationService } from '../notifications/NotificationService';
import { WhatsappService } from '../whatsapp/WhatsappService';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

export class ReminderManager {
    private static instance: ReminderManager;
    private notificationService: NotificationService;
    private whatsappService: WhatsappService;

    private constructor() {
        this.notificationService = NotificationService.getInstance();
        this.whatsappService = WhatsappService.getInstance();
    }

    public static getInstance(): ReminderManager {
        if (!ReminderManager.instance) {
            ReminderManager.instance = new ReminderManager();
        }
        return ReminderManager.instance;
    }

    private async updateScheduleStatus(userId: string, scheduleId: string, newStatus: string) {
        await fetch('/api/schedules', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                scheduleId,
                updatedSchedule: { status: newStatus }
            })
        });
    }

    private async checkAndResetPassedSchedules(userId: string, schedule: any) {
        if (schedule.status === 'passed') {
            const passedDate = new Date(schedule.updatedAt.toDate());
            const now = new Date();
            const daysDifference = Math.floor((now.getTime() - passedDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysDifference >= 3) {
                await this.updateScheduleStatus(userId, schedule.id, 'upcoming');
            }
        }
    }

    private shouldUpdateToPassed(schedule: any): boolean {
        const now = new Date();
        const [endHours, endMinutes] = schedule.endTime.split(':');
        const endTime = new Date();
        endTime.setHours(parseInt(endHours), parseInt(endMinutes), 0);
        
        return now.getTime() > endTime.getTime();
    }

    private determineStatus(schedule: any) {
        const now = new Date();
        const today = now.toLocaleDateString('en-US', { weekday: 'long' });
        
        if (schedule.day !== today) return 'not-due';

        const [hours, minutes] = schedule.startTime.split(':');
        const scheduleTime = new Date();
        scheduleTime.setHours(parseInt(hours), parseInt(minutes), 0);

        const timeDiff = scheduleTime.getTime() - now.getTime();
        const minutesDiff = Math.floor(timeDiff / (1000 * 60));

        if (minutesDiff <= 20 && minutesDiff > 0) {
            return 'upcoming';
        }
        return 'not-due';
    }

    private filterUpcomingSchedules(schedules: any[]) {
        return schedules.filter(schedule => 
            this.determineStatus(schedule) === 'upcoming' && 
            schedule.status !== 'reminded' && 
            schedule.status !== 'passed'
        );
    }

    async processReminders(schedules: any[]) {
        for (const schedule of schedules) {
            const userDoc = await getDoc(doc(db, 'users', schedule.id));
            const userEmail = userDoc.data()?.email;

            if (!userEmail) continue;

            // Check and reset any passed schedules that are over 3 days old
            await this.checkAndResetPassedSchedules(schedule.id, schedule);

            const upcomingSchedules = this.filterUpcomingSchedules(schedule.schedules);
            
            for (const upcomingSchedule of upcomingSchedules) {
                // Check if schedule has ended and should be marked as passed
                if (this.shouldUpdateToPassed(upcomingSchedule)) {
                    await this.updateScheduleStatus(schedule.id, upcomingSchedule.id, 'passed');
                    continue;
                }

                if (upcomingSchedule.reminders?.email) {
                    const response = await fetch('/api/reminders/email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            email: userEmail, 
                            schedule: upcomingSchedule 
                        })
                    });

                    if (response.ok) {
                        await this.updateScheduleStatus(schedule.id, upcomingSchedule.id, 'reminded');
                    }
                }

                if (upcomingSchedule.reminders?.notification) {
                    await this.notificationService.sendReminder(
                        schedule.id,
                        `Your class ${upcomingSchedule.subject} starts in 20 minutes`
                    );
                }

                if (upcomingSchedule.reminders?.whatsapp && userDoc.data()?.phone) {
                    await this.whatsappService.sendReminder(
                        userDoc.data().phone,
                        `Reminder: Your class ${upcomingSchedule.subject} starts at ${upcomingSchedule.startTime}`
                    );
                }
            }
        }
    }
}
