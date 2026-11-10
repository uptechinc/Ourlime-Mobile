---
name: app-release
description: Ship an Ourlime production app update (Play release or OTA) with detailed release notes. Use for any app version bump, build, Play upload, OTA publish, or when changing lib/releaseHistory.json or siteConfig/mobileApp.
---

# App Release: Updates With Detailed Release Notes

Every app update tells people what changed. In "What's new" after updating, in "Update available" before it, and in **Settings → App → Release notes** at any time, they see a bulleted list of real changes, never just "fixes and improvements".

**The rule, for every model and every release (Play or OTA):** add one new entry at the top of `lib/releaseHistory.json`, run `npm run release:check`, and commit it before the build or `eas update`. Never edit or delete past entries: they are the app's release history. A release without its entry is not ready.

## 1. Know what is in the release before you push

- The notes cover **everything since the last published release**, not just the last commit. Several commits before a release become one list.
- Find the last release: the last commit that changed `lib/releaseHistory.json` (its top entry is the last thing shipped, Play or OTA). Then read the changes:
  ```bash
  git log --format="%h %s" <lastReleaseCommit>..HEAD
  ```
  Also check the live release: `siteConfig/mobileApp.latestVersion` / `latestVersionCode`. Read it; never write it from a script you made up.
- Keep commit subjects user-readable, saying what changed for the person using the app. They become the raw material for the notes.

## 2. Add the release to `lib/releaseHistory.json`

The file lists every release, **newest first**. Add the new one at the top of `releases`:

```json
{
  "id": "1.3.2",
  "version": "1.3.2",
  "versionCode": 11,
  "kind": "app",
  "date": "2026-11-05",
  "notes": ["…", "…"]
}
```

- `kind`: `"app"` for a Play release (new versionCode), `"ota"` for an over-the-air update to the same build.
- `id`: unique. The version for a Play release (`"1.3.2"`); `"<version>-ota-<date>"` for an OTA (`"1.3.2-ota-2026-11-07"`, add `-2` for a second OTA that day).
- `version` / `versionCode` must equal `app.json`, and `date` is the publish day (YYYY-MM-DD).
- Up to 12 notes, each under 240 characters. One bullet per feature or fix, in plain words for members ("Assignments: hand in a written answer and files, then see your grade"). No internal names, file paths or "parity".
- Order: new features first, biggest first. End with one "Fixes: …" bullet.
- An OTA's notes list only what that OTA changes; the earlier entries stay as they are.
- Run `npm run release:check`. It refuses a missing or duplicate id, an entry out of order, too many or too long notes, and a top entry that doesn't match `app.json`.
- How it is used: the file ships inside the app (and inside each OTA). "What's new" shows the newest entry for the running version, Settings → Release notes lists them all, and `scripts/publish-android-release.cjs` sends the `"app"` entry's notes to `siteConfig/mobileApp`.
- Commit the entry with (or before) the version bump, then push to `main` (see `git-workflow`).

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
1. Bump `expo.version` and `expo.android.versionCode` in `app.json` (greater than the last Play upload), add the `"app"` entry to `lib/releaseHistory.json`, and run `npm run release:check`.
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
   - After updating, "What's new" shows this release's entry from `lib/releaseHistory.json`.

### OTA (same native build, JS only)
1. Add an `"ota"` entry at the top of `lib/releaseHistory.json` with only this OTA's changes, run `npm run release:check`, then commit and push.
2. The user runs it with the publish script (publishes, then announces: push to Android phones plus the mandatory update sheet):
   ```bash
   set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\aaron\keys\ourlime-admin.json.json
   ```
   ```bash
   npm run ota:publish -- --message "<short summary>"
   ```
3. It reaches production installs whose `expo.version` matches (runtime `appVersion`). Apps check on launch, on foreground (at most every 10 minutes) and when the push is tapped, then show a mandatory "An update is ready" sheet (no Later); it downloads on **Update now** and restarts into it.

## 5. Hand-off message

Tell the user the version and versionCode, the notes as bullets (they also appear in Settings → Release notes), the .aab path and SHA-1, what is ready in Play Console, the announce command, and what users will see.
