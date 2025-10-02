import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

export class EmailAcceptService {
    private static instance: EmailAcceptService;

    public static getInstance(): EmailAcceptService {
        if (!EmailAcceptService.instance) {
            EmailAcceptService.instance = new EmailAcceptService();
        }
        return EmailAcceptService.instance;
    }

    async sendAcceptanceEmail(to: string, from: string, applicationData: any) {
        const mailOptions = {
            from: from,
            to: to,
            subject: `Congratulations! Your Application for ${applicationData.jobTitle} has been Accepted`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Application Accepted</title>
                </head>
                <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f9fafb;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; padding: 40px 20px;">
                        <tr>
                            <td>
                                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                                    <!-- Header -->
                                    <tr>
                                        <td style="background: linear-gradient(to right, #00ff5e, #00e676); padding: 40px 40px; text-align: center;">
                                            <img src="https://ourlime.com/images/transparentLogo.png"
                                            alt="Ourlime Logo"
                                            width="150"
                                            style="margin-bottom: 20px;"
                                            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Application Accepted!</h1>
                                        </td>
                                    </tr>

                                    <!-- Content -->
                                    <tr>
                                        <td style="padding: 40px;">
                                            <h2 style="color: #111827; margin: 0 0 20px; font-size: 20px;">Position: ${applicationData.jobTitle}</h2>
                                            
                                            <p style="margin: 0 0 20px; color: #374151; line-height: 1.6;">
                                                Congratulations! We are pleased to inform you that your application has been accepted. The hiring team was impressed with your qualifications and experience.
                                            </p>

                                            <p style="margin: 0 0 20px; color: #374151; line-height: 1.6;">
                                                The next steps and additional details will be communicated to you shortly.
                                            </p>

                                            <div style="text-align: center; margin-top: 30px;">
                                                <a href="${applicationData.applicationUrl}" style="display: inline-block; background-color: #00ff5e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">
                                                    View Application Details
                                                </a>
                                            </div>
                                        </td>
                                    </tr>

                                    <!-- Footer -->
                                    <tr>
                                        <td style="background-color: #f3f4f6; padding: 20px 40px; text-align: center;">
                                            <p style="margin: 0; color: #6b7280; font-size: 14px;">
                                                This is an automated message from Ourlime Platform
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
            `,
        };

        return transporter.sendMail(mailOptions);
    }
}
