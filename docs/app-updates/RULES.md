# App updates: Firestore and Storage rules

These live in `Ourlime-Web/firestore.rules` and `Ourlime-Web/storage.rules`, not in this repo. Nothing here has been deployed.

## Firestore: `siteConfig/mobileApp` (no change needed)

The current rule (`firestore.rules`, around line 1629) already gives the in-app updater what it needs. Anyone can read the doc, signed in or not, and only administrators can write it:

```
// siteConfig/general only holds the registration mode, which the sign-up screen reads before login.
// siteConfig/mobileApp holds the minimum app version and store links, which the app reads before login.
match /siteConfig/{configId} {
  allow get: if configId in ['general', 'mobileApp'] || isAdministrator();
  allow list: if isAdministrator();
  allow create, update: if isAdministrator();
  allow delete: if false;
}
```

The app reads the doc with `getDoc` and `onSnapshot`. A listener on a single document counts as a `get`, so it is allowed.

The publish script writes with the Admin SDK, which bypasses rules. If you edit releases from the Firebase console, that bypasses rules too.

Optional: you can update the comment to mention the new release fields (`latestVersion`, `latestVersionCode`, `apkUrl`, `apkSha256`, `apkSizeBytes`, `releaseNotes`, `releasedAt`, `otaAvailable`, `sideloadUpdates`).

### `appUpdatePushes/{versionCode}` (new, written by the function only)

`notifyAppUpdate` writes this collection to send each version's push once. Clients never read or write it, so it needs no rule. Check that no broad `match /{document=**}` rule above it grants access; the current file has none.

## Storage: public APK downloads (new)

Add this inside `match /b/{bucket}/o { … }` in `storage.rules`, above the closing `match /{allPaths=**} { allow read, write: if false; }`. Without it, that catch-all denies the download.

```
// In-app update APKs (Ourlime-Mobile scripts/publish-android-release.cjs). Public download: the app checks the
// SHA-256 published in siteConfig/mobileApp before installing, and Android checks the signing key.
// Uploads happen only with the Admin SDK (publish script) or the console, both of which bypass rules.
match /app-releases/android/{versionCode}/{fileName} {
  allow read: if true;
  allow write: if false;
}
```

The app downloads from
`https://firebasestorage.googleapis.com/v0/b/ourlime-919f2.appspot.com/o/app-releases%2Fandroid%2F<versionCode>%2FOurlime.apk?alt=media`.
That URL works without a download token because the rule allows public reads.

**Cost:** each update download is about 450 MB of Storage egress per device. See "APK size" in `README.md`. Any other HTTPS host works too; the app only needs `apkUrl`, `apkSha256` and `apkSizeBytes`.
