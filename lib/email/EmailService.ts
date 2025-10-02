import nodemailer from 'nodemailer';
import { type EmailConfig, type EmailOptions, type VerificationEmailData } from '../types/email';
import { generateVerificationEmailTemplate } from './templates/verification';

/**
 * Service for handling email operations
 */
export class EmailService {
  private transporter: nodemailer.Transporter;
  private domain: string;

  constructor(config: EmailConfig, domain: string) {
    this.transporter = nodemailer.createTransport(config);
    this.domain = domain;
  }

  /**
   * Sends an email using the configured transporter
   * @param options - The email options including recipient, subject, and content
   * @returns Promise containing the email sending result
   */
  private async sendEmail(options: EmailOptions): Promise<nodemailer.SentMessageInfo> {
    try {
      const info = await this.transporter.sendMail(options);
      console.log('Email sent successfully:', info.response);
      return info;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Sends a verification email to a new user
   * @param data - The verification email data including user details and token
   * @returns Promise containing the email sending result
   */
  async sendVerificationEmail(data: VerificationEmailData): Promise<nodemailer.SentMessageInfo> {
    const html = generateVerificationEmailTemplate(data, this.domain);
    
    const mailOptions: EmailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@ourlime.com',
      to: data.email,
      subject: 'Welcome to Ourlime - Verify Your Email',
      html,
    };

    return this.sendEmail(mailOptions);
  }
} 