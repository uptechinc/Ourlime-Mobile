const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

const ANDROID_PERMISSIONS = [
  'android.permission.MANAGE_OWN_CALLS',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MICROPHONE',
  'android.permission.USE_FULL_SCREEN_INTENT',
  'android.permission.WAKE_LOCK',
  'android.permission.VIBRATE',
];

function withCallingInfo(config) {
  return withInfoPlist(config, (result) => {
    const modes = new Set(result.modResults.UIBackgroundModes || []);
    ['audio', 'voip', 'remote-notification'].forEach((mode) => modes.add(mode));
    result.modResults.UIBackgroundModes = [...modes];
    result.modResults.NSContactsUsageDescription ||= 'Ourlime can identify people you call.';
    return result;
  });
}

function withCallingEntitlements(config) {
  return withEntitlementsPlist(config, (result) => {
    result.modResults['aps-environment'] ||= 'development';
    return result;
  });
}

function withCallingAndroid(config) {
  return withAndroidManifest(config, (result) => {
    const manifest = result.modResults.manifest;
    manifest['uses-permission'] ||= [];
    const existing = new Set(manifest['uses-permission'].map((permission) => permission.$['android:name']));
    ANDROID_PERMISSIONS.forEach((permission) => {
      if (!existing.has(permission)) manifest['uses-permission'].push({ $: { 'android:name': permission } });
    });
    if (manifest.application && manifest.application.length > 0) {
      manifest.application[0].$['android:largeHeap'] = 'true';
    }
    return result;
  });
}

function patchSwiftAppDelegate(source) {
  if (source.includes('OURLIME_NATIVE_CALLING')) return source;
  let next = source;
  next = next.replace('import Expo', 'import Expo\nimport PushKit\nimport RNCallKeep\nimport RNVoipPushNotification');
  next = next.replace(/class AppDelegate:\s*ExpoAppDelegate\s*\{/, 'class AppDelegate: ExpoAppDelegate, PKPushRegistryDelegate {');
  const launchMarker = 'public override func application(';
  const launchIndex = next.indexOf(launchMarker);
  if (launchIndex >= 0) {
    const returnIndex = next.indexOf('return super.application', launchIndex);
    if (returnIndex >= 0) next = `${next.slice(0, returnIndex)}RNVoipPushNotificationManager.voipRegistration()\n    ${next.slice(returnIndex)}`;
  }
  const finalBrace = next.lastIndexOf('}');
  if (finalBrace < 0) return next;
  const methods = `

  // OURLIME_NATIVE_CALLING: PushKit must report CallKit before the JS bridge starts.
  public func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
    RNVoipPushNotificationManager.didUpdatePushCredentials(pushCredentials, forType: type.rawValue)
  }

  public func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {}

  public func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
    let data = payload.dictionaryPayload
    guard let callId = data["callId"] as? String else { completion(); return }
    RNVoipPushNotificationManager.didReceiveIncomingPush(withPayload: payload, forType: type.rawValue)
    guard (data["type"] as? String) == "incoming_call" else { completion(); return }
    RNVoipPushNotificationManager.addCompletionHandler(callId, completionHandler: completion)
    let callerName = data["callerName"] as? String ?? "Ourlime call"
    let handle = data["callerUserName"] as? String ?? callerName
    let isVideo = (data["callType"] as? String) == "video"
    RNCallKeep.reportNewIncomingCall(
      callId,
      handle: handle,
      handleType: "generic",
      hasVideo: isVideo,
      localizedCallerName: callerName,
      supportsHolding: true,
      supportsDTMF: true,
      supportsGrouping: false,
      supportsUngrouping: false,
      fromPushKit: true,
      payload: data,
      withCompletionHandler: nil
    )
    let expiresAtMs = (data["expiresAtMs"] as? NSNumber)?.doubleValue ?? ((Date().timeIntervalSince1970 * 1000) + 45000)
    let remainingSeconds = max(0, (expiresAtMs - (Date().timeIntervalSince1970 * 1000)) / 1000)
    DispatchQueue.main.asyncAfter(deadline: .now() + remainingSeconds) {
      if RNCallKeep.isCallActive(callId) {
        RNCallKeep.endCall(withUUID: callId, reason: 3)
      }
    }
  }
`;
  return `${next.slice(0, finalBrace)}${methods}${next.slice(finalBrace)}`;
}

function withCallingAppDelegate(config) {
  return withDangerousMod(config, ['ios', async (result) => {
    const projectName = result.modRequest.projectName;
    const appDelegatePath = path.join(result.modRequest.platformProjectRoot, projectName, 'AppDelegate.swift');
    if (fs.existsSync(appDelegatePath)) {
      const source = fs.readFileSync(appDelegatePath, 'utf8');
      fs.writeFileSync(appDelegatePath, patchSwiftAppDelegate(source));
    }
    return result;
  }]);
}

module.exports = function withOurlimeCalling(config) {
  return withCallingAppDelegate(withCallingAndroid(withCallingEntitlements(withCallingInfo(config))));
};
