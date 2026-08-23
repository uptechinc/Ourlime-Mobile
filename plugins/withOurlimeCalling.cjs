const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withMainActivity,
  withMainApplication,
} = require('@expo/config-plugins');

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

function withCallingMainApplication(config) {
  return withMainApplication(config, (result) => {
    if (result.modResults.language !== 'kt') return result;
    let source = result.modResults.contents;
    if (!source.includes('add(OurlimeIncomingCallPackage())')) {
      source = source.replace(
        /PackageList\(this\)\.packages\.apply \{/,
        'PackageList(this).packages.apply {\n          add(OurlimeIncomingCallPackage())',
      );
    }
    result.modResults.contents = source;
    return result;
  });
}

function withCallingMainActivity(config) {
  return withMainActivity(config, (result) => {
    if (result.modResults.language !== 'kt') return result;
    let source = result.modResults.contents;
    if (!source.includes('import android.content.Intent')) {
      source = source.replace('import android.os.Bundle', 'import android.os.Bundle\nimport android.content.Intent');
    }
    if (!source.includes('import android.view.WindowManager')) {
      source = source.replace('import android.content.Intent', 'import android.content.Intent\nimport android.view.WindowManager');
    }
    if (!source.includes('OurlimeIncomingCallModule.captureIntent(this, intent)')) {
      source = source.replace('super.onCreate(null)', 'super.onCreate(null)\n    OurlimeIncomingCallModule.captureIntent(this, intent)');
    }
    if (!source.includes('override fun onNewIntent(intent: Intent)')) {
      const marker = '  /**\n   * Returns the name of the main component registered from JavaScript.';
      const method = `  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    OurlimeIncomingCallModule.captureIntent(this, intent)
  }

`;
      source = source.replace(marker, `${method}${marker}`);
    }
    if (!source.includes('private fun configureIncomingCallWindow(intent: Intent?)')) {
      source = source.replaceAll(
        '    OurlimeIncomingCallModule.captureIntent(this, intent)',
        '    configureIncomingCallWindow(intent)\n    OurlimeIncomingCallModule.captureIntent(this, intent)',
      );
      const marker = '  /**\n   * Returns the name of the main component registered from JavaScript.';
      const method = `  private fun configureIncomingCallWindow(intent: Intent?) {
    if (intent?.action?.startsWith("com.ourlime.app.INCOMING_CALL_") != true) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
          WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

`;
      source = source.replace(marker, `${method}${marker}`);
    }
    result.modResults.contents = source;
    return result;
  });
}

function withCallingAndroidSources(config) {
  return withDangerousMod(config, ['android', async (result) => {
    const packageDirectory = path.join(
      result.modRequest.platformProjectRoot,
      'app',
      'src',
      'main',
      'java',
      'com',
      'ourlime',
      'app',
    );
    fs.mkdirSync(packageDirectory, { recursive: true });
    ['OurlimeIncomingCallModule.kt', 'OurlimeIncomingCallPackage.kt'].forEach((fileName) => {
      fs.copyFileSync(path.join(__dirname, 'native-call', fileName), path.join(packageDirectory, fileName));
    });
    return result;
  }]);
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
  return withCallingAppDelegate(
    withCallingAndroidSources(
      withCallingMainActivity(
        withCallingMainApplication(
          withCallingAndroid(withCallingEntitlements(withCallingInfo(config))),
        ),
      ),
    ),
  );
};
