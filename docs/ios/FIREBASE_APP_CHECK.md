# Firebase App Check for Ourlime iOS

The native app initializes `@react-native-firebase/app-check` before Expo Router loads Firebase-backed screens.

- Development builds use the Firebase App Check debug provider.
- Production iOS builds use App Attest with DeviceCheck fallback.
- Android does not initialize or autolink this iOS App Check module, preserving the existing Android runtime and build behavior.
- Web App Check configuration is unchanged.
- No debug token or Apple credential is stored in the repository.
- Enforcement must remain disabled until all active Android, iOS, and web clients are registered and App Check metrics show valid traffic.

## Before Apple membership

Simulator builds can use the debug provider. Launch from Xcode, copy the generated debug token from the Xcode console, and register it in Firebase Console under **App Check → Apps → Ourlime iOS → Manage debug tokens**.

## After Apple membership

Register the iOS app for App Attest in Firebase, ensure the Apple Developer App ID/capabilities are correct, test on supported physical devices, monitor metrics, and only then plan staged enforcement for Authentication, Firestore, Storage, Realtime Database, and callable Functions.

Do not enable enforcement from this repository. Enforcement is a Firebase Console production decision and can block older clients immediately.
