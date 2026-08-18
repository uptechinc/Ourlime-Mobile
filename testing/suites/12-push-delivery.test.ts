import { describe, expect, it } from 'bun:test';
import { apiTestHarness } from '../services/ApiTestHarness';

describe('Suite 12: Push Notification Token & Delivery Validation', () => {
  it('should accept valid native Android FCM tokens with transport=fcm', async () => {
    const fcmToken = 'fnwjgetQSwOIHlaunAtMqL:APA91bH_example_valid_fcm_token_1234567890';
    const response = await apiTestHarness.mockPost('/api/push-tokens', {
      token: fcmToken,
      platform: 'android',
      transport: 'fcm',
    });

    expect(response.status).toBe(200);
    expect((response.data as { success: boolean }).success).toBe(true);
  });

  it('should accept valid Expo proxy tokens with transport=expo', async () => {
    const expoToken = 'ExponentPushToken[3zgUGSKk9Bje_example_token_123]';
    const response = await apiTestHarness.mockPost('/api/push-tokens', {
      token: expoToken,
      platform: 'android',
      transport: 'expo',
    });

    expect(response.status).toBe(200);
    expect((response.data as { success: boolean }).success).toBe(true);
  });

  it('should reject invalid token payloads missing platform or token', async () => {
    const invalidResponse = await apiTestHarness.mockPost('/api/push-tokens', {
      token: '',
      platform: 'web',
    });

    expect(invalidResponse.status).toBe(400);
  });

  it('should classify native FCM tokens separately from Expo proxy tokens', () => {
    const isExpoToken = (token: string) => /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(token);
    const isFcmToken = (token: string) => token.length >= 16 && !isExpoToken(token) && !/\s/.test(token);

    const fcmToken = 'fnwjgetQSwOIHlaunAtMqL:APA91bH-abcdef123456';
    const expoToken = 'ExponentPushToken[3zgUGSKk9Bje_example]';

    expect(isFcmToken(fcmToken)).toBe(true);
    expect(isExpoToken(fcmToken)).toBe(false);

    expect(isExpoToken(expoToken)).toBe(true);
    expect(isFcmToken(expoToken)).toBe(false);
  });
});
