import { describe, expect, mock, test } from 'bun:test';

let configSnapshot = { exists: () => false, data: () => undefined };
let getDocBehaviour = async () => configSnapshot;

mock.module('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0' } } }));
mock.module('react-native', () => ({ Platform: { OS: 'android' } }));
mock.module('expo-application', () => ({ nativeBuildVersion: '4' }));
mock.module('@/lib/firebaseConfig', () => ({ db: {} }));
mock.module('firebase/firestore', () => ({
  doc: (_db, ...path) => path.join('/'),
  getDoc: (reference) => getDocBehaviour(reference),
  onSnapshot: () => () => undefined,
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
    expect(blocked.release).toBeNull();
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
  const HASH = 'a'.repeat(64);
  const releaseConfig = (overrides = {}) => ({
    latestVersion: '1.2.0',
    latestVersionCode: 5,
    apkUrl: 'https://firebasestorage.googleapis.com/v0/b/app/o/Ourlime.apk',
    apkSha256: HASH.toUpperCase(),
    apkSizeBytes: 470000000,
    releaseNotes: ['Faster feeds', '  ', 42, 'Trim videos before posting'],
    releasedAt: { toMillis: () => 1700000000000 },
    ...overrides,
  });

  test('offers a newer release by versionCode on Android', () => {
    const offer = appVersionService.evaluate('1.1.2', releaseConfig(), 'android', 4);
    expect(offer.status).toBe('update_available');
    expect(offer.release).toEqual({
      version: '1.2.0',
      versionCode: 5,
      apkUrl: 'https://firebasestorage.googleapis.com/v0/b/app/o/Ourlime.apk',
      apkSha256: HASH,
      apkSizeBytes: 470000000,
      releaseNotes: ['Faster feeds', 'Trim videos before posting'],
      releasedAtMs: 1700000000000,
      otaAvailable: false,
      sideloadUpdates: true,
    });
    // Same or older versionCode: nothing to offer, even if the name looks newer.
    expect(appVersionService.evaluate('1.1.2', releaseConfig({ latestVersionCode: 4 }), 'android', 4)).toEqual({ status: 'supported' });
    expect(appVersionService.evaluate('1.1.2', releaseConfig({ latestVersionCode: 3, latestVersion: '9.0.0' }), 'android', 4)).toEqual({ status: 'supported' });
  });

  test('falls back to the version name when versionCode is unknown or on iOS', () => {
    expect(appVersionService.evaluate('1.1.2', releaseConfig(), 'android', null).status).toBe('update_available');
    expect(appVersionService.evaluate('1.2.0', releaseConfig(), 'android', null)).toEqual({ status: 'supported' });
    expect(appVersionService.evaluate('1.1.2', releaseConfig(), 'ios', null).status).toBe('update_available');
  });

  test('malformed release fields are dropped, never trusted', () => {
    const offer = appVersionService.evaluate('1.1.2', releaseConfig({
      apkUrl: 'http://insecure.example.com/Ourlime.apk',
      apkSha256: 'not-a-hash',
      apkSizeBytes: -1,
      releaseNotes: 'not a list',
      releasedAt: 'yesterday',
      sideloadUpdates: false,
      otaAvailable: 'yes',
    }), 'android', 4);
    expect(offer.status).toBe('update_available');
    expect(offer.release.apkUrl).toBeNull();
    expect(offer.release.apkSha256).toBeNull();
    expect(offer.release.apkSizeBytes).toBeNull();
    expect(offer.release.releaseNotes).toEqual([]);
    expect(offer.release.releasedAtMs).toBeNull();
    expect(offer.release.sideloadUpdates).toBe(false);
    expect(offer.release.otaAvailable).toBe(false);
    for (const apkUrl of ['javascript:alert(1)', 'https://', 'file:///sdcard/a.apk', 7]) {
      expect(appVersionService.evaluate('1.1.2', releaseConfig({ apkUrl }), 'android', 4).release.apkUrl).toBeNull();
    }
  });

  test('a release with neither a valid version nor a versionCode is ignored', () => {
    expect(appVersionService.evaluate('1.1.2', { latestVersion: 'latest', latestVersionCode: 0 }, 'android', 4)).toEqual({ status: 'supported' });
    expect(appVersionService.evaluate('1.1.2', { latestVersionCode: 5.5 }, 'android', 4)).toEqual({ status: 'supported' });
  });

  test('update_required keeps its shape and carries the release when it is newer', () => {
    const blocked = appVersionService.evaluate('1.0.0', releaseConfig({ minimumVersion: '1.1.0', updateMessage: 'Update please.' }), 'android', 3);
    expect(blocked.status).toBe('update_required');
    expect(blocked.minimumVersion).toBe('1.1.0');
    expect(blocked.message).toBe('Update please.');
    expect(blocked.release.versionCode).toBe(5);
  });

  test('reads the installed versionCode from the native build', () => {
    expect(appVersionService.getInstalledBuild()).toEqual({ version: '1.0.0', versionCode: 4 });
  });
});
