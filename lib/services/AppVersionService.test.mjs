import { describe, expect, mock, test } from 'bun:test';

let configSnapshot = { exists: () => false, data: () => undefined };
let getDocBehaviour = async () => configSnapshot;

mock.module('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0' } } }));
mock.module('react-native', () => ({ Platform: { OS: 'android' } }));
mock.module('@/lib/firebaseConfig', () => ({ db: {} }));
mock.module('firebase/firestore', () => ({
  doc: (_db, ...path) => path.join('/'),
  getDoc: (reference) => getDocBehaviour(reference),
}));

const { appVersionService } = await import('./AppVersionService.ts');

describe('AppVersionService', () => {
  test('compares versions segment by segment', () => {
    const parse = (version) => appVersionService.parseVersion(version);
    expect(appVersionService.compare(parse('1.10.0'), parse('1.9.9'))).toBeGreaterThan(0);
    expect(appVersionService.compare(parse('1.0'), parse('1.0.0'))).toBe(0);
    expect(appVersionService.compare(parse('1.0.0'), parse('1.0.1'))).toBeLessThan(0);
    expect(parse('1.x')).toBeNull();
    expect(parse('')).toBeNull();
  });

  test('blocks only builds older than the minimum', () => {
    expect(appVersionService.evaluate('1.0.0', { minimumVersion: '1.0.0' }, 'android')).toEqual({ status: 'supported' });
    expect(appVersionService.evaluate('1.2.0', { minimumVersion: '1.1.0' }, 'android')).toEqual({ status: 'supported' });
    const blocked = appVersionService.evaluate('1.0.0', { minimumVersion: '1.1.0' }, 'android');
    expect(blocked.status).toBe('update_required');
    expect(blocked.storeUrl).toBe('https://play.google.com/store/apps/details?id=com.ourlime.app');
  });

  test('missing or malformed config never blocks', () => {
    expect(appVersionService.evaluate('1.0.0', null, 'android')).toEqual({ status: 'supported' });
    expect(appVersionService.evaluate('1.0.0', {}, 'android')).toEqual({ status: 'supported' });
    expect(appVersionService.evaluate('1.0.0', { minimumVersion: 2 }, 'android')).toEqual({ status: 'supported' });
    expect(appVersionService.evaluate('', { minimumVersion: '9.0.0' }, 'android')).toEqual({ status: 'supported' });
  });

  test('uses configured store links only when they are store or https URLs', () => {
    const ios = appVersionService.evaluate('1.0.0', { minimumVersion: '2.0.0', iosStoreUrl: 'itms-apps://apps.apple.com/app/id1' }, 'ios');
    expect(ios.storeUrl).toBe('itms-apps://apps.apple.com/app/id1');
    const unsafe = appVersionService.evaluate('1.0.0', { minimumVersion: '2.0.0', androidStoreUrl: 'javascript:alert(1)' }, 'android');
    expect(unsafe.storeUrl).toBe('https://play.google.com/store/apps/details?id=com.ourlime.app');
    const iosFallback = appVersionService.evaluate('1.0.0', { minimumVersion: '2.0.0' }, 'ios');
    expect(iosFallback.storeUrl).toBe('https://ourlime.com');
  });

  test('check() reads siteConfig/mobileApp and fails open when it cannot', async () => {
    configSnapshot = { exists: () => true, data: () => ({ minimumVersion: '1.5.0', updateMessage: 'Please update.' }) };
    const blocked = await appVersionService.check();
    expect(blocked.status).toBe('update_required');
    expect(blocked.message).toBe('Please update.');

    getDocBehaviour = async () => { throw new Error('permission-denied'); };
    expect(await appVersionService.check()).toEqual({ status: 'supported' });
  });
});
