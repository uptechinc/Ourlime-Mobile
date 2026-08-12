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
  if (error instanceof AuthServiceError) return error.code;
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') return error.code;
  return 'UNKNOWN';
};
