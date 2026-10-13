import { describe, expect, mock, test } from 'bun:test';

// PageAccessService pulls in the Firebase client, which needs React Native; the routing logic doesn't.
mock.module('@/lib/firebaseConfig', () => ({ db: {} }));
mock.module('firebase/firestore', () => ({ collection: () => null, onSnapshot: () => () => {}, orderBy: () => null, query: () => null }));

const { pageAccessService } = await import('./PageAccessService.ts');
const { authorizationService } = await import('./AuthorizationService.ts');

const setting = (id, route, status) => ({ id, pageName: id, route, status, showInNavigation: true, showPagePreview: true, order: 0 });

// Shaped like production pageAccessSettings: stored docs keep the website's routes.
const SETTINGS = [
  setting('system', '*', 'enabled'),
  setting('home', '/', 'enabled'),
  setting('limes', '/limes', 'admin_only'),
  setting('messages', '/messages', 'enabled'),
  setting('profile', '/profile', 'enabled'),
  setting('profile-settings', '/profile/settings', 'coming_soon'),
  setting('events', '/events', 'beta_only'),
  setting('ewallet', '/eWallet', 'coming_soon'),
  setting('admin', '/profile/admin', 'admin_only'),
];

const roles = {
  user: authorizationService.resolve({ role: 'user' }),
  premium: authorizationService.resolve({ role: 'premium' }),
  tester: authorizationService.resolve({ role: 'tester' }),
  developer: authorizationService.resolve({ role: 'developer' }),
  admin: authorizationService.resolve({ role: 'admin', isAdmin: true }),
};
const decide = (route, role) => pageAccessService.getDecision(SETTINGS, route, roles[role]);

describe('tab screens follow their page settings', () => {
  test('the Limes tab path resolves to the Limes setting', () => {
    expect(decide('/Limes', 'user').setting?.id).toBe('limes');
    expect(decide('/(tabs)/Limes', 'user').setting?.id).toBe('limes');
  });

  test('admin-only Limes is closed and hidden for everyone but admins', () => {
    for (const role of ['user', 'premium', 'tester', 'developer']) {
      expect(decide('/Limes', role).canRead).toBe(false);
      expect(decide('/limes/viewer', role).canRead).toBe(false);
    }
    expect(decide('/Limes', 'user').isVisibleInNavigation).toBe(false);
    expect(decide('/Limes', 'admin').canRead).toBe(true);
    expect(decide('/Limes', 'admin').isVisibleInNavigation).toBe(true);
  });

  test('the website routes for messages and profile settings gate the app screens', () => {
    expect(decide('/Chat', 'user').setting?.id).toBe('messages');
    expect(decide('/chat/abc', 'user').setting?.id).toBe('messages');
    expect(decide('/settings', 'user').setting?.id).toBe('profile-settings');
    expect(decide('/settings', 'user').canRead).toBe(false);
  });
});

describe('restricted pages are only listed for people who can open them', () => {
  test('coming soon pages are hidden from regular users and listed for testers', () => {
    expect(decide('/eWallet', 'user').isVisibleInNavigation).toBe(false);
    expect(decide('/eWallet', 'tester').isVisibleInNavigation).toBe(true);
  });

  test('beta pages are listed for premium members only among non-staff', () => {
    expect(decide('/events', 'user').isVisibleInNavigation).toBe(false);
    expect(decide('/events', 'premium').canRead).toBe(true);
    expect(decide('/events', 'premium').isVisibleInNavigation).toBe(true);
  });

  test('developers see coming soon pages as a read-only preview only', () => {
    const decision = decide('/eWallet', 'developer');
    expect(decision.canRead).toBe(false);
    expect(decision.canEnterPreview).toBe(true);
    expect(decision.isVisibleInNavigation).toBe(true);
  });

  test('admin pages stay admin-only', () => {
    for (const role of ['user', 'premium', 'tester', 'developer']) {
      expect(decide('/admin', role).canRead).toBe(false);
      expect(decide('/admin', role).isVisibleInNavigation).toBe(false);
    }
    expect(decide('/admin', 'admin').canRead).toBe(true);
  });

  test('open pages stay open', () => {
    for (const role of Object.keys(roles)) {
      expect(decide('/', role).canRead).toBe(true);
      expect(decide('/Profile', role).canRead).toBe(true);
    }
  });
});
