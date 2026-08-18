import { describe, expect, it } from 'bun:test';
import { authorizationService } from '@/lib/services/AuthorizationService';
import { authTestHarness } from '../services/AuthTestHarness';
import { mockUsers } from '../mocks/mockUsers';

describe('Suite 01: Authentication & Authorization Flow', () => {
  it('should correctly resolve regular user role and permissions', () => {
    authTestHarness.signInAs('regular');
    const authState = authTestHarness.getAuthorizationState();

    expect(authState.role).toBe('user');
    expect(authState.isAdmin).toBe(false);
    expect(authState.isDeveloper).toBe(false);
    expect(authState.isPremium).toBe(false);
  });

  it('should correctly resolve admin user role and permissions', () => {
    authTestHarness.signInAs('admin');
    const authState = authTestHarness.getAuthorizationState();

    expect(authState.role).toBe('admin');
    expect(authState.isAdmin).toBe(true);
    expect(authState.isDeveloper).toBe(true);
  });

  it('should correctly resolve developer user role and permissions', () => {
    authTestHarness.signInAs('developer');
    const authState = authTestHarness.getAuthorizationState();

    expect(authState.role).toBe('developer');
    expect(authState.isDeveloper).toBe(true);
    expect(authState.isAdmin).toBe(false);
  });

  it('should grant access to admin_only pages only for administrators', () => {
    const adminAuth = authorizationService.resolve(mockUsers.admin);
    const regularAuth = authorizationService.resolve(mockUsers.regular);

    expect(authorizationService.canAccessStatus('admin_only', adminAuth)).toBe(true);
    expect(authorizationService.canAccessStatus('admin_only', regularAuth)).toBe(false);
  });

  it('should grant access to beta_only pages for premium, dev, and admin users', () => {
    const adminAuth = authorizationService.resolve(mockUsers.admin);
    const devAuth = authorizationService.resolve(mockUsers.developer);
    const premiumAuth = authorizationService.resolve(mockUsers.premium);
    const regularAuth = authorizationService.resolve(mockUsers.regular);

    expect(authorizationService.canAccessStatus('beta_only', adminAuth)).toBe(true);
    expect(authorizationService.canAccessStatus('beta_only', devAuth)).toBe(true);
    expect(authorizationService.canAccessStatus('beta_only', premiumAuth)).toBe(true);
    expect(authorizationService.canAccessStatus('beta_only', regularAuth)).toBe(false);
  });
});
