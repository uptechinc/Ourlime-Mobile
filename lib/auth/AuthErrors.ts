export type AuthServiceErrorCode =
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_DELETED'
  | 'PROFILE_NOT_FOUND'
  | 'UNKNOWN';

export class AuthServiceError extends Error {
  public constructor(public readonly code: AuthServiceErrorCode, message: string) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

export const getAuthErrorCode = (error: unknown): string => {
  if (error && typeof error === 'object') {
    const errObj = error as Record<string, unknown>;
    if (typeof errObj.code === 'string' && errObj.code.length > 0) {
      return errObj.code;
    }
  }
  return 'UNKNOWN';
};
