const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const { copyNativeSources, readAndroidPackage } = require('./androidPackage.cjs');

const NATIVE_SOURCES = [
  'OurlimeAppUpdateModule.kt',
  'OurlimeAppUpdatePackage.kt',
  'OurlimeAppUpdateReceiver.kt',
  'OurlimeAppUpdatedReceiver.kt',
];
const INSTALL_PERMISSION = 'android.permission.REQUEST_INSTALL_PACKAGES';
const NETWORK_STATE_PERMISSION = 'android.permission.ACCESS_NETWORK_STATE';

/** extra.distribution: "sideload" (default; in-app APK updates) or "play" (Play policy: no REQUEST_INSTALL_PACKAGES). */
function readDistribution(config) {
  return config.extra && config.extra.distribution === 'play' ? 'play' : 'sideload';
}

function withUpdateManifest(config) {
  const isSideload = readDistribution(config) === 'sideload';
  const androidPackage = readAndroidPackage(config);
  const INSTALL_STATUS_RECEIVER = `${androidPackage}.OurlimeAppUpdateReceiver`;
  const UPDATED_RECEIVER = `${androidPackage}.OurlimeAppUpdatedReceiver`;
  return withAndroidManifest(config, (result) => {
    const manifest = result.modResults.manifest;
    manifest['uses-permission'] ||= [];
    const permissions = manifest['uses-permission'];
    const hasPermission = (name) => permissions.some((permission) => permission.$['android:name'] === name);
    if (!hasPermission(NETWORK_STATE_PERMISSION)) permissions.push({ $: { 'android:name': NETWORK_STATE_PERMISSION } });
    if (isSideload) {
      if (!hasPermission(INSTALL_PERMISSION)) permissions.push({ $: { 'android:name': INSTALL_PERMISSION } });
    } else {
      manifest['uses-permission'] = permissions.filter((permission) => permission.$['android:name'] !== INSTALL_PERMISSION);
    }

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(result.modResults);
    application.receiver ||= [];
    const receivers = application.receiver;
    const hasReceiver = (name) => receivers.some((receiver) => receiver.$['android:name'] === name);
    // PackageInstaller session results (explicit, app-internal PendingIntent).
    if (!hasReceiver(INSTALL_STATUS_RECEIVER)) {
      receivers.push({ $: { 'android:name': INSTALL_STATUS_RECEIVER, 'android:exported': 'false' } });
    }
    // "Ourlime updated" notification. MY_PACKAGE_REPLACED is a protected broadcast: only the system can send it.
    if (!hasReceiver(UPDATED_RECEIVER)) {
      receivers.push({
        $: { 'android:name': UPDATED_RECEIVER, 'android:exported': 'true' },
        'intent-filter': [{ action: [{ $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } }] }],
      });
    }
    return result;
  });
}

function withUpdateMainApplication(config) {
  return withMainApplication(config, (result) => {
    if (result.modResults.language !== 'kt') return result;
    let source = result.modResults.contents;
    if (!source.includes('add(OurlimeAppUpdatePackage())')) {
      source = source.replace(
        /PackageList\(this\)\.packages\.apply \{/,
        'PackageList(this).packages.apply {\n          add(OurlimeAppUpdatePackage())',
      );
    }
    result.modResults.contents = source;
    return result;
  });
}

function withUpdateAndroidSources(config) {
  return withDangerousMod(config, ['android', async (result) => {
    copyNativeSources(result.modRequest.platformProjectRoot, path.join(__dirname, 'native-update'), NATIVE_SOURCES, readAndroidPackage(config));
    return result;
  }]);
}

/**
 * In-app APK updates for sideloaded builds (plugins/native-update): download, verify, and hand over to Android's
 * PackageInstaller. No FileProvider is needed: the APK bytes are written into the installer session directly, so no
 * content URI to the cache is ever exposed to another app.
 */
module.exports = function withOurlimeAppUpdate(config) {
  return withUpdateAndroidSources(withUpdateMainApplication(withUpdateManifest(config)));
};
