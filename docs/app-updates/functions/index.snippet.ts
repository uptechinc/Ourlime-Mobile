// PROPOSAL — add to functions/src/index.ts (Ourlime-Web/functions). onDocumentWritten is already imported there.
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { appUpdatePush } from './AppUpdatePushService';

// ── In-app updates: announce a new Android release (siteConfig/mobileApp.latestVersionCode increased) ──
export const notifyAppUpdate = onDocumentWritten({ document: 'siteConfig/mobileApp', region: 'us-central1', timeoutSeconds: 540 }, async (event) => {
  await appUpdatePush.handleConfigWrite(event.data?.before.data(), event.data?.after.data());
});
