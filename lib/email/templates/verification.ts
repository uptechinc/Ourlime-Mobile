import { VerificationEmailData } from '../../types/email';

export const generateVerificationEmailTemplate = (
  data: VerificationEmailData,
  domain: string
): string => {
  const verificationUrl = `${domain}/verify-email?token=${data.verificationToken}&userId=${data.userId}`;

  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
      <img src="${domain}/images/transparentLogo.png"
           alt="Ourlime Logo"
           style="width: 100px; margin-bottom: 20px;">

      <h1 style="color: #01EB53;">Welcome to Ourlime!</h1>
      
      <p>Hi ${data.userName},</p>
      
      <p>Thank you for joining Ourlime Communities Network. To complete your registration, please verify your email address.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}"
           style="background-color: #01EB53;
                  color: white;
                  padding: 12px 24px;
                  text-decoration: none;
                  border-radius: 5px;
                  font-weight: bold;">
          Verify Email Address
        </a>
      </div>
      
      <p style="color: #666;">
        This verification link will expire in ${data.expiresIn}. If you didn't create an account with Ourlime,
        please ignore this email.
      </p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="color: #888; font-size: 12px;">
          This is an automated message from Ourlime Communities Network.
          Please do not reply to this email.
        </p>
      </div>
    </div>
  `;
} 