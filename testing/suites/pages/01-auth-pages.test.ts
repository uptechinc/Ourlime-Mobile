import { describe, expect, it } from 'bun:test';
import { pageAccessService } from '@/lib/services/PageAccessService';

describe('Page Test Suite 01: Authentication & Onboarding Routes', () => {
  const authRoutes = [
    '/(auth)/login',
    '/(auth)/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
  ];

  it('should identify all authentication routes as public and accessible without session', () => {
    for (const route of authRoutes) {
      expect(pageAccessService.isPublicRoute(route)).toBe(true);
    }
  });

  it('should redirect unauthenticated users navigating to protected routes to login', () => {
    const target = pageAccessService.getTargetRedirect(null, '/(tabs)');
    expect(target).toBe('/(auth)/login');
  });

  it('should redirect authenticated and verified users on login/register to tabs', () => {
    const mockAuthUser = { emailVerified: true, uid: 'user_123' } as any;
    const loginRedirect = pageAccessService.getTargetRedirect(mockAuthUser, '/(auth)/login');
    const registerRedirect = pageAccessService.getTargetRedirect(mockAuthUser, '/(auth)/register');

    expect(loginRedirect).toBe('/(tabs)');
    expect(registerRedirect).toBe('/(tabs)');
  });
});
