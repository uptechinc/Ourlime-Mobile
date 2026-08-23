export type AuthServiceErrorCode =
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_DELETED'
  | 'ACCOUNT_BANNED'
  | 'ACCOUNT_SUSPENDED'
  | 'BETA_ACCESS_REVOKED'
  | 'BETA_ACCESS_SUSPENDED'
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
    const errorWithCode = error as { code?: unknown };
    if (typeof errorWithCode.code === 'string' && errorWithCode.code.length > 0) {
      return errorWithCode.code;
    }
  }
  return 'UNKNOWN';
};
