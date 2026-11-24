import { describe, expect, test } from 'bun:test';
import { authorizationService } from './AuthorizationService.ts';

describe('tester page access authorization', () => {
  const developmentStatuses = [
    'coming_soon',
    'maintenance',
    'beta_only',
    'developer_only',
    'disabled',
  ];

  test('regular users respect development restrictions', () => {
    const authorization = authorizationService.resolve({
      accountType: 'regular',
      role: 'user',
    });

    expect(authorizationService.canAccessStatus('enabled', authorization)).toBe(true);
    for (const status of developmentStatuses) {
      expect(authorizationService.canAccessStatus(status, authorization)).toBe(false);
    }
  });

  test('testers access development pages but not admin pages', () => {
    const authorization = authorizationService.resolve({
      accountType: 'regular',
      role: 'tester',
    });

    for (const status of developmentStatuses) {
      expect(authorizationService.canAccessStatus(status, authorization)).toBe(true);
    }
    expect(authorizationService.canAccessStatus('admin_only', authorization)).toBe(false);
  });

  test('administrators access development and admin pages', () => {
    const authorization = authorizationService.resolve({
      accountType: 'regular',
      role: 'admin',
    });

    for (const status of [...developmentStatuses, 'admin_only']) {
      expect(authorizationService.canAccessStatus(status, authorization)).toBe(true);
    }
  });
});

describe('canonical administrator definition (mirrors firestore.rules isAdministrator)', () => {
  test('accepts exactly isAdmin, role admin or accountType admin', () => {
    expect(authorizationService.isAdministratorRecord({ isAdmin: true })).toBe(true);
    expect(authorizationService.isAdministratorRecord({ role: 'admin' })).toBe(true);
    expect(authorizationService.isAdministratorRecord({ accountType: 'admin' })).toBe(true);
    expect(authorizationService.isAdministratorRecord({ role: 'user', accountType: 'admin' })).toBe(true);
  });

  test('rejects roles the rules do not treat as admin', () => {
    for (const profile of [
      null,
      undefined,
      {},
      { isAdmin: 'true' },
      { role: 'super_admin' },
      { role: 'developer' },
      { role: 'dev' },
      { role: 'Admin' },
      { role: 'moderator' },
      { isSuperAdmin: true },
      { isDeveloper: true },
      { userType: 'admin' },
    ]) {
      expect(authorizationService.isAdministratorRecord(profile)).toBe(false);
    }
  });

  test('resolve() agrees with the canonical check, including accountType admin with a non-admin role', () => {
    expect(authorizationService.resolve({ accountType: 'admin', role: 'user' }).isAdmin).toBe(true);
    expect(authorizationService.resolve({ accountType: 'regular', role: 'developer', isDeveloper: true }).isAdmin).toBe(false);
    expect(authorizationService.resolve({ accountType: 'regular', role: 'Admin' }).isAdmin).toBe(false);
  });

  test('reviewers are administrators or role moderator (isModeratorOrAdministrator)', () => {
    expect(authorizationService.isReviewerRecord({ role: 'moderator' })).toBe(true);
    expect(authorizationService.isReviewerRecord({ isAdmin: true })).toBe(true);
    expect(authorizationService.isReviewerRecord({ accountType: 'moderator' })).toBe(false);
    expect(authorizationService.isReviewerRecord({ role: 'tester' })).toBe(false);
  });
});
