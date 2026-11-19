# Ourlime iOS Manual Setup

Codex has configured the repository for **Ourlime**, bundle ID **`com.ourlime.app`**, using the existing Firebase project **`ourlime-919f2`**. This list contains only work requiring your accounts, Mac, devices, legal decisions, or publication authority.

## Completed

- [x] Firebase iOS app registered for `com.ourlime.app`.
- [x] Genuine `GoogleService-Info.plist` added and verified against `ourlime-919f2`.
- [x] Existing Firestore database and Storage bucket retained; no new backend was created.
- [x] Native Firebase Auth, Firestore, Storage, Messaging, Crashlytics, and App Check dependencies/configuration prepared.
- [x] App Check development and production providers prepared without embedding debug secrets.
- [x] Universal Links association template prepared with an Apple Team ID placeholder.
- [x] Developer handoff, Apple enrollment, Mac testing, App Check, and release-checklist guides are present.

## A. Can complete now without Apple Developer membership

### Register an App Check Simulator debug token

- [ ] **What:** Register the debug token produced by an iOS Simulator development build.
- **Why:** The Simulator cannot produce App Attest or DeviceCheck attestations.
- **Where:** Firebase Console → App Check → Apps → Ourlime iOS → Manage debug tokens.
- **Steps:** Run the app from Xcode; copy the token printed in the Xcode console; register it with a descriptive name; keep it out of source control.
- **Give Codex afterward:** Confirmation only, never the token.
- **Blocks:** Simulator Firebase access only if App Check enforcement is enabled. Keep enforcement disabled for now.

### Confirm test accounts and Firebase test phone numbers

- [ ] **What:** Create dedicated non-production test identities and configure Firebase test phone numbers.
- **Why:** Prevents altering real users and avoids unnecessary SMS traffic.
- **Where:** Firebase Console → Authentication → Sign-in method → Phone → Phone numbers for testing.
- **Steps:** Add fictional test numbers/codes; create a controlled email test account; never reuse customer credentials.
- **Give Codex afterward:** Test scenarios, not passwords or SMS codes.
- **Blocks:** Safe phone-auth testing; does not block email-auth development.

### Review legal and privacy behavior

- [ ] **What:** Confirm privacy, retention, account deletion, moderation, and child-safety statements match business policy.
- **Why:** Codex cannot make legal or retention decisions for Ourlime.
- **Where:** Ourlime legal/business owner and production privacy/terms pages.
- **Steps:** Review collected data and Firebase/Crashlytics/Messaging use; define deletion and lawful-retention rules; confirm reporting/blocking processes; approve any text changes.
- **Give Codex afterward:** Approved wording and concrete retention rules.
- **Blocks:** App Store submission, not Simulator development.

## B. Requires macOS/Xcode but not paid membership

### Generate and run the native project

- [ ] **What:** Generate the iOS project and run Ourlime in an iPhone Simulator.
- **Why:** Windows cannot run CocoaPods, Xcode, or the iOS Simulator.
- **Where:** A Mac following `docs/ios/MAC_TESTING_GUIDE.md`.
- **Steps:** Install dependencies; run `npm run verify:ios-firebase`; run source checks; use `npx expo prebuild --platform ios --clean` only after confirming `ios/` has no manual work; run `npx expo run:ios` or open the generated workspace in Xcode.
- **Give Codex afterward:** Complete first-error build logs and test results.
- **Blocks:** Native iOS compilation and Simulator verification.

### Execute the Simulator test matrix

- [ ] **What:** Test authentication, Firestore, Storage, navigation, uploads, Market, EHub, chat, account deletion, permissions, accessibility, and error states.
- **Why:** Static configuration cannot prove native runtime behavior.
- **Where:** Xcode iPhone Simulator and the existing Firebase test configuration.
- **Steps:** Follow sections 8–10 of `docs/ios/MAC_TESTING_GUIDE.md`; use only test accounts/data; keep Market and EHub separate; record failures with screenshots and Xcode logs.
- **Give Codex afterward:** Reproduction steps and logs without secrets.
- **Blocks:** Confidence for physical-device testing.

## C. Requires Apple Developer membership

### Enroll the publishing organization

