import { describe, expect, test } from 'bun:test';

const { appUpdateStateMachine, INITIAL_APP_UPDATE_STATE } = await import('./AppUpdateStateMachine.ts');

const release = {
  version: '1.2.0',
  versionCode: 5,
  apkUrl: 'https://example.com/Ourlime.apk',
  apkSha256: 'a'.repeat(64),
  apkSizeBytes: 1000,
  releaseNotes: ['Faster'],
  releasedAtMs: null,
  otaAvailable: false,
  sideloadUpdates: true,
};
const available = { status: 'update_available', installedVersion: '1.1.2', installedVersionCode: 4, storeUrl: 'https://x', release };
const supported = { status: 'supported' };

const run = (events, start = INITIAL_APP_UPDATE_STATE) =>
  events.reduce((state, event) => appUpdateStateMachine.transition(state, event), start);

describe('AppUpdateStateMachine', () => {
  test('a check finds a release, then the APK downloads, verifies and installs', () => {
    let state = run([{ type: 'check_started' }]);
    expect(state.status).toBe('checking');
    state = run([{ type: 'check_finished', versionCheck: available, otaReady: false }], state);
    expect(state.status).toBe('available');
    expect(state.release).toBe(release);

    state = run([{ type: 'download_started', source: 'apk', totalBytes: 1000 }, { type: 'download_progress', bytesReceived: 250, totalBytes: 1000 }], state);
    expect(state.status).toBe('downloading');
    expect(state.progress).toBe(0.25);

    state = run([{ type: 'verify_started' }, { type: 'apk_ready', apkPath: '/cache/updates/5.apk' }], state);
    expect(state.status).toBe('ready_to_install');
    expect(state.apkPath).toBe('/cache/updates/5.apk');

    state = run([{ type: 'install_started' }], state);
    expect(state.status).toBe('installing');
    // Backing out of Android's installer keeps the verified file for another try.
    expect(run([{ type: 'install_cancelled' }], state).status).toBe('ready_to_install');
  });

  test('nothing newer means up to date', () => {
    expect(run([{ type: 'check_started' }, { type: 'check_finished', versionCheck: supported, otaReady: false }]).status).toBe('up_to_date');
  });

  test('a downloaded OTA update waits for a restart', () => {
    const state = run([{ type: 'check_finished', versionCheck: supported, otaReady: false }, { type: 'ota_found' }, { type: 'download_started', source: 'ota', totalBytes: 0 }, { type: 'ota_ready' }]);
    expect(state.status).toBe('ready_to_restart');
    expect(state.source).toBe('ota');
    // A later check (live listener) must not throw the finished download away.
    expect(run([{ type: 'check_finished', versionCheck: supported, otaReady: false }], state).status).toBe('ready_to_restart');
    expect(run([{ type: 'check_started' }], state).status).toBe('ready_to_restart');
  });

  test('a pending OTA download found at check time is offered as a restart', () => {
    const state = run([{ type: 'check_finished', versionCheck: supported, otaReady: true }]);
    expect(state.status).toBe('ready_to_restart');
  });

  test('checks during a download only refresh the version answer', () => {
    const downloading = run([
      { type: 'check_finished', versionCheck: available, otaReady: false },
      { type: 'download_started', source: 'apk', totalBytes: 1000 },
    ]);
    const required = { status: 'update_required', installedVersion: '1.1.2', minimumVersion: '1.2.0', storeUrl: 'https://x', message: 'm', release };
    const next = run([{ type: 'check_started' }, { type: 'check_finished', versionCheck: required, otaReady: false }], downloading);
    expect(next.status).toBe('downloading');
    expect(next.versionCheck).toBe(required);
  });

  test('cancel returns to the offer; failures can be retried', () => {
    const downloading = run([
      { type: 'check_finished', versionCheck: available, otaReady: false },
      { type: 'download_started', source: 'apk', totalBytes: 1000 },
      { type: 'download_progress', bytesReceived: 900, totalBytes: 1000 },
    ]);
    const cancelled = run([{ type: 'download_cancelled' }], downloading);
    expect(cancelled.status).toBe('available');
    expect(cancelled.progress).toBe(0);

    const failed = run([{ type: 'failed', message: 'The download does not match the published checksum.' }], downloading);
    expect(failed.status).toBe('error');
    expect(failed.errorMessage).toBe('The download does not match the published checksum.');
    expect(run([{ type: 'download_started', source: 'apk', totalBytes: 1000 }], failed).status).toBe('downloading');
  });

  test('events that do not fit the current state are ignored', () => {
    const idle = INITIAL_APP_UPDATE_STATE;
    for (const event of [
      { type: 'download_progress', bytesReceived: 1, totalBytes: 2 },
      { type: 'verify_started' },
      { type: 'apk_ready', apkPath: '/x' },
      { type: 'install_started' },
      { type: 'install_cancelled' },
      { type: 'download_cancelled' },
      { type: 'download_started', source: 'apk', totalBytes: 1 },
    ]) {
      expect(appUpdateStateMachine.transition(idle, event)).toBe(idle);
    }
  });

  test('progress is clamped to 0..1', () => {
    const state = run([
      { type: 'check_finished', versionCheck: available, otaReady: false },
      { type: 'download_started', source: 'apk', totalBytes: 100 },
      { type: 'download_progress', bytesReceived: 150, totalBytes: 100 },
    ]);
    expect(state.progress).toBe(1);
  });
});
