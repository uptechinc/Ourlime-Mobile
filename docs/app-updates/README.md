# In-app updates (Android sideload builds)

Users find out about updates by themselves, see "Update available" with release notes, update inside the app, and get a one-time "What's new" afterwards. Two mechanisms sit behind one sheet.

| Layer | For | Mechanism | Ends with |
|---|---|---|---|
| A: OTA | JavaScript / assets only | `expo-updates` + EAS Update (`OTA.md`) | "Restart to apply" → `Updates.reloadAsync()` |
| B: APK | Native changes | `plugins/native-update` (Kotlin) downloads, verifies and installs | Android's installer confirmation; Ourlime closes and reopens updated |

Data in `siteConfig/mobileApp` decides each release, not client guesses (`RELEASING.md`).

## Signals

1. **Live listener** on `siteConfig/mobileApp` (public read, works before sign-in): a release appears within seconds.
2. **Foreground check:** on launch and on foreground (at most every 10 minutes), it re-reads the doc and asks EAS Update.
3. **`app_update` push:** from `notifyAppUpdate` (`functions/`), once per versionCode; routed by `NotificationDestinationRegistry`. Pushes for a build already installed are dropped.
4. **Settings → App → Check for updates:** shows the installed `version (versionCode)` and the current state.

## Code map

| File | Role |
|---|---|
| `lib/services/AppVersionService.ts` | Reads and validates `siteConfig/mobileApp`. `evaluate()` is pure and returns `supported`, `update_available` or `update_required`. Live listener. Installed build (`expo-application`). |
| `lib/services/AppUpdateStateMachine.ts` | Pure transitions: `idle`, `checking`, `available`, `downloading`, `verifying`, `ready_to_restart`, `ready_to_install`, `installing`, `error`, `up_to_date` |
| `lib/services/AppUpdateService.ts` | Orchestrator: signals, snooze, "What's new", busy guard (calls / uploads), APK and OTA flows |
| `lib/services/OtaUpdateService.ts` | `expo-updates` wrapper (no-op in dev, Expo Go, or with updates disabled) |
| `lib/services/NativeAppUpdateService.ts` | JS wrapper for the `OurlimeAppUpdate` native module |
| `lib/store/useAppUpdateStore.ts`, `lib/hooks/useAppUpdate.ts` | State for the UI |
| `components/ui/AppUpdateSheet.tsx`, `AppUpdatePanel.tsx`, `AppUpdateRequiredModal.tsx` | Sheet, shared panel, and blocking screen |
| `components/settings/AppUpdateSettingsRow.tsx` | Settings row |
| `plugins/withOurlimeAppUpdate.cjs`, `plugins/native-update/*.kt` | Native module, install-status receiver, "Ourlime updated" receiver, manifest entries |
| `scripts/publish-android-release.cjs` | Uploads the APK and writes the release fields (`--dry-run` first) |

## Deploy / publish (your steps; nothing here was deployed)

1. **Storage rule** for `app-releases/android/**`. See `RULES.md`; the downloads fail without it.
2. **Firestore rules:** no change needed (`RULES.md`).
3. **Cloud Function:**
   - copy `functions/AppUpdatePushService.ts` to `Ourlime-Web/functions/src/` and add `functions/index.snippet.ts` to `functions/src/index.ts`
   - then run `firebase deploy --only functions:reliability:notifyAppUpdate`
   - it type-checks against the functions workspace's strict tsconfig
4. **First updater build:** bump `version` and `versionCode`, build, and install it on testers' phones manually. Builds made before this branch don't have the updater, so they can only be told about updates with `minimumVersion` and its link.
5. **Releases after that:** see `RELEASING.md`. OTA publishing is in `OTA.md`.

## Signing (verified 2026-10-16)

`apksigner verify --print-certs` on the two APKs in the repo root:

| APK | Certificate | SHA-256 |
|---|---|---|
| `Ourlime-07.10.26-debug.apk` | `CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US` | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |
| `Ourlime-15.10.26.apk` (release) | same | same |

Consecutive builds share one certificate, so in-app updates install over each other.

**Risk (not changed in this task):** release builds are signed with the template `debug.keystore` that `expo prebuild` regenerates. That fingerprint appears to be the public React Native template debug key. If so, anyone can sign an APK that Android accepts as an update to Ourlime, and the app's certificate check can't tell the difference. Today the real protection is the SHA-256 published in admin-only `siteConfig/mobileApp`, checked before installing.

Recommendation: create a private release keystore and keep it out of git and `android/`. Wire it in with a config plugin, and move everyone over once. Because the key changes, that one move needs an uninstall and reinstall, or APK Signature Scheme v3 key rotation.

## APK size

The release APK is 472 MB because it bundles four ABIs (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`). Nearly all real phones need only `arm64-v8a`.

Building arm64-only, or one APK per ABI with matching `apkUrl`s, would cut the download dramatically. That makes in-app updates much more pleasant and Storage egress much cheaper. Not changed here.
