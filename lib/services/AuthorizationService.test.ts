import { describe, expect, test } from 'bun:test';
import { authorizationService } from './AuthorizationService';
import type { PageAccessStatus } from '@/lib/types/pageAccess';

describe('tester page access authorization', () => {
  const developmentStatuses: PageAccessStatus[] = [
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

    for (const status of [...developmentStatuses, 'admin_only'] as PageAccessStatus[]) {
      expect(authorizationService.canAccessStatus(status, authorization)).toBe(true);
    }
  });
});
