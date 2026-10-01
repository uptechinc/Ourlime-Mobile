import { FirebaseError } from 'firebase/app';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { app } from '@/lib/firebaseConfig';
import { DiagnosticLogService } from './DiagnosticLogService';

export type AppServerErrorCode =
  | 'unauthenticated'
  | 'permission-denied'
  | 'not-found'
  | 'invalid-argument'
  | 'failed-precondition'
  | 'already-exists'
  | 'resource-exhausted'
  | 'unavailable'
  | 'deadline-exceeded'
  | 'internal'
  | 'unknown';

/** An error returned by one of the app's own Cloud Functions, with its code and a user-facing message. */
export class AppServerError extends Error {
  public constructor(public readonly code: AppServerErrorCode, message: string) {
    super(message);
    this.name = 'AppServerError';
  }
}

const KNOWN_CODES = new Set<AppServerErrorCode>(['unauthenticated', 'permission-denied', 'not-found', 'invalid-argument', 'failed-precondition', 'already-exists', 'resource-exhausted', 'unavailable', 'deadline-exceeded', 'internal']);

/**
 * The app's own server: callable Cloud Functions in us-central1 (codebase "reliability").
 * Uses the same Firebase JS sign-in as Firestore, so every call carries the user's ID token.
 */
export class AppServerService {
  private static instance: AppServerService;
  private readonly logger = DiagnosticLogService.getInstance();
  private functions: Functions | null = null;

  private constructor() {}

  public static getInstance(): AppServerService {
    if (!AppServerService.instance) AppServerService.instance = new AppServerService();
    return AppServerService.instance;
  }

  public async call<TResponse>(name: string, data: object = {}, timeoutMs = 15_000): Promise<TResponse> {
    try {
      const callable = httpsCallable<object, TResponse>(this.getFunctionsClient(), name, { timeout: timeoutMs });
      return (await callable(data)).data;
    } catch (error: unknown) {
      const normalized = this.normalize(error);
      this.logger.warn('AppServerService', `call:${name}`, { code: normalized.code, message: normalized.message });
      throw normalized;
    }
  }

  /** Address of an HTTP (non-callable) function, e.g. the case attachment upload endpoint. */
  public functionUrl(name: string): string {
    return `https://us-central1-${app.options.projectId}.cloudfunctions.net/${name}`;
  }

  private getFunctionsClient(): Functions {
    if (!this.functions) this.functions = getFunctions(app, 'us-central1');
    return this.functions;
  }

  private normalize(error: unknown): AppServerError {
    if (error instanceof FirebaseError) {
      const code = error.code.replace(/^functions\//, '') as AppServerErrorCode;
      return new AppServerError(KNOWN_CODES.has(code) ? code : 'unknown', error.message || 'The Ourlime server could not complete this request.');
    }
    return new AppServerError('unknown', error instanceof Error ? error.message : 'The Ourlime server could not complete this request.');
  }
}

export const appServerService = AppServerService.getInstance();