- [ ] **What:** Activate Apple Developer Program membership for Ourlime's publishing legal entity.
- **Why:** Required for full capabilities, organization signing, TestFlight, and App Store distribution.
- **Where:** Apple Developer → Membership.
- **Steps:** Follow `docs/ios/APPLE_DEVELOPER_ENROLLMENT.md`. Enroll the correct legal entity; complete identity/D-U-N-S and agreements; pay the membership fee; wait for activation.
- **Give Codex afterward:** Apple Team ID and confirmed legal entity name. Never share passwords or verification codes.
- **Blocks:** Production signing, TestFlight, and App Store submission.

### Register the App ID and capabilities

- [ ] **What:** Register explicit App ID `com.ourlime.app` and enable required capabilities.
- **Why:** Signing, Associated Domains, APNs, App Attest, and PushKit must belong to the same Apple identity.
- **Where:** Apple Developer → Certificates, Identifiers & Profiles → Identifiers.
- **Steps:** Register `com.ourlime.app`; enable Associated Domains and Push Notifications; configure App Attest/DeviceCheck as supported; confirm legitimate VoIP/PushKit entitlement use for Ourlime calls.
- **Give Codex afterward:** Team ID and enabled-capability list.
- **Blocks:** Production universal links, push, App Check attestation, VoIP calls, and distribution.

### Configure signing and notification credentials

- [ ] **What:** Create or let Xcode manage distribution certificates/profiles and configure an APNs key.
- **Why:** Physical-device distribution and notifications require Apple-issued credentials.
- **Where:** Apple Developer, Xcode Signing & Capabilities, Firebase Cloud Messaging, and the authorized Ourlime push provider.
- **Steps:** Create an APNs `.p8` key; record Key ID/Team ID; store it in a secure vault; upload it to Firebase/authorized provider; create the App Store provisioning profile. Never commit keys, `.p12`, or provisioning profiles.
- **Give Codex afterward:** Confirmation and non-secret IDs only.
- **Blocks:** Production notifications, reliable physical-device push/call tests, TestFlight, and App Store distribution.

### Publish Universal Links association

- [ ] **What:** Replace `APPLE_TEAM_ID` in `docs/ios/apple-app-site-association` and publish it.
- **Why:** Apple validates both the app entitlement and website association file.
- **Where:** Ourlime production web repository/host.
- **Steps:** Insert the real Team ID; publish at `https://ourlime.com/.well-known/apple-app-site-association` without extension or redirect and with `application/json`; preserve browser fallbacks; do not add `www` unless it serves the same valid file.
- **Give Codex afterward:** Team ID and live response confirmation.
- **Blocks:** Production Universal Links, not custom-scheme links.

## D. Required only before TestFlight/App Store submission

### Create the App Store Connect record

- [ ] **What:** Create the Ourlime iOS app record using `com.ourlime.app`.
- **Why:** Archives need a permanent App Store destination.
- **Where:** App Store Connect → Apps → New App.
- **Steps:** Choose iOS, Ourlime, the exact bundle ID, a unique SKU, and appropriate access; record the numeric App ID.
- **Give Codex afterward:** Numeric App Store Connect App ID and non-secret metadata.
- **Blocks:** TestFlight upload and App Store submission.

### Complete store metadata and disclosures

- [ ] **What:** Supply approved descriptions, URLs, screenshots, privacy answers, age rating, content rights, availability, and review information.
- **Why:** These are business declarations and must match the submitted binary.
- **Where:** App Store Connect.
- **Steps:** Capture real final-build iPhone and iPad screenshots while tablet support remains enabled; complete App Privacy truthfully; explain Market versus EHub, moderation, permissions, and calling; provide stable review credentials for required roles.
- **Give Codex afterward:** Draft metadata/screenshots for review, but keep live review passwords only in App Store Connect.
- **Blocks:** App Review submission.

### TestFlight and release decision

- [ ] **What:** Upload a signed archive, complete testing, and authorize submission.
- **Why:** Physical-device notification, PushKit, App Check, signing, and production behavior require final verification.
- **Where:** Xcode Organizer and App Store Connect → TestFlight/App Store.
- **Steps:** Validate/archive a Release build; answer export-compliance questions truthfully; test the complete `IOS_RELEASE_CHECKLIST.md`; fix failures; select the tested build; choose release timing; submit only when authorized.
- **Give Codex afterward:** Build logs, crash reports, and test results.
- **Blocks:** Final App Store release.
