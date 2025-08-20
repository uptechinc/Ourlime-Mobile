import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});


export class EmailService {
    private static instance: EmailService;

    public static getInstance(): EmailService {
        if (!EmailService.instance) {
            EmailService.instance = new EmailService();
        }
        return EmailService.instance;
    }

    async sendScheduleReminder(to: string, scheduleDetails: any) {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to,
            subject: 'Ourlime Schedule Reminder',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h1 style="color: #00ff5e;">Schedule Reminder</h1>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px;">
                        <h2 style="color: #333;">${scheduleDetails.subject}</h2>
                        <p><strong>Time:</strong> ${scheduleDetails.startTime} - ${scheduleDetails.endTime}</p>
                        <p><strong>Day:</strong> ${scheduleDetails.day}</p>
                    </div>
                    <p style="color: #666; margin-top: 20px;">
                        This is an automated reminder from Ourlime Learning Platform.
                    </p>
                </div>
            `
        };

        return transporter.sendMail(mailOptions);
    }
}
