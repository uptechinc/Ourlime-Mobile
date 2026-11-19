# Ourlime iOS Mac Testing Guide

Ourlime uses Expo Continuous Native Generation (CNG). Treat `app.json` and files in `plugins/` as the source of truth; generate `ios/` on the Mac rather than hand-maintaining a Windows-generated Xcode project.

## 1. Prepare the Mac

1. Install the current stable Xcode supported by Expo SDK 57.
2. Open Xcode once, accept the licence, and install the requested platform components.
3. Install Xcode command-line tools:

   ```bash
   xcode-select --install
   sudo xcodebuild -license accept
   ```

4. Install the current Node.js version required by the repository and Bun 1.4 or later.
5. Clone the repository and enter its root directory.

No paid Apple membership is needed for Simulator testing.

## 2. Install dependencies

The repository declares Bun through `bun.lock`:

```bash
bun install --frozen-lockfile
```

The tracked `bun.lock` is a Bun text lockfile and includes the iOS App Check dependency. Do not switch package managers or regenerate it casually.

## 3. Verify Firebase configuration

Confirm the genuine plist is present at the repository root, then run:

```bash
npm run verify:ios-firebase
```

Expected identities:

```text
Bundle: com.ourlime.app
Project: ourlime-919f2
Firestore: projects/ourlime-919f2/databases/(default)
Storage: gs://ourlime-919f2.appspot.com
```

Never replace `GoogleService-Info.plist` with a service-account JSON file.

## 4. Run source checks

```bash
npm run typecheck
npm run lint
npm run check:discipline
npm run verify:ios-firebase
npx expo-doctor
```

Run relevant tests reported by `git diff --name-only`. Do not point tests at production users, Firestore documents, or Storage objects; use existing unit tests or configured emulators.

## 5. Generate the native iOS project safely

Before generation, confirm there is no manually maintained `ios/` directory:

```bash
git status --short
test ! -d ios || git status --short ios
```

If `ios/` is absent or contains only generated, disposable files:

```bash
npx expo prebuild --platform ios --clean
```

Do not use `--clean` if `ios/` contains unautomated manual work. Move that work into an Expo config plugin first.

Inspect the resolved native configuration:

```bash
npx expo config --type introspect
```

Confirm:

- bundle ID `com.ourlime.app`
- `GoogleService-Info.plist` is copied into the target
- Associated Domains contains `applinks:ourlime.com`
- notification and background modes exist
- Firebase pods use static frameworks
- the App Check plugin initializes before Firebase

## 6. Open and run with Xcode

Install CocoaPods through Expo and open the workspace:

```bash
npx pod-install ios
open ios/Ourlime.xcworkspace
```

If the generated workspace name differs, open the only `.xcworkspace` inside `ios/`.

In Xcode:

1. Select an iPhone Simulator.
2. Leave automatic signing disabled if Xcode does not require it for the Simulator.
3. Choose the Debug configuration.
4. Run the Ourlime scheme.
5. Keep the Xcode console visible for Firebase, App Check, notification, and crash output.

Alternatively:

```bash
npx expo run:ios
```

## 7. Configure App Check for Simulator development

The app uses the debug provider in `__DEV__` and App Attest with DeviceCheck fallback in production. It does not contain a debug secret.

1. Launch the Debug build in the Simulator.
2. Copy the App Check debug token printed in the Xcode console.
3. In Firebase Console, open **App Check → Apps → Ourlime iOS → Manage debug tokens**.
4. Register that token.
5. Keep App Check enforcement disabled until metrics confirm every active client is valid.

Never commit or paste a debug token into `app.json`, source files, or GitHub.

## 8. Test authentication and Firebase

Use a dedicated test account and Firebase test phone numbers where configured.

- Register with email/password and confirm the user profile document is created.
- Restart the app and confirm the authenticated session restores.
- Send password reset and email verification flows only to controlled test addresses.
- Test phone authentication with Firebase Console test numbers; do not generate unnecessary real SMS.
- Read and update the test profile in the existing default Firestore database.
- Upload, display, download, replace, and delete test profile/listing media in the existing Storage bucket.
- Log out and confirm notification tokens and local authenticated state are cleaned up.
- Request account deletion and verify the documented cleanup path using test data only.

## 9. Test navigation and core journeys

Exercise at minimum:

- registration, login, reset, verification, logout, and account deletion
- Home, Discover, Search, profiles, saved items, and settings
- Market person-to-person listings, creation, editing, enquiries, reporting, and blocking
- EHub business profile, seller catalog, product editing, discovery, and enquiries
- chat, image/media selection, uploads, foreground notifications, and notification-tap navigation
- `ourlime://` deep links and HTTPS routes represented by `docs/ios/apple-app-site-association`
- denied camera, microphone, photo, location, and notification permissions
- keyboard, safe-area, dark mode, Dynamic Type, and VoiceOver behavior

Market and EHub must remain separate throughout testing.

## 10. Diagnose native failures

Capture the first native error, not only the final build summary:

```bash
npx expo run:ios --no-build-cache
```

In Xcode, inspect:

- Report navigator build logs
- target **Build Phases** and **Signing & Capabilities**
- generated entitlements and `Info.plist`
- CocoaPods errors in `ios/Podfile.lock`
- runtime console messages before the JavaScript bundle starts

For Firebase startup failures, verify the plist bundle/project IDs and static frameworks first. For App Check, distinguish an unregistered Simulator debug token from a native initialization failure.

## 11. Prepare for physical-device testing

Without paid membership, Xcode may offer limited personal-team device signing, but capabilities such as production push notifications, Associated Domains, App Attest, and PushKit may not be available or representative.

After Apple Developer enrollment, first follow `docs/ios/APPLE_DEVELOPER_ENROLLMENT.md`, then:

1. Select the organization team in Xcode.
2. Register `com.ourlime.app` and required capabilities.
3. Regenerate provisioning profiles.
4. Configure APNs/FCM credentials.
5. Test ordinary notifications separately from VoIP PushKit calls on a physical iPhone.
6. Archive a Release build only after Simulator and device smoke tests pass.
