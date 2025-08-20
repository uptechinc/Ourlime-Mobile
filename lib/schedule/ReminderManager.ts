// lib/schedule/ReminderManager.ts
import { EmailService } from './email/EmailService';
import { NotificationService } from './notifications/NotificationService';
import { WhatsappService } from './whatsapp/WhatsappService';

export class ReminderManager {
    private static instance: ReminderManager;
    private emailService: EmailService;
    private notificationService: NotificationService;
    private whatsappService: WhatsappService;

    private constructor() {
        this.emailService = EmailService.getInstance();
        this.notificationService = NotificationService.getInstance();
        this.whatsappService = WhatsappService.getInstance();
    }

    public static getInstance(): ReminderManager {
        if (!ReminderManager.instance) {
            ReminderManager.instance = new ReminderManager();
        }
        return ReminderManager.instance;
    }

    async checkUpcomingSchedules(schedules: any[], userData: any) {
        const upcomingSchedules = this.filterUpcomingSchedules(schedules);
        
        for (const schedule of upcomingSchedules) {
            if (schedule.reminders.email) {
                await this.emailService.sendScheduleReminder(userData.email, schedule);
            }
            if (schedule.reminders.notification) {
                await this.notificationService.sendReminder(userData.id, schedule);
            }
            if (schedule.reminders.whatsapp) {
                await this.whatsappService.sendReminder(userData.phone, schedule);
            }
        }
    }

    private filterUpcomingSchedules(schedules: any[]) {
        // Logic to filter schedules that are coming up soon
        return schedules.filter(schedule => {
            // Add your schedule filtering logic here
            return true;
        });
    }
}
