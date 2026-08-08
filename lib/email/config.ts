import { type EmailConfig } from '../types/email';

/**
 * Validates and returns email configuration
 * Throws detailed error messages if configuration is invalid
 */
export const getEmailConfig = (): EmailConfig => {
  // Check for required environment variables
  const missingVars = [];
  
  if (!process.env.EMAIL_SERVICE) missingVars.push('EMAIL_SERVICE');
  if (!process.env.EMAIL_USER) missingVars.push('EMAIL_USER');
  if (!process.env.EMAIL_PASS) missingVars.push('EMAIL_PASS');
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env file and ensure all variables are set.\n' +
      'For Gmail, make sure to:\n' +
      '1. Enable 2-Step Verification in your Google Account\n' +
      '2. Generate an App Password for this application\n' +
      '3. Use the App Password as EMAIL_PASS'
    );
  }

  // For Gmail, enforce specific configuration
  if (process.env.EMAIL_SERVICE?.toLowerCase() === 'gmail') {
    return {
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // This should be an App Password for Gmail
      },
    };
  }

  // For other email services
  return {
    service: process.env.EMAIL_SERVICE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  };
};

/**
 * Gets the application domain
 * Always returns https://ourlime.vercel.app/
 */
export const getDomain = (): string => {
  return process.env.EXPO_PUBLIC_WEB_API_URL || 'https://ourlime.com/';
}; 