# Native Build & Standalone Stability Rules

## Scope Control

Use native build work only when explicitly requested or strictly necessary for the requested native change. Do not run extra builds, modify unrelated native code, or broaden the task; report optional work separately.

## 1. Firebase Configuration Integrity
- **Real `google-services.json`**: Always use genuine client config downloaded from Firebase Console for `com.ourlime.app`. Never commit dummy placeholder values or server private keys.
- **Config Plugin Parity**: Every `@react-native-firebase/*` package in `package.json` that requires native Gradle hooks (like `@react-native-firebase/crashlytics`) MUST be listed in `app.json` plugins.

## 2. TurboModules & Native Module Safety
- **Platform-Specific Imports**: Never import platform-specific native modules (e.g. CallKit/CallKeep) globally or on Android without explicit `Platform.OS === 'ios'` guards and `try/catch`.
- **Method Overload Conflicts**: Be aware that React Native 0.76+ TurboModules rejects Java classes with duplicate `@ReactMethod` names. Always fall back gracefully to in-app WebSocket/FCM flows.

## 3. Prebuild & Gradle Configuration
- Keep `app.json` (`expo-build-properties`) and `android/gradle.properties` synchronized.
- Standalone builds do not have Expo Go's pre-initialized sandbox environment; all native permissions and module lifecycle states must be explicitly handled.
