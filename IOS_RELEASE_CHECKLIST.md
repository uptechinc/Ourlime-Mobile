# Ourlime iOS Release Checklist

This project uses the existing Expo/React Native application and Continuous Native Generation (CNG). The native Xcode project is generated from `app.json` and the repository config plugins. The production identity is **Ourlime** with bundle ID **`com.ourlime.app`**.

## Build foundation

- [x] Bundle identifier is `com.ourlime.app`.
- [x] Display name, icon, splash screen, automatic light/dark appearance, safe-area navigation, and native stack gestures are configured.
- [x] iOS deployment target and build number are configured.
- [x] Camera, microphone, photo library, and foreground-location purpose strings describe actual app features.
- [x] React Native Firebase uses static iOS frameworks.
- [x] Firebase App, App Check, Auth, Crashlytics, and Messaging config plugins are registered.
- [x] Remote and background notifications are enabled in the Expo notification plugin.
- [x] Universal-link routes are represented by `docs/ios/apple-app-site-association`.
- [x] Genuine Firebase `GoogleService-Info.plist` for `com.ourlime.app` is present and points to `ourlime-919f2`.
- [x] The iOS App Check bootstrap is isolated from Android; Android does not initialize or autolink the new module.
- [ ] Generate the native project on macOS with `npx expo prebuild --platform ios --clean`.
- [ ] Run `npx expo run:ios --device` and archive a Release build in Xcode.

## Apple Developer and signing

- [ ] Enrol the publishing legal entity in the Apple Developer Program.
- [ ] Register the explicit App ID `com.ourlime.app`.
- [ ] Enable Associated Domains and Push Notifications for the App ID.
- [ ] Confirm VoIP/PushKit use is accepted for Ourlime's real-time calling feature.
- [ ] Create or let Xcode manage an Apple Distribution certificate and App Store provisioning profile.
- [ ] Create an APNs authentication key and configure it with the push provider used by Ourlime.
- [ ] Verify the generated entitlements contain Associated Domains and the correct APNs environment for the signed build.

## Firebase

- [x] Apple app `com.ourlime.app` is registered in the existing Ourlime Firebase project.
- [x] `GoogleService-Info.plist` has the expected `BUNDLE_ID` and `PROJECT_ID` values.
- [ ] Upload the APNs authentication key in Firebase Cloud Messaging if Firebase will deliver iOS notifications.
- [x] Static configuration confirms Auth, Firestore, Storage, Functions, Crashlytics, and Messaging use project `ourlime-919f2`.
- [ ] Confirm those services at runtime from the Mac Simulator and a signed physical-device build.
- [ ] Test security rules with a normal account, seller account, moderator account, and signed-out user.

## Universal links

- [ ] Replace `APPLE_TEAM_ID` in `docs/ios/apple-app-site-association` with the real Apple Team ID.
- [ ] Publish that JSON, without a file extension or redirect, at `https://ourlime.com/.well-known/apple-app-site-association`.
- [ ] Serve it as `application/json` over HTTPS and keep normal website fallbacks working.
- [ ] Add `applinks:www.ourlime.com` only after the `www` host serves the same valid association file.
- [ ] Test listing, profile, community, blog, Lime, event, job, Market, and EHub links on a physical iPhone.

## App Store Connect

- [ ] Create the App Store Connect app using the registered `com.ourlime.app` App ID.
- [ ] Complete app name, subtitle, description, keywords, support URL, marketing URL, and privacy-policy URL.
- [ ] Supply truthful iPhone and, because tablet support is enabled, iPad screenshots from the final build.
- [ ] Complete App Privacy answers from the actual data flows and SDKs.
- [ ] Complete age rating and user-generated-content declarations.
- [ ] Add App Review notes explaining Market versus EHub, moderation/reporting/blocking, and VoIP calling.
- [ ] Provide stable review credentials for every account type needed to review gated functionality.
- [ ] State accurately that physical goods/services do not use in-app purchase; separately review any future digital purchases against guideline 3.1.
- [ ] Upload to TestFlight, complete export-compliance questions, and test before submission.

## Product and compliance verification

- [x] Account deletion is available in Settings.
- [x] Privacy, terms, child-safety, reporting, and blocking flows exist in the mobile app.
- [x] Market and EHub remain separate product systems.
- [ ] Verify account deletion removes associated user data and user-generated content except documented lawful retention.
- [ ] Verify privacy and terms text matches actual mobile data collection, retention, deletion, and third-party SDK use.
- [ ] Test denied/restricted permissions and confirm each feature has a usable fallback.
- [ ] Test foreground, background, terminated, token-refresh, notification-tap, incoming-call, missed-call, and logout token-cleanup behaviour.
- [ ] Test login, registration, reset password, profile editing, uploads, Market, EHub, chat, reporting, blocking, saved items, and settings on physical devices.
- [ ] Run VoiceOver, Dynamic Type/readability, contrast, keyboard, notch/Dynamic Island, rotation, and iPad layout checks.
- [ ] Review Xcode's generated Privacy Report and all bundled SDK privacy manifests before upload.

## Final release gate

- [ ] TypeScript, lint, discipline checks, relevant tests, Expo Doctor, and iOS config inspection pass.
- [ ] No `.p8`, `.p12`, provisioning profile, service-account key, `.env`, or private credential is committed.
- [ ] Crashlytics launches without a missing build ID and receives a non-production test event.
- [ ] TestFlight build passes smoke tests on the minimum supported iOS version and current iOS.
- [ ] Version/build values are unique and release notes describe all user-visible changes.
- [ ] App Store metadata, privacy disclosures, review notes, and screenshots match the submitted binary.
