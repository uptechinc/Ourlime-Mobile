export type VerificationEmailData = {
  userName: string;
  verificationToken: string;
  userId: string;
  email: string;
  expiresIn: string;
};

export type EmailConfig = {
  service: string;
  auth: {
    user: string;
    pass: string;
  };
};

export type EmailOptions = {
  from: string;
  to: string;
  subject: string;
  html: string;
}; 