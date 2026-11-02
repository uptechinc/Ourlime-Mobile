---
name: app-release
description: Ship an Ourlime production app update (Play release or OTA) with detailed release notes. Use for any app version bump, build, Play upload, OTA publish, or when changing lib/releaseNotes.json or siteConfig/mobileApp.
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

## 3. Production only (always)

- **Every release is a production build for the Play app `com.ourlime.mobile`.** No tester builds, no sideload APKs for `com.ourlime.app`, no "testers" publish step. `com.ourlime.app` exists only as the debug dev client on the emulator (`npm run build:local:debug`).
- **Never run an EAS cloud build** (`eas build …`, `npm run build:prod`, `build:preview`, or anything else that builds on expo.dev). If one is queued or in progress, cancel it: `npx eas-cli build:list --status in-progress` / `--status in-queue`, then `npx eas-cli build:cancel <id>`.
- **Build locally:** `npm run build:local` makes `Ourlime-<version>-vc<code>.aab` (package `com.ourlime.mobile`, `distribution: play`), signed with the Play upload key (SHA-1 `8E:EE:1D:44:7A:4D:0E:E9:5B:31:1F:FE:A7:4E:AC:C9:55:D6:38:05`). The script reads the key from `credentials.json` and stops when it's missing or the SHA-1 doesn't match. `npm run build:local:apk` builds the same production app as an APK for testing on the emulator.
  - If `credentials.json` is missing, stop and ask the user to run `npx eas-cli credentials -p android` → production → credentials.json → Download credentials from EAS to credentials.json. It is interactive, so the user runs it. Never commit `credentials.json` or `credentials/`.
- **Before every build, delete the old APK and AAB files on this PC**, so the only build left is the one being released. Look in the repo root, `android/app/build/outputs/`, Downloads, Desktop, Documents and the agent scratchpads (`AppData/Local/Temp/claude`):
  ```bash
  find /c/Users/aaron/Github/Ourlime-Web /c/Users/aaron/Downloads /c/Users/aaron/Desktop /c/Users/aaron/Documents /c/Users/aaron/AppData/Local/Temp/claude -maxdepth 6 \( -iname "*.apk" -o -iname "*.aab" \) -not -path "*/node_modules/*" -not -path "*/intermediates/*"
  ```
  List what you found, then `rm` it. Never delete anything under `node_modules` or the Android SDK.

## 4. Store release or OTA

| What changed | Release |
|---|---|
| Only JS/TS, images, copy | **OTA** to the production channel (`docs/app-updates/OTA.md`) |
| Native packages, `plugins/`, permissions, `app.json` native keys, SDK bump | **Play release** (`docs/app-updates/RELEASING.md`) |

When unsure, ship a Play release.

### Play release
1. Bump `expo.version` and `expo.android.versionCode` in `app.json` (greater than the last Play upload), and update `lib/releaseNotes.json`.
2. Delete old APK/AAB files, then `npm run build:local`. Check that the printed SHA-1 is the upload key.
3. Test the same production build on the emulator with `npm run build:local:apk` and `adb install`. It installs as `com.ourlime.mobile`, next to the dev client.
4. Open Play Console (account Uptech Incorporated, app `com.ourlime.mobile`), create a Production release, upload the .aab and add the notes. Show the user the version, versionCode, package and SHA-1. **The user clicks "Save and publish".**
5. After Play shows it live, the user announces it. This uploads nothing:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=<key> node scripts/publish-android-release.cjs
   ```
   It sets `latestVersion` / `latestVersionCode`, the notes, `androidStoreUrl` (the Play listing) and `sideloadUpdates: false`. What users see:
   - Open apps show "Update available" within seconds, and "Update now" opens Play.
   - Everyone else sees it on the next launch or foreground.
   - Closed apps get the push "Ourlime update available" from `notifyAppUpdate` (web repo, codebase `reliability`), once per versionCode.
   - After updating, "What's new" shows `lib/releaseNotes.json`.

### OTA (same native build, JS only)
1. Update `lib/releaseNotes.json` with the OTA's changes, then commit and push.
2. The user runs it:
   ```bash
   npx eas-cli@latest update --channel production --environment production --message "<short summary>"
   ```
3. It reaches production installs whose `expo.version` matches (runtime `appVersion`). Apps check on launch and on foreground (at most every 10 minutes), download in the background, offer "Restart now", and apply the update on the next cold start anyway.

## 5. Hand-off message

Tell the user the version and versionCode, the notes as bullets, the .aab path and SHA-1, what is ready in Play Console, the announce command, and what users will see.
