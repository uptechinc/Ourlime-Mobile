const { describe, expect, test } = require('bun:test');
const { validateNotificationSoundFile } = require('./notificationSoundRules');

describe('notification sound validation', () => {
  test('accepts MP3 MIME types and file extensions', () => {
    expect(validateNotificationSoundFile({ fileName: 'ringtone.bin', mimeType: 'audio/mpeg', size: 1000 })).toBeNull();
    expect(validateNotificationSoundFile({ fileName: 'message.MP3', size: 1000 })).toBeNull();
  });

  test('rejects unsupported and oversized files', () => {
    expect(validateNotificationSoundFile({ fileName: 'tone.wav', mimeType: 'audio/wav' })).toContain('MP3');
    expect(validateNotificationSoundFile({ fileName: 'tone.mp3', size: 21 * 1024 * 1024 })).toContain('20 MB');
  });
});
