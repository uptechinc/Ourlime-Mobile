import { describe, expect, test } from 'bun:test';
import { AccountLifecycleVisibilityService } from './AccountLifecycleVisibilityService.ts';

describe('AccountLifecycleVisibilityService', () => {
  const service = AccountLifecycleVisibilityService.getInstance();

  for (const status of ['archived', 'pending', 'suspended', 'banned', 'deleted']) {
    test(`hides ${status} resources`, () => {
      expect(service.isHidden({ accountLifecycleStatus: status })).toBe(true);
      expect(service.isHidden({ accountStatus: status })).toBe(true);
    });
  }

  test('keeps active resources and hides marker-backed resources', () => {
    expect(service.isHidden({ accountStatus: 'active' })).toBe(false);
    expect(service.isHidden({ accountLifecycleHiddenAt: { seconds: 1 } })).toBe(true);
  });
});
