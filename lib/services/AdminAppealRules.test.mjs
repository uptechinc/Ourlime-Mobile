import { describe, expect, test } from 'bun:test';

const rules = await import('./AdminAppealRules.ts');

class FakeAdminApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

describe('AdminAppealRules', () => {
  test('only an unreachable server allows the Firestore fallback', () => {
    expect(rules.isServerUnreachableError(new FakeAdminApiError('timeout', 504, 'REQUEST_TIMEOUT'))).toBe(true);
    expect(rules.isServerUnreachableError({ code: 'unavailable', message: 'down' })).toBe(true);
    expect(rules.isServerUnreachableError(new TypeError('Network request failed'))).toBe(true);

    expect(rules.isServerUnreachableError(new FakeAdminApiError('Invalid appeal review parameters.', 400))).toBe(false);
    expect(rules.isServerUnreachableError(new FakeAdminApiError('Forbidden', 403))).toBe(false);
    expect(rules.isServerUnreachableError(new FakeAdminApiError('Internal server error', 500))).toBe(false);
    expect(rules.isServerUnreachableError({ code: 'permission-denied' })).toBe(false);
    expect(rules.isServerUnreachableError(new Error('Something else'))).toBe(false);
    expect(rules.isServerUnreachableError(null)).toBe(false);
    expect(rules.isServerUnreachableError('REQUEST_TIMEOUT')).toBe(false);
  });

  test('the fallback never re-reviews an appeal and restores before approving', () => {
    expect(rules.planAppealFallback('approved', 'approved', true)).toBe('already_reviewed');
    expect(rules.planAppealFallback('rejected', 'rejected', true)).toBe('already_reviewed');
    expect(rules.planAppealFallback('pending', 'approved', true)).toBe('restore_then_mark');
    expect(rules.planAppealFallback(undefined, 'approved', true)).toBe('restore_then_mark');
    expect(rules.planAppealFallback('pending', 'approved', false)).toBe('missing_content');
    expect(rules.planAppealFallback('pending', 'rejected', false)).toBe('mark');
  });
});
