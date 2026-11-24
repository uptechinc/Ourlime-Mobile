/** Pure rules for reviewing content appeals (no Firebase imports, so they are unit-testable). */

export type AppealDecision = 'approved' | 'rejected';
export type AppealFallbackPlan = 'already_reviewed' | 'missing_content' | 'restore_then_mark' | 'mark';

const UNREACHABLE_CODES = new Set(['REQUEST_TIMEOUT', 'unavailable', 'deadline-exceeded']);

/**
 * Only an unreachable server may fall back to the direct Firestore path. A response from the server (a 4xx
 * rejection, a 5xx failure, or `success: false`) is the answer and must be shown, never overridden on the client.
 */
export function isServerUnreachableError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code: unknown = 'code' in error ? error.code : undefined;
  if (typeof code === 'string' && UNREACHABLE_CODES.has(code)) return true;
  const message: unknown = 'message' in error ? error.message : undefined;
  return error instanceof TypeError && typeof message === 'string' && /network request failed/i.test(message);
}

/** What the offline fallback may do with an appeal, given its stored status and content reference. */
export function planAppealFallback(storedStatus: unknown, decision: AppealDecision, hasContentReference: boolean): AppealFallbackPlan {
  if (typeof storedStatus === 'string' && storedStatus !== '' && storedStatus !== 'pending') return 'already_reviewed';
  if (decision === 'rejected') return 'mark';
  return hasContentReference ? 'restore_then_mark' : 'missing_content';
}
