---
name: app-release
description: Ship an Ourlime app update (APK or OTA) with detailed release notes. Use for any app version bump, tester build, APK publish, OTA publish, or when changing lib/releaseNotes.json or siteConfig/mobileApp.
---

# App Release: Updates With Detailed Release Notes

Every app update tells people what changed. In "What's new" after updating, and in "Update available" before it, they see a bulleted list of real changes, never just "fixes and improvements".

## 1. Know what is in the release before you push

- The notes cover **everything since the last published release**, not just the last commit. Several commits before a release become one list.
- Find the last release: the last commit that bumped `expo.version` / `expo.android.versionCode` in `app.json`. For an OTA, use the last commit that changed `lib/releaseNotes.json`. Then read the changes:
  ```bash
  git log --format="%h %s" <lastReleaseCommit>..HEAD
  ```
  Also check the live release: `siteConfig/mobileApp.latestVersion` / `latestVersionCode`. Read it; never write it from a script you made up.
- Keep commit subjects user-readable, saying what changed for the person using the app. They become the raw material for the notes.

## 2. Write `lib/releaseNotes.json`

```json
{ "version": "1.3.0", "versionCode": 9, "notes": ["…", "…"] }
```

- `version` / `versionCode` must equal `app.json`. The publish script refuses when they don't, and the app only shows notes whose `version` matches the running app.
- Up to 12 notes, each under 240 characters. One bullet per feature or fix, in plain words for members ("Assignments: hand in a written answer and files, then see your grade"). No internal names, file paths or "parity".
- Order: new features first, biggest first. End with one "Fixes: …" bullet.
- For an **OTA** on the same version, replace the notes with what that OTA changes. The file ships inside the OTA, so "What's new" shows exactly those notes.
- Commit the notes with (or before) the version bump, then push to `main` (see `git-workflow`).

## 3. Build rules (always)

- **Never run an EAS cloud build** (`eas build …`, `npm run build:prod`, or anything else that builds on expo.dev). Always build locally with `npm run build:local`. If an EAS build is queued or in progress, cancel it: `npx eas-cli build:list --status in-progress` / `--status in-queue`, then `npx eas-cli build:cancel <id>`.
- **Before every build, delete the old APK and AAB files on this PC**, so the only build left is the one being released. Look in the repo root, `android/app/build/outputs/`, Downloads, Desktop, Documents and the agent scratchpads (`AppData/Local/Temp/claude`):
  ```bash
  find /c/Users/aaron/Github/Ourlime-Web /c/Users/aaron/Downloads /c/Users/aaron/Desktop /c/Users/aaron/Documents /c/Users/aaron/AppData/Local/Temp/claude -maxdepth 6 \( -iname "*.apk" -o -iname "*.aab" \) -not -path "*/node_modules/*" -not -path "*/intermediates/*"
  ```
  List what you found, then `rm` it. Never delete anything under `node_modules` or the Android SDK.
- **Play Store bundles** (`com.ourlime.mobile`) must also be built locally, signed with the Play upload key (the EAS key, SHA-1 `8E:EE:1D:44…`). Download that keystore once with `npx eas-cli credentials -p android` and keep it out of git. Until the local signing setup exists, stop and tell the user instead of building on EAS.

## 4. APK or OTA

| What changed | Release |
|---|---|
| Only JS/TS, images, copy | **OTA** (`docs/app-updates/OTA.md`) |
| Native packages, `plugins/`, permissions, `app.json` native keys, SDK bump | **APK** (`docs/app-updates/RELEASING.md`) |

When unsure, ship an APK.

### APK (sideload testers, package `com.ourlime.app`)
1. Bump `expo.version` and `expo.android.versionCode` in `app.json`, and update `lib/releaseNotes.json`.
2. `npm run build:local`. **Only local builds** are signed with the testers' key (`fac61745…033b9c`). EAS cloud builds (`eas build --profile preview`) are signed `86437d…` and can't install over them (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Don't publish an EAS APK to the update prompt.
3. Test it on the emulator (`adb install -r` works over the debug dev client, which has the same key).
4. Dry run with `node scripts/publish-android-release.cjs --dry-run`. The notes default to `lib/releaseNotes.json`.
5. Publish (the user runs it, because it writes production Storage and Firestore):
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=<key> node scripts/publish-android-release.cjs
   ```
   What users see:
   - **Open apps** show "Update available" within seconds, through the live `siteConfig/mobileApp` listener.
   - **Everyone else** sees it on the next launch, or when they come back to the app.
   - **Closed apps** get the push "Ourlime update available" from the `notifyAppUpdate` Cloud Function (web repo, codebase `reliability`). It sends once per versionCode and records each one in `appUpdatePushes/{versionCode}`.

   Only builds from 2026-10-17 onward (with the in-app updater and push routing) react to either.

### OTA (same native build, JS only)
1. Update `lib/releaseNotes.json` with the OTA's changes, then commit and push.
2. The user runs it:
   ```bash
   npx eas-cli@latest update --channel production --environment production --message "<short summary>"
   ```
3. It reaches installs whose `expo.version` matches (runtime `appVersion`) and whose channel is `production`. That covers local builds; EAS `preview` builds are on the `preview` channel. Apps check on launch and on foreground (at most every 10 minutes), download in the background, offer "Restart now", and apply the update on the next cold start anyway.

### Play Store (`com.ourlime.mobile`)
A locally built AAB, uploaded in Play Console (see section 3, and memory `play-release-state`).

## 5. Hand-off message

Tell the user the version and versionCode, the notes as bullets, the APK or update link, the exact publish command, and what testers will see.
