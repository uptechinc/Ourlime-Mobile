# OTA (JavaScript-only) updates with EAS Update

OTA updates replace only the JavaScript bundle and assets. Anything native needs a new APK (see `RELEASING.md`): new native modules, permissions, Kotlin in `plugins/`, config-plugin changes, or SDK bumps.

## How it is set up

`app.json`:

| Key | Value | Why |
|---|---|---|
| `runtimeVersion` | `{ "policy": "appVersion" }` | An OTA reaches only builds with the same `expo.version`. Bumping `version` for every native release keeps old binaries from getting JavaScript they can't run. |
| `updates.url` | `https://u.expo.dev/b2bd2a8c-17f8-4d08-8233-42ccb475a4e5` | EAS project `a-hazzard/ourlime` |
| `updates.checkAutomatically` | `NEVER` | The app decides when to check (`AppUpdateService`); nothing downloads or reloads by surprise. |
| `updates.fallbackToCacheTimeout` | `0` | Launch never waits on the network. |
| `updates.requestHeaders["expo-channel-name"]` | `production` | Local Gradle builds (`npm run build:local`) don't read `eas.json`, so their channel is set here. |

`eas.json` profiles mirror this for cloud builds: `development` uses channel `development`, `preview` uses `preview`, and `production` uses `production`. Every locally built APK is on the `production` channel.

**Why not `fingerprint`?** The fingerprint policy hashes the native project. Our custom config plugins copy Kotlin from `plugins/native-*` into the regenerated `android/` folder, and the fingerprint may not include those sources. A native change could then keep the same runtime and receive an incompatible OTA. With `appVersion`, the rule is simply "native change = bump `version`", which Layer-B (APK) releases do anyway.

## What the app does

1. On launch, and when it returns to the foreground (at most every 10 minutes), it calls `Updates.checkForUpdateAsync()`. It does the same when someone taps **Settings → App → Check for updates**.
2. If an update exists, the sheet offers it ("An update is ready") with **Update now**. Updates are mandatory: the sheet has no Later, and back or tapping outside does not close it. Nothing is downloaded until **Update now** is tapped; then it downloads (`fetchUpdateAsync`) and restarts into it (`reloadAsync`).
3. The same applies to a Play release that Play already serves to this phone (or a downloadable APK). A release in siteConfig that Play does not offer this phone yet cannot be installed, so that sheet stays dismissible instead of locking the person out.
4. Nothing restarts during a call or an upload. A tap on **Restart now** then explains why, and the prompt waits until you're done.
5. If a downloaded update crashes on launch, expo-updates rolls back to the embedded bundle (an emergency launch). The app logs this through `DiagnosticLogService` (`OtaUpdateService launch:emergency`).
6. Dev builds, Expo Go, and binaries built before `expo-updates` was added do nothing (`__DEV__` / `Updates.isEnabled`).
7. After an OTA is applied, "What's new" shows once. It lists the newest entry for this version in `lib/releaseHistory.json` (shipped inside the OTA itself), then falls back to `siteConfig/mobileApp` notes for this version, then a generic line. Before publishing an OTA, add an `"ota"` entry at the top of that file with what the OTA changes and run `npm run release:check` (see the app-release skill). Settings → Release notes lists every entry.

## Publishing an OTA (run it yourself; not run by the agent)

The binary must already contain `expo-updates`. The first APK built from this branch is the first one that can receive OTAs.

```bash
npx eas-cli@latest login
```

Use the publish script: it runs `eas update` on the production channel, then writes `siteConfig/mobileApp.latestOta`, which makes notifyAppUpdate push "Ourlime update available" to Android phones once per update group (phones on another version, or already on that update, ignore it).

```bash
set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\aaron\keys\ourlime-admin.json.json
```

```bash
npm run ota:publish -- --message "Fix feed video resume"
```

To announce an update already published with plain `eas update`: `npm run ota:publish -- --group <update group id>`.

- The update reaches only installs whose `version` matches the current `app.json` `version` (runtime `appVersion`).
- To roll back, republish the previous update with `npx eas-cli@latest update:republish --group <groupId>` (find group IDs with `npx eas-cli@latest update:list --branch production`), or roll back to the embedded bundle with `npx eas-cli@latest update:roll-back-to-embedded --branch production --runtime-version <version>`.
- Optionally set `otaAvailable: true` in `siteConfig/mobileApp` as a hint. The app checks EAS anyway, so it isn't required.
- `EXPO_PUBLIC_*` values are inlined at publish time from your local environment or EAS environment variables. Use the same ones as the build.
