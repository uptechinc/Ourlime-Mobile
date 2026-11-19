# Ourlime iOS Developer Handoff

Prepared November 18, 2026. The repository remains a single Expo/React Native codebase for Android and iOS. iOS uses bundle ID `com.ourlime.app` and the existing Firebase project `ourlime-919f2`.

## What has been completed

- Pulled and reconciled the latest `origin/main` before preparing the handoff.
- Added the genuine `GoogleService-Info.plist` for `com.ourlime.app`.
- Pointed iOS to the existing Firebase project, default Firestore database, Storage bucket, Auth users, Functions, Messaging, and Crashlytics configuration. No new database or Firebase project was created.
- Configured static iOS frameworks and Firebase Expo config plugins.
- Added iOS App Check initialization before Expo Router, using the debug provider in development and App Attest with DeviceCheck fallback in production.
- Enabled native iOS FCM token registration and refresh handling while preserving the existing Android FCM path.
- Added iOS permission descriptions, remote/background notification configuration, deployment target, build number, and encryption declaration.
- Kept Associated Domains for `ourlime.com` and added an `apple-app-site-association` template.
- Removed a hard-coded development APNs entitlement so signing can supply the correct environment.
- Added `npm run verify:ios-firebase` to verify bundle/project/backend identities and Android isolation.
- Excluded the iOS-only App Check native module from Android autolinking and made its runtime bootstrap iOS-only.
- Migrated the unusable legacy/corrupt Bun lock artifact to a valid Bun text lockfile containing the new dependency.

## What still requires the Mac developer

1. Enroll the publishing organization and invite the developer by following `docs/ios/APPLE_DEVELOPER_ENROLLMENT.md`.
2. On the Mac, install Xcode and Bun, clone/pull the repository, and run `bun install --frozen-lockfile`.
3. Run `npm run verify:ios-firebase`, `npm run typecheck`, `npm run lint`, `npm run check:discipline`, and `npx expo-doctor`.
4. Generate iOS with `npx expo prebuild --platform ios --clean`, install pods, and open the generated `.xcworkspace`.
5. Run an iPhone Simulator build. Register the printed Firebase App Check debug token in Firebase Console.
6. After membership activation, select the organization team, register `com.ourlime.app`, enable required capabilities, and run on a physical iPhone.
7. Create/store an APNs `.p8` key securely and upload it to the existing Firebase project's Cloud Messaging settings.
8. Replace `APPLE_TEAM_ID` in the association file and publish it on `ourlime.com`.
9. Exercise the complete Simulator/device matrix, especially Auth, Firestore, Storage, notifications, deep links, calling, permissions, account deletion, Market, EHub, and chat.
10. Create the App Store Connect record, finish store/privacy metadata, upload to TestFlight, test, archive, and submit only after authorization.

## Mac quick start

```bash
git pull --ff-only
bun install --frozen-lockfile
npm run verify:ios-firebase
npm run typecheck
npm run lint
npm run check:discipline
npx expo-doctor
npx expo prebuild --platform ios --clean
npx pod-install ios
open ios/*.xcworkspace
```

Do not use `--clean` if the generated `ios/` folder contains manual work that has not been represented in a config plugin.

## Android protection and validation

- Android package remains `com.ourlime.app`.
- Android still points to the existing `google-services.json` and Firebase project `ourlime-919f2`.
- App Check initialization returns immediately on Android.
- `@react-native-firebase/app-check` is excluded from Android native autolinking.
- The native push change reuses the same Android Firebase Messaging token path; only iOS adds `registerDeviceForRemoteMessages`.
- No Android manifest, Gradle source, signing key, version code, or Play release history was changed for this handoff.

The Mac developer should still run an Android smoke build/test before the iOS commit is promoted to a production release.

## Repository guides and their purpose

- `docs/ios/DEVELOPER_HANDOFF.md` - this status summary, remaining work, quick start, and Android safeguards.
- `docs/ios/APPLE_DEVELOPER_ENROLLMENT.md` - organization enrollment, roles, App ID/capabilities, APNs, and App Store Connect setup.
- `docs/ios/MAC_TESTING_GUIDE.md` - Xcode/CocoaPods generation, Simulator setup, App Check debug token, test matrix, and diagnostics.
- `docs/ios/FIREBASE_APP_CHECK.md` - App Check providers, enforcement warning, and iOS-only isolation.
- `IOS_MANUAL_SETUP.md` - owner/account tasks grouped by what needs Apple membership, a Mac, or publication authority.
- `IOS_RELEASE_CHECKLIST.md` - signing, Firebase, links, store metadata, compliance, device tests, and final release gates.
- `docs/ios/apple-app-site-association` - template that must receive the real Apple Team ID and be deployed to the website.
- `.agents/skills/native-build-stability/SKILL.md` - project-specific native-build and Firebase stability rules for coding agents.

## Secrets and operational cautions

- The Firebase plist is app configuration, not an administrator credential. It must still be limited to the intended bundle/project.
- Never commit Apple `.p8`, `.p12`, `.mobileprovision`, service-account JSON, passwords, two-factor codes, or App Check debug tokens.
- Keep Firebase App Check enforcement disabled until valid traffic is confirmed for Android, iOS, and web; enabling it prematurely can block production clients.
- Keep Market and EHub separate in testing and App Review notes.
- Use organization-owned accounts and invite individual developers; do not share a single account.
