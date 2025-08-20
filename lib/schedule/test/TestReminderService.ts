// lib/test/TestReminderService.ts
import { EmailService } from '../email/EmailService';
import { NotificationService } from '../notifications/NotificationService';
import { WhatsappService } from '../whatsapp/WhatsappService';

export class TestReminderService {
    private static instance: TestReminderService;
    private emailService: EmailService;
    private notificationService: NotificationService;
    private whatsappService: WhatsappService;

    private constructor() {
        this.emailService = EmailService.getInstance();
        this.notificationService = NotificationService.getInstance();
        this.whatsappService = WhatsappService.getInstance();
    }

    public static getInstance(): TestReminderService {
        if (!TestReminderService.instance) {
            TestReminderService.instance = new TestReminderService();
        }
        return TestReminderService.instance;
    }

    async testEmail(email: string) {
        const testSchedule = {
            subject: "Test Class",
            startTime: "10:00 AM",
            endTime: "11:00 AM",
            day: "Monday"
        };
        return await this.emailService.sendScheduleReminder(email, testSchedule);
    }

    async testNotification(userId: string) {
        return await this.notificationService.sendReminder(userId, "Test notification message");
    }

    async testWhatsapp(phoneNumber: string) {
        return await this.whatsappService.sendReminder(phoneNumber, "Test WhatsApp message");
    }

    async testAll(userId: string, email: string, phoneNumber: string) {
        const results = {
            email: await this.testEmail(email),
            notification: await this.testNotification(userId),
            whatsapp: await this.testWhatsapp(phoneNumber)
        };
        return results;
    }
}
