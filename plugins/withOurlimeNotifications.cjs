const { withAndroidManifest } = require('expo/config-plugins');

const FIREBASE_NOTIFICATION_METADATA = new Set([
  'com.google.firebase.messaging.default_notification_color',
  'com.google.firebase.messaging.default_notification_icon',
]);

module.exports = function withOurlimeNotifications(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults.manifest;
    manifest.$ = {
      ...manifest.$,
      'xmlns:tools': 'http://schemas.android.com/tools',
    };

    const application = manifest.application?.[0];
    for (const metadata of application?.['meta-data'] ?? []) {
      if (FIREBASE_NOTIFICATION_METADATA.has(metadata.$?.['android:name'])) {
        metadata.$['tools:replace'] = 'android:resource';
      }
    }

    return manifestConfig;
  });
};
