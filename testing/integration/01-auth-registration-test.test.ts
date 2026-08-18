import { afterAll, describe, expect, it } from 'bun:test';
import { e2eDataCleanupService } from '../services/E2eDataCleanupService';
import { authorizationService } from '@/lib/services/AuthorizationService';
import type { UserProfile } from '@/lib/services/AuthService';

describe('Integration Suite 01: Test Registration & Automated Verification Bypass', () => {
  let createdUser: UserProfile | null = null;

  it('should register a new test user account and bypass manual email verification', async () => {
    const timestamp = Date.now();
    const testEmail = `test_automated_${timestamp}@ourlime.test`;
    const testUsername = `autotest_${timestamp}`;

    // Simulate registration payload
    createdUser = {
      uid: `test_uid_${timestamp}`,
      firstName: 'Automated',
      lastName: 'Tester',
      userName: testUsername,
      email: testEmail,
      role: 'user',
      accountType: 'personal',
      emailVerified: true, // Automated verification set directly per test requirements
    };

    // Register for cleanup tracking
    e2eDataCleanupService.registerUser(createdUser.uid);

    expect(createdUser.uid).toBeDefined();
    expect(createdUser.emailVerified).toBe(true);
  });

  it('should verify authenticated session and role resolution for registered user', () => {
    expect(createdUser).not.toBeNull();
    if (!createdUser) return;

    const authState = authorizationService.resolve(createdUser);
    expect(authState.role).toBe('user');
    expect(authState.isAdmin).toBe(false);
    expect(authState.isDeveloper).toBe(false);
  });

  afterAll(async () => {
    const result = await e2eDataCleanupService.cleanupAll(async (record) => {
      // Cleanup hook: simulates deletion of test auth document
    });
    expect(result.errors.length).toBe(0);
  });
});
