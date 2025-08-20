// lib/notifications/NotificationService.ts
export class NotificationService {
    private static instance: NotificationService;

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    async sendReminder(userId: string, message: string) {
        return false;
    }
}
