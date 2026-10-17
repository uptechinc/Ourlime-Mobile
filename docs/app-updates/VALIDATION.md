# In-app updates: device validation

Run these on a **release APK built from this branch** (`npm run build:local`), installed on a real Android phone. The dev client can't test the APK or OTA paths: its binary has neither the native updater nor expo-updates enabled.

**Setup.** Build A is the current `app.json` version, for example `1.2.0` / versionCode `5`; install it. Build B is the same code with `version` `1.2.1` and `versionCode` `6`, built and kept aside. Publish B with `scripts/publish-android-release.cjs` when a step says so. To reset between runs, clear the app's storage (Settings → Apps → Ourlime → Storage → Clear storage) or reinstall A.

To fake states without publishing, edit `siteConfig/mobileApp` in the Firebase console. The app accepts any `latestVersionCode` above the installed one.

## 1. Live release while the app is open

1. Open Ourlime (signed in, or on the login screen).
2. Publish B, or set `latestVersionCode: 6` plus `releaseNotes` in the console.
3. **Expect:** within a few seconds, the "Update available" sheet with "Version 1.2.1 · NNN MB" and the notes as bullets.
4. Repeat on the login screen, signed out. **Expect:** the same; it works before sign-in.

## 2. Push for a closed app (needs `notifyAppUpdate` deployed)

1. Force-stop Ourlime. Publish a new versionCode.
2. **Expect:** an "Ourlime update available" notification. Tap it: the app cold-starts and the update sheet opens, even before sign-in finishes.
3. With the app open, publish another versionCode. **Expect:** an in-app banner, not a system notification. Tapping it opens the sheet.
4. Stale push: install the announced build, then send a push for the same versionCode with FCM test send (data `type=app_update`, `destinationKind=app_update`, `versionCode=<installed>`). **Expect:** with the app open, no banner; tapping a system notification for it opens nothing.

## 3. Later / snooze

1. With the sheet open, tap **Later**. Kill and reopen the app. **Expect:** no sheet.
2. Settings → App → **Check for updates**. **Expect:** the row says "Version … is available" and tapping it opens the sheet.
3. Publish a newer versionCode. **Expect:** the sheet appears right away; the snooze applies only to the version you dismissed.
4. After 24 hours (or change the device clock), the dismissed version prompts again.

## 4. APK path

1. **Permission flow.**
   - Steps: Settings → Apps → Special app access → Install unknown apps → Ourlime: Off. Tap **Update now**.
   - **Expect:**
     - The app explains the permission and shows **Open settings**, which goes to Ourlime's toggle.
     - Turn it on and press Back. The download starts by itself.
2. **Progress and cancel.**
   - **Expect:** a progress bar with "NN% · X of Y MB".
   - Tap **Cancel**. **Expect:** back to "Update available".
3. **Resume after a kill.**
   - Steps: start the download and kill the app at about 30%. Reopen it and tap **Update now**.
   - **Expect:** progress continues from about 30% (HTTP Range), not 0.
4. **Checksum mismatch.**
   - Steps: in the console, change one character of `apkSha256` and download.
   - **Expect:** "The download doesn't match the published update (checksum mismatch). It was discarded." Restore the hash.
5. **Wrong APK:**
   - Point `apkUrl`/`apkSha256`/`apkSizeBytes` at an APK with a lower versionCode. **Expect:** "This download (build N) isn't newer than the installed Ourlime (build M)."
   - Then point them at an APK signed with another key, for example one from another machine's debug keystore. **Expect:** "The download isn't signed with Ourlime's key…"
6. **Low storage.**
   - Steps: fill the device until less than (APK size + 50 MB) is free, then tap **Update now**.
   - **Expect:** "Not enough free space. The update needs about N MB…"
7. **Metered data.**
   - Steps: turn off Wi-Fi and use mobile data, then tap **Update now**.
   - **Expect:** "Download on mobile data? This update is N MB." **Wait for Wi-Fi** stops; **Download anyway** continues.
8. **Install.**
   - **Expect:** "Checking the download…", then Android's installer asks to update Ourlime. Confirm.
   - The app closes. An "Ourlime updated, tap to open" notification appears if notifications are allowed.
   - Open the app. **Expect:** "What's new in Ourlime 1.2.1" with the release notes, shown once; reopening doesn't show it again.
9. **Back out.**
   - Steps: when Android's installer appears, press Cancel.
   - **Expect:** the sheet shows "Ready to install" with **Install**, and no new download is needed.

## 5. OTA path

1. Install a build of this branch. Make a JavaScript-only change, for example a text tweak, and publish it with `npx eas-cli@latest update --channel production --environment production --message test`.
2. Reopen or foreground the app (or Settings → App → Check for updates). **Expect:**
   - the update downloads in the background
   - the sheet says "Update downloaded. Restart Ourlime to apply it."
3. **Restart now.** **Expect:** the app reloads with the change.
4. Publish another change. Tap **Later**, then kill the app and cold-start it. **Expect:** the change is live, and "What's new" shows once.
5. Dev client (`npx expo start`) and Expo Go: **expect** no OTA prompts and no errors.

## 6. `minimumVersion`

1. Set `minimumVersion` above the installed version, with B published.
2. **Expect:** the full-screen "Update Ourlime" screen, with the in-app download panel inside it. The download, verification and install work from there, and there is no Later.
3. Build with `extra.distribution: "play"`, or use a build without the native updater. **Expect:** the blocking screen's **Update now** opens the APK link (sideload) or Play (`market://`).

## 7. Calls and uploads

1. During a voice or video call, publish a release. **Expect:** no sheet during the call; it appears after hang-up.
2. With an OTA downloaded, start a call and tap **Restart now** (Settings → App). **Expect:** "Finish what you're doing first…", with no restart.
3. Start posting a large video. While it uploads, publish a release. **Expect:** no prompt until the upload finishes.
4. With an APK downloaded and verified while a call starts, **expect** the installer does not open until the call ends; then **Install** works.

## 8. Failure safety

1. Airplane mode at launch: the app works normally, with no update UI and no errors.
2. In the console, set `apkUrl: "http://example.com/x.apk"`, `apkSha256: "zzz"`, `latestVersionCode: "6"` (a string) or `releaseNotes: 5`.
   - **Expect:** the app runs normally.
   - Invalid fields are ignored. A string versionCode means no versionCode, so the version name is compared instead.
   - No crash and no repeated prompts.
3. Delete `siteConfig/mobileApp`: no update UI, and nothing is blocked.
4. Set `sideloadUpdates: false`: **Update now** opens the external link instead of downloading.
