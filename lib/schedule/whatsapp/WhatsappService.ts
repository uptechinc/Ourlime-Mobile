// lib/whatsapp/WhatsappService.ts
export class WhatsappService {
    private static instance: WhatsappService;

    public static getInstance(): WhatsappService {
        if (!WhatsappService.instance) {
            WhatsappService.instance = new WhatsappService();
        }
        return WhatsappService.instance;
    }

    async sendReminder(phoneNumber: string, message: string) {
        return false;
    }
}
