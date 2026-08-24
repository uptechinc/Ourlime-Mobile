---
name: native-build-stability
description: Guidelines and best practices for standalone React Native / Expo APK and iOS builds, native Firebase configuration, TurboModules compatibility, and native module isolation.
---

# Native Build Stability & Standalone APK/IPA Guidelines

## Scope Control

Use this skill only when native build work is explicitly requested or strictly necessary for the requested native change. Do not run extra builds, modify unrelated native code, or broaden the task; report optional work separately.

This skill documents critical practices to ensure standalone production/preview builds (`.apk`, `.aab`, `.ipa`) run smoothly without native startup crashes or TurboModule reflection failures.

---

## 1. Firebase Configuration & Google Services

### Critical Rule: Genuine Client Config Files
- **Android**: [`google-services.json`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/google-services.json) must come directly from Firebase Console under the matching Android package name (`com.ourlime.app`).
- **Never use placeholders or Service Account keys**: Placing dummy keys or backend service account keys (`"type": "service_account"`) causes `FirebaseInitProvider` to crash the JVM during native process startup before JavaScript runs.
- **Config Plugin Matching**: If `@react-native-firebase/crashlytics` (or `@react-native-firebase/messaging`) is in `package.json`, its corresponding config plugin **must** be declared in [`app.json`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/app.json) under `plugins`:
  ```json
  "plugins": [
    "@react-native-firebase/app",
    "@react-native-firebase/crashlytics",
    "@react-native-firebase/messaging"
  ]
  ```
  *Omission causes: `IllegalStateException: The Crashlytics build ID is missing`.*

---

## 2. TurboModules & Native Module Compatibility (React Native 0.76+)

### Issue: Overloaded `@ReactMethod` in Legacy Libraries
- In React Native 0.76+ and New Architecture, the `TurboModuleInteropUtils` reflection parser scans all native modules.
- If a legacy library exports multiple `@ReactMethod` annotations with the **same Java method name** (e.g. `react-native-callkeep`'s `displayIncomingCall`), TurboModules throws a fatal `ParsingException` on Android.

### Standard Fix Pattern: Platform Isolation & Lazy Imports
1. **Never import incompatible native modules at top-level** or on platforms where they are broken.
2. Guard platform-specific libraries:
   ```typescript
   if (Platform.OS === 'ios') {
     try {
       const RNCallKeep = (await import('react-native-callkeep')).default;
       await RNCallKeep.setup(...);
     } catch (error: unknown) {
       logger.warn('CallKeep', 'setup-failed', { error });
     }
   }
   ```
3. Use fallback channels (e.g., FCM push notifications + in-app calling overlay with Agora RTC) for platforms where legacy telephony bridges conflict with TurboModules.

---

## 3. Prebuild & `gradle.properties` Synchronization

- When an `android/` directory is committed in the repository, EAS Build compiles using that committed directory directly.
- Ensure properties in [`android/gradle.properties`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/android/gradle.properties) align with your [`app.json`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/app.json) `expo-build-properties`.

---

## 4. Standalone Debugging Checklist

When diagnosing crashes in standalone APKs:
1. Clear device logcat buffer:
   ```cmd
   adb logcat -c
   ```
2. Stream fatal runtime exceptions in real-time:
   ```cmd
   adb logcat AndroidRuntime:E ReactNativeJS:E *:S
   ```
3. Look for:
   - **`FirebaseInitProvider` / `IllegalStateException`**: Missing or malformed `google-services.json` or missing Firebase Gradle plugins in `app.json`.
   - **`TurboModuleInteropUtils$ParsingException`**: Incompatible `@ReactMethod` overloads in third-party native libraries.
   - **`NullPointerException` / `HostObject::get`**: Native module accessed before permissions or on unsupported platform.
