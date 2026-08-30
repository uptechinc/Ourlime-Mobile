export type BlogVerificationData = {
  identityVerificationStatus?: unknown;
  verificationStatus?: unknown;
};

export class BlogAuthorizationService {
  private static instance: BlogAuthorizationService;

  private constructor() {}

  public static getInstance(): BlogAuthorizationService {
    if (!BlogAuthorizationService.instance) {
      BlogAuthorizationService.instance = new BlogAuthorizationService();
    }
    return BlogAuthorizationService.instance;
  }

  public isIdentityVerified(verificationData: BlogVerificationData): boolean {
    return (
      verificationData.identityVerificationStatus === 'verified' ||
      verificationData.verificationStatus === 'verified'
    );
  }
}

export const blogAuthorizationService = BlogAuthorizationService.getInstance();