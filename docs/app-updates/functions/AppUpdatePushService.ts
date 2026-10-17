// PROPOSAL — copy to functions/src/AppUpdatePushService.ts (Ourlime-Web/functions, codebase "reliability").
// Not deployed by the mobile repo. See docs/app-updates/README.md → "Deploy".
import { FieldPath, FieldValue, getFirestore, type DocumentReference, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

type MobileAppRelease = {
  latestVersion?: unknown;
  latestVersionCode?: unknown;
  apkUrl?: unknown;
  sideloadUpdates?: unknown;
};

type AndroidDevice = { reference: DocumentReference; token: string; transport: string };

/** Flat, string-only NativePushDataV1 (docs/NOTIFICATION_ROUTING.md in Ourlime-Mobile). */
type AppUpdatePushData = {
  schemaVersion: '1';
  destinationKind: 'app_update';
  type: 'app_update';
  notificationId: string;
  versionCode: string;
  path: string;
};

const PAGE_SIZE = 500;
const EXPO_BATCH_SIZE = 100;
const CHANNEL_ID = 'ourlime-messages-v3';
const INVALID_FCM_CODES = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);

const readVersionCode = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;

/**
 * Announces a new Android release (siteConfig/mobileApp.latestVersionCode went up) to every registered Android
 * device, once per versionCode. Uses the same pushTokens collection and transports as PushDeliveryService (FCM for
 * native tokens, Expo for Expo tokens) and removes dead tokens the same way. The app drops the push when it already
 * runs that versionCode and shows it as an in-app banner while open; tapping it opens the update sheet.
 */
export class AppUpdatePushService {
  /** Called from the siteConfig/mobileApp onDocumentWritten trigger. */
  public async handleConfigWrite(before: MobileAppRelease | undefined, after: MobileAppRelease | undefined): Promise<void> {
    const previousCode = readVersionCode(before?.latestVersionCode) ?? 0;
    const versionCode = readVersionCode(after?.latestVersionCode);
    if (!after || versionCode === null || versionCode <= previousCode) return;
    if (after.sideloadUpdates === false || typeof after.apkUrl !== 'string' || !after.apkUrl.startsWith('https://')) return;
    const version = typeof after.latestVersion === 'string' ? after.latestVersion.trim() : '';
    await this.announce(versionCode, version);
  }

  public async announce(versionCode: number, version: string): Promise<void> {
    const database = getFirestore();
    // Once per versionCode, even if the trigger retries or the doc is written again (create() fails if it exists).
    try {
      await database.doc(`appUpdatePushes/${versionCode}`).create({ versionCode, version, startedAt: FieldValue.serverTimestamp() });
    } catch {
      console.info('[AppUpdatePushService.announce] Already announced:', versionCode);
      return;
    }

    const data: AppUpdatePushData = {
      schemaVersion: '1',
      destinationKind: 'app_update',
      type: 'app_update',
      notificationId: `app_update_${versionCode}`,
      versionCode: String(versionCode),
      path: '/notifications',
    };
    const title = 'Ourlime update available';
    const body = version ? `Version ${version} is ready. Tap to update.` : 'A new version is ready. Tap to update.';
    let sent = 0;
    let lastDocument: QueryDocumentSnapshot | null = null;

    for (;;) {
      let query = database.collection('pushTokens').where('platform', '==', 'android').orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
      if (lastDocument) query = query.startAfter(lastDocument);
      const page = await query.get();
      if (page.empty) break;
      lastDocument = page.docs[page.docs.length - 1];
      const devices = page.docs.flatMap((document): AndroidDevice[] => {
        const token = document.get('token');
        return typeof token === 'string' && token ? [{ reference: document.ref, token, transport: String(document.get('transport') ?? '') }] : [];
      });
      const isExpoToken = (token: string) => token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken');
      const fcmDevices = devices.filter((device) => device.transport === 'fcm' || (device.transport !== 'expo' && !isExpoToken(device.token)));
      const expoDevices = devices.filter((device) => !fcmDevices.includes(device));
      const invalid = [...await this.sendFcm(fcmDevices, title, body, data), ...await this.sendExpo(expoDevices, title, body, data)];
      await this.removeTokens(invalid);
      sent += devices.length;
      if (page.size < PAGE_SIZE) break;
    }

    await database.doc(`appUpdatePushes/${versionCode}`).set({ devices: sent, finishedAt: FieldValue.serverTimestamp() }, { merge: true });
    console.info('[AppUpdatePushService.announce] Sent:', { versionCode, devices: sent });
  }

  private async sendFcm(devices: AndroidDevice[], title: string, body: string, data: AppUpdatePushData): Promise<DocumentReference[]> {
    if (devices.length === 0) return [];
    try {
      const response = await getMessaging().sendEachForMulticast({
        tokens: devices.map((device) => device.token),
        notification: { title, body },
        data,
        android: { priority: 'normal', collapseKey: data.notificationId, notification: { channelId: CHANNEL_ID, tag: data.notificationId } },
      });
      return response.responses.flatMap((result, index) =>
        result.error && INVALID_FCM_CODES.has(result.error.code) ? [devices[index].reference] : []);
    } catch (error: unknown) {
      console.error('[AppUpdatePushService.sendFcm] Error:', error instanceof Error ? error.message : 'FCM delivery failed');
      return [];
    }
  }

  private async sendExpo(devices: AndroidDevice[], title: string, body: string, data: AppUpdatePushData): Promise<DocumentReference[]> {
    const invalid: DocumentReference[] = [];
    for (let start = 0; start < devices.length; start += EXPO_BATCH_SIZE) {
      const batch = devices.slice(start, start + EXPO_BATCH_SIZE);
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify(batch.map((device) => ({ to: device.token, title, body, channelId: CHANNEL_ID, data }))),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) continue;
        const result = await response.json() as { data?: { status?: string; details?: { error?: string } }[] };
        (result.data ?? []).forEach((ticket, index) => {
          if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' && batch[index]) invalid.push(batch[index].reference);
        });
      } catch (error: unknown) {
        console.error('[AppUpdatePushService.sendExpo] Error:', error instanceof Error ? error.message : 'Expo delivery failed');
      }
    }
    return invalid;
  }

  private async removeTokens(references: DocumentReference[]): Promise<void> {
    if (references.length === 0) return;
    const batch = getFirestore().batch();
    references.forEach((reference) => batch.delete(reference));
    await batch.commit();
  }
}

export const appUpdatePush = new AppUpdatePushService();
